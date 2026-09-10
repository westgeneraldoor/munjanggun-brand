import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { classifyPixelEvidenceGate, proposeSearchTags } from '../scripts/build-asset-evidence-review-package.mjs';
import { classifyTextMatch } from '../scripts/analyze-asset-pixel-evidence.mjs';
import { assertPackageEntryPixelGate, validateAssetEvidenceReviewPackage } from '../scripts/validate-asset-evidence-review-package.mjs';
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

test('decimal magnitude and spaced units remain critical evidence', () => {
  assert.equal(classifyTextMatch('1.5cm', '15cm').status, 'critical_mismatch');
  assert.equal(classifyTextMatch('3.5만원', '35만원').status, 'critical_mismatch');
  assert.equal(classifyTextMatch('두께 5 mm', '두께 5 cm').status, 'critical_mismatch');
  assert.deepEqual(classifyTextMatch('3.5만원', '35만원').criticalTokens, ['35000원']);
});

test('critical evidence preserves order while accepting harmless formatting', () => {
  assert.equal(classifyTextMatch('폭 100cm 높이 200cm', '폭 200cm 높이 100cm').status, 'critical_mismatch');
  assert.equal(classifyTextMatch('50,000원', '50000 원').status, 'exact');
  assert.equal(classifyTextMatch('1.50 cm', '1.5cm').status, 'exact');
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

test('file package validator rejects a review phrase removed from the separate queue', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'munjanggun-evidence-package-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageRoot = resolve(root, 'package');
  const sourceRoot = resolve(root, 'sources');
  await Promise.all([mkdir(packageRoot), mkdir(sourceRoot)]);
  const sha = 'c'.repeat(64);
  const match = {
    text: '50,000원', status: 'critical_mismatch', score: 0.8,
    criticalTokens: ['50000원'], candidateCriticalTokens: ['30000원'], criticalCompatible: false,
    normalizedCandidate: '30000원', recognizedText: '30,000원', sourcePath: resolve(root, 'frame.png'),
    frameIndex: 7, region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4, unit: 'normalized' },
    ocrLineStart: 1, ocrLineCount: 1,
  };
  const analysis = {
    schema: 'munjanggun.assetPixelEvidenceAnalysis.v1', version: '1.0',
    assets: [{ sourceObjectSha256: sha, textPresence: 'observed', textMatches: [match] }],
  };
  const entry = {
    sourceObjectSha256: sha, mediaKind: 'gif', textPresence: 'observed', visibleText: ['50,000원'],
    textReviewQueue: [match], pixelMatchSummary: { exact: 0, strong: 0, weak: 0, critical_mismatch: 1, unmatched: 0 },
    sourceUncertainties: [], claimSignals: [], privacySignals: [],
    gates: { pixelRegions: 'direct_review_required' }, promotionEligible: false,
  };
  const queued = { ...structuredClone(entry), textReviewQueue: [] };
  const analysisSpec = await writeJsonWithHash(resolve(sourceRoot, 'analysis.json'), analysis);
  const entriesSpec = await writeJsonWithHash(resolve(packageRoot, 'asset-evidence-entries.json'), { entries: [entry] });
  const queueSpec = await writeJsonWithHash(resolve(packageRoot, 'direct-review-queue.json'), { queue: [queued] });
  const dashboardPath = resolve(packageRoot, 'review-dashboard.html');
  const dashboardBytes = Buffer.from('review', 'utf8');
  await writeFile(dashboardPath, dashboardBytes);
  const report = {
    schema: 'munjanggun.assetEvidenceReviewPackage.v1', version: '1.0', status: 'non_authority_review_package',
    files: {
      entries: entriesSpec,
      queue: queueSpec,
      dashboard: { path: dashboardPath, sha256: digest(dashboardBytes) },
    },
    sources: { analysis: analysisSpec },
    coverage: {
      uniqueAssetCount: 1, staticAssetCount: 0, gifAssetCount: 1,
      machinePixelReadyCount: 0, directPixelReviewAssetCount: 1,
      queuedAssetCount: 1, queuedTextItemCount: 0, claimAssetCount: 0, privacyAssetCount: 0,
      promotionEligibleCount: 0,
    },
  };
  const reportPath = resolve(packageRoot, 'package-report.json');
  await writeFile(reportPath, jsonBytes(report));
  await assert.rejects(
    validateAssetEvidenceReviewPackage({ reportPath }),
    /direct-review queue content mismatch/u,
  );
});

async function writeJsonWithHash(path, value) {
  const bytes = jsonBytes(value);
  await writeFile(path, bytes);
  return { path, sha256: digest(bytes) };
}

function jsonBytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
