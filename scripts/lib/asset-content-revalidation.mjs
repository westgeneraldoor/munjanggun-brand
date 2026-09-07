import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatSchemaErrors, validateAgainstSchema } from './schema-validation.mjs';

const PRICE_TEXT = /(?:[₩￦]\s*[\d,.]+|[\d,.]+\s*(?:원|만원|천원)|가격|정상가|할인가)/iu;
const PRICE_SIGNAL = /(?:price|pricing|discount|가격|금액|할인)/iu;
const SHA256 = /^[a-f0-9]{64}$/u;
const TAG_KEYS = ['productTypes', 'scenes', 'colors', 'designs', 'topics'];

export async function buildVerifiedContentAuthority({
  catalogPath,
  objectRoot,
  rawRoot,
  reviewFiles,
  outputRoot,
  generatedAt = new Date().toISOString(),
  repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url))),
} = {}) {
  if (!catalogPath || !objectRoot || !rawRoot || !outputRoot || !Array.isArray(reviewFiles) || reviewFiles.length < 1) {
    throw new Error('catalogPath, objectRoot, rawRoot, reviewFiles, and outputRoot are required');
  }
  const destination = resolve(outputRoot);
  if (!isAbsolute(outputRoot)) throw new Error('Output root must be absolute');
  if (isContained(resolve(repoRoot), destination)) throw new Error('Verified content authority must be stored outside the public repository');
  await assertMissing(destination, 'Output root');

  const [catalogBytes, rawReviews, reviewSchema, overlaySchema, receiptSchema] = await Promise.all([
    readFile(resolve(catalogPath)),
    Promise.all(reviewFiles.map(async (path) => ({ path: resolve(path), bytes: await readFile(resolve(path)) }))),
    readJson(new URL('../../schemas/asset-content-review-shard.schema.json', import.meta.url)),
    readJson(new URL('../../schemas/asset-content-overlay.schema.json', import.meta.url)),
    readJson(new URL('../../schemas/asset-content-revalidation-receipt.schema.json', import.meta.url)),
  ]);
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  if (!Array.isArray(catalog.entries) || catalog.entries.length !== catalog.binaryGroupCount) {
    throw new Error('Base catalog entry count is invalid');
  }
  const baseCatalogSha256 = digest(catalogBytes);
  const resolvedObjectRoot = resolve(objectRoot);
  const baselineBySha = uniqueMap(catalog.entries, (entry) => entry.sha256, 'base catalog');
  await Promise.all(catalog.entries.map(async (entry) => {
    const objectPath = resolve(resolvedObjectRoot, ...String(entry.objectRef ?? '').split('/'));
    if (!isContained(resolvedObjectRoot, objectPath) || objectPath === resolvedObjectRoot) {
      throw new Error(`Object reference escapes object root for ${entry.sha256}`);
    }
    const objectBytes = await readFile(objectPath);
    if (digest(objectBytes) !== entry.sha256 || objectBytes.length !== entry.byteSize) {
      throw new Error(`Object store file mismatch for ${entry.sha256}`);
    }
  }));
  const normalizedReviews = [];
  const reviewedBySha = new Map();

  for (const raw of rawReviews) {
    const document = JSON.parse(raw.bytes.toString('utf8'));
    const shard = await normalizeReviewShard(document, raw.path, catalog, baselineBySha, resolve(rawRoot));
    assertSchema(shard, reviewSchema, `normalized review shard ${shard.shardId}`);
    for (const entry of shard.entries) {
      if (reviewedBySha.has(entry.sourceObjectSha256)) throw new Error(`Duplicate review SHA: ${entry.sourceObjectSha256}`);
      reviewedBySha.set(entry.sourceObjectSha256, { shard, entry });
    }
    normalizedReviews.push({ raw, shard });
  }

  const missing = [...baselineBySha.keys()].filter((sha256) => !reviewedBySha.has(sha256));
  if (missing.length) throw new Error(`Missing visual review coverage for ${missing.length} SHA(s): ${missing.slice(0, 5).join(', ')}`);
  if (reviewedBySha.size !== baselineBySha.size) throw new Error('Visual review count does not match the base catalog');
  const needsEscalation = [...reviewedBySha.values()].filter(({ entry }) => entry.humanReviewStatus !== 'verified');
  if (needsEscalation.length) {
    throw new Error(`Visual review is not fully verified: ${needsEscalation.length} entry(s) need escalation`);
  }

  assertKnownRegressionCases(reviewedBySha);
  const partial = `${destination}.partial-${process.pid}-${Date.now()}`;
  await mkdir(resolve(partial, 'reviews'), { recursive: true });
  try {
    const sealedReviewFiles = [];
    for (const { raw, shard } of normalizedReviews) {
      const filename = safeShardFilename(shard.shardId, raw.path);
      const path = resolve(partial, 'reviews', filename);
      const bytes = jsonBytes(shard);
      await writeFile(path, bytes, { flag: 'wx' });
      sealedReviewFiles.push({ path, filename, bytes, entryCount: shard.entries.length });
    }
    const evidenceRefBySha = new Map();
    for (const item of sealedReviewFiles) {
      const shard = JSON.parse(item.bytes.toString('utf8'));
      for (const entry of shard.entries) {
        evidenceRefBySha.set(entry.sourceObjectSha256, [
          `${resolve(destination, 'reviews', item.filename)}#sha256=${entry.sourceObjectSha256}`,
          entry.originalPath,
          ...entry.evidenceRefs,
        ].filter((value, index, values) => values.indexOf(value) === index));
      }
    }
    const overlay = {
      schema: 'munjanggun.assetContentOverlay.v1',
      version: '1.0',
      intakeId: catalog.intakeId,
      generatedAt,
      baseCatalogSha256,
      entryCount: catalog.entries.length,
      entries: catalog.entries.map((baseline) => toOverlayEntry(reviewedBySha.get(baseline.sha256).entry, evidenceRefBySha.get(baseline.sha256))),
    };
    assertSchema(overlay, overlaySchema, 'content overlay');
    const overlayBytes = jsonBytes(overlay);
    const overlaySha256 = digest(overlayBytes);
    await writeFile(resolve(partial, 'content-overlay.json'), overlayBytes, { flag: 'wx' });

    const receiptReviewFiles = sealedReviewFiles.map((item) => ({
      path: resolve(destination, 'reviews', item.filename),
      sha256: digest(item.bytes),
      entryCount: item.entryCount,
    }));
    const treeHash = digest(Buffer.from([
      `${overlaySha256}  content-overlay.json`,
      ...receiptReviewFiles.map((entry) => `${entry.sha256}  ${entry.path}`),
    ].sort().join('\n') + '\n', 'utf8'));
    const gifEntries = overlay.entries.filter((entry) => baselineBySha.get(entry.sha256).mediaType === 'image/gif');
    const receipt = {
      schema: 'munjanggun.assetContentRevalidationReceipt.v1',
      version: '1.0',
      intakeId: catalog.intakeId,
      sealedAt: generatedAt,
      baseCatalogSha256,
      overlaySha256,
      entryCount: overlay.entryCount,
      verifiedCount: overlay.entries.length,
      needsEscalationCount: 0,
      staticCount: overlay.entries.length - gifEntries.length,
      gifCount: gifEntries.length,
      fullLoopGifCount: gifEntries.filter((entry) => entry.gifMetadata?.movementEvidence === 'full_loop_reviewed').length,
      reviewFiles: receiptReviewFiles,
      treeHash,
    };
    assertSchema(receipt, receiptSchema, 'content revalidation receipt');
    await writeFile(resolve(partial, 'receipt.json'), jsonBytes(receipt), { flag: 'wx' });
    await rename(partial, destination);
    return {
      outputRoot: destination,
      overlayPath: resolve(destination, 'content-overlay.json'),
      overlaySha256,
      receiptPath: resolve(destination, 'receipt.json'),
      receiptSha256: digest(jsonBytes(receipt)),
      baseCatalogSha256,
      entryCount: overlay.entryCount,
      staticCount: receipt.staticCount,
      gifCount: receipt.gifCount,
    };
  } catch (error) {
    await rm(partial, { recursive: true, force: true });
    throw error;
  }
}

export function computeContentDecisionHash(entry) {
  const decision = {
    sourceObjectSha256: entry.sourceObjectSha256,
    originalPath: entry.originalPath,
    sourceRefs: normalizeSourceRefs(entry.sourceRefs),
    mediaType: entry.mediaType,
    semanticSummary: entry.semanticSummary,
    assetType: entry.assetType,
    useCases: uniqueStrings(entry.useCases),
    searchTags: normalizeSearchTags(entry.searchTags),
    visibleText: uniqueStrings(entry.visibleText),
    ocrText: entry.ocrText,
    claimSignals: uniqueStrings(entry.claimSignals),
    privacySignals: uniqueStrings(entry.privacySignals),
    humanReviewStatus: entry.humanReviewStatus,
    annotationMethod: entry.annotationMethod,
    evidenceRefs: uniqueStrings(entry.evidenceRefs),
    reviewNotes: entry.reviewNotes,
    gifReview: entry.gifReview ?? null,
  };
  return digest(Buffer.from(canonicalJson(decision), 'utf8'));
}

async function normalizeReviewShard(raw, rawPath, catalog, baselineBySha, rawRoot) {
  if (raw?.intakeId !== catalog.intakeId || !Array.isArray(raw?.entries)) {
    throw new Error(`Review file does not match catalog intake or has no entries: ${rawPath}`);
  }
  const mediaKind = inferMediaKind(raw, rawPath);
  const reviewer = String(raw.reviewer ?? raw.reviewEvidence?.reviewer ?? raw.entries[0]?.reviewEvidence?.reviewer ?? '').trim();
  const reviewedAt = normalizeDate(raw.reviewedAt ?? raw.entries[0]?.reviewEvidence?.reviewedAt);
  const shardId = String(raw.reportId ?? raw.reviewId ?? raw.shardId ?? basename(rawPath, '.json')).trim();
  const entries = [];
  for (const source of raw.entries) {
    const sourceObjectSha256 = String(source.sourceObjectSha256 ?? source.sha256 ?? '').toLowerCase();
    if (!SHA256.test(sourceObjectSha256) || !baselineBySha.has(sourceObjectSha256)) {
      throw new Error(`${shardId}: unknown or invalid SHA ${sourceObjectSha256}`);
    }
    const baseline = baselineBySha.get(sourceObjectSha256);
    const entry = await normalizeReviewEntry(source, baseline, { reviewer, reviewedAt, mediaKind, rawRoot });
    entry.decisionHash = computeContentDecisionHash(entry);
    entries.push(entry);
  }
  return {
    schema: 'munjanggun.assetContentReviewShard.v2',
    version: '2.0',
    intakeId: catalog.intakeId,
    shardId,
    mediaKind,
    reviewedAt,
    reviewer,
    entries,
  };
}

async function normalizeReviewEntry(source, baseline, context) {
  const suppliedOriginalPath = String(source.originalPath ?? source.reviewEvidence?.originalPath ?? '');
  const originalPath = isAbsolute(suppliedOriginalPath)
    ? resolve(suppliedOriginalPath)
    : resolve(context.rawRoot, ...suppliedOriginalPath.split('/'));
  const evidenceMethod = String(source.annotationMethod ?? source.reviewEvidence?.method ?? '').trim();
  const annotationMethod = context.mediaKind === 'gif' ? 'full_loop_original_reviewed' : 'full_resolution_original_reviewed';
  const allowedMethods = context.mediaKind === 'gif'
    ? new Set(['full_loop_original_reviewed', 'full_loop_original_opened', 'full_loop_reviewed'])
    : new Set(['full_resolution_original_reviewed', 'full_resolution_original_opened']);
  if (!allowedMethods.has(evidenceMethod)) throw new Error(`Review method is insufficient for ${baseline.sha256}: ${evidenceMethod}`);
  const sourceRefs = source.sourceRefs ?? [];
  if (JSON.stringify(normalizeSourceRefs(sourceRefs)) !== JSON.stringify(normalizeSourceRefs(baseline.sourceRefs))) {
    throw new Error(`Review sourceRefs mismatch for ${baseline.sha256}`);
  }
  const allowedOriginals = sourceRefs.map((ref) => resolve(context.rawRoot, ...String(ref.sourceRelativePath).split('/')));
  if (!allowedOriginals.includes(originalPath) || !isContained(context.rawRoot, originalPath)) {
    throw new Error(`Review originalPath is not one of the catalog source paths for ${baseline.sha256}`);
  }
  const originalBytes = await readFile(originalPath);
  if (digest(originalBytes) !== baseline.sha256) throw new Error(`Original file hash mismatch for ${baseline.sha256}`);
  const originalStat = await stat(originalPath);
  if (!originalStat.isFile() || originalStat.size !== baseline.byteSize) throw new Error(`Original file facts mismatch for ${baseline.sha256}`);

  const visibleText = normalizeVisibleText(source.visibleText ?? source.visibleTextVerified ?? source.ocrText);
  const ocrText = String(source.ocrText ?? visibleText.join('; ')).trim();
  const claimSignals = uniqueStrings(source.claimSignals);
  const hasPriceText = PRICE_TEXT.test([ocrText, ...visibleText].join(' '));
  const hasPriceSignal = claimSignals.some((value) => PRICE_SIGNAL.test(value));
  if (hasPriceText && !hasPriceSignal) {
    if (source.explicitClaimFalsePositive !== true || !String(source.explicitClaimFalsePositiveReason ?? '').trim()) {
      throw new Error(`Visible price text requires a price claim signal for ${baseline.sha256}`);
    }
  }
  const status = String(source.humanReviewStatus ?? source.verificationStatus ?? '').trim();
  const humanReviewStatus = status === 'verified' ? 'verified' : 'needs_escalation';
  const searchTags = normalizeSearchTags(source.searchTags);
  const assetType = String(source.assetType ?? source.contentType ?? '').trim();
  const semanticSummary = String(source.semanticSummary ?? source.observedSummary ?? '').trim();
  if (!semanticSummary || !assetType) throw new Error(`Review meaning is incomplete for ${baseline.sha256}`);
  const uncertainties = uniqueStrings(source.uncertainties);
  const reviewNotes = String(source.reviewNotes ?? uncertainties.join('; ')).trim();
  const evidenceRefs = uniqueStrings([
    ...extractEvidencePaths(source.evidenceRefs),
    ...(source.reviewEvidence?.storyboardPaths ?? []),
  ]);
  const entry = {
    sourceObjectSha256: baseline.sha256,
    originalPath,
    sourceRefs,
    mediaType: baseline.mediaType,
    semanticSummary,
    assetType,
    useCases: uniqueStrings(source.useCases?.length ? source.useCases : [...searchTags.topics, assetType]),
    searchTags,
    visibleText,
    ocrText,
    claimSignals,
    privacySignals: uniqueStrings(source.privacySignals),
    humanReviewStatus,
    reviewer: String(source.reviewer ?? source.reviewEvidence?.reviewer ?? context.reviewer).trim(),
    reviewedAt: normalizeDate(source.reviewedAt ?? source.reviewEvidence?.reviewedAt ?? context.reviewedAt),
    annotationMethod,
    evidenceRefs,
    reviewNotes,
  };
  if (source.explicitClaimFalsePositive === true) {
    entry.explicitClaimFalsePositive = true;
    entry.explicitClaimFalsePositiveReason = String(source.explicitClaimFalsePositiveReason).trim();
  }
  if (context.mediaKind === 'gif') entry.gifReview = await normalizeGifReview(source, baseline);
  return entry;
}

async function normalizeGifReview(source, baseline) {
  const evidence = source.gifReview ?? source.reviewEvidence ?? source;
  const movementEvidence = String(source.movementEvidence ?? evidence.movementEvidence ?? '').trim();
  if (movementEvidence !== 'full_loop_reviewed') throw new Error(`GIF lacks full-loop evidence: ${source.sha256 ?? source.sourceObjectSha256}`);
  const storyboardPaths = uniqueStrings(source.storyboardPaths ?? evidence.storyboardPaths);
  for (const path of storyboardPaths) {
    const info = await stat(resolve(path));
    if (!info.isFile()) throw new Error(`GIF storyboard is not a file for ${baseline.sha256}`);
  }
  for (const item of Array.isArray(source.evidenceRefs) ? source.evidenceRefs : []) {
    if (!item || typeof item !== 'object') continue;
    if (item.targetSha256 && item.targetSha256 !== baseline.sha256) throw new Error(`GIF evidence target SHA mismatch for ${baseline.sha256}`);
    if (item.kind === 'source_original_full_loop') {
      const bytes = await readFile(resolve(item.path));
      if (digest(bytes) !== baseline.sha256 || item.sha256 !== baseline.sha256 || item.reviewCoverage !== 'full_loop') {
        throw new Error(`GIF full-loop source evidence mismatch for ${baseline.sha256}`);
      }
    }
  }
  return {
    frameCount: positiveInteger(source.frameCount ?? evidence.frameCount, 'GIF frameCount'),
    durationMs: nonnegativeInteger(source.durationMs ?? evidence.durationMs, 'GIF durationMs'),
    loopBehavior: String(source.loopBehavior ?? evidence.loopBehavior ?? '').trim() || 'full loop reviewed',
    movementEvidence,
    storyboardPaths,
  };
}

function extractEvidencePaths(values) {
  return (Array.isArray(values) ? values : []).map((value) => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && value.path) return String(value.path);
    return '';
  }).filter(Boolean);
}

function toOverlayEntry(entry, reviewEvidenceRefs) {
  return {
    sha256: entry.sourceObjectSha256,
    semanticSummary: entry.semanticSummary,
    assetType: entry.assetType,
    useCases: entry.useCases,
    searchTags: entry.searchTags,
    ocrText: entry.ocrText,
    claimSignals: entry.claimSignals,
    privacySignals: entry.privacySignals,
    humanReviewStatus: 'verified',
    annotationMethod: entry.annotationMethod,
    reviewEvidenceRefs,
    decisionHash: entry.decisionHash,
    gifMetadata: entry.gifReview ?? null,
  };
}

function assertKnownRegressionCases(reviewedBySha) {
  const cases = [
    ['4fc48031ae77696f947ed56c2c00b425832f6d618a68efcc7bc04817ba8c33ba', /디자인/u, true],
    ['2fb65ed2ab2e2181d6baa1a8afd215d8e4cb6452467ab00e018254aa5f752f07', /디자인/u, true],
    ['6fdb8bfd8071f6fdb4edf73f7678d25e61d3408eef4e0de3882d859f1f4086d7', /디자인/u, false],
  ];
  for (const [sha256, summaryPattern, requiresPrice] of cases) {
    if (!reviewedBySha.has(sha256)) continue;
    const entry = reviewedBySha.get(sha256)?.entry;
    if (!entry || !summaryPattern.test(entry.semanticSummary)) throw new Error(`Known semantic regression remains for ${sha256}`);
    if (/개폐 기능|천천히 닫|통행 공간/u.test(entry.semanticSummary)) throw new Error(`Known motion misclassification remains for ${sha256}`);
    if (requiresPrice && !entry.claimSignals.some((value) => PRICE_SIGNAL.test(value))) {
      throw new Error(`Known price claim regression remains for ${sha256}`);
    }
  }
}

function inferMediaKind(raw, path) {
  const rawKind = String(raw.mediaKind ?? raw.batch ?? raw.reportId ?? raw.reviewId ?? basename(path)).toLowerCase();
  return rawKind.includes('gif') ? 'gif' : 'static';
}

function normalizeSearchTags(tags = {}) {
  const result = {};
  for (const key of TAG_KEYS) {
    const sourceKey = key === 'productTypes' && !tags.productTypes ? 'products' : key;
    result[key] = uniqueStrings(tags[sourceKey]);
  }
  return result;
}

function normalizeVisibleText(value) {
  if (Array.isArray(value)) return uniqueStrings(value);
  const text = String(value ?? '').trim();
  return text ? [text] : [];
}

function normalizeSourceRefs(refs = []) {
  return refs.map((entry) => ({ sourceId: String(entry.sourceId), sourceRelativePath: String(entry.sourceRelativePath) }))
    .sort((left, right) => `${left.sourceId}\0${left.sourceRelativePath}`.localeCompare(`${right.sourceId}\0${right.sourceRelativePath}`));
}

function safeShardFilename(shardId, rawPath) {
  const safe = shardId.replace(/[^A-Za-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '');
  return `${safe || basename(rawPath, '.json')}.json`;
}

function uniqueMap(values, keyOf, label) {
  const result = new Map();
  for (const value of values ?? []) {
    const key = keyOf(value);
    if (!key || result.has(key)) throw new Error(`${label} contains a missing or duplicate key: ${key}`);
    result.set(key, value);
  }
  return result;
}

function uniqueStrings(values = []) {
  return [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))].sort();
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} must be a positive integer`);
  return number;
}

function nonnegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be a nonnegative integer`);
  return number;
}

function normalizeDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.valueOf())) throw new Error(`Invalid review date: ${value}`);
  return date.toISOString();
}

function assertSchema(value, schema, label) {
  const validation = validateAgainstSchema(value, schema);
  if (!validation.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(validation.errors).join('\n')}`);
}

async function assertMissing(path, label) {
  try {
    await stat(path);
    throw new Error(`${label} already exists: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function isContained(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function readJson(path) {
  return JSON.parse(await readFile(fileURLToPath(path), 'utf8'));
}
