import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, parse, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const SHA256 = /^[a-f0-9]{64}$/u;
const POINTER_SCHEMA = 'munjanggun.gifSecondaryActiveCandidate.v1';
const LEDGER_SCHEMA = 'munjanggun.gifSecondarySemanticRawLedger.v1';
const VERIFICATION_SCHEMA = 'munjanggun.gifSecondaryReviewVerification.v1';
const REJECTION_SCHEMA = 'munjanggun.reviewDraftRejectionReceipt.v1';
const POINTER_STATUS = 'unsigned_candidate_not_authority';
const LEDGER_STATUS = 'unsigned_draft_active_candidate_not_authority';
const ACTIVE_CHAIN_STATUS = 'unsigned_active_candidate_not_authority';
const REJECTED_CHAIN_STATUS = 'rejected_superseded';

export async function validateGifSecondaryActiveCandidate({ activeCandidatePath, includeValidatedEvidence = false } = {}) {
  if (!activeCandidatePath) throw new Error('activeCandidatePath is required');
  const activePath = resolve(activeCandidatePath);
  await assertNoReparsePointChain(dirname(activePath), 'GIF active candidate parent');
  const active = await readJsonRegularFile(activePath, 'GIF active candidate pointer');
  const root = dirname(active.path);
  const rootReal = await realpath(root);
  const pointer = active.value;
  if (pointer.schema !== POINTER_SCHEMA || pointer.version !== '1.0' || pointer.status !== POINTER_STATUS) {
    throw new Error('GIF active candidate pointer schema or current status is invalid');
  }
  if (!Array.isArray(pointer.correctionChain) || pointer.correctionChain.length < 2) {
    throw new Error('GIF correction chain is missing');
  }
  if (!pointer.activeCandidate?.path || !SHA256.test(pointer.activeCandidate?.sha256 ?? '')) {
    throw new Error('GIF active candidate exact path/hash is missing');
  }
  if (!pointer.verification?.path) throw new Error('GIF active candidate verification path is missing');
  assertExpectedTotals(pointer.expectedScreeningTotals);

  const chain = [];
  const seenPaths = new Set();
  const seenHashes = new Set();
  for (let index = 0; index < pointer.correctionChain.length; index += 1) {
    const item = pointer.correctionChain[index];
    if (!item?.path || !SHA256.test(item.sha256 ?? '')) throw new Error(`Invalid GIF correction-chain item at ${index}`);
    const itemPath = await resolveContainedRegularPath(root, rootReal, item.path, `GIF correction-chain item ${index}`);
    if (seenPaths.has(itemPath) || seenHashes.has(item.sha256)) throw new Error('Duplicate GIF correction-chain path or hash');
    seenPaths.add(itemPath); seenHashes.add(item.sha256);
    const expectedStatus = index === pointer.correctionChain.length - 1 ? ACTIVE_CHAIN_STATUS : REJECTED_CHAIN_STATUS;
    if (item.status !== expectedStatus) throw new Error(`GIF correction-chain status is not current at ${index}`);
    const file = await readJsonRegularFile(itemPath, `GIF correction-chain ledger ${index}`);
    if (file.sha256 !== item.sha256) throw new Error(`GIF correction-chain ledger hash mismatch at ${index}`);
    chain.push({ ...item, path: itemPath, file });
  }

  const selected = chain.at(-1);
  const selectedPath = await resolveContainedRegularPath(root, rootReal, pointer.activeCandidate.path, 'GIF selected semantic ledger');
  if (selected.path !== selectedPath || selected.sha256 !== pointer.activeCandidate.sha256) {
    throw new Error('GIF active pointer does not select the exact current chain tail');
  }
  if (selected.file.value.schema !== LEDGER_SCHEMA || selected.file.value.version !== '1.0'
    || selected.file.value.status !== LEDGER_STATUS || selected.file.value.priorSemanticResultsConsulted !== false) {
    throw new Error('GIF selected semantic ledger is not the current unsigned non-authority candidate');
  }
  await assertSelectedTailHasNoRejection(selected.path);

  for (let index = 0; index < chain.length - 1; index += 1) {
    const current = chain[index];
    const next = chain[index + 1];
    const receiptPath = rejectionPathFor(current.path);
    const receipt = await readJsonRegularFile(receiptPath, `GIF rejection receipt ${index}`);
    if (receipt.value.schema !== REJECTION_SCHEMA
      || resolve(receipt.value.rejectedPath ?? '') !== current.path
      || receipt.value.rejectedSha256 !== current.sha256
      || resolve(receipt.value.replacementPath ?? '') !== next.path
      || receipt.value.replacementSha256 !== next.sha256) {
      throw new Error(`GIF rejection receipt does not bind correction-chain transition ${index}`);
    }
  }

  const verificationPath = await resolveContainedRegularPath(root, rootReal, pointer.verification.path, 'GIF active verification');
  const verification = await readJsonRegularFile(verificationPath, 'GIF active verification');
  const verified = verification.value;
  if (verified.schema !== VERIFICATION_SCHEMA || verified.version !== '1.0' || verified.status !== 'pass') {
    throw new Error('GIF active verification status is not pass');
  }
  if (await resolveContainedRegularPath(root, rootReal, verified.activeCandidate?.path, 'GIF verification pointer ref') !== active.path
    || verified.activeCandidate?.sha256 !== active.sha256
    || await resolveContainedRegularPath(root, rootReal, verified.activeCandidate?.ledgerPath, 'GIF verification ledger ref') !== selected.path
    || verified.activeCandidate?.ledgerSha256 !== selected.sha256) {
    throw new Error('GIF verification does not bind the exact active pointer and ledger hashes');
  }
  const normalizedPointerChain = pointer.correctionChain.map((item) => ({ ...item }));
  if (!isDeepStrictEqual(verified.correctionChain, normalizedPointerChain)) {
    throw new Error('GIF verification correction chain differs from active pointer');
  }

  const entries = selected.file.value.entries;
  if (!Array.isArray(entries) || entries.length !== verified.coverage?.expected
    || entries.length !== verified.coverage?.actual || verified.coverage?.missing !== 0) {
    throw new Error('GIF active ledger coverage is not an exact pass');
  }
  const indexes = new Set();
  const sourceHashes = new Set();
  const computedTotals = Object.fromEntries(Object.keys(pointer.expectedScreeningTotals).map((key) => [key, 0]));
  for (const entry of entries) {
    if (!Number.isInteger(entry.gifProjectionIndex) || indexes.has(entry.gifProjectionIndex)
      || !SHA256.test(entry.sourceObjectSha256 ?? '') || sourceHashes.has(entry.sourceObjectSha256)) {
      throw new Error('GIF active ledger contains duplicate or invalid projection bindings');
    }
    indexes.add(entry.gifProjectionIndex); sourceHashes.add(entry.sourceObjectSha256);
    for (const key of Object.keys(computedTotals)) {
      if (typeof entry.screeningSignals?.[key] !== 'boolean') throw new Error(`GIF screening signal ${key} is missing or non-boolean`);
      if (entry.screeningSignals[key]) computedTotals[key] += 1;
    }
  }
  const expectedIndexes = Array.from({ length: entries.length }, (_, index) => index);
  if (!isDeepStrictEqual([...indexes].sort((a, b) => a - b), expectedIndexes)) throw new Error('GIF projection indexes are not contiguous');
  if (sourceHashes.size !== verified.coverage?.uniqueSourceSha256) throw new Error('GIF unique source coverage differs from verification');
  if (!isDeepStrictEqual(computedTotals, pointer.expectedScreeningTotals)
    || !isDeepStrictEqual(computedTotals, verified.screeningTotals)) {
    throw new Error('GIF screening totals differ from the active pointer or verification');
  }
  if (verified.receiptBinding?.failureCount !== 0 || verified.sourceObjects?.hashOrSizeMismatchCount !== 0
    || Object.entries(verified.bindings ?? {}).some(([key, value]) => key.endsWith('FailureCount') && value !== 0)
    || verified.priorSemanticResultsConsulted !== false) {
    throw new Error('GIF active verification contains a failed or unsafe gate');
  }

  const result = {
    schema: 'munjanggun.gifSecondaryActiveCandidateValidation.v1',
    status: 'pass',
    authorityStatus: 'unsigned_candidate_not_authority',
    libraryStatus: 'blocked',
    activeCandidatePath: active.path,
    activeCandidateSha256: active.sha256,
    ledgerPath: selected.path,
    ledgerSha256: selected.sha256,
    verificationPath: verification.path,
    verificationSha256: verification.sha256,
    correctionChainLength: chain.length,
    entryCount: entries.length,
    screeningTotals: computedTotals,
  };
  if (includeValidatedEvidence) {
    result.validatedEvidence = {
      activeCandidate: snapshotDocument(active),
      ledger: snapshotDocument(selected.file),
      verification: snapshotDocument(verification),
    };
  }
  return result;
}

function assertExpectedTotals(value) {
  const required = ['price', 'eventOrPromotion', 'serviceOrAsClaim', 'personDepicted', 'privacyRelevant', 'absoluteOrDurabilityClaim'];
  if (!value || !isDeepStrictEqual(Object.keys(value), required)
    || required.some((key) => !Number.isInteger(value[key]) || value[key] < 0)) {
    throw new Error('GIF active pointer expected screening totals are invalid');
  }
}

async function readJsonRegularFile(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be an exact regular file, not a directory or symlink`);
  const bytes = await readFile(path);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { throw new Error(`${label} is not valid JSON`); }
  return { path: resolve(path), bytes, sha256: createHash('sha256').update(bytes).digest('hex'), value };
}

async function resolveContainedRegularPath(root, rootReal, reference, label) {
  if (typeof reference !== 'string' || reference.length === 0 || isAbsolute(reference)) {
    throw new Error(`${label} must be a relative exact-file reference`);
  }
  const path = resolve(root, reference);
  const rel = relative(root, path);
  if (!rel || rel === '..' || rel.startsWith(`..\\`) || rel.startsWith('../') || isAbsolute(rel)) {
    if (!rel) return path;
    throw new Error(`${label} escapes the active candidate root`);
  }
  await assertNoReparsePointChain(path, label, root);
  const resolvedReal = await realpath(path);
  if (!isContained(rootReal, resolvedReal)) throw new Error(`${label} escapes the active candidate root through a reparse point`);
  return path;
}

async function assertNoReparsePointChain(target, label, floor = parse(resolve(target)).root) {
  const absoluteTarget = resolve(target);
  const absoluteFloor = resolve(floor);
  if (!isContained(absoluteFloor, absoluteTarget)) throw new Error(`${label} is outside its filesystem root`);
  const rel = relative(absoluteFloor, absoluteTarget);
  let current = absoluteFloor;
  const components = rel ? rel.split(sep).filter(Boolean) : [];
  for (const component of components) {
    current = resolve(current, component);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error(`${label} contains a symlink or junction path component: ${current}`);
  }
}

async function assertSelectedTailHasNoRejection(ledgerPath) {
  const receiptPath = rejectionPathFor(ledgerPath);
  try {
    await lstat(receiptPath);
    throw new Error(`GIF selected tail has a rejection receipt and is superseded: ${receiptPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function snapshotDocument(file) {
  return { path: file.path, sha256: file.sha256, bytes: Buffer.from(file.bytes) };
}

function isContained(root, candidate) {
  const value = relative(root, candidate);
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
}

function rejectionPathFor(ledgerPath) {
  return ledgerPath.replace(/\.json$/u, '.rejection.json');
}
