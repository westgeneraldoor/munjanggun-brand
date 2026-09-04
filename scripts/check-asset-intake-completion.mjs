#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { compareInventories, computeTreeHash, inventoryTree } from './lib/asset-inventory.mjs';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { findFiles } from './lib/brand-validation-core.mjs';
import { verifyManifestObjects } from './lib/asset-resolver.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const receiptPath = resolve(requiredArg('--receipt'));
const sourceRoot = resolve(requiredArg('--source'));
const recoveryRoot = resolve(requiredArg('--recovery'));
const candidateRoot = resolve(requiredArg('--candidate-root'));
const catalogPath = resolve(requiredArg('--catalog'));
const urlReviewPath = resolve(requiredArg('--url-review'));
const objectRoot = resolve(requiredArg('--object-root'));
const outputPath = getArg('--output') ? resolve(getArg('--output')) : null;

const [receipt, catalog, urlReview, gates] = await Promise.all([
  readJson(receiptPath),
  readJson(catalogPath),
  readJson(urlReviewPath),
  readJson(resolve(candidateRoot, 'completion-gates.json')),
]);
const schemas = await loadSchemas();
const errors = [];
for (const [label, value, schema] of [
  ['receipt', receipt, schemas.receipt],
  ['catalog', catalog, schemas.catalog],
  ['URL review', urlReview, schemas.urlReview],
  ['completion gates', gates, schemas.gates],
]) {
  const result = validateAgainstSchema(value, schema);
  errors.push(...formatSchemaErrors(result.errors).map((message) => `${label}: ${message}`));
}
for (const value of [catalog, urlReview, gates]) {
  if (value.intakeId !== receipt.intakeId) errors.push(`${value.schema}: intakeId mismatch`);
}

const manifestPaths = (await findFiles(resolve(candidateRoot, 'manifests'), (path) => path.endsWith('asset-manifest.json'))).sort();
const manifests = [];
for (const manifestPath of manifestPaths) {
  const result = await readAndValidateManifestV2(manifestPath);
  if (result.findings.length > 0) errors.push(...result.findings.map((finding) => `${manifestPath}: ${finding.message}`));
  manifests.push(result.manifest);
}
const assets = manifests.flatMap((manifest) => manifest.assets);
const byHash = new Map();
for (const asset of assets) {
  const group = byHash.get(asset.sha256) ?? [];
  group.push(asset);
  byHash.set(asset.sha256, group);
}
const catalogByHash = new Map(catalog.entries.map((entry) => [entry.sha256, entry]));
if (catalogByHash.size !== catalog.entries.length) errors.push('catalog: duplicate SHA entry');
if (byHash.size !== catalogByHash.size) errors.push('catalog: manifest/catalog binary group count mismatch');
for (const [sha256, group] of byHash) {
  const entry = catalogByHash.get(sha256);
  if (!entry) {
    errors.push(`catalog: missing SHA ${sha256}`);
    continue;
  }
  const manifestRefs = group.map((asset) => `${asset.sourceId}\0${asset.sourceRelativePath}`).sort();
  const catalogRefs = entry.sourceRefs.map((ref) => `${ref.sourceId}\0${ref.sourceRelativePath}`).sort();
  if (JSON.stringify(manifestRefs) !== JSON.stringify(catalogRefs)) errors.push(`catalog: sourceRefs mismatch for ${sha256}`);
}

const objectResult = await verifyManifestObjects({ assets }, objectRoot);
errors.push(...objectResult.errors.map((message) => `object: ${message}`));

const [sourceInventory, recoveryInventory] = await Promise.all([inventoryTree(sourceRoot), inventoryTree(recoveryRoot)]);
const sourceRecovery = compareInventories(sourceInventory.entries, recoveryInventory.entries);
const receiptSource = compareInventories(receipt.entries, sourceInventory.entries);
let receiptMismatch = 0;
if (sourceRecovery.status !== 'verified') receiptMismatch += mismatchCount(sourceRecovery);
if (receiptSource.status !== 'verified') receiptMismatch += mismatchCount(receiptSource);
if (receipt.sourceTreeHash !== computeTreeHash(receipt.entries)) receiptMismatch += 1;
if (receipt.sourceTreeHash !== sourceInventory.treeHash) receiptMismatch += 1;
if (receipt.recoveryTreeHash !== recoveryInventory.treeHash) receiptMismatch += 1;

const gifEntries = catalog.entries.filter((entry) => entry.mediaType === 'image/gif');
const actual = {
  receiptManaged: receipt.counts.managed,
  visualManifestPaths: assets.length,
  binaryGroups: byHash.size,
  uniqueGifBinaries: gifEntries.length,
  gifSourcePaths: gifEntries.reduce((sum, entry) => sum + entry.sourcePathCount, 0),
  unresolvedVisualGroups: catalog.entries.filter((entry) => !entry.visualGroupId || !['reviewed', 'needs_escalation'].includes(entry.humanReviewStatus)).length,
  urlRecords: urlReview.entries.filter((entry) => entry.accessStatus === 'accessible' && entry.productConnectionStatus === 'matched').length,
  unverifiedRightsPublishable: assets.filter((asset) => asset.rightsStatus !== 'verified' && (['eligible', 'published'].includes(asset.publishStatus) || asset.publicRepoEligibility === 'eligible')).length,
  receiptMismatch,
};
for (const [key, expected] of Object.entries(gates.expected)) {
  if (actual[key] !== expected) errors.push(`gate ${key}: expected ${expected}, got ${actual[key]}`);
}

const releaseBlockers = {
  rightsUnverifiedPaths: assets.filter((asset) => asset.rightsStatus !== 'verified').length,
  humanReviewEscalationGroups: catalog.entries.filter((entry) => entry.humanReviewStatus === 'needs_escalation').length,
  claimSignalGroups: catalog.entries.filter((entry) => entry.claimSignals.length > 0).length,
  privacySignalGroups: catalog.entries.filter((entry) => entry.privacySignals.length > 0).length,
  publicRepoEligiblePaths: assets.filter((asset) => asset.publicRepoEligibility === 'eligible').length,
  canonicalPromotionStatus: 'not_started',
};
const report = {
  schema: 'munjanggun.assetIntakeCompletionReport.v1',
  version: '1.0',
  intakeId: receipt.intakeId,
  checkedAt: new Date().toISOString(),
  technicalGateStatus: errors.length === 0 ? 'passed' : 'failed',
  externalReleaseStatus: 'blocked',
  finalCompletionStatus: 'blocked_pending_rights_claim_privacy_and_owner_approval',
  expected: gates.expected,
  actual,
  objectVerification: { verifiedUniqueObjects: objectResult.verified, referencedLogicalPaths: objectResult.referenced, errorCount: objectResult.errors.length },
  releaseBlockers,
  errors,
};
if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}
console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exitCode = 1;

function mismatchCount(result) {
  return result.missing.length + result.extra.length + result.sizeMismatch.length + result.hashMismatch.length;
}

async function loadSchemas() {
  const names = {
    receipt: 'asset-intake-receipt.schema.json',
    catalog: 'asset-content-catalog.schema.json',
    urlReview: 'asset-url-review.schema.json',
    gates: 'asset-completion-gates.schema.json',
  };
  return Object.fromEntries(await Promise.all(Object.entries(names).map(async ([key, name]) => [key, await readJson(new URL(`../schemas/${name}`, import.meta.url))])));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredArg(name) {
  const value = getArg(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
