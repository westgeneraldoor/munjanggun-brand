#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256File } from './lib/asset-inventory.mjs';
import { resolveAssetObject } from './lib/asset-resolver.mjs';
import { resolveContainedPath } from './lib/asset-paths.mjs';
import { canonicalExtensionForMediaType } from './lib/media-metadata.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';
import { verifyApprovalAuthority } from './lib/asset-owner-approval.mjs';
import { verifyUseEvidenceAuthority } from './lib/asset-use-evidence.mjs';
import { assertTrustedPrivateOutput } from './lib/asset-transfer-policy.mjs';

export async function runAssetExtractContent(argv, { trustedPrivateRoots, emit = console.log } = {}) {
const args = parseArgs(argv);
const catalogPath = resolve(requiredValue(args, '--catalog'));
const objectRoot = resolve(requiredValue(args, '--object-root'));
const outputRoot = resolve(requiredValue(args, '--output-root'));
const evidenceReceiptPath = resolve(requiredValue(args, '--evidence-receipt'));
const purpose = requiredValue(args, '--purpose');
const destinationClass = requiredValue(args, '--destination-class');
const shaArg = singleValue(args, '--sha');
const contentIdArg = singleValue(args, '--content-id');
if (Boolean(shaArg) === Boolean(contentIdArg)) throw new Error('Provide exactly one of --sha or --content-id');
assertPurposeContract(purpose, destinationClass);

const [catalog, catalogSchema, evidenceReceipt, evidenceReceiptSchema] = await Promise.all([
  readJson(catalogPath),
  readJson(fileURLToPath(new URL('../schemas/asset-content-catalog.schema.json', import.meta.url))),
  readJson(evidenceReceiptPath),
  readJson(fileURLToPath(new URL('../schemas/review-evidence-receipt.schema.json', import.meta.url))),
]);
assertSchema(catalog, catalogSchema, 'catalog');
assertSchema(evidenceReceipt, evidenceReceiptSchema, 'review evidence receipt');
validateCatalogInvariants(catalog);
await verifyReviewEvidenceAuthority({ catalog, catalogPath, evidenceReceipt, evidenceReceiptPath });
const approvalAuthority = purpose === 'internal-audit' ? null : await verifyApprovalAuthority({
  catalog,
  catalogPath,
  ledgerPath: resolve(requiredValue(args, '--approval-ledger')),
  receiptPath: resolve(requiredValue(args, '--approval-receipt')),
  useEvidenceReceiptPath: resolve(requiredValue(args, '--use-evidence-receipt')),
});

const matches = catalog.entries.filter((item) => shaArg ? item.sha256 === shaArg : item.contentId === contentIdArg);
if (matches.length !== 1) throw new Error(`Catalog selector must match exactly one entry; found ${matches.length}`);
const entry = matches[0];
await verifySelectedReviewEvidence({ entry, catalogPath, evidenceReceipt, evidenceReceiptPath });
const useEvidenceAuthority = purpose === 'internal-audit' ? null : await verifyUseEvidenceAuthority({
  catalog, catalogPath,
  registryPath: resolve(requiredValue(args, '--use-evidence-registry')),
  receiptPath: resolve(requiredValue(args, '--use-evidence-receipt')),
  entry, purpose, channel: singleValue(args, '--channel'),
});

const releaseGate = evaluateReleaseGate(entry, purpose, approvalAuthority, useEvidenceAuthority);
const overrideAcknowledgements = values(args, '--override-gate');
const auditContext = purpose === 'internal-audit'
  ? validateInternalAuditOverride(args, outputRoot, releaseGate, overrideAcknowledgements)
  : null;
if (auditContext) for (const gate of releaseGate.failures) gate.overridden = true;
if (!releaseGate.allowed && purpose !== 'internal-audit') {
  throw new Error(`Extraction blocked by release gate: ${releaseGate.failures.map((item) => `${item.gate}=${item.observed}`).join(', ')}`);
}

const objectPath = await resolveAssetObject(objectRoot, entry);
if (canonicalExtensionForMediaType(entry.mediaType) !== extname(objectPath).toLowerCase()) {
  throw new Error('Object extension does not match catalog mediaType');
}
await assertOutputPolicy({ outputRoot, objectRoot, purpose, args, trustedPrivateRoots });

const extractionId = `EXTRACT-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8).toUpperCase()}`;
const partialBundle = resolveContainedPath(outputRoot, `.${extractionId}.partial`, 'partial extraction bundle');
const finalBundle = resolveContainedPath(outputRoot, extractionId, 'final extraction bundle');
const sourceName = basename(entry.sourceRefs[0]?.sourceRelativePath ?? `asset${extname(objectPath)}`);
const safeStem = basename(sourceName, extname(sourceName)).replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 80) || 'asset';
const outputName = `${entry.contentId}-${safeStem}${extname(objectPath).toLowerCase()}`;
const partialOutputPath = resolveContainedPath(partialBundle, outputName, 'partial output file');
const receiptPath = resolveContainedPath(finalBundle, 'receipt.json', 'extraction receipt');
const catalogSha256 = await sha256File(catalogPath);
const evidenceReceiptSha256 = await sha256File(evidenceReceiptPath);

await mkdir(outputRoot, { recursive: true });
await mkdir(partialBundle, { recursive: false });
try {
  await copyFile(objectPath, partialOutputPath, constants.COPYFILE_EXCL);
  const copiedStat = await stat(partialOutputPath);
  const copiedSha256 = await sha256File(partialOutputPath);
  if (copiedStat.size !== entry.byteSize || copiedSha256 !== entry.sha256) throw new Error('Copied output integrity mismatch');

  const receipt = {
    schema: 'munjanggun.assetExtractionReceipt.v1', version: '1.0', extractionId,
    createdAt: new Date().toISOString(), result: 'success', purpose, destinationClass,
    extractionMode: releaseGate.allowed ? 'release_eligible' : 'internal_audit_override',
    releaseEligible: releaseGate.allowed,
    externalUseAllowed: releaseGate.allowed && purpose !== 'internal-audit',
    requestedBy: auditContext?.requestedBy ?? null, auditRef: auditContext?.auditRef ?? null,
    reason: auditContext?.reason ?? null, expiresAt: auditContext?.expiresAt ?? null,
    noPublicationAcknowledged: auditContext?.noPublicationAcknowledged ?? false,
    overrideAcknowledgements,
    catalog: {
      path: catalogPath, sha256: catalogSha256, schema: catalog.schema, intakeId: catalog.intakeId,
      reviewedAt: catalog.reviewedAt, reviewEvidenceReceiptPath: evidenceReceiptPath,
      reviewEvidenceReceiptSha256: evidenceReceiptSha256,
    },
    approvalAuthority: approvalAuthority ? {
      ledgerPath: approvalAuthority.ledgerPath,
      ledgerSha256: approvalAuthority.ledgerSha256,
      receiptPath: approvalAuthority.receiptPath,
      receiptSha256: approvalAuthority.receiptSha256,
    } : null,
    useEvidenceAuthority: useEvidenceAuthority ? {
      registryPath: useEvidenceAuthority.registryPath, registrySha256: useEvidenceAuthority.registrySha256,
      receiptPath: useEvidenceAuthority.receiptPath, receiptSha256: useEvidenceAuthority.receiptSha256,
      resolvedEvidence: useEvidenceAuthority.resolvedEvidence,
    } : null,
    selector: shaArg ? { type: 'sha256', value: shaArg, matchCount: 1 } : { type: 'contentId', value: contentIdArg, matchCount: 1 },
    asset: {
      contentId: entry.contentId, binaryGroupId: entry.binaryGroupId, sha256: entry.sha256,
      byteSize: entry.byteSize, mediaType: entry.mediaType, objectRef: entry.objectRef,
    },
    gates: releaseGate.checks,
    output: { fileName: outputName, sha256: copiedSha256, byteSize: copiedStat.size, noOverwrite: true },
  };
  await writeFile(resolveContainedPath(partialBundle, 'receipt.json', 'partial receipt'), `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  if (await sha256File(catalogPath) !== catalogSha256) throw new Error('Catalog changed during extraction');
  if (await sha256File(evidenceReceiptPath) !== evidenceReceiptSha256) throw new Error('Evidence receipt changed during extraction');
  await rename(partialBundle, finalBundle);
  const result = { extractionId, result: 'success', receiptPath, bundlePath: finalBundle };
  emit(JSON.stringify(result, null, 2));
  return result;
} catch (error) {
  await rm(partialBundle, { recursive: true, force: true });
  throw error;
}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runAssetExtractContent(process.argv.slice(2));
}

function evaluateReleaseGate(entry, purpose, approvalAuthority, useEvidenceAuthority) {
  const checks = [
    check('humanReviewStatus', entry.humanReviewStatus, 'reviewed', entry.humanReviewStatus === 'reviewed'),
    check('rightsStatus', entry.rightsStatus, 'verified', entry.rightsStatus === 'verified'),
    check('rightsScope.external_reuse', scopeValue(entry.rightsScope, 'external_reuse'), 'present', entry.rightsScope?.includes('external_reuse')),
    check('rightsEvidenceRef', Array.isArray(entry.rightsEvidenceRef) ? entry.rightsEvidenceRef.length : 'missing', 'non_empty', Array.isArray(entry.rightsEvidenceRef) && entry.rightsEvidenceRef.length > 0),
    check('privacyStatus', entry.privacyStatus, 'cleared', entry.privacyStatus === 'cleared'),
    check('claimReviewStatus', entry.claimReviewStatus, 'verified_or_not_applicable', ['verified', 'not_applicable'].includes(entry.claimReviewStatus)),
    check('claimSignalsConsistency', entry.claimSignals?.length ?? 'missing', 'zero_if_not_applicable', entry.claimReviewStatus !== 'not_applicable' || entry.claimSignals.length === 0),
    check('claimEvidenceRef', entry.claimEvidenceRef?.length ?? 0, 'non_empty_when_verified_or_signaled', !(entry.claimReviewStatus === 'verified' || entry.claimSignals.length > 0) || entry.claimEvidenceRef.length > 0),
    check('publishStatus', entry.publishStatus, 'eligible_or_published', ['eligible', 'published'].includes(entry.publishStatus)),
    check('reviewEvidenceRefs', Array.isArray(entry.reviewEvidenceRefs) ? entry.reviewEvidenceRefs.length : 'missing', 'non_empty', Array.isArray(entry.reviewEvidenceRefs) && entry.reviewEvidenceRefs.length > 0),
  ];
  if (purpose === 'public-repository') {
    checks.push(check('rightsScope.public_git_storage', scopeValue(entry.rightsScope, 'public_git_storage'), 'present', entry.rightsScope?.includes('public_git_storage')));
    checks.push(check('publicRepoEligibility', entry.publicRepoEligibility, 'eligible', entry.publicRepoEligibility === 'eligible'));
  }
  if (approvalAuthority) {
    const assetDecision = approvalAuthority.assetDecisionBySha.get(entry.sha256);
    const global = approvalAuthority.ledger.rightsDecisions;
    const globalRightsRefs = new Set(purpose === 'public-repository' ? (global.publicGitStorage.evidenceRefs ?? []) : (global.externalReuse.evidenceRefs ?? []));
    const assetRightsRefs = new Set(assetDecision?.rightsEvidenceRefs ?? []);
    const rightsEvidenceBound = entry.rightsEvidenceRef.length > 0 && entry.rightsEvidenceRef.every((ref) => globalRightsRefs.has(ref) && assetRightsRefs.has(ref));
    checks.push(check('owner.externalReuse', global.externalReuse.status, 'approved', global.externalReuse.status === 'approved'));
    checks.push(check('owner.specialAssetRestrictions', global.specialAssetRestrictions.status, 'approved', global.specialAssetRestrictions.status === 'approved'));
    const resolvedUseEvidenceIds = new Set(useEvidenceAuthority?.resolvedEvidence.map((item) => item.evidenceId) ?? []);
    const applicableSpecialEvidenceRefs = (global.specialAssetRestrictions.evidenceRefs ?? []).filter((ref) => assetRightsRefs.has(ref));
    const specialEvidenceBound = applicableSpecialEvidenceRefs.length > 0 && applicableSpecialEvidenceRefs.every((ref) => resolvedUseEvidenceIds.has(ref));
    checks.push(check('owner.specialAssetRestrictionsEvidence', specialEvidenceBound ? 'bound' : 'unbound', 'bound', specialEvidenceBound));
    checks.push(check('owner.asset.humanReviewDecision', assetDecision?.humanReviewDecision, 'approved', assetDecision?.humanReviewDecision === 'approved'));
    checks.push(check('owner.asset.claimDecision', assetDecision?.claimDecision, 'verified_or_not_applicable', ['verified', 'not_applicable'].includes(assetDecision?.claimDecision)));
    checks.push(check('owner.asset.privacyDecision', assetDecision?.privacyDecision, 'cleared', assetDecision?.privacyDecision === 'cleared'));
    checks.push(check('owner.asset.rightsDecision', assetDecision?.rightsDecision, 'verified', assetDecision?.rightsDecision === 'verified'));
    checks.push(check('owner.rightsEvidenceBinding', rightsEvidenceBound ? 'bound' : 'unbound', 'bound', rightsEvidenceBound));
    const claimEvidenceBound = entry.claimEvidenceRef.length === 0 || entry.claimEvidenceRef.every((ref) => (assetDecision?.claimEvidenceRefs ?? []).includes(ref));
    checks.push(check('owner.claimEvidenceBinding', claimEvidenceBound ? 'bound' : 'unbound', 'bound', claimEvidenceBound));
    if (purpose === 'public-repository') checks.push(check('owner.publicGitStorage', global.publicGitStorage.status, 'approved', global.publicGitStorage.status === 'approved'));
  }
  if (purpose !== 'internal-audit') checks.push(check('useEvidenceAuthority', useEvidenceAuthority ? 'verified' : 'missing', 'verified', Boolean(useEvidenceAuthority)));
  return { checks, failures: checks.filter((item) => !item.passed), allowed: checks.every((item) => item.passed) };
}

function validateInternalAuditOverride(args, outputRoot, releaseGate, acknowledgements) {
  const approvedPrivateRoot = resolve(requiredValue(args, '--approved-private-root'));
  if (!isContained(approvedPrivateRoot, outputRoot)) throw new Error('Internal audit output must stay under --approved-private-root');
  const auditRef = requiredValue(args, '--audit-ref');
  if (!/^AUDIT-[A-Z0-9-]+$/i.test(auditRef)) throw new Error('--audit-ref must use AUDIT-... format');
  const requestedBy = requiredValue(args, '--requested-by');
  const reason = requiredValue(args, '--reason');
  if (reason.length < 20) throw new Error('--reason must be at least 20 characters');
  const expiresAt = requiredValue(args, '--expires-at');
  const expiry = Date.parse(expiresAt);
  const now = Date.now();
  if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 30 * 24 * 60 * 60 * 1000) throw new Error('--expires-at must be within the next 30 days');
  if (!hasFlag(args, '--acknowledge-no-publication')) throw new Error('Internal audit requires --acknowledge-no-publication');
  const expected = releaseGate.failures.map((item) => `${item.gate}=${String(item.observed)}`).sort();
  const actual = [...acknowledgements].sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Internal audit requires exact --override-gate acknowledgements: ${expected.join(', ')}`);
  return { approvedPrivateRoot, auditRef, requestedBy, reason, expiresAt, noPublicationAcknowledged: true };
}

async function verifyReviewEvidenceAuthority(context) {
  if (!context.catalog.reviewedAt) throw new Error('Catalog reviewedAt is required for extraction');
  const receiptSha = await sha256File(context.evidenceReceiptPath);
  if (context.catalog.reviewEvidenceReceiptSha256 !== receiptSha) throw new Error('Catalog evidence receipt SHA mismatch');
  if (resolve(dirname(context.catalogPath), context.catalog.reviewEvidenceReceiptRef ?? '') !== context.evidenceReceiptPath) throw new Error('Catalog evidence receipt path mismatch');
  if (context.catalog.intakeId !== context.evidenceReceipt.intakeId) throw new Error('Catalog/evidence intakeId mismatch');
}

async function verifySelectedReviewEvidence(context) {
  const receiptByPath = new Map(context.evidenceReceipt.entries.map((item) => [item.relativePath, item]));
  let targeted = false;
  for (const ref of context.entry.reviewEvidenceRefs ?? []) {
    const [relativeRef, fragment] = String(ref).split('#', 2);
    const targetPath = resolve(dirname(context.catalogPath), relativeRef);
    const evidenceRoot = dirname(context.evidenceReceiptPath);
    const evidenceRelative = relative(evidenceRoot, targetPath).replaceAll('\\', '/');
    const sealed = receiptByPath.get(evidenceRelative);
    if (!sealed) throw new Error(`Review evidence is not sealed: ${ref}`);
    const targetStat = await stat(targetPath);
    if (!targetStat.isFile() || targetStat.size !== sealed.byteSize || await sha256File(targetPath) !== sealed.sha256) throw new Error(`Review evidence integrity mismatch: ${ref}`);
    const match = fragment?.match(/^sha256=([a-f0-9]{64})$/);
    if (match) {
      if (match[1] !== context.entry.sha256) throw new Error(`Review evidence SHA fragment mismatch: ${ref}`);
      const report = await readJson(targetPath);
      const evidenceRow = Array.isArray(report.entries) ? report.entries.find((row) => row.sha256 === context.entry.sha256) : null;
      if (!evidenceRow) throw new Error(`Review evidence target absent: ${ref}`);
      assertEvidenceRowMatchesEntry(evidenceRow, context.entry, ref);
      targeted = true;
    }
  }
  if (!targeted) throw new Error('Catalog entry has no targeted sealed review evidence');
}

function assertEvidenceRowMatchesEntry(row, entry, ref) {
  if (normalizeEvidenceHumanStatus(row.humanReviewStatus) !== entry.humanReviewStatus) throw new Error(`Review evidence humanReviewStatus mismatch: ${ref}`);
}

function normalizeEvidenceHumanStatus(value) {
  if (value === 'reviewed_full_loop_storyboard') return 'reviewed';
  return value;
}

function validateCatalogInvariants(catalog) {
  if (catalog.entries.length !== catalog.binaryGroupCount) throw new Error('Catalog binaryGroupCount mismatch');
  const shaSet = new Set();
  const contentSet = new Set();
  for (const entry of catalog.entries) {
    if (shaSet.has(entry.sha256) || contentSet.has(entry.contentId)) throw new Error('Catalog has duplicate sha256 or contentId');
    shaSet.add(entry.sha256); contentSet.add(entry.contentId);
    if (entry.binaryGroupId !== `sha256:${entry.sha256}`) throw new Error(`Catalog binaryGroupId mismatch for ${entry.sha256}`);
    if (entry.sourcePathCount !== entry.sourceRefs.length) throw new Error(`Catalog sourcePathCount mismatch for ${entry.sha256}`);
  }
}

async function assertOutputPolicy({ outputRoot, objectRoot, purpose, args, trustedPrivateRoots }) {
  const objectReal = await realpath(objectRoot);
  if (isContained(objectReal, outputRoot) || isContained(outputRoot, objectReal)) throw new Error('Output root and object root must be separate');
  if (purpose === 'internal-audit') {
    await assertTrustedPrivateOutput({
      approvedPrivateRoot: requiredValue(args, '--approved-private-root'),
      outputPath: outputRoot,
      objectRoot,
      outputLabel: 'Internal audit output',
    }, trustedPrivateRoots === undefined ? undefined : { trustedPrivateRoots });
  }
  if (purpose === 'public-repository') {
    const publicRoot = resolve(requiredValue(args, '--approved-public-root'));
    await assertContainedWithoutSymlinks(publicRoot, outputRoot, 'Public repository output');
  }
  const parent = dirname(outputRoot);
  try {
    const parentInfo = await lstat(parent);
    if (parentInfo.isSymbolicLink()) throw new Error('Output parent must not be a symbolic link');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function assertContainedWithoutSymlinks(root, target, label) {
  if (!isContained(root, target)) throw new Error(`${label} must stay under its approved root`);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error(`${label} approved root must be a real directory`);
  const rootReal = await realpath(root);
  const segments = relative(root, target).split(sep).filter(Boolean);
  let cursor = root;
  for (const segment of segments) {
    cursor = resolve(cursor, segment);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) throw new Error(`${label} path must not contain symbolic links`);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }
  if (!isContained(rootReal, resolve(rootReal, ...segments))) throw new Error(`${label} real path escapes its approved root`);
}

function assertPurposeContract(purpose, destinationClass) {
  const expected = { 'external-publication': 'local-publication-staging', 'public-repository': 'public-repository', 'internal-audit': 'private-temporary' };
  if (!expected[purpose]) throw new Error(`Unknown --purpose ${purpose}`);
  if (destinationClass !== expected[purpose]) throw new Error(`${purpose} requires --destination-class ${expected[purpose]}`);
}

function parseArgs(argv) {
  const valueFlags = new Set(['--catalog', '--object-root', '--output-root', '--evidence-receipt', '--approval-ledger', '--approval-receipt', '--use-evidence-registry', '--use-evidence-receipt', '--channel', '--purpose', '--destination-class', '--sha', '--content-id', '--approved-private-root', '--approved-public-root', '--audit-ref', '--requested-by', '--reason', '--expires-at', '--override-gate']);
  const booleanFlags = new Set(['--acknowledge-no-publication']);
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!valueFlags.has(token) && !booleanFlags.has(token)) throw new Error(`Unknown argument ${token}`);
    if (booleanFlags.has(token)) {
      if (parsed.has(token)) throw new Error(`Duplicate argument ${token}`);
      parsed.set(token, [true]); continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    if (token !== '--override-gate' && parsed.has(token)) throw new Error(`Duplicate argument ${token}`);
    parsed.set(token, [...(parsed.get(token) ?? []), value]); index += 1;
  }
  return parsed;
}

function requiredValue(args, name) { const value = singleValue(args, name); if (!value) throw new Error(`Missing required argument ${name}`); return value; }
function singleValue(args, name) { return args.get(name)?.[0]; }
function values(args, name) { return args.get(name) ?? []; }
function hasFlag(args, name) { return args.get(name)?.[0] === true; }
function check(gate, observed, expected, passed) { return { gate, observed: String(observed ?? 'missing'), expected, passed: Boolean(passed), overridden: false }; }
function scopeValue(scopes, value) { return Array.isArray(scopes) && scopes.includes(value) ? 'present' : 'absent'; }
function isContained(root, child) { const relation = relative(resolve(root), resolve(child)); return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation)); }
function assertSchema(value, schema, label) { const result = validateAgainstSchema(value, schema); if (!result.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`); }
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
