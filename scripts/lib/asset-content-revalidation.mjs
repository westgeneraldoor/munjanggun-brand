import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectMedia } from './media-metadata.mjs';
import { decodeGifFramePixels, GIF_PIXEL_DECODER_VERSION, readPngPixelFact } from './gif-frame-pixels.mjs';
import { decodeStaticRegionPixels, encodeRgbaPng, readCropPngPixels, STATIC_PIXEL_DECODER_VERSION, STATIC_PNG_ENCODER_VERSION } from './static-image-region-pixels.mjs';
import { normalizeReviewerPrincipal, parseContentReviewerTrust, verifyTrustedContentReviewerSignature } from './asset-content-reviewer-trust.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './schema-validation.mjs';

export const CONTENT_AUTHORITY_CONTRACT_VERSION = 'content-evidence-v3';

const PRICE_TEXT = /(?:[₩￦]\s*[\d,.]+|[\d,.]+\s*(?:원|만원|천원)|가격|정상가|할인가|할인율|월\s*납입)/iu;
const PRICE_SIGNAL = /(?:price|pricing|discount|가격|금액|할인)/iu;
const AS_TEXT = /(?:\bA\s*\/?\s*S\b|에이\s*\/?\s*에스|보증|무상\s*수리)/iu;
const EVENT_TEXT = /(?:이벤트|행사|프로모션|증정|사은품|혜택)/iu;
const SPEC_TEXT = /(?:\d+(?:\.\d+)?\s*(?:mm|㎜|cm|t)\b|강화\s*유리|유리\s*두께|제품\s*규격|제품\s*사이즈)/iu;
const REVIEW_TEXT = /(?:(?:고객|포토)?\s*(?:리뷰|후기)\s*[\d,]+\s*(?:개|건)|고객\s*(?:리뷰|후기)|만족도\s*[\d.]+\s*%)/iu;
const SCHEDULE_TEXT = /(?:\d+\s*(?:일|시간)\s*(?:이내|내|만에)\s*(?:시공|설치|완료)?|당일\s*(?:시공|설치|완료)|(?:시공|설치)\s*일정)/iu;
const SHA256 = /^[a-f0-9]{64}$/u;
const TAG_KEYS = ['productTypes', 'scenes', 'colors', 'designs', 'topics'];

export async function buildVerifiedContentAuthority({
  catalogPath,
  profilePath,
  objectRoot,
  rawRoot,
  reviewFiles,
  reviewerTrustPath,
  outputRoot,
  generatedAt = new Date().toISOString(),
  repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url))),
} = {}) {
  if (!catalogPath || !profilePath || !objectRoot || !rawRoot || !outputRoot || !reviewerTrustPath || !Array.isArray(reviewFiles) || reviewFiles.length < 1) {
    throw new Error('catalogPath, profilePath, objectRoot, rawRoot, reviewFiles, reviewerTrustPath, and outputRoot are required');
  }
  const destination = resolve(outputRoot);
  if (!isAbsolute(outputRoot)) throw new Error('Output root must be absolute');
  if (isContained(resolve(repoRoot), destination)) throw new Error('Verified content authority must be stored outside the public repository');
  await assertMissing(destination, 'Output root');

  const sealedAt = normalizeDate(generatedAt);
  assertNotFuture(sealedAt, 'Content authority sealedAt');
  const [catalogBytes, profileBytes, reviewerTrustBytes, rawReviews, inputSchema, reviewSchema, overlaySchema, receiptSchema] = await Promise.all([
    readFile(resolve(catalogPath)),
    readFile(resolve(profilePath)),
    readFile(resolve(reviewerTrustPath)),
    Promise.all(reviewFiles.map(async (path) => ({ path: resolve(path), bytes: await readFile(resolve(path)) }))),
    readJson(new URL('../../schemas/asset-content-review-input.schema.json', import.meta.url)),
    readJson(new URL('../../schemas/asset-content-review-shard.schema.json', import.meta.url)),
    readJson(new URL('../../schemas/asset-content-overlay.schema.json', import.meta.url)),
    readJson(new URL('../../schemas/asset-content-revalidation-receipt.schema.json', import.meta.url)),
  ]);
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const profile = JSON.parse(profileBytes.toString('utf8'));
  const reviewerTrust = parseContentReviewerTrust(reviewerTrustBytes);
  if (!Array.isArray(catalog.entries) || catalog.entries.length !== catalog.binaryGroupCount) {
    throw new Error('Base catalog entry count is invalid');
  }
  const productIdentity = buildProductIdentity(profile, catalog.intakeId);
  const baseCatalogSha256 = digest(catalogBytes);
  const profileSha256 = digest(profileBytes);
  const reviewerTrustSha256 = digest(reviewerTrustBytes);
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
    assertSchema(document, inputSchema, `raw review input ${raw.path}`);
    verifyTrustedContentReviewerSignature(document, document.reviewer, reviewerTrust, `Primary review ${raw.path}`);
    const shard = await normalizeReviewShard(document, raw.path, raw.bytes, catalog, baselineBySha, resolve(rawRoot), productIdentity, sealedAt, reviewerTrust);
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
  await mkdir(resolve(partial, 'raw-reviews'), { recursive: true });
  try {
    const sealedReviewFiles = [];
    for (const { raw, shard } of normalizedReviews) {
      const filename = safeShardFilename(shard.shardId, raw.path);
      const path = resolve(partial, 'reviews', filename);
      const bytes = jsonBytes(shard);
      const rawPath = resolve(partial, 'raw-reviews', filename);
      await writeFile(path, bytes, { flag: 'wx' });
      await writeFile(rawPath, raw.bytes, { flag: 'wx' });
      sealedReviewFiles.push({ path, rawPath, filename, bytes, rawBytes: raw.bytes, entryCount: shard.entries.length });
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
      schema: 'munjanggun.assetContentOverlay.v2',
      version: '2.0',
      authorityContractVersion: CONTENT_AUTHORITY_CONTRACT_VERSION,
      intakeId: catalog.intakeId,
      generatedAt: sealedAt,
      baseCatalogSha256,
      entryCount: catalog.entries.length,
      entries: catalog.entries.map((baseline) => toOverlayEntry(reviewedBySha.get(baseline.sha256).entry, evidenceRefBySha.get(baseline.sha256))),
    };
    assertSchema(overlay, overlaySchema, 'content overlay');
    const overlayBytes = jsonBytes(overlay);
    const overlaySha256 = digest(overlayBytes);
    await writeFile(resolve(partial, 'content-overlay.json'), overlayBytes, { flag: 'wx' });
    await writeFile(resolve(partial, 'base-catalog.json'), catalogBytes, { flag: 'wx' });
    await writeFile(resolve(partial, 'intake-profile.json'), profileBytes, { flag: 'wx' });
    await writeFile(resolve(partial, 'reviewer-trust.json'), reviewerTrustBytes, { flag: 'wx' });

    const receiptReviewFiles = sealedReviewFiles.map((item) => ({
      path: resolve(destination, 'reviews', item.filename),
      sha256: digest(item.bytes),
      rawPath: resolve(destination, 'raw-reviews', item.filename),
      rawSha256: digest(item.rawBytes),
      entryCount: item.entryCount,
    }));
    const treeHash = digest(Buffer.from([
      `${overlaySha256}  content-overlay.json`,
      `${baseCatalogSha256}  base-catalog.json`,
      `${profileSha256}  intake-profile.json`,
      `${reviewerTrustSha256}  reviewer-trust.json`,
      ...receiptReviewFiles.map((entry) => `${entry.sha256}  ${entry.path}`),
      ...receiptReviewFiles.map((entry) => `${entry.rawSha256}  ${entry.rawPath}`),
    ].sort().join('\n') + '\n', 'utf8'));
    const gifEntries = overlay.entries.filter((entry) => baselineBySha.get(entry.sha256).mediaType === 'image/gif');
    const receipt = {
      schema: 'munjanggun.assetContentRevalidationReceipt.v2',
      version: '2.0',
      authorityContractVersion: CONTENT_AUTHORITY_CONTRACT_VERSION,
      intakeId: catalog.intakeId,
      sealedAt,
      baseCatalogPath: resolve(destination, 'base-catalog.json'),
      baseCatalogSha256,
      profilePath: resolve(destination, 'intake-profile.json'),
      profileSha256,
      reviewerTrustPath: resolve(destination, 'reviewer-trust.json'),
      reviewerTrustSha256,
      rawRootPath: resolve(rawRoot),
      overlaySha256,
      entryCount: overlay.entryCount,
      verifiedCount: overlay.entries.length,
      needsEscalationCount: 0,
      staticCount: overlay.entries.length - gifEntries.length,
      gifCount: gifEntries.length,
      decodedGifFrameCount: sum(gifEntries, (entry) => entry.gifMetadata.decodedFrameCount),
      sampledGifFrameCount: sum(gifEntries, (entry) => entry.gifMetadata.sampledFrameCount),
      fullPlaybackObservedGifCount: gifEntries.filter((entry) => entry.gifMetadata?.fullPlaybackObservation?.observed === true).length,
      visibleTextObservationCount: sum(overlay.entries, (entry) => entry.visibleTextObservations.length),
      verifiedCropCount: sum(overlay.entries.filter((entry) => !entry.gifMetadata), (entry) => entry.visibleTextObservations.filter((item) => item.cropEvidence).length),
      sensitiveClaimObservationCount: sum(overlay.entries, (entry) => sensitiveObservationIndices(entry).size),
      secondReviewedSensitiveObservationCount: sum(overlay.entries, (entry) => [...sensitiveObservationIndices(entry)].filter((index) => entry.visibleTextObservations[index]?.secondReview).length),
      claimSignalAssetCount: overlay.entries.filter((entry) => entry.claimSignals.length > 0).length,
      sensitiveClaimEvidenceAssetCount: overlay.entries.filter((entry) => entry.claimEvidence.some((item) => item.topic !== 'other')).length,
      priceClaimAssetCount: overlay.entries.filter((entry) => entry.claimEvidence.some((item) => item.topic === 'price')).length,
      privacySignalAssetCount: overlay.entries.filter((entry) => entry.privacySignals.length > 0).length,
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
      profileSha256,
      reviewerTrustSha256,
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
    crossProductSourceIds: uniqueStrings(entry.crossProductSourceIds),
    genericSourceProduct: entry.genericSourceProduct === true,
    genericSourceProductReason: entry.genericSourceProductReason ?? '',
    textPresence: entry.textPresence,
    visibleText: orderedUniqueStrings(entry.visibleText),
    visibleTextObservations: entry.visibleTextObservations,
    ocrText: entry.ocrText,
    sourceContext: uniqueStrings(entry.sourceContext),
    inferredText: uniqueStrings(entry.inferredText),
    claimSignals: uniqueStrings(entry.claimSignals),
    claimEvidence: normalizeClaimEvidence(entry.claimEvidence),
    privacySignals: uniqueStrings(entry.privacySignals),
    humanReviewStatus: entry.humanReviewStatus,
    reviewer: entry.reviewer,
    primaryReviewedAt: entry.primaryReviewedAt,
    reviewedAt: entry.reviewedAt,
    annotationMethod: entry.annotationMethod,
    evidenceRefs: uniqueStrings(entry.evidenceRefs),
    reviewNotes: entry.reviewNotes,
    gifReview: entry.gifReview ?? null,
  };
  return digest(Buffer.from(canonicalJson(decision), 'utf8'));
}

export async function normalizeReviewShard(raw, rawPath, rawBytes, catalog, baselineBySha, rawRoot, productIdentity, sealedAt, reviewerTrust) {
  if (raw?.intakeId !== catalog.intakeId || !Array.isArray(raw?.entries)) {
    throw new Error(`Review file does not match catalog intake or has no entries: ${rawPath}`);
  }
  const mediaKind = inferMediaKind(raw, rawPath);
  const reviewer = String(raw.reviewer ?? raw.reviewEvidence?.reviewer ?? raw.entries[0]?.reviewEvidence?.reviewer ?? '').trim();
  const reviewedAt = normalizeDate(raw.reviewedAt ?? raw.entries[0]?.reviewEvidence?.reviewedAt);
  assertDateOrder(reviewedAt, sealedAt, `Review shard ${raw.reviewId ?? rawPath} reviewedAt must not be after sealedAt`);
  const shardId = String(raw.reportId ?? raw.reviewId ?? raw.shardId ?? basename(rawPath, '.json')).trim();
  const entries = [];
  for (const source of raw.entries) {
    const sourceObjectSha256 = String(source.sourceObjectSha256 ?? source.sha256 ?? '').toLowerCase();
    if (!SHA256.test(sourceObjectSha256) || !baselineBySha.has(sourceObjectSha256)) {
      throw new Error(`${shardId}: unknown or invalid SHA ${sourceObjectSha256}`);
    }
    const baseline = baselineBySha.get(sourceObjectSha256);
    const entry = await normalizeReviewEntry(source, baseline, {
      reviewer, reviewedAt, mediaKind, rawRoot, evidenceRoot: dirname(rawRoot), sealedAt, reviewerTrust,
    });
    assertDateOrder(entry.reviewedAt, reviewedAt, `Review entry ${sourceObjectSha256} reviewedAt must not be after shard reviewedAt`);
    assertProductIdentity(entry, productIdentity);
    entry.decisionHash = computeContentDecisionHash(entry);
    entries.push(entry);
  }
  return {
    schema: 'munjanggun.assetContentReviewShard.v3',
    version: '3.0',
    authorityContractVersion: CONTENT_AUTHORITY_CONTRACT_VERSION,
    intakeId: catalog.intakeId,
    shardId,
    mediaKind,
    reviewedAt,
    reviewer,
    rawReviewSha256: digest(rawBytes),
    entries,
  };
}

export function buildProductIdentity(profile, intakeId) {
  if (profile?.schema !== 'munjanggun.assetIntakeProfile.v1' || profile?.intakeId !== intakeId || !Array.isArray(profile.products) || !profile.products.length) {
    throw new Error('Asset intake profile is invalid or does not match the catalog intake');
  }
  const bySourceId = new Map();
  const products = profile.products.map((product) => {
    if (!Array.isArray(product.exclusiveAliases)) throw new Error(`Asset intake profile product is missing exclusiveAliases: ${product.folder ?? 'unknown'}`);
    if (!Array.isArray(product.requiredAliases) || product.requiredAliases.length === 0) throw new Error(`Asset intake profile product is missing requiredAliases: ${product.folder ?? 'unknown'}`);
    const aliases = [...new Set(product.exclusiveAliases.map(normalizeProductText).filter(Boolean))];
    const requiredAliases = [...new Set(product.requiredAliases.map(normalizeProductText).filter(Boolean))];
    const genericAliases = [...new Set((product.genericAliases ?? []).map(normalizeProductText).filter(Boolean))];
    if (!product.sourceId || bySourceId.has(product.sourceId)) throw new Error('Asset intake profile has an invalid or duplicate product sourceId');
    const normalized = { sourceId: product.sourceId, folder: product.folder, label: product.label, aliases, requiredAliases, genericAliases };
    bySourceId.set(product.sourceId, normalized);
    return normalized;
  });
  return { bySourceId, products };
}

export function assertProductIdentity(entry, productIdentity) {
  const allowed = new Set();
  for (const ref of entry.sourceRefs) {
    const product = productIdentity.bySourceId.get(ref.sourceId);
    if (!product) throw new Error(`Review sourceId is absent from intake profile for ${entry.sourceObjectSha256}: ${ref.sourceId}`);
    const firstFolder = String(ref.sourceRelativePath).replaceAll('\\', '/').split('/')[0];
    if (firstFolder !== product.folder) {
      throw new Error(`Review source path product mismatch for ${entry.sourceObjectSha256}: ${ref.sourceRelativePath}`);
    }
    allowed.add(product.sourceId);
  }
  const declaredCrossProducts = new Set(entry.crossProductSourceIds);
  for (const sourceId of declaredCrossProducts) {
    if (!productIdentity.bySourceId.has(sourceId)) throw new Error(`Review cross-product sourceId is absent from intake profile for ${entry.sourceObjectSha256}: ${sourceId}`);
    if (allowed.has(sourceId)) throw new Error(`Review cross-product sourceId duplicates a catalog sourceRef for ${entry.sourceObjectSha256}: ${sourceId}`);
  }
  const meaning = normalizeProductText([entry.semanticSummary, ...entry.searchTags.productTypes].join(' '));
  if (entry.searchTags.productTypes.length === 0) {
    const namedSourceProducts = [...allowed]
      .map((sourceId) => productIdentity.bySourceId.get(sourceId))
      .filter((product) => product.requiredAliases.some((alias) => meaning.includes(alias)));
    if (namedSourceProducts.length > 0) {
      throw new Error(`Review names a source product but omits its productTypes tag for ${entry.sourceObjectSha256}: ${namedSourceProducts.map((product) => product.label).join(', ')}`);
    }
  }
  for (const sourceId of declaredCrossProducts) {
    const product = productIdentity.bySourceId.get(sourceId);
    if (![...product.aliases, ...product.requiredAliases].some((alias) => meaning.includes(alias))) {
      throw new Error(`Review cross-product sourceId has no matching visible meaning for ${entry.sourceObjectSha256}: ${sourceId}`);
    }
  }
  if (allowed.size === 1 && entry.searchTags.productTypes.length > 0) {
    const sourceProduct = productIdentity.bySourceId.get([...allowed][0]);
    const sourceMatch = sourceProduct.requiredAliases.some((alias) => meaning.includes(alias));
    const genericMatch = entry.genericSourceProduct === true
      && sourceProduct.genericAliases.some((alias) => meaning.includes(alias));
    const declaredMatch = [...declaredCrossProducts].some((sourceId) => {
      const product = productIdentity.bySourceId.get(sourceId);
      return [...product.aliases, ...product.requiredAliases].some((alias) => meaning.includes(alias));
    });
    if (!sourceMatch && !genericMatch && !declaredMatch) {
      throw new Error(`Review omits its single-source product identity for ${entry.sourceObjectSha256}: ${sourceProduct.label}`);
    }
  }
  if (entry.genericSourceProduct === true) {
    if (!entry.genericSourceProductReason) throw new Error(`Generic source product requires a reason for ${entry.sourceObjectSha256}`);
    const sourceProducts = [...allowed].map((sourceId) => productIdentity.bySourceId.get(sourceId));
    if (!sourceProducts.length || sourceProducts.some((product) => !product.genericAliases.some((alias) => meaning.includes(alias)))) {
      throw new Error(`Generic source product is not allowed by every source profile for ${entry.sourceObjectSha256}`);
    }
  }
  const conflicts = [];
  for (const product of productIdentity.products) {
    if (allowed.has(product.sourceId) || declaredCrossProducts.has(product.sourceId)) continue;
    if (product.aliases.some((alias) => meaning.includes(alias))) conflicts.push(product.label);
  }
  if (conflicts.length) {
    throw new Error(`Review product identity conflicts with source for ${entry.sourceObjectSha256}: ${conflicts.join(', ')}`);
  }
}

function normalizeProductText(value) {
  return String(value ?? '').toLowerCase().replace(/[\s/_-]+/gu, '');
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

  const visibleText = normalizeVisibleText(source.visibleText);
  const textPresence = String(source.textPresence ?? '').trim();
  const visibleTextObservations = await normalizeVisibleTextObservations(
    source.visibleTextObservations,
    { visibleText, textPresence, baseline, mediaKind: context.mediaKind, evidenceRoot: context.evidenceRoot, originalPath },
  );
  const ocrText = String(source.ocrText ?? '').trim();
  const sourceContext = uniqueStrings(source.sourceContext);
  const inferredText = uniqueStrings(source.inferredText);
  const claimSignals = uniqueStrings(source.claimSignals);
  const hasPriceText = visibleText.some((value) => PRICE_TEXT.test(value));
  const hasPriceSignal = claimSignals.some((value) => PRICE_SIGNAL.test(value));
  if (hasPriceText && !hasPriceSignal) throw new Error(`Visible price text requires a price claim signal for ${baseline.sha256}`);
  const hasAsText = visibleText.some((value) => AS_TEXT.test(value));
  const hasAsSignal = claimSignals.some((value) => classifySensitiveTopic(value) === 'after_sales_service');
  if (hasAsText && !hasAsSignal) throw new Error(`Visible A/S text requires an A/S claim signal for ${baseline.sha256}`);
  const hasEventText = visibleText.some((value) => EVENT_TEXT.test(value));
  const hasEventSignal = claimSignals.some((value) => classifySensitiveTopic(value) === 'event');
  if (hasEventText && !hasEventSignal) throw new Error(`Visible event text requires an event claim signal for ${baseline.sha256}`);
  const visibleSensitivePatterns = [
    ['specification', SPEC_TEXT], ['review', REVIEW_TEXT], ['schedule', SCHEDULE_TEXT],
  ];
  for (const [topic, pattern] of visibleSensitivePatterns) {
    if (visibleText.some((value) => pattern.test(value)) && !claimSignals.some((value) => classifySensitiveTopic(value) === topic)) {
      throw new Error(`Visible ${topic} text requires a matching claim signal for ${baseline.sha256}`);
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
  const evidenceRefs = [originalPath];
  const entry = {
    sourceObjectSha256: baseline.sha256,
    originalPath,
    sourceRefs,
    mediaType: baseline.mediaType,
    semanticSummary,
    assetType,
    useCases: uniqueStrings(source.useCases?.length ? source.useCases : [...searchTags.topics, assetType]),
    searchTags,
    crossProductSourceIds: uniqueStrings(source.crossProductSourceIds),
    textPresence,
    visibleText,
    visibleTextObservations,
    ocrText,
    sourceContext,
    inferredText,
    claimSignals,
    claimEvidence: normalizeClaimEvidence(source.claimEvidence),
    privacySignals: uniqueStrings(source.privacySignals),
    humanReviewStatus,
    reviewer: String(source.reviewEvidence?.reviewer ?? context.reviewer).trim(),
    primaryReviewedAt: normalizeDate(source.reviewEvidence?.reviewedAt),
    reviewedAt: context.reviewedAt,
    annotationMethod,
    evidenceRefs,
    reviewNotes,
  };
  if (normalizeReviewerPrincipal(entry.reviewer) !== normalizeReviewerPrincipal(context.reviewer)) {
    throw new Error(`Primary review entry reviewer does not match signed review principal for ${baseline.sha256}`);
  }
  if (source.genericSourceProduct === true) {
    entry.genericSourceProduct = true;
    entry.genericSourceProductReason = String(source.genericSourceProductReason ?? '').trim();
  }
  if (context.mediaKind === 'gif') {
    entry.gifReview = await normalizeGifReview(source, baseline, originalPath, context.evidenceRoot, entry.reviewer);
    entry.evidenceRefs = uniqueStrings([
      originalPath,
      ...entry.gifReview.storyboardEvidence.map((item) => item.path),
      ...entry.gifReview.sampleEvidence.map((item) => item.path),
      entry.gifReview.fullPlaybackObservation.evidenceRef,
      ...entry.visibleTextObservations.map((item) => item.secondReview?.evidenceRef).filter(Boolean),
    ]);
    if (entry.claimEvidence.some((item) => item.frameIndex >= entry.gifReview.decodedFrameCount)) {
      throw new Error(`GIF claim evidence frame index is out of range for ${baseline.sha256}`);
    }
    assertDateOrder(entry.gifReview.fullPlaybackObservation.reviewedAt, entry.reviewedAt,
      `GIF playback observation ${baseline.sha256} must not be after entry reviewedAt`);
  } else if (source.gifReview) {
    throw new Error(`Static review must not contain GIF review evidence for ${baseline.sha256}`);
  } else {
    entry.evidenceRefs = uniqueStrings([
      originalPath,
      ...entry.visibleTextObservations.map((item) => item.cropEvidence?.path).filter(Boolean),
      ...entry.visibleTextObservations.map((item) => item.secondReview?.evidenceRef).filter(Boolean),
    ]);
  }
  assertDateOrder(entry.primaryReviewedAt, entry.reviewedAt, `Primary review ${baseline.sha256} must not be after entry reviewedAt`);
  await assertContentEntryEvidence(entry, context.mediaKind, { evidenceRoots: [context.evidenceRoot], reviewerTrust: context.reviewerTrust });
  return entry;
}

async function normalizeGifReview(source, baseline, originalPath, evidenceRoot, reviewer) {
  const evidence = source.gifReview;
  if (!evidence) throw new Error(`GIF review evidence is missing for ${baseline.sha256}`);
  const decoded = await inspectMedia(originalPath);
  if (decoded.mediaType !== 'image/gif') throw new Error(`GIF media signature mismatch for ${baseline.sha256}`);
  const declaredDecodedFrameCount = positiveInteger(evidence.decodedFrameCount, 'GIF decodedFrameCount');
  const declaredDecodedDurationMs = nonnegativeInteger(evidence.decodedDurationMs, 'GIF decodedDurationMs');
  const declaredDecodedLoopCount = nullableNonnegativeInteger(evidence.decodedLoopCount, 'GIF decodedLoopCount');
  if (declaredDecodedFrameCount !== decoded.frameCount || declaredDecodedDurationMs !== decoded.durationMs
    || declaredDecodedLoopCount !== decoded.loopCount) {
    throw new Error(`GIF decoded metadata mismatch for ${baseline.sha256}`);
  }
  const sampledFrameIndices = uniqueNonnegativeIntegers(evidence.sampledFrameIndices, 'GIF sampledFrameIndices');
  const sampledFrameCount = positiveInteger(evidence.sampledFrameCount, 'GIF sampledFrameCount');
  if (sampledFrameCount !== sampledFrameIndices.length) throw new Error(`GIF sampled frame count mismatch for ${baseline.sha256}`);
  if (sampledFrameIndices.some((index) => index >= decoded.frameCount)) throw new Error(`GIF sampled frame index is out of range for ${baseline.sha256}`);
  const storyboardEvidence = await normalizeEvidenceFiles(evidence.storyboardEvidence, evidenceRoot, `GIF storyboard evidence ${baseline.sha256}`);
  const sampleEvidence = await normalizeSampleEvidence(evidence.sampleEvidence, baseline, sampledFrameIndices, evidenceRoot, originalPath);
  const observation = normalizeFullPlaybackObservation(evidence.fullPlaybackObservation);
  if (observation.method === 'continuous_original_playback' && observation.observedToMs < decoded.durationMs) {
    throw new Error(`GIF full-playback observation is shorter than decoded duration for ${baseline.sha256}`);
  }
  if (observation.method === 'all_decoded_frames_reviewed'
    && (sampledFrameIndices.length !== decoded.frameCount || sampledFrameIndices.some((value, index) => value !== index))) {
    throw new Error(`GIF all-frame observation does not cover every decoded frame for ${baseline.sha256}`);
  }
  await assertPlaybackObservationReceipt(observation, baseline.sha256, reviewer, evidenceRoot, decoded);
  return {
    decodedFrameCount: decoded.frameCount,
    decodedDurationMs: decoded.durationMs,
    decodedLoopCount: decoded.loopCount,
    sampledFrameCount,
    sampledFrameIndices,
    loopBehavior: String(evidence.loopBehavior ?? '').trim(),
    storyboardEvidence,
    sampleEvidence,
    fullPlaybackObservation: observation,
  };
}

export async function assertGifReviewEvidence(entry, { evidenceRoots = [] } = {}) {
  const review = entry?.gifReview;
  if (!review) throw new Error(`GIF review evidence is missing for ${entry?.sourceObjectSha256 ?? 'unknown SHA'}`);
  const decoded = await inspectMedia(entry.originalPath);
  if (decoded.mediaType !== 'image/gif'
    || review.decodedFrameCount !== decoded.frameCount
    || review.decodedDurationMs !== decoded.durationMs
    || review.decodedLoopCount !== decoded.loopCount) {
    throw new Error(`GIF decoded metadata mismatch for ${entry.sourceObjectSha256}`);
  }
  if (review.sampledFrameCount !== review.sampledFrameIndices.length
    || review.sampledFrameIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= decoded.frameCount)) {
    throw new Error(`GIF sampled frame evidence is invalid for ${entry.sourceObjectSha256}`);
  }
  await verifyEvidenceFiles(review.storyboardEvidence, evidenceRoots, `GIF storyboard evidence ${entry.sourceObjectSha256}`);
  await verifySampleEvidence(review.sampleEvidence, entry.sourceObjectSha256, review.sampledFrameIndices, evidenceRoots, entry.originalPath);
  const observation = review.fullPlaybackObservation;
  await verifyPlaybackObservationReceipt(observation, entry.sourceObjectSha256, entry.reviewer, evidenceRoots, decoded);
  if (observation.method === 'continuous_original_playback' && observation.observedToMs < decoded.durationMs) {
    throw new Error(`GIF full-playback observation is shorter than decoded duration for ${entry.sourceObjectSha256}`);
  }
  if (observation.method === 'all_decoded_frames_reviewed'
    && (review.sampledFrameIndices.length !== decoded.frameCount
      || review.sampledFrameIndices.some((value, index) => value !== index))) {
    throw new Error(`GIF all-frame observation does not cover every decoded frame for ${entry.sourceObjectSha256}`);
  }
  if (entry.claimEvidence.some((item) => item.frameIndex >= decoded.frameCount)) {
    throw new Error(`GIF claim evidence frame index is out of range for ${entry.sourceObjectSha256}`);
  }
  if (entry.visibleTextObservations.some((item) => item.frameIndex >= decoded.frameCount
    || !review.sampledFrameIndices.includes(item.frameIndex))) {
    throw new Error(`GIF visible text frame is outside decoded and sampled evidence for ${entry.sourceObjectSha256}`);
  }
  return true;
}

export async function assertContentEntryEvidence(entry, mediaKind, { evidenceRoots = [], reviewerTrust = null } = {}) {
  if (mediaKind === 'gif' && !entry?.gifReview) {
    throw new Error(`GIF review evidence is missing for ${entry?.sourceObjectSha256 ?? 'unknown SHA'}`);
  }
  if (mediaKind !== 'gif' && entry?.gifReview) {
    throw new Error(`Static review must not contain GIF review evidence for ${entry?.sourceObjectSha256 ?? 'unknown SHA'}`);
  }
  assertKnownPerObjectRegressions(entry);
  const visibleText = Array.isArray(entry.visibleText) ? entry.visibleText : [];
  await verifyVisibleTextObservations(entry, mediaKind, evidenceRoots, reviewerTrust);
  const claimSignals = uniqueStrings(entry.claimSignals);
  const claimEvidence = normalizeClaimEvidence(entry.claimEvidence);
  const evidenceSignals = new Set(claimEvidence.map((item) => item.signal));
  for (const signal of claimSignals) {
    if (!evidenceSignals.has(signal)) throw new Error(`Claim signal lacks pixel evidence for ${entry.sourceObjectSha256}: ${signal}`);
  }
  for (const evidence of claimEvidence) {
    if (!claimSignals.includes(evidence.signal)) {
      throw new Error(`Claim evidence names an undeclared signal for ${entry.sourceObjectSha256}: ${evidence.signal}`);
    }
    if (evidence.sourceObjectSha256 !== entry.sourceObjectSha256) {
      throw new Error(`Claim evidence SHA mismatch for ${entry.sourceObjectSha256}`);
    }
    if (mediaKind === 'gif') {
      if (evidence.provenance !== 'gif_frame_visible_text' || !Number.isInteger(evidence.frameIndex)) {
        throw new Error(`GIF claim evidence must identify a visible frame for ${entry.sourceObjectSha256}`);
      }
    } else if (evidence.provenance !== 'visible_text' || evidence.frameIndex !== undefined) {
      throw new Error(`Static claim evidence must use direct visible text for ${entry.sourceObjectSha256}`);
    }
    assertEvidenceRefMatchesOriginal(evidence.evidenceRef, entry.originalPath, `Claim evidence for ${entry.sourceObjectSha256}`);
    const selectedText = evidence.visibleTextIndices.map((index) => {
      if (!Number.isInteger(index) || index < 0 || index >= visibleText.length) {
        throw new Error(`Claim evidence visibleText index is out of range for ${entry.sourceObjectSha256}`);
      }
      return visibleText[index];
    });
    if (mediaKind === 'gif' && evidence.visibleTextIndices.some((index) => entry.visibleTextObservations[index]?.frameIndex !== evidence.frameIndex)) {
      throw new Error(`GIF claim evidence frame does not match its visible text observation for ${entry.sourceObjectSha256}`);
    }
    const text = selectedText.join(' ');
    if (evidence.topic === 'price' && !PRICE_TEXT.test(text)) {
      throw new Error(`Price claim evidence does not point to visible price text for ${entry.sourceObjectSha256}`);
    }
    if (evidence.topic === 'after_sales_service' && !AS_TEXT.test(text)) {
      throw new Error(`A/S claim evidence does not point to visible A/S text for ${entry.sourceObjectSha256}`);
    }
    if (evidence.topic === 'event' && !EVENT_TEXT.test(text)) {
      throw new Error(`Event claim evidence does not point to visible event text for ${entry.sourceObjectSha256}`);
    }
    const evidencePattern = new Map([
      ['specification', SPEC_TEXT], ['review', REVIEW_TEXT], ['schedule', SCHEDULE_TEXT],
    ]).get(evidence.topic);
    if (evidencePattern && !evidencePattern.test(text)) {
      throw new Error(`${evidence.topic} claim evidence does not point to matching visible text for ${entry.sourceObjectSha256}`);
    }
    if (evidence.topic !== 'other' && evidence.visibleTextIndices.some((index) => !entry.visibleTextObservations[index]?.secondReview)) {
      throw new Error(`Sensitive claim evidence requires an independent visible-text second review for ${entry.sourceObjectSha256}`);
    }
    const signalTopic = classifySensitiveTopic(evidence.signal);
    if (signalTopic && signalTopic !== evidence.topic) {
      throw new Error(`Claim evidence topic does not match its signal for ${entry.sourceObjectSha256}: ${evidence.signal}`);
    }
  }
  for (const topic of entry.searchTags?.topics ?? []) {
    const kind = classifySensitiveTopic(topic);
    if (kind && !claimEvidence.some((item) => item.topic === kind)) {
      throw new Error(`Sensitive search topic lacks pixel evidence for ${entry.sourceObjectSha256}: ${topic}`);
    }
  }
  const authoritativeSearchText = [
    entry.semanticSummary,
    entry.assetType,
    ...(entry.useCases ?? []),
    ...Object.values(entry.searchTags ?? {}).flat(),
    ...visibleText,
  ].filter(Boolean).join(' ');
  const searchableSensitiveTopics = [
    ['price', PRICE_TEXT],
    ['after_sales_service', AS_TEXT],
    ['event', EVENT_TEXT],
    ['specification', SPEC_TEXT],
    ['review', REVIEW_TEXT],
    ['schedule', SCHEDULE_TEXT],
  ];
  for (const [topic, pattern] of searchableSensitiveTopics) {
    if (pattern.test(authoritativeSearchText) && !claimEvidence.some((item) => item.topic === topic)) {
      throw new Error(`Sensitive searchable content lacks pixel evidence for ${entry.sourceObjectSha256}: ${topic}`);
    }
    if (pattern.test(String(entry.ocrText ?? '')) && !claimEvidence.some((item) => item.topic === topic)) {
      throw new Error(`Sensitive OCR text lacks confirmed pixel evidence for ${entry.sourceObjectSha256}: ${topic}`);
    }
  }
  const priceSignal = claimSignals.some((value) => classifySensitiveTopic(value) === 'price');
  if (priceSignal && !claimEvidence.some((item) => item.topic === 'price')) {
    throw new Error(`Price claim signal lacks price evidence for ${entry.sourceObjectSha256}`);
  }
  const asSignal = claimSignals.some((value) => classifySensitiveTopic(value) === 'after_sales_service');
  if (asSignal && !claimEvidence.some((item) => item.topic === 'after_sales_service')) {
    throw new Error(`A/S claim signal lacks A/S evidence for ${entry.sourceObjectSha256}`);
  }
  return true;
}

function normalizeClaimEvidence(values = []) {
  return (Array.isArray(values) ? values : []).map((item) => ({
    signal: String(item?.signal ?? '').trim(),
    topic: String(item?.topic ?? '').trim(),
    provenance: String(item?.provenance ?? '').trim(),
    visibleTextIndices: uniqueNonnegativeIntegers(item?.visibleTextIndices, 'claim visibleTextIndices'),
    sourceObjectSha256: String(item?.sourceObjectSha256 ?? '').toLowerCase(),
    evidenceRef: String(item?.evidenceRef ?? '').trim(),
    ...(item?.frameIndex === undefined ? {} : { frameIndex: nonnegativeInteger(item.frameIndex, 'claim frameIndex') }),
  })).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

function sensitiveObservationIndices(entry) {
  return new Set((entry.claimEvidence ?? [])
    .filter((item) => item.topic !== 'other')
    .flatMap((item) => item.visibleTextIndices ?? []));
}

function normalizeFullPlaybackObservation(value = {}) {
  if (value.observed !== true) throw new Error('GIF full-playback observation must be explicit');
  const method = String(value.method ?? '').trim();
  if (!['continuous_original_playback', 'all_decoded_frames_reviewed'].includes(method)) {
    throw new Error(`Unsupported GIF full-playback observation method: ${method}`);
  }
  return {
    observed: true,
    method,
    observedFromMs: nonnegativeInteger(value.observedFromMs, 'GIF observedFromMs'),
    observedToMs: nonnegativeInteger(value.observedToMs, 'GIF observedToMs'),
    reviewedAt: normalizeDate(value.reviewedAt),
    evidenceRef: String(value.evidenceRef ?? '').trim(),
    evidenceSha256: String(value.evidenceSha256 ?? '').toLowerCase(),
  };
}

async function normalizeVisibleTextObservations(values, {
  visibleText, textPresence, baseline, mediaKind, evidenceRoot, originalPath,
}) {
  if (!['observed', 'none_observed'].includes(textPresence)) throw new Error(`Text presence is missing for ${baseline.sha256}`);
  const observations = Array.isArray(values) ? values : [];
  if (textPresence === 'none_observed' && (visibleText.length || observations.length)) {
    throw new Error(`No-text decision conflicts with visible text evidence for ${baseline.sha256}`);
  }
  if (textPresence === 'observed' && (!visibleText.length || observations.length !== visibleText.length)) {
    throw new Error(`Visible text requires one pixel observation per text item for ${baseline.sha256}`);
  }
  const normalized = [];
  for (let index = 0; index < observations.length; index += 1) {
    const item = observations[index] ?? {};
    const evidenceRef = await verifyEvidenceFile(item.evidenceRef, item.evidenceSha256, [evidenceRoot], `Visible text evidence ${baseline.sha256}`);
    if (resolve(evidenceRef) !== resolve(originalPath) || String(item.evidenceSha256).toLowerCase() !== baseline.sha256) {
      throw new Error(`Visible text observation must bind the verified original for ${baseline.sha256}`);
    }
    const region = normalizeRegion(item.region, baseline.sha256);
    const frameIndex = item.frameIndex === undefined ? undefined : nonnegativeInteger(item.frameIndex, 'visible text frameIndex');
    const provenance = String(item.provenance ?? '').trim();
    if (String(item.text ?? '').trim() !== visibleText[index] || item.sourceObjectSha256 !== baseline.sha256) {
      throw new Error(`Visible text observation binding mismatch for ${baseline.sha256}`);
    }
    if (mediaKind === 'gif') {
      if (provenance !== 'gif_frame_pixel' || frameIndex === undefined) throw new Error(`GIF visible text must identify a frame for ${baseline.sha256}`);
    } else if (provenance !== 'static_pixel' || frameIndex !== undefined) {
      throw new Error(`Static visible text must use static pixel evidence for ${baseline.sha256}`);
    }
    const cropEvidence = mediaKind === 'gif'
      ? undefined
      : await normalizeStaticCropEvidence(item.cropEvidence, baseline, region, evidenceRoot, originalPath);
    const observation = {
      text: visibleText[index], sourceObjectSha256: baseline.sha256, provenance, region,
      evidenceRef, evidenceSha256: String(item.evidenceSha256).toLowerCase(),
      ...(frameIndex === undefined ? {} : { frameIndex }),
      ...(cropEvidence ? { cropEvidence } : {}),
    };
    if (item.secondReview) observation.secondReview = normalizeVisibleTextSecondReview(item.secondReview);
    normalized.push(observation);
  }
  return normalized;
}

function normalizeVisibleTextSecondReview(value) {
  return {
    status: String(value.status ?? '').trim(),
    method: String(value.method ?? '').trim(),
    reviewerPrincipalId: String(value.reviewerPrincipalId ?? '').trim(),
    reviewedAt: normalizeDate(value.reviewedAt),
    observationDigest: String(value.observationDigest ?? '').toLowerCase(),
    evidenceRef: String(value.evidenceRef ?? '').trim(),
    evidenceSha256: String(value.evidenceSha256 ?? '').toLowerCase(),
  };
}

export function computeVisibleTextObservationDigest(observation) {
  return digest(Buffer.from(canonicalJson({
    text: observation.text,
    sourceObjectSha256: observation.sourceObjectSha256,
    provenance: observation.provenance,
    region: observation.region,
    evidenceSha256: observation.evidenceSha256,
    frameIndex: observation.frameIndex ?? null,
    pixelEvidenceSha256: observation.cropEvidence?.sha256 ?? null,
  }), 'utf8'));
}

async function normalizeStaticCropEvidence(value, baseline, region, evidenceRoot, originalPath) {
  const item = value ?? {};
  if (item.sourceObjectSha256 !== baseline.sha256) {
    throw new Error(`Static text crop source binding mismatch for ${baseline.sha256}`);
  }
  const path = await verifyEvidenceFile(item.path, item.sha256, [evidenceRoot], `Static text crop ${baseline.sha256}`);
  const expected = decodeStaticRegionPixels(await readFile(originalPath), region);
  const cropBytes = await readFile(path);
  const actual = readCropPngPixels(cropBytes);
  const canonicalCropBytes = encodeRgbaPng(expected);
  assertVisibleTextCropHasPixels(expected, baseline.sha256);
  if (actual.width !== expected.width || actual.height !== expected.height
    || actual.pixelSha256 !== expected.pixelSha256 || item.pixelSha256 !== expected.pixelSha256
    || item.width !== expected.width || item.height !== expected.height
    || item.sourceWidth !== expected.sourceWidth || item.sourceHeight !== expected.sourceHeight
    || canonicalJson(item.pixelRegion) !== canonicalJson(expected.pixelRegion)
    || item.decoderVersion !== STATIC_PIXEL_DECODER_VERSION || item.encoderVersion !== STATIC_PNG_ENCODER_VERSION
    || !cropBytes.equals(canonicalCropBytes)) {
    throw new Error(`Static text crop pixels do not match source region for ${baseline.sha256}`);
  }
  return {
    path,
    sha256: String(item.sha256).toLowerCase(),
    pixelSha256: expected.pixelSha256,
    width: expected.width,
    height: expected.height,
    sourceWidth: expected.sourceWidth,
    sourceHeight: expected.sourceHeight,
    pixelRegion: expected.pixelRegion,
    decoderVersion: STATIC_PIXEL_DECODER_VERSION,
    encoderVersion: STATIC_PNG_ENCODER_VERSION,
    sourceObjectSha256: baseline.sha256,
  };
}

function assertVisibleTextCropHasPixels(crop, sha256) {
  if (crop.width < 2 || crop.height < 2) throw new Error(`Static text crop is too small to support visible text for ${sha256}`);
  const first = crop.data.subarray(0, 4);
  let differs = false;
  for (let offset = 4; offset < crop.data.length; offset += 4) {
    if (crop.data[offset] !== first[0] || crop.data[offset + 1] !== first[1]
      || crop.data[offset + 2] !== first[2] || crop.data[offset + 3] !== first[3]) {
      differs = true;
      break;
    }
  }
  if (!differs) throw new Error(`Static text crop has no pixel variation to support visible text for ${sha256}`);
}

function normalizeRegion(value = {}, sha256) {
  const region = {
    x: Number(value.x), y: Number(value.y), width: Number(value.width), height: Number(value.height), unit: String(value.unit ?? ''),
  };
  if (![region.x, region.y, region.width, region.height].every(Number.isFinite)
    || region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0
    || region.x + region.width > 1 || region.y + region.height > 1 || region.unit !== 'normalized') {
    throw new Error(`Visible text region is invalid for ${sha256}`);
  }
  return region;
}

async function normalizeSampleEvidence(values, baseline, sampledFrameIndices, evidenceRoot, originalPath) {
  const samples = Array.isArray(values) ? values : [];
  if (samples.length !== sampledFrameIndices.length) throw new Error(`GIF sample evidence count mismatch for ${baseline.sha256}`);
  const normalized = [];
  const decoded = decodeGifFramePixels(await readFile(originalPath), sampledFrameIndices);
  for (let index = 0; index < samples.length; index += 1) {
    const item = samples[index] ?? {};
    const frameIndex = nonnegativeInteger(item.frameIndex, 'GIF sample frameIndex');
    if (frameIndex !== sampledFrameIndices[index] || item.sourceObjectSha256 !== baseline.sha256) {
      throw new Error(`GIF sample evidence binding mismatch for ${baseline.sha256}`);
    }
    const path = await verifyEvidenceFile(item.path, item.sha256, [evidenceRoot], `GIF sample evidence ${baseline.sha256}`);
    const sourceFrame = decoded.frames.get(frameIndex);
    const sampleFrame = await readPngPixelFact(path);
    if (!sourceFrame || sampleFrame.width !== sourceFrame.width || sampleFrame.height !== sourceFrame.height
      || sampleFrame.pixelSha256 !== sourceFrame.pixelSha256 || item.pixelSha256 !== sourceFrame.pixelSha256
      || item.width !== sourceFrame.width || item.height !== sourceFrame.height
      || item.decoderVersion !== GIF_PIXEL_DECODER_VERSION) {
      throw new Error(`GIF sample evidence pixels do not match source frame ${frameIndex} for ${baseline.sha256}`);
    }
    normalized.push({
      frameIndex, path, sha256: String(item.sha256).toLowerCase(), pixelSha256: sourceFrame.pixelSha256,
      width: sourceFrame.width, height: sourceFrame.height, decoderVersion: GIF_PIXEL_DECODER_VERSION,
      sourceObjectSha256: baseline.sha256,
    });
  }
  return normalized;
}

async function verifyVisibleTextObservations(entry, mediaKind, evidenceRoots, reviewerTrust) {
  const observations = Array.isArray(entry.visibleTextObservations) ? entry.visibleTextObservations : [];
  const visibleText = Array.isArray(entry.visibleText) ? entry.visibleText : [];
  if (entry.textPresence === 'none_observed') {
    if (visibleText.length || observations.length) throw new Error(`No-text decision conflicts with visible text evidence for ${entry.sourceObjectSha256}`);
    return;
  }
  if (entry.textPresence !== 'observed' || observations.length !== visibleText.length || !visibleText.length) {
    throw new Error(`Visible text observation coverage is invalid for ${entry.sourceObjectSha256}`);
  }
  for (let index = 0; index < observations.length; index += 1) {
    const item = observations[index];
    normalizeRegion(item.region, entry.sourceObjectSha256);
    if (item.text !== visibleText[index] || item.sourceObjectSha256 !== entry.sourceObjectSha256) throw new Error(`Visible text observation binding mismatch for ${entry.sourceObjectSha256}`);
    if ((mediaKind === 'gif' && (item.provenance !== 'gif_frame_pixel' || !Number.isInteger(item.frameIndex)))
      || (mediaKind !== 'gif' && (item.provenance !== 'static_pixel' || item.frameIndex !== undefined))) {
      throw new Error(`Visible text observation provenance mismatch for ${entry.sourceObjectSha256}`);
    }
    if (resolve(item.evidenceRef) !== resolve(entry.originalPath) || item.evidenceSha256 !== entry.sourceObjectSha256) {
      throw new Error(`Visible text observation must bind the verified original for ${entry.sourceObjectSha256}`);
    }
    await verifyEvidenceFile(item.evidenceRef, item.evidenceSha256, evidenceRoots, `Visible text evidence ${entry.sourceObjectSha256}`);
    if (mediaKind !== 'gif') {
      await verifyStaticCropEvidence(item.cropEvidence, entry.sourceObjectSha256, item.region, evidenceRoots, entry.originalPath);
    }
    if (item.secondReview) await verifyVisibleTextSecondReview(item, entry, mediaKind, evidenceRoots, reviewerTrust);
  }
}

async function verifyVisibleTextSecondReview(observation, entry, mediaKind, evidenceRoots, reviewerTrust) {
  const second = observation.secondReview;
  const expectedDigest = computeVisibleTextObservationDigest(observation);
  if (second.status !== 'confirmed_visible' || second.method !== 'independent_crop_review'
    || second.observationDigest !== expectedDigest
    || normalizeReviewerPrincipal(second.reviewerPrincipalId) === normalizeReviewerPrincipal(entry.reviewer)) {
    throw new Error(`Visible text second review binding mismatch for ${entry.sourceObjectSha256}`);
  }
  assertNotFuture(second.reviewedAt, `Visible text second review ${entry.sourceObjectSha256}`);
  assertDateOrder(entry.primaryReviewedAt, second.reviewedAt, `Visible text second review ${entry.sourceObjectSha256} must not be before primary review`);
  assertDateOrder(second.reviewedAt, entry.reviewedAt, `Visible text second review ${entry.sourceObjectSha256} must not be after entry reviewedAt`);
  const path = await verifyEvidenceFile(second.evidenceRef, second.evidenceSha256, evidenceRoots, `Visible text second review ${entry.sourceObjectSha256}`);
  const receipt = JSON.parse(await readFile(path, 'utf8'));
  const schema = await readJson(new URL('../../schemas/visible-text-second-review-receipt.schema.json', import.meta.url));
  assertSchema(receipt, schema, `visible text second review receipt ${entry.sourceObjectSha256}`);
  if (!reviewerTrust) throw new Error(`Visible text second review trust is unavailable for ${entry.sourceObjectSha256}`);
  verifyTrustedContentReviewerSignature(receipt, second.reviewerPrincipalId, reviewerTrust, `Visible text second review ${entry.sourceObjectSha256}`);
  const pixelEvidenceSha256 = mediaKind === 'gif'
    ? entry.gifReview?.sampleEvidence.find((item) => item.frameIndex === observation.frameIndex)?.sha256
    : observation.cropEvidence?.sha256;
  if (receipt.sourceObjectSha256 !== entry.sourceObjectSha256 || receipt.observedText !== observation.text
    || canonicalJson(receipt.region) !== canonicalJson(observation.region)
    || receipt.pixelEvidenceSha256 !== pixelEvidenceSha256 || receipt.observationDigest !== expectedDigest
    || receipt.reviewerPrincipalId !== second.reviewerPrincipalId || normalizeDate(receipt.reviewedAt) !== second.reviewedAt
    || receipt.status !== second.status || receipt.method !== second.method) {
    throw new Error(`Visible text second review receipt mismatch for ${entry.sourceObjectSha256}`);
  }
}

async function verifyStaticCropEvidence(item, sourceSha256, region, evidenceRoots, originalPath) {
  if (!item || item.sourceObjectSha256 !== sourceSha256) throw new Error(`Static text crop source binding mismatch for ${sourceSha256}`);
  const path = await verifyEvidenceFile(item.path, item.sha256, evidenceRoots, `Static text crop ${sourceSha256}`);
  const expected = decodeStaticRegionPixels(await readFile(originalPath), region);
  const cropBytes = await readFile(path);
  const actual = readCropPngPixels(cropBytes);
  assertVisibleTextCropHasPixels(expected, sourceSha256);
  if (actual.width !== expected.width || actual.height !== expected.height
    || actual.pixelSha256 !== expected.pixelSha256 || item.pixelSha256 !== expected.pixelSha256
    || item.width !== expected.width || item.height !== expected.height
    || item.sourceWidth !== expected.sourceWidth || item.sourceHeight !== expected.sourceHeight
    || canonicalJson(item.pixelRegion) !== canonicalJson(expected.pixelRegion)
    || item.decoderVersion !== STATIC_PIXEL_DECODER_VERSION || item.encoderVersion !== STATIC_PNG_ENCODER_VERSION
    || !cropBytes.equals(encodeRgbaPng(expected))) {
    throw new Error(`Static text crop pixels do not match source region for ${sourceSha256}`);
  }
}

async function verifySampleEvidence(samples, sourceSha256, sampledFrameIndices, evidenceRoots, originalPath) {
  if (!Array.isArray(samples) || samples.length !== sampledFrameIndices.length) throw new Error(`GIF sample evidence count mismatch for ${sourceSha256}`);
  const decoded = decodeGifFramePixels(await readFile(originalPath), sampledFrameIndices);
  for (let index = 0; index < samples.length; index += 1) {
    const item = samples[index];
    if (item.frameIndex !== sampledFrameIndices[index] || item.sourceObjectSha256 !== sourceSha256) throw new Error(`GIF sample evidence binding mismatch for ${sourceSha256}`);
    const path = await verifyEvidenceFile(item.path, item.sha256, evidenceRoots, `GIF sample evidence ${sourceSha256}`);
    const sourceFrame = decoded.frames.get(item.frameIndex);
    const sampleFrame = await readPngPixelFact(path);
    if (!sourceFrame || sampleFrame.width !== sourceFrame.width || sampleFrame.height !== sourceFrame.height
      || sampleFrame.pixelSha256 !== sourceFrame.pixelSha256 || item.pixelSha256 !== sourceFrame.pixelSha256
      || item.width !== sourceFrame.width || item.height !== sourceFrame.height
      || item.decoderVersion !== GIF_PIXEL_DECODER_VERSION) {
      throw new Error(`GIF sample evidence pixels do not match source frame ${item.frameIndex} for ${sourceSha256}`);
    }
  }
}

async function assertPlaybackObservationReceipt(observation, sourceSha256, reviewer, evidenceRoot, decoded) {
  return verifyPlaybackObservationReceipt(observation, sourceSha256, reviewer, [evidenceRoot], decoded);
}

async function verifyPlaybackObservationReceipt(observation, sourceSha256, reviewer, evidenceRoots, decoded) {
  const path = await verifyEvidenceFile(observation.evidenceRef, observation.evidenceSha256, evidenceRoots, `GIF playback receipt ${sourceSha256}`);
  const receipt = JSON.parse(await readFile(path, 'utf8'));
  if (receipt.schema !== 'munjanggun.gifPlaybackObservation.v1' || receipt.observed !== true
    || receipt.sourceObjectSha256 !== sourceSha256
    || receipt.method !== observation.method || receipt.observedFromMs !== observation.observedFromMs
    || receipt.observedToMs !== observation.observedToMs || normalizeDate(receipt.reviewedAt) !== observation.reviewedAt
    || String(receipt.reviewer ?? '').trim() !== String(reviewer ?? '').trim()
    || receipt.decodedFrameCount !== decoded.frameCount || receipt.decodedDurationMs !== decoded.durationMs) {
    throw new Error(`GIF playback receipt binding mismatch for ${sourceSha256}`);
  }
  return true;
}

async function normalizeEvidenceFiles(values, evidenceRoot, label) {
  const result = [];
  for (const item of Array.isArray(values) ? values : []) {
    const path = await verifyEvidenceFile(item?.path, item?.sha256, [evidenceRoot], label);
    result.push({ path, sha256: String(item.sha256).toLowerCase() });
  }
  return result;
}

async function verifyEvidenceFiles(values, evidenceRoots, label) {
  for (const item of Array.isArray(values) ? values : []) await verifyEvidenceFile(item?.path, item?.sha256, evidenceRoots, label);
}

async function verifyEvidenceFile(pathValue, shaValue, roots, label) {
  const path = resolve(String(pathValue ?? ''));
  if (!isAbsolute(String(pathValue ?? '')) || !SHA256.test(String(shaValue ?? '').toLowerCase())) throw new Error(`${label} path or SHA-256 is invalid`);
  const allowed = roots.map((root) => resolve(root)).some((root) => isContained(root, path) && root !== path);
  if (!allowed) throw new Error(`${label} is outside the intake evidence root`);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} is not a regular non-symlink file`);
  const realPath = await realpath(path);
  const realAllowed = await Promise.all(roots.map(async (root) => {
    try { return isContained(await realpath(resolve(root)), realPath); } catch { return false; }
  }));
  if (!realAllowed.some(Boolean)) throw new Error(`${label} real path escapes the intake evidence root`);
  const bytes = await readFile(path);
  if (digest(bytes) !== String(shaValue).toLowerCase()) throw new Error(`${label} SHA-256 mismatch`);
  return path;
}

function classifySensitiveTopic(value) {
  const text = String(value ?? '').toLocaleLowerCase('ko');
  if (/(?:price|pricing|discount|가격|금액|할인|월\s*납입)/iu.test(text)) return 'price';
  if (/(?:^|[^a-z])a\s*\/?\s*s(?:$|[^a-z])|after[\s_-]*sales|에이\s*\/?\s*에스|보증|무상\s*수리/iu.test(text)) return 'after_sales_service';
  if (/(?:event|promotion|이벤트|행사|프로모션|증정|사은품)/iu.test(text)) return 'event';
  if (/(?:spec(?:ification)?|dimension|thickness|규격|사이즈|두께|강화\s*유리)/iu.test(text)) return 'specification';
  if (/(?:review|testimonial|리뷰|후기|만족도)/iu.test(text)) return 'review';
  if (/(?:schedule|lead[\s_-]*time|일정|납기|당일\s*(?:시공|설치)|\d+\s*(?:일|시간)\s*(?:이내|내|만에))/iu.test(text)) return 'schedule';
  return null;
}

function assertEvidenceRefMatchesOriginal(evidenceRef, originalPath, label) {
  const text = String(evidenceRef ?? '').trim();
  const pathPart = text.split('#', 1)[0];
  if (!text || !isAbsolute(pathPart) || resolve(pathPart) !== resolve(originalPath)) {
    throw new Error(`${label} must reference the verified original file`);
  }
}

function assertDateOrder(earlier, later, message) {
  if (new Date(earlier).valueOf() > new Date(later).valueOf()) throw new Error(message);
}

function assertNotFuture(value, label, now = Date.now()) {
  if (new Date(value).valueOf() > now + 5 * 60 * 1000) throw new Error(`${label} must not be in the future`);
}

function toOverlayEntry(entry, reviewEvidenceRefs) {
  return {
    sha256: entry.sourceObjectSha256,
    semanticSummary: entry.semanticSummary,
    assetType: entry.assetType,
    useCases: entry.useCases,
    searchTags: entry.searchTags,
    textPresence: entry.textPresence,
    visibleText: entry.visibleText,
    visibleTextObservations: entry.visibleTextObservations,
    ocrText: entry.ocrText,
    sourceContext: entry.sourceContext,
    inferredText: entry.inferredText,
    claimSignals: entry.claimSignals,
    claimEvidence: entry.claimEvidence,
    privacySignals: entry.privacySignals,
    humanReviewStatus: 'verified',
    reviewer: entry.reviewer,
    primaryReviewedAt: entry.primaryReviewedAt,
    reviewedAt: entry.reviewedAt,
    annotationMethod: entry.annotationMethod,
    reviewEvidenceRefs,
    decisionHash: entry.decisionHash,
    gifMetadata: entry.gifReview ?? null,
  };
}

export function assertKnownRegressionCases(reviewedBySha) {
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
  const wrongOneSlidingCases = [
    'fef70b4e71f3819b3c368e3be0f1cdced1accd831d0ec5493c091232137fd00b',
    '9c3de5edbf7e833b5bfd4ec1fd1f53234c74820fbd184b119ed9b4fe66349baf',
    'aca4011963a40e1ece03d7a5f8e2513df0290116e258f9795a355d1e35146400',
    'cd16b5b5f5453fccff183ebb1e8599fe8caac471911cb51ffa4e7f160e3e9eec',
    'eeee6f488819eea8bc914538f9001c302f8e93b960fead9c0aba4f0c7b8bf853',
  ];
  for (const sha256 of wrongOneSlidingCases) {
    if (!reviewedBySha.has(sha256)) continue;
    const entry = reviewedBySha.get(sha256)?.entry;
    if (/원\s*슬라이딩/u.test(entry.semanticSummary)
      || !entry.searchTags.productTypes.some((value) => normalizeProductText(value) === normalizeProductText('3연동중문'))) {
      throw new Error(`Known 3-panel product identity regression remains for ${sha256}`);
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
  if (Array.isArray(value)) return orderedUniqueStrings(value);
  const text = String(value ?? '').trim();
  return text ? [text] : [];
}

function assertKnownPerObjectRegressions(entry) {
  const fabricatedNoTextSha = 'bff4bbbb15d2b2cd9404ebdfe3d8ada978d4ca1c8c8ab0237a7066518367e009';
  if (entry?.sourceObjectSha256 !== fabricatedNoTextSha) return;
  if ((entry.visibleText ?? []).length !== 0 || entry.ocrText || (entry.claimSignals ?? []).length !== 0
    || (entry.claimEvidence ?? []).length !== 0
    || (entry.searchTags?.topics ?? []).some((value) => classifySensitiveTopic(value) !== null)) {
    throw new Error(`Known fabricated no-text regression remains for ${fabricatedNoTextSha}`);
  }
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

function orderedUniqueStrings(values = []) {
  return [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))];
}

function uniqueNonnegativeIntegers(values, label) {
  if (!Array.isArray(values) || values.length < 1) throw new Error(`${label} must contain at least one integer`);
  const result = [...new Set(values.map((value) => nonnegativeInteger(value, label)))].sort((left, right) => left - right);
  if (result.length !== values.length) throw new Error(`${label} must not contain duplicate integers`);
  return result;
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

function nullableNonnegativeInteger(value, label) {
  return value === null ? null : nonnegativeInteger(value, label);
}

function sum(values, getter) {
  return values.reduce((total, value) => total + getter(value), 0);
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
