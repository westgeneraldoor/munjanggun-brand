#!/usr/bin/env node
import { readFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { resolveContainedPath } from './lib/asset-paths.mjs';
import { buildCountList, validateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { canonicalExtensionForMediaType, inspectMedia } from './lib/media-metadata.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const sourceRoot = resolve(requiredArg('--source'));
const receiptPath = resolve(requiredArg('--receipt'));
const outputRoot = resolve(requiredArg('--output-root'));
const intakeId = requiredArg('--intake-id');
await requireEmptyOutput(outputRoot);

const schemas = await loadSchemas();
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
assertSchema(receipt, schemas.receipt, 'receipt');
if (receipt.intakeId !== intakeId) throw new Error(`Receipt intakeId ${receipt.intakeId} does not match ${intakeId}`);
if (receipt.recoveryVerification.status !== 'verified') throw new Error('Receipt recovery is not verified.');

const visualEntries = receipt.entries.filter((entry) => entry.disposition === 'managed' && entry.kind === 'visual');
const metadataByHash = new Map();
for (const entry of visualEntries) {
  if (metadataByHash.has(entry.sha256)) continue;
  const sourcePath = resolveContainedPath(sourceRoot, entry.sourceRelativePath, 'sourceRelativePath');
  metadataByHash.set(entry.sha256, await inspectMedia(sourcePath));
}

const now = new Date().toISOString();
const assetsByProduct = new Map();
const sortedVisuals = [...visualEntries].sort((left, right) => natural(left.sourceRelativePath, right.sourceRelativePath));
for (const entry of sortedVisuals) {
  const productFolder = entry.sourceRelativePath.split('/')[0];
  const config = productConfig(productFolder);
  const productAssets = assetsByProduct.get(productFolder) ?? [];
  const metadata = metadataByHash.get(entry.sha256);
  const canonicalExtension = canonicalExtensionForMediaType(metadata.mediaType);
  const sourceOrder = productAssets.length + 1;
  const folderRole = folderRoleFor(entry.sourceRelativePath);
  productAssets.push({
    assetInstanceId: `ASSET-${intakeId.replace('INTAKE-', '')}-${config.slug.toUpperCase()}-${String(sourceOrder).padStart(4, '0')}`,
    productId: config.productId,
    sourceId: config.sourceId,
    sourceRelativePath: entry.sourceRelativePath,
    logicalPath: `문장군상품/${entry.sourceRelativePath}`,
    sourceOrder,
    objectId: `sha256:${entry.sha256}`,
    objectRef: `sha256/${entry.sha256.slice(0, 2)}/${entry.sha256}${canonicalExtension}`,
    sha256: entry.sha256,
    byteSize: entry.byteSize,
    originalExtension: extname(entry.sourceRelativePath).toLowerCase(),
    mediaType: metadata.mediaType,
    width: metadata.width,
    height: metadata.height,
    frameCount: metadata.frameCount,
    durationMs: metadata.durationMs,
    loopCount: metadata.loopCount,
    folderRole,
    contentId: `CONTENT-CANDIDATE-${entry.sha256.slice(0, 16).toUpperCase()}`,
    binaryGroupId: `sha256:${entry.sha256}`,
    visualGroupId: null,
    comparisonMethod: ['sha256_exact'],
    humanReviewStatus: 'not_reviewed',
    preservationStatus: 'verified',
    privacyStatus: 'not_reviewed',
    rightsStatus: 'not_reviewed',
    rightsScope: [],
    rightsEvidenceRef: [],
    claimRisk: folderRole === '이벤트 및 공지' ? 'high' : 'medium',
    claimReviewStatus: 'not_reviewed',
    claimEvidenceRef: [],
    publishStatus: 'blocked',
    publishConditions: ['human_review_required', 'privacy_review_required', 'rights_review_required', 'claim_review_required'],
    publicRepoEligibility: 'not_reviewed',
    publicSyncStatus: 'absent',
    publicObjectRef: null,
    notes: '',
  });
  assetsByProduct.set(productFolder, productAssets);
}

const manifests = [];
for (const [productFolder, assets] of [...assetsByProduct.entries()].sort(([left], [right]) => natural(left, right))) {
  const config = productConfig(productFolder);
  const manifest = {
    schema: 'munjanggun.productDetailAssets.v2',
    version: '2.0',
    generatedAt: now,
    updatedAt: now,
    intakeId,
    sourceId: config.sourceId,
    productId: config.productId,
    product: config.product,
    assetCount: assets.length,
    roleCounts: buildCountList(assets, 'folderRole'),
    claimRiskCounts: buildCountList(assets, 'claimRisk'),
    rightsStatusCounts: buildCountList(assets, 'rightsStatus'),
    publishStatusCounts: buildCountList(assets, 'publishStatus'),
    assets,
  };
  const findings = validateManifestV2(manifest, schemas.manifest);
  if (findings.length > 0) throw new Error(`${productFolder}: ${findings.map((finding) => finding.message).join('; ')}`);
  const path = resolveContainedPath(outputRoot, `manifests/${productFolder}/asset-manifest.json`, 'candidate manifest path');
  await writeJsonNew(path, manifest);
  manifests.push(manifest);
}

const groups = new Map();
for (const manifest of manifests) {
  for (const asset of manifest.assets) {
    const group = groups.get(asset.sha256) ?? [];
    group.push(asset);
    groups.set(asset.sha256, group);
  }
}
const catalog = {
  schema: 'munjanggun.assetContentCatalog.v2',
  version: '2.0',
  intakeId,
  generatedAt: now,
  binaryGroupCount: groups.size,
  entries: [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([sha256, assets]) => ({
    binaryGroupId: `sha256:${sha256}`,
    objectRef: assets[0].objectRef,
    sha256,
    byteSize: assets[0].byteSize,
    mediaType: assets[0].mediaType,
    sourcePathCount: assets.length,
    sourceRefs: assets.map((asset) => ({ sourceId: asset.sourceId, sourceRelativePath: asset.sourceRelativePath })),
    contentId: assets[0].contentId,
    visualGroupId: null,
    comparisonMethod: ['sha256_exact'],
    humanReviewStatus: 'not_reviewed',
    semanticSummary: '',
    ocrText: '',
    gifReviewStatus: assets[0].mediaType === 'image/gif' ? 'not_reviewed' : 'not_applicable',
    claimSignals: [],
    privacySignals: [],
    rightsSignals: [],
    rightsStatus: 'not_reviewed',
    rightsScope: [],
    rightsEvidenceRef: [],
    privacyStatus: 'not_reviewed',
    claimReviewStatus: 'not_reviewed',
    claimEvidenceRef: [],
    publishStatus: 'blocked',
    publicRepoEligibility: 'not_reviewed',
  })),
};
assertSchema(catalog, schemas.catalog, 'content catalog');
await writeJsonNew(resolveContainedPath(outputRoot, 'content-catalog.json'), catalog);

const gifAssets = visualEntries.filter((entry) => extname(entry.sourceRelativePath).toLowerCase() === '.gif');
const gates = {
  schema: 'munjanggun.assetCompletionGates.v2',
  version: '2.0',
  intakeId,
  expected: {
    receiptManaged: receipt.counts.managed,
    visualManifestPaths: visualEntries.length,
    binaryGroups: groups.size,
    uniqueGifBinaries: new Set(gifAssets.map((entry) => entry.sha256)).size,
    gifSourcePaths: gifAssets.length,
    unresolvedVisualGroups: 0,
    urlRecords: receipt.counts.url,
    unverifiedRightsPublishable: 0,
    receiptMismatch: 0,
    visualGroups: 0,
  },
};
assertSchema(gates, schemas.gates, 'completion gates');
await writeJsonNew(resolveContainedPath(outputRoot, 'completion-gates.json'), gates);

console.log(`Candidate metadata written: ${manifests.length} products, ${visualEntries.length} visual paths, ${groups.size} binary groups.`);
console.log(`GIF mapping: ${gifAssets.length} paths, ${gates.expected.uniqueGifBinaries} unique binaries.`);

async function loadSchemas() {
  const schemaDir = new URL('../schemas/', import.meta.url);
  const names = {
    receipt: 'asset-intake-receipt.schema.json',
    manifest: 'product-detail-asset-manifest.v2.schema.json',
    catalog: 'asset-content-catalog.schema.json',
    gates: 'asset-completion-gates.schema.json',
  };
  return Object.fromEntries(await Promise.all(Object.entries(names).map(async ([key, name]) => [key, JSON.parse(await readFile(new URL(name, schemaDir), 'utf8'))])));
}

function assertSchema(value, schema, label) {
  const result = validateAgainstSchema(value, schema);
  if (!result.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`);
}

async function writeJsonNew(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

async function requireEmptyOutput(path) {
  await mkdir(path, { recursive: true });
  if ((await readdir(path)).length > 0) throw new Error(`Output root must be empty: ${path}`);
}

function folderRoleFor(sourceRelativePath) {
  const segments = sourceRelativePath.split('/');
  return segments.length <= 2 ? 'root' : segments[1];
}

function productConfig(folder) {
  const configs = {
    '3연동 자동중문': ['PROD-3PANEL-AUTO-MIDDLE-DOOR', '3연동 자동중문', '3panel-auto'],
    '3연동ㄱ자': ['PROD-3PANEL-LSHAPE-MIDDLE-DOOR', '3연동 ㄱ자 중문', '3panel-lshape'],
    '3연동중문': ['PROD-3PANEL-MIDDLE-DOOR', '3연동중문', '3panel'],
    'ABS도어 문틀리폼 필름시공': ['PROD-ABS-DOOR-FRAME-FILM', 'ABS도어 문틀리폼 필름시공', 'abs-door-frame-film'],
    'ABS도어 방문교체': ['PROD-ABS-DOOR-REPLACEMENT', 'ABS도어 방문교체', 'abs-door-replacement'],
    'ABS도어 슬라이딩도어': ['PROD-ABS-SLIDING-DOOR', 'ABS도어 슬라이딩도어', 'abs-sliding-door'],
    '몰딩': ['PROD-MOLDING', '몰딩', 'molding'],
    '스윙중문': ['PROD-SWING-MIDDLE-DOOR', '스윙중문', 'swing'],
    '양개형중문 미서기': ['PROD-WIDE-SLIDING-MIDDLE-DOOR', '양개형중문/미서기', 'wide-sliding'],
    '원슬라이딩중문': ['PROD-ONE-SLIDING-MIDDLE-DOOR', '원슬라이딩중문', 'onesliding'],
  };
  const selected = configs[folder];
  if (!selected) throw new Error(`Unknown product folder: ${folder}`);
  return {
    productId: selected[0],
    product: selected[1],
    slug: selected[2],
    sourceId: `SRC-2026-09-04-${selected[2].toUpperCase()}-DETAILPAGE`,
  };
}

function natural(left, right) {
  return left.localeCompare(right, 'ko', { numeric: true, sensitivity: 'base' });
}

function requiredArg(name) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
