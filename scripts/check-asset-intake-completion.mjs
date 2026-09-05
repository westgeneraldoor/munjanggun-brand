#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareInventories, computeTreeHash, inventoryTree, sha256File } from './lib/asset-inventory.mjs';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { findFiles } from './lib/brand-validation-core.mjs';
import { verifyManifestObjects } from './lib/asset-resolver.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';
import { resolveContainedPath } from './lib/asset-paths.mjs';

const receiptPath = resolve(requiredArg('--receipt'));
const sourceRoot = resolve(requiredArg('--source'));
const recoveryRoot = resolve(requiredArg('--recovery'));
const candidateRoot = resolve(requiredArg('--candidate-root'));
const catalogPath = resolve(requiredArg('--catalog'));
const urlReviewPath = resolve(requiredArg('--url-review'));
const urlReviewSourcePath = resolve(requiredArg('--url-review-source'));
const objectRoot = resolve(requiredArg('--object-root'));
const combinedInventoryPath = resolve(requiredArg('--combined-inventory'));
const similarityMapPath = resolve(requiredArg('--similarity-map'));
const evidenceRoot = resolve(requiredArg('--evidence-root'));
const evidenceReceiptPath = resolve(requiredArg('--evidence-receipt'));
const ownerDecisionsPath = resolve(requiredArg('--owner-decisions'));
const ownerDecisionsReceiptPath = resolve(requiredArg('--owner-decisions-receipt'));
const outputPath = getArg('--output') ? resolve(getArg('--output')) : null;

const [receipt, catalog, urlReview, gates, combinedInventory, similarityMap, evidenceReceipt, ownerDecisions, ownerDecisionsReceipt] = await Promise.all([
  readJson(receiptPath),
  readJson(catalogPath),
  readJson(urlReviewPath),
  readJson(resolve(candidateRoot, 'completion-gates.json')),
  readJson(combinedInventoryPath),
  readJson(similarityMapPath),
  readJson(evidenceReceiptPath),
  readJson(ownerDecisionsPath),
  readJson(ownerDecisionsReceiptPath),
]);
const schemas = await loadSchemas();
const errors = [];
for (const [label, value, schema] of [
  ['receipt', receipt, schemas.receipt],
  ['catalog', catalog, schemas.catalog],
  ['URL review', urlReview, schemas.urlReview],
  ['completion gates', gates, schemas.gates],
  ['visual similarity map', similarityMap, schemas.similarity],
  ['review evidence receipt', evidenceReceipt, schemas.evidenceReceipt],
  ['owner decisions', ownerDecisions, schemas.ownerDecisions],
  ['owner decisions receipt', ownerDecisionsReceipt, schemas.ownerDecisionsReceipt],
]) {
  const result = validateAgainstSchema(value, schema);
  errors.push(...formatSchemaErrors(result.errors).map((message) => `${label}: ${message}`));
}
for (const value of [catalog, urlReview, gates, similarityMap, evidenceReceipt, ownerDecisions, ownerDecisionsReceipt]) {
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
const combinedObjectErrors = [];
let combinedObjectsVerified = 0;
for (const group of combinedInventory.groups) {
  try {
    const objectPath = resolveContainedPath(objectRoot, group.objectRef, 'combined objectRef');
    const objectStat = await stat(objectPath);
    if (!objectStat.isFile() || objectStat.size !== group.byteSize) throw new Error('byteSize mismatch');
    if (await sha256File(objectPath) !== group.sha256) throw new Error('sha256 mismatch');
    combinedObjectsVerified += 1;
  } catch (error) {
    combinedObjectErrors.push(`${group.sha256}: ${error.message}`);
  }
}
errors.push(...combinedObjectErrors.map((message) => `combined object: ${message}`));
if (combinedInventory.counts.logicalVisualPaths !== 2013 || combinedInventory.counts.binaryGroups !== 450) {
  errors.push('combined inventory: expected 2013 logical paths and 450 binary groups');
}
if (similarityMap.logicalPathCount !== 2013 || similarityMap.binaryGroupCount !== 450) {
  errors.push('visual similarity map: expected 2013 logical paths and 450 binary groups');
}
const inventoryHashes = [...combinedInventory.groups.map((entry) => entry.sha256)].sort();
const similarityHashes = [...similarityMap.entries.map((entry) => entry.sha256)].sort();
if (JSON.stringify(inventoryHashes) !== JSON.stringify(similarityHashes)) errors.push('visual similarity map: SHA coverage mismatch');

const evidenceVerification = await verifyEvidenceChain({
  evidenceRoot,
  evidenceReceiptPath,
  evidenceReceipt,
  catalog,
  catalogPath,
  similarityMap,
  similarityMapPath,
  urlReview,
  urlReviewPath,
  urlReviewSourcePath,
  intakeReceipt: receipt,
  intakeReceiptPath: receiptPath,
});
errors.push(...evidenceVerification.errors.map((message) => `evidence: ${message}`));
const ownerDecisionVerification = await verifyOwnerDecisionAuthority({
  catalog, catalogPath, ownerDecisions, ownerDecisionsPath, ownerDecisionsReceipt, ownerDecisionsReceiptPath,
});
errors.push(...ownerDecisionVerification.errors.map((message) => `owner decisions: ${message}`));

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
  unresolvedVisualGroups: similarityMap.unjudgedCount,
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
  provenance: {
    checkerSha256: await sha256File(fileURLToPath(import.meta.url)),
    inputs: Object.fromEntries(await Promise.all([
      ['intakeReceipt', receiptPath], ['catalog', catalogPath], ['urlReview', urlReviewPath], ['urlReviewSource', urlReviewSourcePath],
      ['combinedInventory', combinedInventoryPath], ['similarityMap', similarityMapPath], ['evidenceReceipt', evidenceReceiptPath],
      ['ownerDecisions', ownerDecisionsPath], ['ownerDecisionsReceipt', ownerDecisionsReceiptPath],
    ].map(async ([key, path]) => [key, await sha256File(path)]))),
  },
  expected: gates.expected,
  actual,
  objectVerification: {
    incomingVerifiedUniqueObjects: objectResult.verified,
    incomingReferencedLogicalPaths: objectResult.referenced,
    combinedVerifiedUniqueObjects: combinedObjectsVerified,
    combinedExpectedUniqueObjects: combinedInventory.groups.length,
    errorCount: objectResult.errors.length + combinedObjectErrors.length,
  },
  crossCorpusSimilarity: {
    logicalPaths: similarityMap.logicalPathCount,
    binaryGroups: similarityMap.binaryGroupCount,
    visualGroups: similarityMap.visualGroupCount,
    unjudged: similarityMap.unjudgedCount,
    comparisonPolicy: similarityMap.comparisonPolicy,
  },
  evidenceVerification: {
    sealedFiles: evidenceVerification.sealedFiles,
    verifiedFiles: evidenceVerification.verifiedFiles,
    catalogRefs: evidenceVerification.catalogRefs,
    similarityRefs: evidenceVerification.similarityRefs,
    targetedShaRefs: evidenceVerification.targetedShaRefs,
    supportingVisualRefs: evidenceVerification.supportingVisualRefs,
    urlConfirmations: evidenceVerification.urlConfirmations,
    errorCount: evidenceVerification.errors.length,
  },
  ownerDecisionVerification,
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
    similarity: 'asset-visual-similarity-map.schema.json',
    evidenceReceipt: 'review-evidence-receipt.schema.json',
    ownerDecisions: 'asset-owner-decisions.schema.json',
    ownerDecisionsReceipt: 'asset-owner-decision-receipt.schema.json',
  };
  return Object.fromEntries(await Promise.all(Object.entries(names).map(async ([key, name]) => [key, await readJson(new URL(`../schemas/${name}`, import.meta.url))])));
}

async function verifyEvidenceChain(context) {
  const errors = [];
  const receiptByPath = new Map();
  for (const entry of context.evidenceReceipt.entries) {
    if (receiptByPath.has(entry.relativePath)) errors.push(`duplicate receipt path ${entry.relativePath}`);
    receiptByPath.set(entry.relativePath, entry);
  }
  if (context.evidenceReceipt.fileCount !== context.evidenceReceipt.entries.length) errors.push('evidence receipt fileCount mismatch');
  if (context.evidenceReceipt.treeHash !== hashEvidenceEntries(context.evidenceReceipt.entries)) errors.push('evidence receipt treeHash mismatch');

  const actualPaths = (await findFiles(context.evidenceRoot, (path) => resolve(path) !== context.evidenceReceiptPath))
    .map((path) => toForwardSlash(relative(context.evidenceRoot, path))).sort();
  const receiptPaths = [...receiptByPath.keys()].sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(receiptPaths)) errors.push('evidence receipt paths do not match live bundle');
  let verifiedFiles = 0;
  for (const entry of context.evidenceReceipt.entries) {
    try {
      const path = resolveContainedPath(context.evidenceRoot, entry.relativePath, 'evidence receipt path');
      const fileStat = await stat(path);
      if (!fileStat.isFile() || fileStat.size !== entry.byteSize) throw new Error('byteSize mismatch');
      if (await sha256File(path) !== entry.sha256) throw new Error('sha256 mismatch');
      verifiedFiles += 1;
    } catch (error) {
      errors.push(`${entry.relativePath}: ${error.message}`);
    }
  }
  const receiptSha256 = await sha256File(context.evidenceReceiptPath);
  for (const [label, owner, ownerPath] of [
    ['catalog', context.catalog, context.catalogPath],
    ['similarity map', context.similarityMap, context.similarityMapPath],
  ]) {
    if (owner.reviewEvidenceReceiptSha256 !== receiptSha256) errors.push(`${label} evidence receipt SHA mismatch`);
    const resolved = resolve(dirname(ownerPath), owner.reviewEvidenceReceiptRef ?? '');
    if (resolved !== context.evidenceReceiptPath) errors.push(`${label} evidence receipt path mismatch`);
  }

  const jsonCache = new Map();
  const catalogResult = await verifyEntryRefs(context.catalog.entries, 'reviewEvidenceRefs', context.catalogPath);
  const similarityResult = await verifyEntryRefs(context.similarityMap.entries, 'humanReviewEvidence', context.similarityMapPath);
  errors.push(...catalogResult.errors, ...similarityResult.errors);

  let supportingVisualRefs = 0;
  for (const entry of context.evidenceReceipt.entries.filter((item) => item.kind === 'review_report')) {
    const reportPath = resolveContainedPath(context.evidenceRoot, entry.relativePath, 'review report path');
    const report = await readJsonCached(reportPath);
    for (const ref of collectStrings(report).filter((value) => /^(sheets|storyboards)\//.test(value))) {
      supportingVisualRefs += 1;
      if (!receiptByPath.has(ref)) errors.push(`${entry.relativePath}: missing supporting evidence ${ref}`);
    }
  }

  let urlConfirmations = 0;
  try {
    const confirmationPath = resolve(dirname(context.urlReviewPath), context.urlReview.confirmationReceiptRef ?? '');
    if (await sha256File(confirmationPath) !== context.urlReview.confirmationReceiptSha256) throw new Error('confirmation receipt SHA mismatch');
    const confirmationRelative = toForwardSlash(relative(context.evidenceRoot, confirmationPath));
    if (!receiptByPath.has(confirmationRelative)) throw new Error('confirmation receipt absent from evidence receipt');
    const confirmation = await readJsonCached(confirmationPath);
    if (confirmation.intakeReceiptSha256 !== await sha256File(context.intakeReceiptPath)) throw new Error('intake receipt SHA mismatch');
    if (confirmation.urlReviewSha256 !== await sha256File(context.urlReviewSourcePath)) throw new Error('source URL review SHA mismatch');
    if (confirmation.recordsHash !== hashJson(confirmation.entries)) throw new Error('URL confirmation recordsHash mismatch');
    if (confirmation.recordCount !== confirmation.entries.length || confirmation.recordCount !== context.urlReview.recordCount) throw new Error('URL confirmation count mismatch');
    const sourceUrlByPath = new Map(context.intakeReceipt.entries.filter((entry) => entry.kind === 'url' && entry.disposition === 'managed').map((entry) => [entry.sourceRelativePath, entry]));
    const reviewByPath = new Map(context.urlReview.entries.map((entry) => [entry.sourceRelativePath, entry]));
    for (const record of confirmation.entries) {
      const source = sourceUrlByPath.get(record.sourceRelativePath);
      const review = reviewByPath.get(record.sourceRelativePath);
      if (!source || source.sha256 !== record.sourceFileSha256) throw new Error(`source URL receipt mismatch for ${record.sourceRelativePath}`);
      for (const field of ['url', 'productId', 'accessStatus', 'observedTitle', 'productConnectionStatus']) {
        if (!review || review[field] !== record[field]) throw new Error(`URL review field ${field} mismatch for ${record.sourceRelativePath}`);
      }
      if (record.checkedAt !== context.urlReview.checkedAt || record.method !== context.urlReview.method) throw new Error(`URL review timestamp/method mismatch for ${record.sourceRelativePath}`);
      urlConfirmations += 1;
    }
  } catch (error) {
    errors.push(`URL confirmation: ${error.message}`);
  }

  return {
    sealedFiles: context.evidenceReceipt.fileCount,
    verifiedFiles,
    catalogRefs: catalogResult.refCount,
    similarityRefs: similarityResult.refCount,
    targetedShaRefs: catalogResult.targetedCount + similarityResult.targetedCount,
    supportingVisualRefs,
    urlConfirmations,
    errors,
  };

  async function verifyEntryRefs(entries, field, ownerPath) {
    const result = { refCount: 0, targetedCount: 0, errors: [] };
    for (const entry of entries) {
      const refs = entry[field];
      if (!Array.isArray(refs) || refs.length === 0) {
        result.errors.push(`${field} missing for ${entry.sha256}`);
        continue;
      }
      let hasTargetedRef = false;
      for (const ref of refs) {
        result.refCount += 1;
        const [relativeRef, fragment] = String(ref).split('#', 2);
        const path = resolve(dirname(ownerPath), relativeRef);
        const evidenceRelative = toForwardSlash(relative(context.evidenceRoot, path));
        if (evidenceRelative.startsWith('../') || resolve(path) === context.evidenceReceiptPath) {
          result.errors.push(`invalid evidence target ${ref}`);
          continue;
        }
        const receiptEntry = receiptByPath.get(evidenceRelative);
        if (!receiptEntry) {
          result.errors.push(`unsealed evidence target ${ref}`);
          continue;
        }
        if (fragment) {
          const match = fragment.match(/^sha256=([a-f0-9]{64})$/);
          if (!match || match[1] !== entry.sha256) {
            result.errors.push(`invalid SHA fragment ${ref}`);
            continue;
          }
          const report = await readJsonCached(path);
          const evidenceRow = Array.isArray(report.entries) ? report.entries.find((row) => row.sha256 === entry.sha256) : null;
          if (!evidenceRow) {
            result.errors.push(`target SHA absent from report ${ref}`);
            continue;
          }
          if (field === 'reviewEvidenceRefs') {
            const mismatches = compareCatalogEvidenceRow(evidenceRow, entry);
            for (const mismatch of mismatches) result.errors.push(`${ref}: ${mismatch}`);
            if (mismatches.length > 0) continue;
          }
          hasTargetedRef = true;
          result.targetedCount += 1;
        }
      }
      if (!hasTargetedRef) result.errors.push(`no targeted SHA evidence for ${entry.sha256}`);
    }
    return result;
  }

  async function readJsonCached(path) {
    const key = resolve(path);
    if (!jsonCache.has(key)) jsonCache.set(key, await readJson(key));
    return jsonCache.get(key);
  }
}

async function verifyOwnerDecisionAuthority(context) {
  const errors = [];
  const catalogSha256 = await sha256File(context.catalogPath);
  const ledgerSha256 = await sha256File(context.ownerDecisionsPath);
  if (context.ownerDecisions.catalogSha256 !== catalogSha256) errors.push('ledger catalog SHA mismatch');
  if (context.ownerDecisionsReceipt.catalogSha256 !== catalogSha256) errors.push('receipt catalog SHA mismatch');
  if (context.ownerDecisionsReceipt.ledgerSha256 !== ledgerSha256) errors.push('receipt ledger SHA mismatch');
  if (resolve(dirname(context.ownerDecisionsReceiptPath), context.ownerDecisionsReceipt.ledgerRef) !== context.ownerDecisionsPath) errors.push('receipt ledger path mismatch');
  if (context.ownerDecisions.assetDecisionCount !== context.ownerDecisions.assetDecisions.length) errors.push('assetDecisionCount mismatch');
  if (context.ownerDecisionsReceipt.assetDecisionCount !== context.ownerDecisions.assetDecisionCount) errors.push('receipt assetDecisionCount mismatch');
  if (context.ownerDecisionsReceipt.escalationDecisionCount !== context.ownerDecisions.escalationDecisionCount) errors.push('receipt escalationDecisionCount mismatch');
  const catalogBySha = new Map(context.catalog.entries.map((entry) => [entry.sha256, entry]));
  const decisionBySha = new Map();
  for (const decision of context.ownerDecisions.assetDecisions) {
    if (decisionBySha.has(decision.sha256)) errors.push(`duplicate asset decision ${decision.sha256}`);
    const entry = catalogBySha.get(decision.sha256);
    if (!entry || entry.contentId !== decision.contentId) errors.push(`asset decision target mismatch ${decision.sha256}`);
    if (entry && decision.needsEscalation !== (entry.humanReviewStatus === 'needs_escalation')) errors.push(`asset escalation flag mismatch ${decision.sha256}`);
    decisionBySha.set(decision.sha256, decision);
  }
  if (decisionBySha.size !== catalogBySha.size) errors.push('asset decision coverage mismatch');
  const escalationRows = context.ownerDecisions.assetDecisions.filter((decision) => decision.needsEscalation);
  if (escalationRows.length !== context.ownerDecisions.escalationDecisionCount) errors.push('escalation decision count mismatch');
  const globalStatuses = Object.fromEntries(Object.entries(context.ownerDecisions.rightsDecisions).map(([key, value]) => [key, value.status]));
  return {
    catalogBound: context.ownerDecisions.catalogSha256 === catalogSha256 && context.ownerDecisionsReceipt.catalogSha256 === catalogSha256,
    ledgerBound: context.ownerDecisionsReceipt.ledgerSha256 === ledgerSha256,
    assetDecisions: context.ownerDecisions.assetDecisionCount,
    escalationDecisions: context.ownerDecisions.escalationDecisionCount,
    globalStatuses,
    errorCount: errors.length,
    errors,
  };
}

function compareCatalogEvidenceRow(row, entry) {
  return normalizeEvidenceHumanStatus(row.humanReviewStatus) === entry.humanReviewStatus ? [] : ['humanReviewStatus mismatch'];
}

function normalizeEvidenceHumanStatus(value) {
  if (value === 'reviewed_full_loop_storyboard') return 'reviewed';
  return value;
}

function collectStrings(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, output);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, output);
  return output;
}

function hashEvidenceEntries(entries) {
  const hash = createHash('sha256');
  for (const entry of entries) hash.update(`${entry.relativePath}\0${entry.byteSize}\0${entry.sha256}\n`, 'utf8');
  return hash.digest('hex');
}

function hashJson(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function toForwardSlash(path) {
  return path.replaceAll('\\', '/');
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
