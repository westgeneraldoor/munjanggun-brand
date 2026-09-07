import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkerReviewQueue } from '../scripts/lib/asset-worker-review-queue.mjs';

const base = { rightsStatus: 'owner_approved_recorded', sourceRefs: [{ sourceRelativePath: '상품/001.jpg' }] };

test('worker queue separates easy first review from claim, privacy, and reread work', () => {
  const catalog = { intakeId: 'INTAKE-20260905-01', entries: [
    { ...base, contentId: 'A', sha256: 'a'.repeat(64), semanticSummary: '제품 사진', humanReviewStatus: 'reviewed', claimSignals: [], privacySignals: [] },
    { ...base, contentId: 'B', sha256: 'b'.repeat(64), semanticSummary: '가격표', humanReviewStatus: 'reviewed', claimSignals: ['price'], privacySignals: [] },
    { ...base, contentId: 'C', sha256: 'c'.repeat(64), semanticSummary: '다른 가격표', humanReviewStatus: 'needs_escalation', claimSignals: ['price'], privacySignals: ['face'] },
  ] };
  const queue = buildWorkerReviewQueue(catalog, '2026-09-05T00:00:00.000Z');
  assert.deepEqual(queue.counts, { totalAssets: 3, firstReviewCandidates: 1, claimSignalAssets: 2, privacySignalAssets: 1, humanReReviewAssets: 1 });
  assert.equal(queue.claimBatches.length, 1);
  assert.equal(queue.claimBatches[0].assetCount, 2);
  assert.equal(queue.firstReviewCandidates[0].contentId, 'A');
});
