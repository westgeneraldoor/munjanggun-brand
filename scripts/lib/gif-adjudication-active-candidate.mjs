import { createHash, createPublicKey, verify } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { stableJson } from './asset-owner-trust.mjs';
import { normalizeReviewerPrincipal, parseContentReviewerTrust } from './asset-content-reviewer-trust.mjs';
import { validateGifSecondaryActiveCandidate } from './gif-secondary-active-candidate.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './schema-validation.mjs';

const SHA256 = /^[a-f0-9]{64}$/u;
const POINTER_NAME = 'gif-adjudication-active-candidate-v1.json';
const POINTER_VERIFICATION_NAME = 'gif-adjudication-active-candidate-verification-v1.json';
const SIGNAL_KEYS = Object.freeze([
  'price', 'eventOrPromotion', 'serviceOrAsClaim', 'personDepicted', 'privacyRelevant', 'absoluteOrDurabilityClaim',
]);
const DECISION_FIELDS = Object.freeze([
  '/canonicalObservation/sceneAndTransitions',
  '/canonicalObservation/visibleText',
  '/canonicalObservation/uncertainties',
  ...SIGNAL_KEYS.map((key) => `/canonicalObservation/signals/${key}`),
  '/canonicalObservation/realPersonNature',
]);
const schemaPath = fileURLToPath(new URL('../../schemas/gif-adjudication-active-candidate.schema.json', import.meta.url));
let schemaPromise;

export async function validateGifAdjudicationActiveCandidate({ activeCandidatePath, includeValidatedEvidence = false } = {}) {
  const pointerPath = requireAbsolute(activeCandidatePath, 'GIF adjudication active candidate');
  if (basename(pointerPath) !== POINTER_NAME) throw new Error(`GIF adjudication active candidate must be the exact ${POINTER_NAME} pointer`);
  const root = dirname(pointerPath);
  await assertNoReparsePointChain(root, 'GIF adjudication pointer parent');
  const rootReal = await realpath(root);
  const pointer = await readJsonRegularFile(pointerPath, 'GIF adjudication active candidate');
  const schema = await (schemaPromise ??= readFile(schemaPath, 'utf8').then(JSON.parse));
  const schemaResult = validateAgainstSchema(pointer.value, schema);
  if (!schemaResult.valid) throw new Error(`GIF adjudication active candidate schema failed:\n${formatSchemaErrors(schemaResult.errors).join('\n')}`);
  await assertNoRejectionReceipt(pointer.path, 'GIF adjudication active candidate');

  const selected = {};
  for (const key of ['pairIndex', 'adjudicationLedger', 'verificationReceipt', 'reviewerTrust']) {
    selected[key] = await readSelectedFile(root, rootReal, pointer.value.selection[key], `GIF adjudication ${key}`);
    await assertNoRejectionReceipt(selected[key].path, `GIF adjudication ${key}`);
  }
  const trust = parseContentReviewerTrust(selected.reviewerTrust.bytes);
  const reviewer = assertReviewer(pointer.value.reviewer, trust, 'GIF adjudication pointer reviewer');
  verifyAttestation(pointer.value, reviewer, 'GIF adjudication active candidate');

  const pointerVerificationPath = resolve(root, POINTER_VERIFICATION_NAME);
  const pointerVerification = await readContainedFile(root, rootReal, pointerVerificationPath, 'GIF adjudication pointer verification');
  await assertNoRejectionReceipt(pointerVerification.path, 'GIF adjudication pointer verification');
  assertPointerVerification(pointerVerification.value, pointer, reviewer);
  verifyAttestation(pointerVerification.value, reviewer, 'GIF adjudication pointer verification');

  const pair = selected.pairIndex.value;
  const ledger = selected.adjudicationLedger.value;
  const receipt = selected.verificationReceipt.value;
  assertTopLevelDocuments(pair, ledger, receipt, reviewer);
  verifyAttestation(ledger, reviewer, 'GIF adjudication ledger');
  verifyAttestation(receipt, reviewer, 'GIF adjudication verification receipt');
  assertBinding(receipt.artifactBindings?.pairIndex, selected.pairIndex, 'Verification pair index');
  assertBinding(receipt.artifactBindings?.adjudicationLedger, selected.adjudicationLedger, 'Verification adjudication ledger');
  assertBinding(receipt.artifactBindings?.reviewerTrust, selected.reviewerTrust, 'Verification reviewer trust');

  const reviewRoot = dirname(root);
  const bindings = pair.bindings;
  assertSame(bindings, ledger.inputBindings, 'Pair and adjudication input bindings');
  const r4Validation = await validateGifSecondaryActiveCandidate({
    activeCandidatePath: requireBinding(bindings.activeCandidate, 'R4 active candidate').path,
    includeValidatedEvidence: true,
  });
  if (r4Validation.status !== 'pass' || !r4Validation.validatedEvidence) throw new Error('R4 active candidate validation did not return exact snapshots');
  assertHashPath(bindings.activeCandidate, r4Validation.activeCandidatePath, r4Validation.activeCandidateSha256, 'R4 active pointer');
  assertHashPath(bindings.selectedR4Ledger, r4Validation.ledgerPath, r4Validation.ledgerSha256, 'R4 selected ledger');
  assertHashPath(bindings.selectedR4Verification, r4Validation.verificationPath, r4Validation.verificationSha256, 'R4 selected verification');
  const r4Ledger = parseSnapshot(r4Validation.validatedEvidence.ledger, 'R4 ledger snapshot');

  const p7Ledger = await readBoundReviewFile(reviewRoot, bindings.p7PrimaryLedger, 'P7 primary ledger');
  const p7Linkage = await readBoundReviewFile(reviewRoot, bindings.p7LinkageVerification, 'P7 linkage verification');
  const queue = await readBoundReviewFile(reviewRoot, bindings.reviewQueue, 'Visual review queue');
  assertP7Linkage(p7Ledger, p7Linkage);
  assertInputValidationReceipt(receipt, r4Validation, bindings);

  const pairByIndex = exactIndexMap(pair.pairs, 'gifProjectionIndex', 80, 'GIF adjudication pairs');
  const adjudicationByIndex = exactIndexMap(ledger.adjudications, 'pairIndex', 80, 'GIF adjudications');
  const r4ByIndex = exactIndexMap(r4Ledger.value.entries, 'gifProjectionIndex', 80, 'R4 entries');
  const p7ByIndex = exactIndexMap(p7Ledger.value.records, 'index', 80, 'P7 records', 1);
  const gifQueue = queue.value.entries?.filter((entry) => entry.reviewMediaKind === 'gif');
  if (!Array.isArray(gifQueue) || gifQueue.length !== 80) throw new Error('Review queue does not contain exactly 80 GIF sources');

  const sourceHashes = new Set();
  const totals = Object.fromEntries([
    ...SIGNAL_KEYS,
    'realPersonNatureObserved', 'realPersonNatureUncertain', 'privacyRelevantUncertain',
  ].map((key) => [key, 0]));
  let decisionCount = 0;
  let uncertaintyAssetCount = 0;
  const canonicalEntries = [];
  for (let index = 0; index < 80; index += 1) {
    const pairItem = pairByIndex.get(index);
    const adjudication = adjudicationByIndex.get(index);
    const r4 = r4ByIndex.get(index);
    const p7 = p7ByIndex.get(index + 1);
    const queued = gifQueue[index];
    assertExactSourceBinding({ pairItem, adjudication, r4, p7, queued, index });
    if (sourceHashes.has(pairItem.sourceObjectSha256)) throw new Error(`Duplicate GIF adjudication source SHA at ${index}`);
    sourceHashes.add(pairItem.sourceObjectSha256);
    await verifySourceFile(pairItem.sourcePath, pairItem.sourceObjectSha256, pairItem.byteSize);
    decisionCount += assertFieldDecisions(adjudication, r4, p7, index);
    const canonical = adjudication.canonicalObservation;
    if (!Array.isArray(canonical.uncertainties)) throw new Error(`Canonical uncertainties are invalid at ${index}`);
    if (canonical.uncertainties.length) uncertaintyAssetCount += 1;
    for (const key of SIGNAL_KEYS) {
      const state = canonical.signals?.[key]?.state;
      if (!['observed_signal', 'not_observed', 'uncertain_signal'].includes(state)) throw new Error(`Canonical signal state is invalid at ${index}:${key}`);
      if (state === 'observed_signal') totals[key] += 1;
    }
    if (canonical.realPersonNature?.state === 'observed_signal') totals.realPersonNatureObserved += 1;
    if (canonical.realPersonNature?.state === 'uncertain_signal') totals.realPersonNatureUncertain += 1;
    if (canonical.signals.privacyRelevant.state === 'uncertain_signal') totals.privacyRelevantUncertain += 1;
    canonicalEntries.push({ index, pair: pairItem, adjudication });
  }
  if (decisionCount !== 800) throw new Error(`GIF adjudication field decision coverage mismatch: ${decisionCount}/800`);
  assertSame(totals, ledger.comparisonSummary?.canonicalSignalTotals, 'Ledger canonical signal totals');
  assertSame(totals, receipt.canonicalSignalTotals, 'Verification canonical signal totals');
  if (!Array.isArray(ledger.comparisonSummary?.unresolvedObservationalConflicts)
    || ledger.comparisonSummary.unresolvedObservationalConflicts.length !== 0
    || receipt.checks?.unresolvedObservationalConflictCount !== 0
    || receipt.checks?.fieldDecisionCompleteness !== true
    || receipt.checks?.canonicalObservationCount !== 80
    || receipt.checks?.residualUncertaintiesPreserved !== true) {
    throw new Error('GIF adjudication unresolved-conflict or residual-uncertainty contract failed');
  }

  const result = {
    schema: 'munjanggun.gifAdjudicationActiveCandidateValidation.v1',
    status: 'pass',
    authorityStatus: 'signed_non_authority_candidate',
    libraryStatus: 'blocked',
    activeCandidatePath: pointer.path,
    activeCandidateSha256: pointer.sha256,
    pointerVerificationPath: pointerVerification.path,
    pointerVerificationSha256: pointerVerification.sha256,
    pairIndexPath: selected.pairIndex.path,
    pairIndexSha256: selected.pairIndex.sha256,
    adjudicationLedgerPath: selected.adjudicationLedger.path,
    adjudicationLedgerSha256: selected.adjudicationLedger.sha256,
    verificationReceiptPath: selected.verificationReceipt.path,
    verificationReceiptSha256: selected.verificationReceipt.sha256,
    reviewerTrustPath: selected.reviewerTrust.path,
    reviewerTrustSha256: selected.reviewerTrust.sha256,
    r4ActiveCandidateSha256: r4Validation.activeCandidateSha256,
    r4LedgerSha256: r4Validation.ledgerSha256,
    r4VerificationSha256: r4Validation.verificationSha256,
    p7LedgerSha256: p7Ledger.sha256,
    p7LinkageVerificationSha256: p7Linkage.sha256,
    sourceCount: sourceHashes.size,
    fieldDecisionCount: decisionCount,
    uncertaintyAssetCount,
    canonicalSignalTotals: totals,
  };
  if (includeValidatedEvidence) {
    result.validatedEvidence = {
      activeCandidate: snapshot(pointer),
      pointerVerification: snapshot(pointerVerification),
      pairIndex: snapshot(selected.pairIndex),
      adjudicationLedger: snapshot(selected.adjudicationLedger),
      verificationReceipt: snapshot(selected.verificationReceipt),
      reviewerTrust: snapshot(selected.reviewerTrust),
      r4ActiveCandidate: r4Validation.validatedEvidence.activeCandidate,
      r4Ledger: r4Validation.validatedEvidence.ledger,
      r4Verification: r4Validation.validatedEvidence.verification,
      p7Ledger: snapshot(p7Ledger),
      p7LinkageVerification: snapshot(p7Linkage),
      queue: snapshot(queue),
    };
  }
  return result;
}

function assertTopLevelDocuments(pair, ledger, receipt, reviewer) {
  if (pair.schema !== 'munjanggun.gifAdjudicationPairIndex.v1' || pair.version !== '1.0'
    || pair.status !== 'complete_non_authority' || pair.coverage?.count !== 80
    || pair.coverage?.missing?.length !== 0 || pair.coverage?.duplicates?.length !== 0) throw new Error('GIF adjudication pair index is invalid');
  if (ledger.schema !== 'munjanggun.gifIndependentAdjudicationLedger.v1' || ledger.version !== '1.0'
    || ledger.status !== 'complete_signed_non_authority' || ledger.authority?.contentAuthority !== false
    || ledger.authority?.libraryAuthority !== false || ledger.authority?.promotionEligible !== false
    || ledger.authority?.libraryStatus !== 'blocked' || ledger.reviewer?.principalId !== reviewer.principalId
    || ledger.coverage?.pairCount !== 80) throw new Error('GIF adjudication ledger header is invalid');
  assertGifAdjudicationReceiptChecks(receipt.checks);
  if (receipt.schema !== 'munjanggun.gifIndependentAdjudicationVerification.v1' || receipt.version !== '1.0'
    || receipt.status !== 'pass' || receipt.authorityStatus !== 'signed_non_authority_verification_only'
    || receipt.libraryStatus !== 'blocked' || receipt.reviewer?.principalId !== reviewer.principalId) throw new Error('GIF adjudication verification receipt is invalid');
}

function assertPointerVerification(value, pointer, reviewer) {
  assertGifAdjudicationPointerChecks(value.checks);
  if (value.schema !== 'munjanggun.gifAdjudicationActiveCandidateVerification.v1' || value.version !== '1.0'
    || value.status !== 'pass' || value.authorityStatus !== 'signed_non_authority_verification_only'
    || resolve(value.activeCandidate?.path ?? '') !== pointer.path || value.activeCandidate?.sha256 !== pointer.sha256
    || value.activeCandidate?.byteSize !== pointer.bytes.length || value.attestation?.principalId !== reviewer.principalId) {
    throw new Error('GIF adjudication pointer verification does not bind the exact pointer');
  }
}

export function assertGifAdjudicationPointerChecks(checks) {
  const requiredTrue = [
    'pointerJsonParse', 'pointerSignatureValid', 'pointerActiveCandidateTrue', 'statusExact',
    'exactPairIndexHash', 'exactLedgerHash', 'exactVerificationReceiptHash', 'exactReviewerTrustHash',
    'contentAuthorityFalse', 'libraryAuthorityFalse', 'promotionEligibleFalse', 'libraryStatusBlocked',
    'directoryEnumerationForbidden', 'shaTamperEvidenceDeclared',
  ];
  if (requiredTrue.some((key) => checks?.[key] !== true) || checks?.storageImmutabilityClaimed !== false) {
    throw new Error('GIF adjudication pointer verification checks are not an exact pass');
  }
}

export function assertGifAdjudicationReceiptChecks(checks) {
  const requiredTrue = [
    'jsonParse', 'coverage80', 'continuousIndices', 'uniqueSourcePairs', 'exactInputBindings',
    'ledgerAttestationVerified', 'chronology', 'fieldDecisionCompleteness',
    'technicalVsSemanticEvidenceSeparated', 'contentAuthorityFalse', 'libraryAuthorityFalse',
    'promotionEligibleFalse', 'residualUncertaintiesPreserved',
  ];
  if (requiredTrue.some((key) => checks?.[key] !== true)
    || checks?.canonicalObservationCount !== 80 || checks?.unresolvedObservationalConflictCount !== 0) {
    throw new Error('GIF adjudication verification receipt checks are not an exact pass');
  }
}

function assertReviewer(declared, trust, label) {
  const principalId = normalizeReviewerPrincipal(declared?.principalId);
  const key = trust.keys.find((item) => item.status === 'active' && item.principalId === principalId && item.keyId === declared?.keyId);
  if (!key || key.fingerprint !== declared?.publicKeyFingerprint) throw new Error(`${label} is not bound to an active trusted Ed25519 key`);
  return { principalId, keyId: key.keyId, fingerprint: key.fingerprint, publicKeyPem: key.publicKeyPem };
}

function verifyAttestation(document, reviewer, label) {
  const attestation = document?.attestation;
  if (!attestation || attestation.algorithm !== 'Ed25519' || normalizeReviewerPrincipal(attestation.principalId) !== reviewer.principalId
    || attestation.keyId !== reviewer.keyId || attestation.publicKeyFingerprint !== reviewer.fingerprint
    || attestation.signedPayloadCanonicalization !== 'recursive_lexicographic_json_keys_utf8') throw new Error(`${label} attestation identity is invalid`);
  const payload = { ...document };
  delete payload.attestation;
  const bytes = Buffer.from(stableJson(payload), 'utf8');
  if (digest(bytes) !== attestation.signedPayloadSha256
    || !verify(null, bytes, createPublicKey(reviewer.publicKeyPem), Buffer.from(attestation.signatureBase64, 'base64'))) {
    throw new Error(`${label} Ed25519 attestation is invalid`);
  }
}

function assertP7Linkage(ledger, linkage) {
  if (ledger.value.schema !== 'p7-unsigned-raw-gif-semantic-ledger-v1'
    || ledger.value.status !== 'sampled_full_timeline_semantic_non_authority'
    || ledger.value.reviewerPrincipal !== 'fresh_gif_p7' || ledger.value.contentAuthority !== false
    || ledger.value.promotionEligible !== false || ledger.value.signed !== false || ledger.value.signature !== null
    || ledger.value.coverage?.expectedUniqueGifCount !== 80 || ledger.value.coverage?.reviewedUniqueGifCount !== 80) throw new Error('P7 primary ledger contract is invalid');
  const value = linkage.value;
  if (value.schema !== 'p7-raw-ledger-linkage-verification-v1' || value.passed !== true
    || value.status !== 'verified_unsigned_non_authority' || resolve(value.ledger?.path ?? '') !== ledger.path
    || value.ledger?.sha256 !== ledger.sha256 || value.coverage?.expectedUniqueGifCount !== 80
    || value.coverage?.reviewedUniqueGifCount !== 80 || Object.values(value.checks ?? {}).some((item) => item !== true)) {
    throw new Error('P7 linkage verification is not an exact all-pass binding');
  }
}

function assertInputValidationReceipt(receipt, r4, bindings) {
  const recorded = receipt.inputValidation?.currentActiveCandidateValidator;
  for (const key of ['activeCandidateSha256', 'ledgerSha256', 'verificationSha256', 'entryCount']) {
    if (recorded?.[key] !== r4[key]) throw new Error(`P5 verification receipt R4 validator binding differs: ${key}`);
  }
  if (receipt.inputValidation?.expectedHashesMatched !== true || receipt.inputValidation?.sourceShaPairCoverage?.expected !== 80
    || receipt.inputValidation?.sourceShaPairCoverage?.actual !== 80
    || receipt.inputValidation?.sourceShaPairCoverage?.missing?.length !== 0
    || receipt.inputValidation?.sourceShaPairCoverage?.duplicates?.length !== 0
    || receipt.inputValidation?.sourceFilesVerifiedAgainstShaAndByteSize !== 80
    || !isDeepStrictEqual(receipt.artifactBindings, {
      pairIndex: receipt.artifactBindings.pairIndex,
      adjudicationLedger: receipt.artifactBindings.adjudicationLedger,
      reviewerTrust: receipt.artifactBindings.reviewerTrust,
    }) || !bindings) throw new Error('P5 verification input validation is incomplete');
}

function assertExactSourceBinding({ pairItem, adjudication, r4, p7, queued, index }) {
  if (pairItem.p7Index !== index + 1 || adjudication.p7Index !== index + 1
    || pairItem.sourceObjectSha256 !== queued.sha256 || adjudication.sourceObjectSha256 !== queued.sha256
    || r4.sourceObjectSha256 !== queued.sha256 || p7.sourceObjectSha256 !== queued.sha256
    || pairItem.byteSize !== queued.byteSize || r4.byteSize !== queued.byteSize
    || resolve(pairItem.sourcePath) !== resolve(queued.primaryOriginalPath)
    || resolve(adjudication.sourcePath) !== resolve(pairItem.sourcePath)
    || resolve(r4.primaryOriginalPath) !== resolve(pairItem.sourcePath) || resolve(p7.sourcePath) !== resolve(pairItem.sourcePath)
    || pairItem.decodedFrameCount !== r4.decodedFrameCount || pairItem.decodedFrameCount !== p7.decodedSourceFrameCount
    || pairItem.decodedDurationMs !== r4.decodedDurationMs || pairItem.decodedDurationMs !== p7.decodedCycleDurationMs
    || !isDeepStrictEqual(pairItem.r4PlaybackReceiptRefs, r4.playbackEvidence?.receiptRefs)
    || !isDeepStrictEqual(pairItem.p7Overview, p7.observationMethod?.overview)
    || !isDeepStrictEqual(pairItem.p7SupplementalOriginalPixelFrames, p7.observationMethod?.supplementalOriginalPixelFrames)
    || !isDeepStrictEqual(pairItem.p7TechnicalPlaybackEvidence, p7.technicalPlaybackEvidence)) {
    throw new Error(`GIF P5 exact source binding mismatch at ${index}`);
  }
}

function assertFieldDecisions(adjudication, r4, p7, index) {
  const decisions = adjudication.fieldDecisions;
  if (!Array.isArray(decisions) || decisions.length !== DECISION_FIELDS.length) throw new Error(`GIF P5 field decision count is not 10 at ${index}`);
  const byField = new Map();
  for (const item of decisions) {
    if (!DECISION_FIELDS.includes(item.field) || byField.has(item.field)) throw new Error(`GIF P5 field decision is missing, duplicate, or unknown at ${index}`);
    byField.set(item.field, item);
  }
  for (const field of DECISION_FIELDS) if (!byField.has(field)) throw new Error(`GIF P5 field decision is missing at ${index}:${field}`);
  const canonical = adjudication.canonicalObservation;
  assertDecision(byField.get(DECISION_FIELDS[0]), canonical.sceneAndTransitions, { r4: r4.rawObservation, p7: p7.sceneAndTransitions }, index);
  assertDecision(byField.get(DECISION_FIELDS[1]), canonical.visibleText, { r4: r4.rawObservation, p7: p7.visibleText }, index);
  assertDecision(byField.get(DECISION_FIELDS[2]), canonical.uncertainties, { r4: r4.uncertainties, p7: p7.uncertainties }, index);
  const p7Keys = { price: 'price', eventOrPromotion: 'event', serviceOrAsClaim: 'afterSales', personDepicted: 'realPerson', privacyRelevant: 'privacy', absoluteOrDurabilityClaim: 'absoluteDurability' };
  for (const key of SIGNAL_KEYS) {
    assertDecision(byField.get(`/canonicalObservation/signals/${key}`), canonical.signals[key].state, {
      r4: r4.screeningSignals[key] ? 'observed_signal' : 'not_observed',
      p7: normalizeP7Signal(p7.signals[p7Keys[key]].state),
    }, index);
  }
  assertDecision(byField.get('/canonicalObservation/realPersonNature'), canonical.realPersonNature.state, {
    r4PersonDepicted: r4.screeningSignals.personDepicted ? 'observed_signal' : 'not_observed',
    p7RealPerson: normalizeP7Signal(p7.signals.realPerson.state),
  }, index);
  return decisions.length;
}

function assertDecision(item, canonical, sourceValues, index) {
  if (!isDeepStrictEqual(item.decision, canonical) || !isDeepStrictEqual(item.sourceValues, sourceValues)
    || typeof item.origin !== 'string' || !item.origin || typeof item.rationale !== 'string' || !item.rationale) {
    throw new Error(`GIF P5 field decision reconstruction mismatch at ${index}:${item.field}`);
  }
}

function normalizeP7Signal(value) {
  if (value === 'observed_signal') return value;
  if (value === 'uncertain_signal') return value;
  if (value === 'not_observed_in_sampled_frames') return 'not_observed';
  throw new Error(`Unsupported P7 signal state: ${value}`);
}

function exactIndexMap(values, key, count, label, start = 0) {
  if (!Array.isArray(values) || values.length !== count) throw new Error(`${label} count must be ${count}`);
  const map = new Map();
  for (const value of values) {
    const index = value?.[key];
    if (!Number.isInteger(index) || index < start || index >= start + count || map.has(index)) throw new Error(`${label} has invalid or duplicate indices`);
    map.set(index, value);
  }
  return map;
}

async function verifySourceFile(pathValue, sha256, byteSize) {
  const path = requireAbsolute(pathValue, 'GIF adjudication source');
  await assertNoReparsePointChain(path, 'GIF adjudication source');
  const bytes = await readFile(path);
  if (bytes.length !== byteSize || digest(bytes) !== sha256) throw new Error(`GIF adjudication source hash or size mismatch: ${path}`);
}

async function readSelectedFile(root, rootReal, binding, label) {
  requireBinding(binding, label);
  const path = requireAbsolute(binding.path, label);
  const file = await readContainedFile(root, rootReal, path, label);
  if (file.sha256 !== binding.sha256 || file.bytes.length !== binding.byteSize) throw new Error(`${label} exact SHA-256 or byteSize mismatch`);
  return file;
}

async function readBoundReviewFile(root, binding, label) {
  requireBinding(binding, label);
  const rootReal = await realpath(root);
  const path = requireAbsolute(binding.path, label);
  const file = await readContainedFile(root, rootReal, path, label);
  if (file.sha256 !== binding.sha256) throw new Error(`${label} SHA-256 mismatch`);
  return file;
}

async function readContainedFile(root, rootReal, path, label) {
  if (!isContained(root, path)) throw new Error(`${label} escapes its evidence root`);
  await assertNoReparsePointChain(path, label, root);
  const actualReal = await realpath(path);
  if (!isContained(rootReal, actualReal)) throw new Error(`${label} escapes its evidence root through a reparse point`);
  return readJsonRegularFile(path, label);
}

async function readJsonRegularFile(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be an exact regular file, not a directory or symlink`);
  const bytes = await readFile(path);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new Error(`${label} is not valid UTF-8 JSON`); }
  return { path: resolve(path), sha256: digest(bytes), bytes, value };
}

async function assertNoRejectionReceipt(path, label) {
  const rejection = path.endsWith('.json') ? path.replace(/\.json$/u, '.rejection.json') : `${path}.rejection.json`;
  try { await lstat(rejection); throw new Error(`${label} has a rejection receipt and is superseded`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

async function assertNoReparsePointChain(target, label, floor = parse(resolve(target)).root) {
  const absoluteTarget = resolve(target);
  const absoluteFloor = resolve(floor);
  if (!isContained(absoluteFloor, absoluteTarget)) throw new Error(`${label} is outside its filesystem root`);
  let current = absoluteFloor;
  for (const component of relative(absoluteFloor, absoluteTarget).split(sep).filter(Boolean)) {
    current = resolve(current, component);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error(`${label} contains a symlink or junction path component: ${current}`);
  }
}

function assertBinding(binding, file, label) {
  if (resolve(binding?.path ?? '') !== file.path || binding?.sha256 !== file.sha256 || binding?.byteSize !== file.bytes.length) throw new Error(`${label} does not bind exact artifact bytes`);
}

function requireBinding(binding, label) {
  if (!binding || !isAbsolute(binding.path ?? '') || !SHA256.test(binding.sha256 ?? '')) throw new Error(`${label} exact path/hash binding is invalid`);
  return { ...binding, path: resolve(binding.path) };
}

function assertHashPath(binding, path, sha256, label) {
  const exact = requireBinding(binding, label);
  if (exact.path !== resolve(path) || exact.sha256 !== sha256) throw new Error(`${label} does not match the active validation result`);
}

function parseSnapshot(value, label) {
  if (!value || !Buffer.isBuffer(value.bytes) || digest(value.bytes) !== value.sha256) throw new Error(`${label} exact bytes/hash is invalid`);
  return { ...value, path: resolve(value.path), value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(value.bytes)) };
}

function snapshot(file) { return { path: file.path, sha256: file.sha256, bytes: Buffer.from(file.bytes) }; }
function assertSame(left, right, label) { if (!isDeepStrictEqual(left, right)) throw new Error(`${label} differ`); }
function requireAbsolute(value, label) { if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) throw new Error(`${label} must be an absolute path`); return resolve(value); }
function isContained(root, candidate) { const rel = relative(resolve(root), resolve(candidate)); return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)); }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
