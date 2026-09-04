import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateAgainstSchema } from '../scripts/lib/schema-validation.mjs';

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

async function readSchema(name) {
  return JSON.parse(await readFile(resolve('schemas', name), 'utf8'));
}
