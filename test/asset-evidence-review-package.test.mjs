import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyPixelEvidenceGate, proposeSearchTags } from '../scripts/build-asset-evidence-review-package.mjs';
import { classifyTextMatch } from '../scripts/analyze-asset-pixel-evidence.mjs';
import { assertPackageEntryPixelGate } from '../scripts/validate-asset-evidence-review-package.mjs';
import { midpointIndices } from '../scripts/refine-gif-pixel-evidence.mjs';

test('product tag uses the exact top-level source folder', () => {
  const tags = proposeSearchTags({
    sourceRefs: [{ sourceRelativePath: '원슬라이딩중문/컬렉션/001.jpg' }],
    observedSummary: '원슬라이딩 도어 색상표',
    visibleText: ['WHITE', 'BLACK'],
    claimSignals: ['specification'],
  });
  assert.deepEqual(tags.productTypes, ['원슬라이딩중문']);
  assert.deepEqual(tags.topics, ['제품 사양']);
  assert.deepEqual(tags.colors, []);
});

test('BASIC GLASS and ASH do not create an A/S topic', () => {
  const tags = proposeSearchTags({
    sourceRefs: [{ sourceRelativePath: '3연동중문/001.jpg' }],
    observedSummary: 'BASIC GLASS ASH 색상표',
    visibleText: ['BASIC', 'GLASS', 'ASH'],
    claimSignals: [],
  });
  assert.deepEqual(tags.topics, []);
});

test('원슬라이딩 path does not create a price topic', () => {
  const tags = proposeSearchTags({
    sourceRefs: [{ sourceRelativePath: '원슬라이딩중문/컬렉션/색상표.jpg' }],
    observedSummary: '도어 색상표',
    visibleText: ['오프화이트', '우드'],
    claimSignals: [],
  });
  assert.deepEqual(tags.topics, []);
  assert.deepEqual(tags.colors, ['우드', '화이트']);
});

test('topics come only from adjudicated claim signal enums', () => {
  const tags = proposeSearchTags({
    sourceRefs: [{ sourceRelativePath: 'ABS도어 방문교체/008.jpg' }],
    observedSummary: '가격과 A/S 안내',
    visibleText: ['120,000원', 'A/S'],
    claimSignals: ['price', 'after_sales_service'],
  });
  assert.deepEqual(tags.productTypes, ['ABS도어 방문교체']);
  assert.deepEqual(new Set(tags.topics), new Set(['A/S', '가격']));
});

test('controlled Korean design and color terms are proposed conservatively', () => {
  const tags = proposeSearchTags({
    sourceRefs: [{ sourceRelativePath: '3연동중문/015.jpg' }],
    observedSummary: '화이트 프레임의 모던 디바이드 선택 화면',
    visibleText: ['풀 윈도우', '모던 디바이드'],
    claimSignals: [],
  });
  assert.deepEqual(tags.colors, ['화이트']);
  assert.deepEqual(tags.designs, ['디바이드', '모던 디바이드', '풀 윈도우']);
});

test('GIF refinement selects only new midpoint frames', () => {
  assert.deepEqual(midpointIndices([0, 12, 24, 25]), [6, 18]);
});

test('different prices never pass as a strong or exact pixel match', () => {
  const result = classifyTextMatch('50,000원', '30,000원');
  assert.equal(result.status, 'critical_mismatch');
  assert.deepEqual(result.criticalTokens, ['50000원']);
  assert.deepEqual(result.candidateCriticalTokens, ['30000원']);
});

test('different numbered design models require direct review', () => {
  const result = classifyTextMatch('시그니처 간살 1', '시그니처 간살 2');
  assert.equal(result.status, 'critical_mismatch');
});

test('a region containing the target price and another price is not machine exact', () => {
  const result = classifyTextMatch('50,000원', '50,000원 30,000원');
  assert.equal(result.status, 'critical_mismatch');
});

test('exact is reserved for normalized equality, not containment', () => {
  assert.equal(classifyTextMatch('30,000원', '30,000원').status, 'exact');
  assert.equal(classifyTextMatch('30,000원', '할인가 30,000원').status, 'strong');
});

test('uncertain and observed-without-text records always require direct review', () => {
  assert.equal(classifyPixelEvidenceGate({ textPresence: 'uncertain', visibleText: [] }, { matchStatus: 'review_required' }), 'direct_review_required');
  assert.equal(classifyPixelEvidenceGate({ textPresence: 'observed', visibleText: [] }, { matchStatus: 'review_required' }), 'direct_review_required');
  assert.equal(classifyPixelEvidenceGate({ textPresence: 'none_observed', visibleText: [] }, { matchStatus: 'no_text' }), 'machine_ready_non_authority');
});

test('package validator rejects an uncertain asset relabeled machine ready', () => {
  assert.throws(() => assertPackageEntryPixelGate({
    sourceObjectSha256: 'a'.repeat(64), textPresence: 'uncertain', visibleText: [], textReviewQueue: [],
    pixelMatchSummary: { exact: 0, strong: 0, weak: 0, critical_mismatch: 0, unmatched: 0 },
    gates: { pixelRegions: 'machine_ready_non_authority' },
  }), /contradicts text evidence/u);
});

test('package validator rejects a critical mismatch omitted from direct review queue', () => {
  assert.throws(() => assertPackageEntryPixelGate({
    sourceObjectSha256: 'b'.repeat(64), textPresence: 'observed', visibleText: ['50,000원'], textReviewQueue: [],
    pixelMatchSummary: { exact: 0, strong: 0, weak: 0, critical_mismatch: 1, unmatched: 0 },
    gates: { pixelRegions: 'machine_ready_non_authority' },
  }), /queue count mismatch/u);
});
