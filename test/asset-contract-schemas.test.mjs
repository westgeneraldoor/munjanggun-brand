import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateAgainstSchema } from '../scripts/lib/schema-validation.mjs';

test('content review input keeps visible OCR context and inference separate', async () => {
  const schema = await readSchema('asset-content-review-input.schema.json');
  const hash = 'a'.repeat(64);
  const input = {
    schema: 'munjanggun.assetContentReviewInput.v1', version: '1.0', intakeId: 'INTAKE-20260904-01',
    reviewId: 'static-a', mediaKind: 'static', reviewedAt: '2026-09-07T01:00:00.000Z', reviewer: 'reviewer',
    signature: { algorithm: 'Ed25519', keyId: 'reviewer-key', valueBase64: 'YWJjZA==' },
    entries: [{
      sha256: hash, sourceRefs: [{ sourceId: 'SRC-1', sourceRelativePath: '상품/001.jpg' }], verificationStatus: 'verified',
      observedSummary: '가격 안내 이미지', contentType: 'product_guide', useCases: ['상품 안내'],
      searchTags: { productTypes: ['상품'], scenes: [], colors: [], designs: [], topics: ['가격'] },
      textPresence: 'observed', visibleText: ['600,000원'], visibleTextObservations: [{
        text: '600,000원', sourceObjectSha256: hash, provenance: 'static_pixel',
        region: { x: 0, y: 0, width: 1, height: 1, unit: 'normalized' },
        evidenceRef: 'Z:/raw/상품/001.jpg', evidenceSha256: hash,
        cropEvidence: {
          path: 'Z:/evidence/crop.png', sha256: hash, pixelSha256: hash, width: 1, height: 1, sourceWidth: 1, sourceHeight: 1,
          pixelRegion: { left: 0, top: 0, width: 1, height: 1 },
          decoderVersion: 'pngjs@7.0.0+jpeg-js@0.4.4+munjanggun-crop-v1', encoderVersion: 'pngjs@7.0.0+munjanggun-canonical-png-v1', sourceObjectSha256: hash,
        },
      }], ocrText: '6OO,OOO원', sourceContext: ['상품/001.jpg'], inferredText: ['가격표로 추정'],
      claimSignals: ['price_claim'], claimEvidence: [{
        signal: 'price_claim', topic: 'price', provenance: 'visible_text', visibleTextIndices: [0],
        sourceObjectSha256: hash, evidenceRef: 'Z:/raw/상품/001.jpg',
      }], privacySignals: [], uncertainties: [],
      reviewEvidence: { method: 'full_resolution_original_opened', originalPath: 'Z:/raw/상품/001.jpg', reviewer: 'reviewer', reviewedAt: '2026-09-07T01:00:00.000Z' },
      staticTileCoverage: staticTileCoveragePointer(hash), secondarySemanticVerdict: secondarySemanticPointer(hash),
    }],
  };
  assert.equal(validateAgainstSchema(input, schema).valid, true);
  delete input.entries[0].visibleText;
  assert.equal(validateAgainstSchema(input, schema).valid, false);
});

test('visible text second-review receipt binds the exact source region and pixel evidence', async () => {
  const schema = await readSchema('visible-text-second-review-receipt.schema.json');
  const hash = 'a'.repeat(64);
  const receipt = {
    schema: 'munjanggun.visibleTextSecondReview.v1', version: '1.0', status: 'confirmed_visible', method: 'independent_crop_review',
    sourceObjectSha256: hash, observedText: '600,000원', region: { x: 0, y: 0, width: 1, height: 1, unit: 'normalized' },
    pixelEvidenceSha256: hash, observationDigest: hash, reviewerPrincipalId: 'reviewer-2', reviewedAt: '2026-09-07T01:00:00.000Z',
    signature: { algorithm: 'Ed25519', keyId: 'reviewer-2-key', valueBase64: 'YWJjZA==' },
  };
  assert.equal(validateAgainstSchema(receipt, schema).valid, true);
  receipt.extra = 'not allowed';
  assert.equal(validateAgainstSchema(receipt, schema).valid, false);
});

test('content review input rejects non-pixel claim provenance', async () => {
  const schema = await readSchema('asset-content-review-input.schema.json');
  const hash = 'b'.repeat(64);
  const base = {
    schema: 'munjanggun.assetContentReviewInput.v1', version: '1.0', intakeId: 'INTAKE-20260904-01',
    reviewId: 'gif', mediaKind: 'gif', reviewedAt: '2026-09-07T01:00:00.000Z', reviewer: 'reviewer',
    signature: { algorithm: 'Ed25519', keyId: 'reviewer-key', valueBase64: 'YWJjZA==' },
    entries: [{
      sha256: hash, sourceRefs: [{ sourceId: 'SRC-1', sourceRelativePath: '상품/001.gif' }], verificationStatus: 'verified',
      observedSummary: '움직이는 가격 안내', contentType: 'animation', useCases: ['상품 안내'],
      searchTags: { productTypes: ['상품'], scenes: [], colors: [], designs: [], topics: ['가격'] },
      textPresence: 'observed', visibleText: ['600,000원'], visibleTextObservations: [{
        text: '600,000원', sourceObjectSha256: hash, provenance: 'gif_frame_pixel', frameIndex: 0,
        region: { x: 0, y: 0, width: 1, height: 1, unit: 'normalized' },
        evidenceRef: 'Z:/raw/상품/001.gif', evidenceSha256: hash,
      }], ocrText: '', sourceContext: [], inferredText: [], claimSignals: ['price_claim'],
      claimEvidence: [{ signal: 'price_claim', topic: 'price', provenance: 'source_context', visibleTextIndices: [0], sourceObjectSha256: hash, evidenceRef: 'Z:/raw/상품/001.gif' }],
      privacySignals: [], uncertainties: [],
      reviewEvidence: { method: 'full_loop_original_opened', originalPath: 'Z:/raw/상품/001.gif', reviewer: 'reviewer', reviewedAt: '2026-09-07T01:00:00.000Z' },
      secondarySemanticVerdict: secondarySemanticPointer(hash),
      gifReview: {
        decodedFrameCount: 2, decodedDurationMs: 200, decodedLoopCount: 0, sampledFrameCount: 1,
        sampledFrameIndices: [0], loopBehavior: 'loop', storyboardEvidence: [],
        sampleEvidence: [{ frameIndex: 0, path: 'Z:/evidence/frame-0.png', sha256: hash, pixelSha256: hash, width: 1, height: 1, decoderVersion: 'gifuct-js@2.1.2+munjanggun-compositor-v1', sourceObjectSha256: hash }],
        fullPlaybackObservation: { observed: true, method: 'continuous_original_playback', observedFromMs: 0, observedToMs: 200, reviewedAt: '2026-09-07T01:00:00.000Z', evidenceRef: 'Z:/evidence/playback.json', evidenceSha256: hash },
      },
    }],
  };
  assert.equal(validateAgainstSchema(base, schema).valid, false);
});

test('content review input rejects ambiguous GIF frameCount independently', async () => {
  const schema = await readSchema('asset-content-review-input.schema.json');
  const input = validGifReviewInput();
  input.entries[0].gifReview.frameCount = 2;
  assert.equal(validateAgainstSchema(input, schema).valid, false);
});

test('content review input and sealed shard require GIF evidence for GIF media kind', async () => {
  const inputSchema = await readSchema('asset-content-review-input.schema.json');
  const input = validGifReviewInput();
  delete input.entries[0].gifReview;
  assert.equal(validateAgainstSchema(input, inputSchema).valid, false);

  const shardSchema = await readSchema('asset-content-review-shard.schema.json');
  const raw = validGifReviewInput().entries[0];
  const shard = {
    schema: 'munjanggun.assetContentReviewShard.v4', version: '4.0', authorityContractVersion: 'content-evidence-v4',
    intakeId: input.intakeId, shardId: 'gif', mediaKind: 'gif', reviewedAt: input.reviewedAt, reviewer: input.reviewer,
    rawReviewSha256: 'd'.repeat(64),
    entries: [{
      sourceObjectSha256: raw.sha256, originalPath: raw.reviewEvidence.originalPath, sourceRefs: raw.sourceRefs,
      mediaType: 'image/gif', semanticSummary: raw.observedSummary, assetType: raw.contentType, useCases: raw.useCases,
      searchTags: raw.searchTags, crossProductSourceIds: [], textPresence: raw.textPresence, visibleText: raw.visibleText,
      visibleTextObservations: raw.visibleTextObservations, ocrText: raw.ocrText,
      sourceContext: raw.sourceContext, inferredText: raw.inferredText, claimSignals: raw.claimSignals,
      claimEvidence: raw.claimEvidence, privacySignals: [], uncertainties: [], humanReviewStatus: 'verified', reviewer: input.reviewer,
      primaryReviewedAt: input.reviewedAt, reviewedAt: input.reviewedAt, annotationMethod: 'full_loop_original_reviewed', evidenceRefs: [raw.reviewEvidence.originalPath],
      reviewNotes: '', secondarySemanticVerdict: raw.secondarySemanticVerdict, decisionHash: 'c'.repeat(64),
    }],
  };
  assert.equal(validateAgainstSchema(shard, shardSchema).valid, false);
});

test('content catalog schema accepts a fail-closed binary group', async () => {
  const schema = await readSchema('asset-content-catalog.schema.json');
  const hash = 'a'.repeat(64);
  const result = validateAgainstSchema({
    schema: 'munjanggun.assetContentCatalog.v2',
    version: '2.0',
    intakeId: 'INTAKE-20260904-01',
    generatedAt: '2026-09-04T00:00:00.000Z',
    binaryGroupCount: 1,
    entries: [{
      binaryGroupId: `sha256:${hash}`,
      objectRef: `sha256/aa/${hash}.jpg`,
      sha256: hash,
      byteSize: 1,
      mediaType: 'image/jpeg',
      sourcePathCount: 1,
      sourceRefs: [{ sourceId: 'SRC-1', sourceRelativePath: '상품/001.jpg' }],
      contentId: 'CONTENT-CANDIDATE-1',
      visualGroupId: null,
      comparisonMethod: ['sha256_exact'],
      humanReviewStatus: 'not_reviewed',
      semanticSummary: '',
      ocrText: '',
      gifReviewStatus: 'not_applicable',
      claimSignals: [],
      privacySignals: [],
      rightsSignals: [],
      rightsStatus: 'not_reviewed',
      rightsScope: [],
      rightsEvidenceRef: [],
      claimEvidenceRef: [],
      privacyStatus: 'not_reviewed',
      claimReviewStatus: 'not_reviewed',
      publishStatus: 'blocked',
      publicRepoEligibility: 'not_reviewed',
    }],
  }, schema);

  assert.equal(result.valid, true);
});

test('completion gates schema pins this intake numerical contract', async () => {
  const schema = await readSchema('asset-completion-gates.schema.json');
  const result = validateAgainstSchema({
    schema: 'munjanggun.assetCompletionGates.v2',
    version: '2.0',
    intakeId: 'INTAKE-20260904-01',
    expected: {
      receiptManaged: 1154,
      visualManifestPaths: 1134,
      binaryGroups: 407,
      uniqueGifBinaries: 72,
      gifSourcePaths: 252,
      unresolvedVisualGroups: 0,
      urlRecords: 13,
      unverifiedRightsPublishable: 0,
      receiptMismatch: 0,
      visualGroups: 443,
    },
  }, schema);

  assert.equal(result.valid, true);
});

test('URL review schema keeps access evidence separate from claim approval', async () => {
  const schema = await readSchema('asset-url-review.schema.json');
  const result = validateAgainstSchema({
    schema: 'munjanggun.assetUrlReview.v1',
    version: '1.0',
    intakeId: 'INTAKE-20260904-01',
    checkedAt: '2026-09-04T08:00:00.000Z',
    method: 'signed_in_browser_read_only',
    recordCount: 1,
    entries: [{
      sourceRelativePath: '상품/상품.url',
      url: 'https://brand.naver.com/example/products/1',
      productId: '1',
      accessStatus: 'accessible',
      observedTitle: '확인된 상품명',
      productConnectionStatus: 'matched',
      claimReviewStatus: 'not_reviewed',
      notes: '접근만 확인',
    }],
  }, schema);

  assert.equal(result.valid, true);
  assert.equal(result.valid && result.errors.length === 0, true);
});

test('visual similarity schema requires a reviewed within-media decision', async () => {
  const schema = await readSchema('asset-visual-similarity-map.schema.json');
  const hash = 'b'.repeat(64);
  const result = validateAgainstSchema({
    schema: 'munjanggun.assetVisualSimilarityMap.v1',
    version: '1.0',
    intakeId: 'INTAKE-20260904-01',
    generatedAt: '2026-09-04T08:00:00.000Z',
    comparisonPolicy: 'within_media_only',
    logicalPathCount: 1,
    binaryGroupCount: 1,
    visualGroupCount: 1,
    unjudgedCount: 0,
    entries: [{
      binaryGroupId: `sha256:${hash}`,
      sha256: hash,
      mediaType: 'image/jpeg',
      originScope: 'intake_only',
      sourcePathCount: 1,
      visualGroupId: 'VG-TEST-1',
      semanticGroupId: null,
      visualDecision: 'reviewed_singleton',
      comparisonScope: 'within_media_only',
      comparisonMethod: ['perceptual_hash', 'human_visual_review'],
      humanReviewStatus: 'reviewed',
      humanReviewEvidence: ['review.json#sha256=test'],
    }],
  }, schema);

  assert.equal(result.valid, true);
});

test('owner decisions schema separates four rights axes from per-asset decisions', async () => {
  const schema = await readSchema('asset-owner-decisions.schema.json');
  const pending = { status: 'pending', evidenceRefs: [], notes: '' };
  const result = validateAgainstSchema({
    schema: 'munjanggun.assetOwnerDecisions.v1', version: '1.0', intakeId: 'INTAKE-20260904-01',
    generatedAt: '2026-09-05T00:00:00.000Z', catalogSha256: 'd'.repeat(64), useEvidenceReceiptSha256: 'f'.repeat(64), inheritancePolicy: 'global_answers_do_not_propagate_to_asset_decisions',
    rightsDecisions: {
      internalPreservation: pending, publicGitStorage: pending, externalReuse: pending, specialAssetRestrictions: pending,
    },
    assetDecisionCount: 1,
    assetDecisions: [{
      sha256: 'c'.repeat(64), contentId: 'CONTENT-1', needsEscalation: true, humanReviewDecision: 'pending', claimDecision: 'pending',
      privacyDecision: 'pending', rightsDecision: 'pending', rightsEvidenceRefs: [], claimEvidenceRefs: [], notes: '',
    }],
    escalationDecisionCount: 1,
    escalationDecisions: [{
      sha256: 'c'.repeat(64), contentId: 'CONTENT-1', humanReviewDecision: 'pending', claimDecision: 'pending',
      privacyDecision: 'pending', rightsDecision: 'pending', rightsEvidenceRefs: [], claimEvidenceRefs: [], notes: '',
    }],
  }, schema);
  assert.equal(result.valid, true);
});

test('owner decision receipt binds one ledger to one catalog hash', async () => {
  const schema = await readSchema('asset-owner-decision-receipt.schema.json');
  const result = validateAgainstSchema({
    schema: 'munjanggun.assetOwnerDecisionReceipt.v1', version: '1.0', intakeId: 'INTAKE-20260904-01',
    sealedAt: '2026-09-05T00:00:00.000Z', catalogSha256: 'd'.repeat(64), useEvidenceReceiptSha256: 'f'.repeat(64),
    ledgerRef: 'owner-decisions.json', ledgerSha256: 'e'.repeat(64), globalDecisionStatus: 'pending',
    assetDecisionCount: 407, escalationDecisionCount: 57, signature: null,
  }, schema);
  assert.equal(result.valid, true);
});

function validGifReviewInput() {
  const hash = 'b'.repeat(64);
  return {
    schema: 'munjanggun.assetContentReviewInput.v1', version: '1.0', intakeId: 'INTAKE-20260904-01',
    reviewId: 'gif', mediaKind: 'gif', reviewedAt: '2026-09-07T01:00:00.000Z', reviewer: 'reviewer',
    signature: { algorithm: 'Ed25519', keyId: 'reviewer-key', valueBase64: 'YWJjZA==' },
    entries: [{
      sha256: hash, sourceRefs: [{ sourceId: 'SRC-1', sourceRelativePath: '상품/001.gif' }], verificationStatus: 'verified',
      observedSummary: '움직이는 가격 안내', contentType: 'animation', useCases: ['상품 안내'],
      searchTags: { productTypes: ['상품'], scenes: [], colors: [], designs: [], topics: ['가격'] },
      textPresence: 'observed', visibleText: ['600,000원'], visibleTextObservations: [{
        text: '600,000원', sourceObjectSha256: hash, provenance: 'gif_frame_pixel', frameIndex: 0,
        region: { x: 0, y: 0, width: 1, height: 1, unit: 'normalized' }, evidenceRef: 'Z:/raw/상품/001.gif', evidenceSha256: hash,
      }], ocrText: '', sourceContext: [], inferredText: [], claimSignals: ['price_claim'],
      claimEvidence: [{
        signal: 'price_claim', topic: 'price', provenance: 'gif_frame_visible_text', visibleTextIndices: [0], frameIndex: 0,
        sourceObjectSha256: hash, evidenceRef: 'Z:/raw/상품/001.gif',
      }],
      privacySignals: [], uncertainties: [],
      reviewEvidence: { method: 'full_loop_original_opened', originalPath: 'Z:/raw/상품/001.gif', reviewer: 'reviewer', reviewedAt: '2026-09-07T01:00:00.000Z' },
      secondarySemanticVerdict: secondarySemanticPointer(hash),
      gifReview: {
        decodedFrameCount: 2, decodedDurationMs: 200, decodedLoopCount: 0, sampledFrameCount: 1,
        sampledFrameIndices: [0], loopBehavior: 'loop', storyboardEvidence: [],
        sampleEvidence: [{ frameIndex: 0, path: 'Z:/evidence/frame-0.png', sha256: hash, pixelSha256: hash, width: 1, height: 1, decoderVersion: 'gifuct-js@2.1.2+munjanggun-compositor-v1', sourceObjectSha256: hash }],
        fullPlaybackObservation: {
          observed: true, method: 'continuous_original_playback', observedFromMs: 0, observedToMs: 200,
          reviewedAt: '2026-09-07T01:00:00.000Z', evidenceRef: 'Z:/evidence/playback.json', evidenceSha256: hash,
        },
      },
    }],
  };
}

function staticTileCoveragePointer(hash) {
  return { manifestRef: 'Z:/evidence/static-tiles.json', manifestSha256: hash, coverageDigest: hash };
}

function secondarySemanticPointer(hash) {
  return {
    status: 'confirmed_match', method: 'independent_full_content_review', reviewerPrincipalId: 'reviewer-2',
    reviewedAt: '2026-09-07T01:00:00.000Z', primaryDecisionDigest: hash,
    evidenceRef: 'Z:/evidence/secondary-semantic.json', evidenceSha256: hash,
  };
}

async function readSchema(name) {
  return JSON.parse(await readFile(resolve('schemas', name), 'utf8'));
}
