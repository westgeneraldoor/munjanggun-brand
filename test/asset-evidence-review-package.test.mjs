import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proposeSearchTags } from '../scripts/build-asset-evidence-review-package.mjs';
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
