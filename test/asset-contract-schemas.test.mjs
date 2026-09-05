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

async function readSchema(name) {
  return JSON.parse(await readFile(resolve('schemas', name), 'utf8'));
}
