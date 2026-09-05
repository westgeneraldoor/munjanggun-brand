#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFiles } from './lib/brand-validation-core.mjs';
import { sha256File } from './lib/asset-inventory.mjs';
import { toPosixPath } from './lib/asset-paths.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const reviewSource = resolve(requiredArg('--review-source'));
const evidenceRoot = resolve(requiredArg('--evidence-root'));
const candidateRoot = resolve(requiredArg('--candidate-root'));
const catalogPath = resolve(requiredArg('--catalog'));
const similarityPath = resolve(requiredArg('--similarity-map'));
const urlReviewPath = resolve(requiredArg('--url-review'));
const intakeReceiptPath = resolve(requiredArg('--intake-receipt'));
const catalogOutput = resolve(requiredArg('--catalog-output'));
const similarityOutput = resolve(requiredArg('--similarity-output'));
const urlReviewOutput = resolve(requiredArg('--url-review-output'));

await mkdir(evidenceRoot, { recursive: true });
if ((await readdir(evidenceRoot)).length > 0) throw new Error(`Evidence root must be empty: ${evidenceRoot}`);
const reportsDir = join(evidenceRoot, 'reports');
const sheetsDir = join(evidenceRoot, 'sheets');
const storyboardsDir = join(evidenceRoot, 'storyboards');
await Promise.all([mkdir(reportsDir), mkdir(sheetsDir), mkdir(storyboardsDir)]);

const reportNames = [
  'static-a.json', 'static-b.json', 'gif.json', 'report-audit.json',
  'static-final-375.json', 'gif-final-75.json', 'similarity-audit.json', 'combined-inventory-2013.json',
];
const sourceMappings = new Map();
for (const name of reportNames) sourceMappings.set(normalizeAbsolute(join(reviewSource, name)), `reports/${name}`);
const rootSheets = (await readdir(reviewSource, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.jpg'))
  .map((entry) => entry.name);
for (const name of rootSheets) sourceMappings.set(normalizeAbsolute(join(reviewSource, name)), `sheets/${name}`);
const storyboardNames = (await readdir(join(reviewSource, 'storyboards'), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.jpg'))
  .map((entry) => entry.name);
for (const name of storyboardNames) sourceMappings.set(normalizeAbsolute(join(reviewSource, 'storyboards', name)), `storyboards/${name}`);

for (const name of rootSheets) await copyFile(join(reviewSource, name), join(sheetsDir, name), constants.COPYFILE_EXCL);
for (const name of storyboardNames) await copyFile(join(reviewSource, 'storyboards', name), join(storyboardsDir, name), constants.COPYFILE_EXCL);
for (const name of reportNames) {
  const report = await readJson(join(reviewSource, name));
  const normalized = normalizeEvidenceValue(report, { rootSheets: new Set(rootSheets), storyboardNames: new Set(storyboardNames) });
  await writeJsonNew(join(reportsDir, name), normalized);
}

const [urlReview, intakeReceipt] = await Promise.all([readJson(urlReviewPath), readJson(intakeReceiptPath)]);
const intakeUrlByPath = new Map(intakeReceipt.entries.filter((entry) => entry.kind === 'url' && entry.disposition === 'managed').map((entry) => [entry.sourceRelativePath, entry]));
const confirmationEntries = urlReview.entries.map((entry) => {
  const source = intakeUrlByPath.get(entry.sourceRelativePath);
  if (!source) throw new Error(`URL confirmation missing intake receipt path ${entry.sourceRelativePath}`);
  return {
    sourceRelativePath: entry.sourceRelativePath,
    sourceFileSha256: source.sha256,
    url: entry.url,
    productId: entry.productId,
    accessStatus: entry.accessStatus,
    observedTitle: entry.observedTitle,
    productConnectionStatus: entry.productConnectionStatus,
    checkedAt: urlReview.checkedAt,
    method: urlReview.method,
  };
});
if (confirmationEntries.length !== 13) throw new Error(`Expected 13 URL confirmations, got ${confirmationEntries.length}`);
const urlConfirmation = {
  schema: 'munjanggun.urlConfirmationReceipt.v1',
  version: '1.0',
  intakeId: intakeReceipt.intakeId,
  generatedAt: new Date().toISOString(),
  intakeReceiptSha256: await sha256File(intakeReceiptPath),
  urlReviewSha256: await sha256File(urlReviewPath),
  recordCount: confirmationEntries.length,
  recordsHash: hashJson(confirmationEntries),
  entries: confirmationEntries,
};
const urlConfirmationPath = join(reportsDir, 'url-confirmation-receipt.json');
await writeJsonNew(urlConfirmationPath, urlConfirmation);

const evidenceFiles = (await findFiles(evidenceRoot, () => true)).sort();
const evidenceEntries = [];
for (const path of evidenceFiles) {
  const fileStat = await stat(path);
  const relativePath = toPosixPath(relative(evidenceRoot, path));
  evidenceEntries.push({
    relativePath,
    byteSize: fileStat.size,
    sha256: await sha256File(path),
    kind: relativePath === 'reports/url-confirmation-receipt.json'
      ? 'url_confirmation'
      : relativePath.startsWith('reports/') ? 'review_report'
        : relativePath.startsWith('sheets/') ? 'contact_sheet' : 'storyboard',
  });
}
const evidenceReceipt = {
  schema: 'munjanggun.reviewEvidenceReceipt.v1',
  version: '1.0',
  intakeId: intakeReceipt.intakeId,
  sealedAt: new Date().toISOString(),
  fileCount: evidenceEntries.length,
  treeHash: hashEvidenceEntries(evidenceEntries),
  entries: evidenceEntries,
};
const evidenceSchema = await readJson(fileURLToPath(new URL('../schemas/review-evidence-receipt.schema.json', import.meta.url)));
assertSchema(evidenceReceipt, evidenceSchema, 'review evidence receipt');
const evidenceReceiptPath = join(evidenceRoot, 'receipt.json');
await writeJsonNew(evidenceReceiptPath, evidenceReceipt);
const evidenceReceiptSha256 = await sha256File(evidenceReceiptPath);

const [catalog, similarityMap, manifests] = await Promise.all([
  readJson(catalogPath),
  readJson(similarityPath),
  readCandidateManifests(candidateRoot),
]);
const assetsByHash = new Map();
for (const asset of manifests.flatMap((manifest) => manifest.assets)) {
  const group = assetsByHash.get(asset.sha256) ?? [];
  group.push(asset);
  assetsByHash.set(asset.sha256, group);
}
const sealedCatalog = {
  ...catalog,
  reviewEvidenceReceiptRef: '../review-evidence/receipt.json',
  reviewEvidenceReceiptSha256: evidenceReceiptSha256,
  entries: catalog.entries.map((entry) => {
    const assets = assetsByHash.get(entry.sha256);
    if (!assets) throw new Error(`No manifest assets for catalog SHA ${entry.sha256}`);
    return {
      ...entry,
      rightsStatus: strictest(assets.map((asset) => asset.rightsStatus), ['restricted', 'expired', 'not_reviewed', 'pending', 'verified']),
      rightsScope: intersection(assets.map((asset) => asset.rightsScope)),
      rightsEvidenceRef: intersection(assets.map((asset) => asset.rightsEvidenceRef)),
      privacyStatus: strictest(assets.map((asset) => asset.privacyStatus), ['needs_redaction', 'restricted', 'not_reviewed', 'cleared']),
      claimReviewStatus: strictest(assets.map((asset) => asset.claimReviewStatus), ['restricted', 'expired', 'needs_confirmation', 'not_reviewed', 'verified', 'not_applicable']),
      publishStatus: strictest(assets.map((asset) => asset.publishStatus), ['blocked', 'withdrawn', 'needs_confirmation', 'eligible', 'published']),
      publicRepoEligibility: strictest(assets.map((asset) => asset.publicRepoEligibility), ['prohibited', 'not_reviewed', 'eligible']),
      reviewEvidenceRefs: (entry.reviewEvidenceRefs ?? []).map(toSealedReviewRef),
    };
  }),
};
const sealedSimilarity = {
  ...similarityMap,
  reviewEvidenceReceiptRef: '../review-evidence/receipt.json',
  reviewEvidenceReceiptSha256: evidenceReceiptSha256,
  entries: similarityMap.entries.map((entry) => ({
    ...entry,
    humanReviewEvidence: entry.humanReviewEvidence.map(toSealedReviewRef),
  })),
};
const confirmationRelativeRef = '../review-evidence/reports/url-confirmation-receipt.json';
const sealedUrlReview = {
  ...urlReview,
  confirmationReceiptRef: confirmationRelativeRef,
  confirmationReceiptSha256: await sha256File(urlConfirmationPath),
};
const schemas = await Promise.all([
  readJson(fileURLToPath(new URL('../schemas/asset-content-catalog.schema.json', import.meta.url))),
  readJson(fileURLToPath(new URL('../schemas/asset-visual-similarity-map.schema.json', import.meta.url))),
  readJson(fileURLToPath(new URL('../schemas/asset-url-review.schema.json', import.meta.url))),
]);
assertSchema(sealedCatalog, schemas[0], 'sealed content catalog');
assertSchema(sealedSimilarity, schemas[1], 'sealed visual similarity map');
assertSchema(sealedUrlReview, schemas[2], 'sealed URL review');
await writeJsonNew(catalogOutput, sealedCatalog);
await writeJsonNew(similarityOutput, sealedSimilarity);
await writeJsonNew(urlReviewOutput, sealedUrlReview);

console.log(`Evidence sealed: ${evidenceReceipt.fileCount} files / tree ${evidenceReceipt.treeHash}`);
console.log(`Catalog evidence refs: ${sealedCatalog.entries.reduce((sum, entry) => sum + entry.reviewEvidenceRefs.length, 0)}.`);
console.log(`Similarity evidence refs: ${sealedSimilarity.entries.reduce((sum, entry) => sum + entry.humanReviewEvidence.length, 0)}.`);
console.log(`URL confirmations: ${sealedUrlReview.recordCount}.`);

function normalizeEvidenceValue(value, names) {
  if (Array.isArray(value)) return value.map((item) => normalizeEvidenceValue(item, names));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeEvidenceValue(item, names)]));
  if (typeof value !== 'string') return value;
  const mapped = sourceMappings.get(normalizeAbsolute(value));
  if (mapped) return mapped;
  const fileName = basename(value.replaceAll('\\', '/'));
  if (names.rootSheets.has(fileName)) return `sheets/${fileName}`;
  if (names.storyboardNames.has(fileName)) return `storyboards/${fileName}`;
  const objectMatch = value.replaceAll('\\', '/').match(/objects\/(sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.[A-Za-z0-9]+)$/i);
  if (objectMatch) return `object://${objectMatch[1].toLowerCase()}`;
  if (/^[A-Za-z]:[\\/]/.test(value)) return `local-source://${fileName}`;
  return value;
}

function toSealedReviewRef(value) {
  const [path, fragment] = String(value).split('#', 2);
  return `../review-evidence/reports/${basename(path)}${fragment ? `#${fragment}` : ''}`;
}

async function readCandidateManifests(root) {
  const paths = await findFiles(resolve(root, 'manifests'), (path) => path.endsWith('asset-manifest.json'));
  return Promise.all(paths.map(readJson));
}

function strictest(values, order) {
  for (const candidate of order) if (values.includes(candidate)) return candidate;
  throw new Error(`Unknown state values: ${values.join(', ')}`);
}

function intersection(lists) {
  if (lists.length === 0) return [];
  return [...new Set(lists[0])].filter((value) => lists.every((list) => list.includes(value))).sort();
}

function hashJson(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function hashEvidenceEntries(entries) {
  const hash = createHash('sha256');
  for (const entry of entries) hash.update(`${entry.relativePath}\0${entry.byteSize}\0${entry.sha256}\n`, 'utf8');
  return hash.digest('hex');
}

function normalizeAbsolute(path) {
  return resolve(path).replaceAll('\\', '/').toLowerCase();
}

function assertSchema(value, schema, label) {
  const result = validateAgainstSchema(value, schema);
  if (!result.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJsonNew(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
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
