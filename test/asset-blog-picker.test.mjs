import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runBlogAssetPicker } from '../scripts/assets-pick-for-blog.mjs';
import { searchCatalogEntries } from '../scripts/assets-search-catalog.mjs';

test('blog picker matches product, installation scene, color, design, and consultation topic', async () => {
  const fixture = await makeCatalog();
  try {
    const output = await runBlogAssetPicker([
      '--catalog', fixture.catalogPath,
      '--product', '3연동 중문',
      '--installation-scene', '현관 설치',
      '--color', '베이지',
      '--design', '모던',
      '--consultation-topic', '좁은 공간',
    ], { emit: () => {}, verifyContentQuality: async () => {} });
    assert.equal(output.candidateCount, 2);
    assert.deepEqual(output.candidates.map((item) => item.contentId).sort(), ['CONTENT-APPROVED', 'CONTENT-BLOCKED']);
    assert(output.candidates.every((item) => Object.keys(item.matchedDimensions).length === 5));
    assert.equal(output.candidates.find((item) => item.contentId === 'CONTENT-APPROVED').catalogMetadataStatus, 'ready_for_guarded_extraction_request');
    assert.equal(output.candidates.find((item) => item.contentId === 'CONTENT-BLOCKED').catalogMetadataStatus, 'review_only');
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('blog picker permits planning selection but never emits an extraction step for blocked metadata', async () => {
  const fixture = await makeCatalog();
  try {
    const blocked = await runBlogAssetPicker([
      '--catalog', fixture.catalogPath, '--query', '베이지 모던', '--select-content-id', 'CONTENT-BLOCKED',
    ], { emit: () => {}, verifyContentQuality: async () => {} });
    assert.equal(blocked.selection.planningSelectionAllowed, true);
    assert.equal(blocked.selection.externalExtractionRequestStatus, 'blocked_by_catalog_metadata');
    assert(blocked.selection.blockers.includes('rightsStatus=not_reviewed'));
    assert.equal(blocked.selection.nextStep, null);

    const approved = await runBlogAssetPicker([
      '--catalog', fixture.catalogPath, '--query', '베이지 모던', '--select-content-id', 'CONTENT-APPROVED',
    ], { emit: () => {}, verifyContentQuality: async () => {} });
    assert.equal(approved.selection.externalExtractionRequestStatus, 'requires_assets_extract_content_revalidation');
    assert.equal(approved.selection.nextStep.command, 'npm run assets:extract-content');
    assert.equal(approved.selection.nextStep.guarantee, 'none_until_extractor_succeeds');

    await assert.rejects(runBlogAssetPicker([
      '--catalog', fixture.catalogPath, '--product', '3연동중문', '--select-content-id', 'CONTENT-OTHER',
    ], { emit: () => {}, verifyContentQuality: async () => {} }), /not in the current candidate results/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('blog picker uses verified visible text for a color criterion', async () => {
  const fixture = await makeCatalog();
  try {
    const catalog = JSON.parse(await readFile(fixture.catalogPath, 'utf8'));
    catalog.entries = [{
      ...catalog.entries[0], semanticSummary: '중문 제품 사진', visibleText: ['화이트'], ocrText: '검정',
    }];
    await writeFile(fixture.catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    const output = await runBlogAssetPicker([
      '--catalog', fixture.catalogPath, '--color', '화이트',
    ], { emit: () => {}, verifyContentQuality: async () => {} });
    assert.equal(output.candidateCount, 1);
    assert.deepEqual(output.candidates[0].visibleText, ['화이트']);
    assert.equal(output.candidates[0].unverifiedOcrText, '검정');
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('blog picker applies detailed criteria before limiting a catalog over 500 entries', async () => {
  const fixture = await makeCatalog();
  try {
    const distractors = Array.from({ length: 500 }, (_, index) => ({
      ...entry(`DISTRACTOR-${index}`, `제품/일반/${index}.jpg`, false),
      semanticSummary: '공통 고득점 일반 자료', visibleText: [],
    }));
    const qualified = {
      ...entry('QUALIFIED', '제품/희귀/qualified.jpg', false),
      semanticSummary: '공통 자료', visibleText: ['희귀'],
    };
    await writeFile(fixture.catalogPath, `${JSON.stringify({ entries: [...distractors, qualified] }, null, 2)}\n`);
    const output = await runBlogAssetPicker([
      '--catalog', fixture.catalogPath, '--query', '공통', '--color', '희귀', '--limit', '1',
    ], { emit: () => {}, verifyContentQuality: async () => {} });
    assert.deepEqual(output.candidates.map((item) => item.contentId), ['QUALIFIED']);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('sensitive short searches require matching pixel-backed claim evidence', () => {
  const plain = (contentId, semanticSummary, visibleText = [], claimEvidence = []) => ({
    ...entry(contentId, `제품/${contentId}.jpg`, false), semanticSummary, visibleText, claimEvidence,
  });
  const catalog = { entries: [
    plain('GLASS', 'GLASS 색상표'), plain('BASIC', 'BASIC 디자인'), plain('ASH', 'ASH 컬러'),
    plain('ABS', 'ABS 도어'), plain('ONE-SLIDING', '원슬라이딩 색상표'),
    plain('AS-GUIDE', 'A/S 안내', ['3년 무상 A/S'], [{ topic: 'after_sales_service' }]),
    plain('PRICE-GUIDE', '가격 안내', ['600,000원'], [{ topic: 'price' }]),
  ] };
  assert.deepEqual(searchCatalogEntries(catalog, { query: 'AS' }).map((item) => item.contentId), ['AS-GUIDE']);
  assert.deepEqual(searchCatalogEntries(catalog, { query: 'A/S' }).map((item) => item.contentId), ['AS-GUIDE']);
  assert.deepEqual(searchCatalogEntries(catalog, { query: '가격' }).map((item) => item.contentId), ['PRICE-GUIDE']);
});

async function makeCatalog() {
  const root = join(tmpdir(), `mg-blog-picker-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const catalogPath = join(root, 'catalog.json');
  await mkdir(root, { recursive: true });
  const entries = [
    entry('CONTENT-APPROVED', '3연동중문/현관/베이지/모던/001.jpg', true),
    entry('CONTENT-BLOCKED', '3연동중문/현관/베이지/모던/002.jpg', false),
    { ...entry('CONTENT-OTHER', '스윙중문/거실/화이트/클래식/001.jpg', true), semanticSummary: '거실 설치 장면 화이트 클래식 디자인 넓은 공간 상담' },
  ];
  await writeFile(catalogPath, `${JSON.stringify({ entries }, null, 2)}\n`);
  return { root, catalogPath };
}

function entry(contentId, sourceRelativePath, approved) {
  const sha256 = createHash('sha256').update(contentId).digest('hex');
  return {
    contentId,
    sha256,
    mediaType: 'image/jpeg',
    semanticSummary: '현관 설치 장면 베이지 모던 디자인 좁은 공간 상담',
    assetType: 'installation_photo',
    useCases: ['중문 안내'],
    searchTags: { productTypes: ['3연동중문'], scenes: ['현관 설치'], colors: ['베이지'], designs: ['모던'], topics: ['좁은 공간'] },
    visibleText: [],
    ocrText: '베이지 모던',
    semanticGroupId: 'SEM-INSTALLATION',
    visualGroupId: `VISUAL-${contentId}`,
    humanReviewStatus: 'reviewed',
    claimSignals: [],
    claimEvidence: [],
    privacySignals: [],
    rightsSignals: approved ? [] : ['source_rights_unverified'],
    rightsStatus: approved ? 'verified' : 'not_reviewed',
    rightsScope: approved ? ['external_reuse'] : [],
    rightsEvidenceRef: approved ? ['RIGHTS-EV-TEST-001'] : [],
    privacyStatus: approved ? 'cleared' : 'not_reviewed',
    claimReviewStatus: approved ? 'not_applicable' : 'not_reviewed',
    claimEvidenceRef: [],
    publishStatus: approved ? 'eligible' : 'blocked',
    publicRepoEligibility: 'not_reviewed',
    reviewEvidenceRefs: [`review.json#sha256=${sha256}`],
    sourceRefs: [{ sourceId: 'SRC-TEST', sourceRelativePath }],
  };
}
