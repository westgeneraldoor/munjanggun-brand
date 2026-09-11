import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  buildInternalAssetBrief, loadInternalAssetLibrary, resolveProductStoryContext,
  searchInternalAssetLibrary, writeInternalAssetHandoff,
} from '../scripts/lib/asset-internal-library.mjs';
import { contentReviewerKeyFingerprint } from '../scripts/lib/asset-content-reviewer-trust.mjs';
import { stableJson } from '../scripts/lib/asset-owner-trust.mjs';

test('primary-reviewed internal mode searches across all records and keeps publication blocked', async () => {
  const fixture = await makeFixture();
  try {
    const library = await loadFixture(fixture);
    const results = searchInternalAssetLibrary(library, { product: '3연동 중문', color: '베이지' }, { limit: 1 });
    assert.equal(library.records.length, 3);
    assert.equal(results.length, 1);
    assert.equal(results[0].sha256, fixture.hashes[2]);
    assert.equal(results[0].usageStatus.internalSearchPreview.status, 'usable');
    assert.equal(results[0].usageStatus.externalPublication.status, 'blocked_selected_asset_review_required');
    assert.equal(results[0].usageStatus.publicGit.status, 'blocked');
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('whole-product search returns the product story before individual assets', async () => {
  const fixture = await makeFixture();
  try {
    const library = await loadFixture(fixture);
    const criteria = { product: '3연동 중문' };
    const storyContext = resolveProductStoryContext(library.productStoryContexts, criteria);
    const results = searchInternalAssetLibrary(library, criteria, { limit: 20, storyContext });
    const brief = buildInternalAssetBrief(library, criteria, results);
    assert.equal(results.length, 2);
    assert.equal(brief.requestScope.kind, 'whole_product');
    assert.equal(brief.productId, 'PROD-FIXTURE-3PANEL');
    assert.deepEqual(brief.optionSets[0].options.map((option) => option.label), ['블랙 그룹', '베이지 그룹']);
    assert.equal(results[0].narrativePlacements[0].sectionId, 'overview');
    assert.equal(results[0].storyPlacement.sourcePath, '3연동중문/002.jpg');
    assert.equal(results[0].storySourcePath, '3연동중문/002.jpg');
    assert.equal(results[0].storySourceId, 'SRC-FIXTURE');
    assert.equal(brief.resultCoverage.wholeProductAssetSelectionComplete, true);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('subset search says it is only part of the product and preserves the other options', async () => {
  const fixture = await makeFixture();
  try {
    const library = await loadFixture(fixture);
    const criteria = { query: '3연동중문 베이지' };
    const storyContext = resolveProductStoryContext(library.productStoryContexts, criteria);
    const results = searchInternalAssetLibrary(library, criteria, { limit: 20, storyContext });
    const brief = buildInternalAssetBrief(library, criteria, results);
    assert.equal(brief.requestScope.kind, 'product_subset');
    assert.deepEqual(brief.requestScope.matchedOptions.map((option) => option.label), ['베이지 그룹']);
    assert.deepEqual(brief.optionSets[0].options.map((option) => option.label), ['블랙 그룹', '베이지 그룹']);
    assert.deepEqual(brief.resultCoverage.optionSetCoverage[0].missingOptions, ['블랙 그룹']);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('repository story contexts resolve seven vetted products without cross-product ambiguity', async () => {
  const config = JSON.parse(await readFile(new URL('../config/product-story-contexts.json', import.meta.url), 'utf8'));
  const catalogs = new Map(config.detailCatalogs.map((catalog) => [catalog.detailCatalogId, catalog.details]));
  const contexts = structuredClone(config.contexts).map((context) => ({
    ...context,
    authorityStatus: config.authorityStatus,
    optionSets: context.optionSets.map((optionSet) => ({
      ...optionSet,
      options: optionSet.options.map((option) => ({
        ...option, details: option.details ?? catalogs.get(option.detailCatalogId) ?? [],
      })),
    })),
  }));
  const expected = new Map([
    ['3연동중문', 'PROD-3PANEL-MIDDLE-DOOR'],
    ['원슬라이딩중문', 'PROD-ONE-SLIDING-MIDDLE-DOOR'],
    ['3연동 자동중문', 'PROD-3PANEL-AUTO-MIDDLE-DOOR'],
    ['3연동ㄱ자', 'PROD-3PANEL-LSHAPE-MIDDLE-DOOR'],
    ['스윙중문', 'PROD-SWING-MIDDLE-DOOR'],
    ['양개형중문 미서기', 'PROD-WIDE-SLIDING-MIDDLE-DOOR'],
    ['ABS도어 방문교체', 'PROD-ABS-DOOR-REPLACEMENT'],
  ]);
  assert.equal(contexts.length, 7);
  for (const [product, productId] of expected) {
    assert.equal(resolveProductStoryContext(contexts, { product }).productId, productId);
  }

  const wideBrief = buildInternalAssetBrief({ productStoryContexts: contexts }, { query: '양개형중문 미서기 4연동' }, []);
  assert.equal(wideBrief.requestScope.label, '양개형중문 미서기의 일부 선택 축');
  assert.deepEqual(wideBrief.requestScope.matchedOptions.map((option) => option.label), ['4연동 중문']);
  const absBrief = buildInternalAssetBrief({ productStoryContexts: contexts }, { product: 'ABS도어 방문교체' }, []);
  assert.match(absBrief.sourceWarnings[0].reason, /패키지3/u);

  for (const [query, productId] of [
    ['3연동중문 자동', 'PROD-3PANEL-AUTO-MIDDLE-DOOR'],
    ['ㄱ자 3연동중문', 'PROD-3PANEL-LSHAPE-MIDDLE-DOOR'],
    ['3연동 중문 자동', 'PROD-3PANEL-AUTO-MIDDLE-DOOR'],
  ]) assert.equal(resolveProductStoryContext(contexts, { query }).productId, productId);

  const expectedSubsets = [
    ['3연동중문 화이트 오크', '프리미엄 우드', '화이트 오크'],
    ['3연동중문 월넛', '프리미엄 우드', '월넛'],
    ['3연동중문 올리브그린', '오리지널 컬러', '올리브그린'],
  ];
  for (const [query, group, detail] of expectedSubsets) {
    const brief = buildInternalAssetBrief({ productStoryContexts: contexts }, { query }, []);
    assert.equal(brief.requestScope.kind, 'product_subset');
    assert.equal(brief.requestScope.matchedOptions[0].label, group);
    assert.equal(brief.requestScope.matchedOptions[0].detail.label, detail);
  }
  for (const [query, section] of [
    ['3연동중문 행사', 'event_and_notice'], ['3연동중문 유리', 'glass_options'], ['3연동중문 시공', 'fit_and_consultation'],
  ]) assert.equal(buildInternalAssetBrief({ productStoryContexts: contexts }, { query }, []).requestScope.matchedSections[0].sectionId, section);
  assert.equal(buildInternalAssetBrief({ productStoryContexts: contexts }, { query: 'ABS도어 방문교체 패키지3' }, [])
    .requestScope.matchedOptions[0].optionId, 'package_3_conflict');
  assert.equal(buildInternalAssetBrief({ productStoryContexts: contexts }, { product: '3연동중문', color: '우드' }, [])
    .requestScope.matchedOptions[0].optionId, 'premium_wood');
  const codeBrief = buildInternalAssetBrief({ productStoryContexts: contexts }, { query: '3연동중문 DS64' }, []);
  assert.equal(codeBrief.requestScope.kind, 'product_subset');
  assert.equal(codeBrief.requestScope.matchedOptions[0].detail.label, '올리브그린');
  assert.equal(buildInternalAssetBrief({ productStoryContexts: contexts }, { product: '3연동중문' }, [])
    .applicableConstraints[0].constraintId, '3panel-basic-only-white-source-claim');
  assert.equal(buildInternalAssetBrief({ productStoryContexts: contexts }, { query: '3연동중문 베이직 우드' }, [])
    .applicableConstraints[0].constraintId, '3panel-basic-only-white-source-claim');

  const productComparison = buildInternalAssetBrief(
    { productStoryContexts: contexts }, { query: '3연동중문 원슬라이딩중문 비교' }, [],
  );
  assert.equal(productComparison.productId, 'PROD-3PANEL-MIDDLE-DOOR');
  assert.equal(productComparison.requestScope.kind, 'comparison_requires_split');
  assert.deepEqual(productComparison.requestScope.comparisonTargets.map((target) => target.productId), [
    'PROD-3PANEL-MIDDLE-DOOR', 'PROD-ONE-SLIDING-MIDDLE-DOOR',
  ]);
  const explicitProductComparison = buildInternalAssetBrief(
    { productStoryContexts: contexts }, { product: '3연동중문', query: '원슬라이딩중문' }, [],
  );
  assert.equal(explicitProductComparison.productId, 'PROD-3PANEL-MIDDLE-DOOR');
  assert.equal(explicitProductComparison.requestScope.kind, 'comparison_requires_split');
  const unresolvedProductTerm = buildInternalAssetBrief(
    { productStoryContexts: contexts }, { product: '3연동중문', query: '자동중문' }, [],
  );
  assert.equal(unresolvedProductTerm.requestScope.kind, 'product_topic_unresolved');
  assert.deepEqual(unresolvedProductTerm.requestScope.unresolvedTerms, ['자동중문']);
  assert.deepEqual(unresolvedProductTerm.requestScope.unresolvedProductTerms, ['자동중문']);
  assert.equal(unresolvedProductTerm.requestResolution.status, 'unresolved_product_term_requires_clarification');

  const optionComparison = buildInternalAssetBrief(
    { productStoryContexts: contexts }, { query: '3연동중문 우드와 화이트 비교' }, [],
  );
  assert.equal(optionComparison.requestScope.kind, 'comparison_requires_split');
  assert.deepEqual(optionComparison.requestScope.comparisonTargets.map((target) => target.label), ['프리미엄 우드', '퍼스널 화이트']);
  assert.equal(optionComparison.requestResolution.status, 'comparison_requires_separate_searches');
  assert.equal(optionComparison.completionAssessment.readerQuestionAnswerComplete, false);
});

test('story placement requires a registered source id even when the path is identical', () => {
  const context = {
    contextId: 'STORY-SOURCE-BOUND', productId: 'PROD-SOURCE-BOUND', productNames: ['소스상품'], sourceIds: ['SRC-ALLOWED'],
    authorityStatus: 'curated_non_authority_context', summary: 'source bound', wholeProductRule: 'whole', subsetRule: 'subset',
    requiredOptionSetsForWholeProduct: ['groups'], requiredSectionsForWholeProduct: ['overview'], writingGuardrails: [], sourceWarnings: [],
    optionSets: [{ optionSetId: 'groups', label: '그룹', relationship: '관계', options: [{
      optionId: 'one', label: '하나', aliases: ['하나'], summary: '하나', selectors: [{ pathPrefix: '소스상품/' }],
    }] }],
    sections: [{ sectionId: 'overview', order: 1, label: '개요', summary: '개요', selectors: [{ pathPrefix: '소스상품/' }] }],
  };
  const record = {
    sourceObjectSha256: 'a'.repeat(64), mediaKind: 'static', originalPath: 'C:/fixture.jpg',
    sourceRefs: [{ sourceId: 'SRC-DIFFERENT', sourceRelativePath: '소스상품/001.jpg' }], observedSummary: '소스상품', contentType: 'photo',
    useCases: [], proposedSearchTags: { productTypes: ['소스상품'], scenes: [], colors: [], designs: [], topics: [] },
    acceptedObservations: [], claimSignals: [], privacySignals: [], releaseConstraints: [],
  };
  const results = searchInternalAssetLibrary({ records: [record] }, { product: '소스상품' }, { storyContext: context });
  assert.equal(results.length, 0);
});

test('detail search ranks exact catalog evidence before exact examples and labeled group context', () => {
  const context = {
    contextId: 'STORY-DETAIL', productId: 'PROD-DETAIL', productNames: ['상세상품'], sourceIds: ['SRC-DETAIL'],
    authorityStatus: 'curated_non_authority_context', summary: 'detail', wholeProductRule: 'whole', subsetRule: 'subset',
    requiredOptionSetsForWholeProduct: ['colors'], requiredSectionsForWholeProduct: ['colors'], writingGuardrails: [], sourceWarnings: [],
    optionSets: [
      { optionSetId: 'colors', label: '컬러', relationship: '관계', options: [{
        optionId: 'wood', label: '우드', aliases: ['우드'], summary: '우드',
        details: [{ detailId: 'white_oak', label: '화이트 오크', aliases: ['white oak'], code: 'EW175' }],
        selectors: [{ pathPrefix: '상세상품/컬러/', sequenceFrom: 1, sequenceTo: 3 }],
        evidenceRoles: [
          { roleId: 'option_catalog', label: '세부 색상표', required: true, selectors: [{ pathPrefix: '상세상품/컬러/', sequenceFrom: 1, sequenceTo: 1 }] },
          { roleId: 'application_examples', label: '적용 예시', required: false, selectors: [{ pathPrefix: '상세상품/컬러/', sequenceFrom: 2, sequenceTo: 2 }] },
        ],
      }] },
      { optionSetId: 'collections', label: '컬렉션', relationship: '관계', options: [{
        optionId: 'basic', label: '베이직', aliases: ['베이직'], summary: '베이직',
        selectors: [{ pathPrefix: '상세상품/컬러/', sequenceFrom: 1, sequenceTo: 3 }],
      }] },
    ],
    sections: [{ sectionId: 'colors', order: 1, label: '컬러', summary: '컬러', selectors: [{ pathPrefix: '상세상품/컬러/' }] }],
  };
  const makeRecord = (suffix, summary, visibleText) => ({
    sourceObjectSha256: suffix.repeat(64), mediaKind: 'static', originalPath: `C:/fixture-${suffix}.jpg`,
    sourceRefs: [{ sourceId: 'SRC-DETAIL', sourceRelativePath: `상세상품/컬러/00${suffix}.jpg` }],
    observedSummary: summary, contentType: 'photo', useCases: [],
    proposedSearchTags: { productTypes: ['상세상품'], scenes: [], colors: [], designs: [], topics: [] },
    acceptedObservations: visibleText.map((text) => ({ text, recognizedText: text })), claimSignals: [], privacySignals: [], releaseConstraints: [],
  });
  const library = { productStoryContexts: [context], records: [
    makeRecord('3', '우드 그룹 연출', ['PREMIUM WOOD']),
    makeRecord('2', '화이트 오크 적용 예시', ['WHITE OAK']),
    makeRecord('1', '화이트 오크 색상표', ['화이트 오크', 'EW175']),
  ] };
  const criteria = { query: '상세상품 화이트 오크' };
  const storyContext = resolveProductStoryContext(library.productStoryContexts, criteria);
  const results = searchInternalAssetLibrary(library, criteria, { storyContext, limit: 20 });
  assert.deepEqual(results.map((result) => result.storySourcePath), [
    '상세상품/컬러/001.jpg', '상세상품/컬러/002.jpg', '상세상품/컬러/003.jpg',
  ]);
  assert.deepEqual(results.map((result) => result.storyEvidenceMatch.kind), [
    'exact_detail_evidence', 'exact_detail_evidence', 'option_group_context',
  ]);
  assert.equal(results[0].storyEvidenceMatch.isCatalogEvidence, true);
  const structured = searchInternalAssetLibrary(library, { product: '상세상품', color: '화이트 오크' }, { storyContext, limit: 20 });
  assert.deepEqual(structured.map((result) => result.storyEvidenceMatch.kind), results.map((result) => result.storyEvidenceMatch.kind));

  const unsupportedCriteria = { query: '상세상품 우드 방탄' };
  const unsupported = searchInternalAssetLibrary(library, unsupportedCriteria, { storyContext, limit: 20 });
  const unsupportedBrief = buildInternalAssetBrief(library, unsupportedCriteria, unsupported);
  assert.equal(unsupported.length, 0);
  assert.deepEqual(unsupportedBrief.requestScope.unresolvedTerms, ['방탄']);
  assert.equal(unsupportedBrief.requestResolution.status, 'unresolved_condition_no_evidence');

  for (const [field, value] of [
    ['color', '우드 방탄'],
    ['color', '화이트 오크 방탄'],
    ['design', '베이직 방탄'],
    ['topic', '컬러 방탄'],
    ['scene', '방탄'],
  ]) {
    const structuredCriteria = { product: '상세상품', [field]: value };
    const structuredResults = searchInternalAssetLibrary(library, structuredCriteria, { storyContext, limit: 20 });
    const structuredBrief = buildInternalAssetBrief(library, structuredCriteria, structuredResults);
    assert.equal(structuredResults.length, 0, `${field} must not drop an unresolved condition`);
    assert.deepEqual(structuredBrief.requestScope.unresolvedTerms, ['방탄']);
    assert.deepEqual(structuredBrief.requestScope.unresolvedConditions, [{ field, term: '방탄' }]);
    assert.deepEqual(structuredBrief.requestResolution.unresolvedConditions, [
      { field, term: '방탄', status: 'no_matching_evidence' },
    ]);
    assert.equal(structuredBrief.requestResolution.status, 'unresolved_condition_no_evidence');
  }

  library.records[0].observedSummary = '다른 출처에서 자동중문으로도 쓰인 공유 이미지';
  const conflictingProductTerm = { product: '상세상품', query: '자동중문' };
  const conflictingResults = searchInternalAssetLibrary(library, conflictingProductTerm, { storyContext, limit: 20 });
  const conflictingBrief = buildInternalAssetBrief(library, conflictingProductTerm, conflictingResults);
  assert.equal(conflictingResults.length, 0);
  assert.equal(conflictingBrief.requestResolution.status, 'unresolved_product_term_requires_clarification');
});

test('spacing variants of a product alias resolve and search the same story context', () => {
  const context = {
    contextId: 'STORY-SPACING', productId: 'PROD-SPACING',
    productNames: ['3연동 자동중문', '3연동 자동 중문', '3연동중문 자동'], sourceIds: ['SRC-SPACING'],
    authorityStatus: 'curated_non_authority_context', summary: 'spacing', wholeProductRule: 'whole', subsetRule: 'subset',
    requiredOptionSetsForWholeProduct: [], requiredSectionsForWholeProduct: ['overview'], writingGuardrails: [], sourceWarnings: [],
    optionSets: [],
    sections: [{ sectionId: 'overview', order: 1, label: '개요', summary: '개요', selectors: [{ pathPrefix: '3연동 자동중문/' }] }],
  };
  const record = {
    sourceObjectSha256: '9'.repeat(64), mediaKind: 'static', originalPath: 'C:/fixture-spacing.jpg',
    sourceRefs: [{ sourceId: 'SRC-SPACING', sourceRelativePath: '3연동 자동중문/001.jpg' }],
    observedSummary: '3연동 자동중문 상품 소개', contentType: 'photo', useCases: [],
    proposedSearchTags: { productTypes: ['3연동 자동중문'], scenes: [], colors: [], designs: [], topics: [] },
    acceptedObservations: [], claimSignals: [], privacySignals: [], releaseConstraints: [],
  };
  const secondRecord = {
    ...record,
    sourceObjectSha256: '8'.repeat(64),
    originalPath: 'C:/fixture-spacing-2.jpg',
    sourceRefs: [{ sourceId: 'SRC-SPACING', sourceRelativePath: '3연동 자동중문/002.jpg' }],
    observedSummary: '두 번째 상품 소개',
    proposedSearchTags: { productTypes: [], scenes: [], colors: [], designs: [], topics: [] },
  };
  const directButUnplacedRecord = {
    ...record,
    sourceObjectSha256: '7'.repeat(64),
    originalPath: 'C:/fixture-spacing-unplaced.jpg',
    sourceRefs: [{ sourceId: 'SRC-OTHER', sourceRelativePath: '다른상품/001.jpg' }],
    observedSummary: '3연동 자동중문 검색어는 있으나 등록 스토리 출처가 아닌 자료',
  };
  const library = { productStoryContexts: [context], records: [record, secondRecord, directButUnplacedRecord] };
  const resultPaths = [];
  for (const criteria of [{ query: '3연동중문 자동' }, { query: '3연동 중문 자동' }, { product: '3연동 자동중문' }]) {
    const storyContext = resolveProductStoryContext(library.productStoryContexts, criteria);
    const results = searchInternalAssetLibrary(library, criteria, { storyContext, limit: 20 });
    const brief = buildInternalAssetBrief(library, criteria, results);
    assert.equal(storyContext.productId, 'PROD-SPACING');
    assert.equal(results.length, 2);
    assert.equal(brief.requestScope.kind, 'whole_product');
    assert.deepEqual(brief.requestScope.unresolvedTerms, []);
    resultPaths.push(results.map((result) => result.storySourcePath));
  }
  assert.deepEqual(resultPaths[0], resultPaths[1]);
  assert.deepEqual(resultPaths[0], resultPaths[2]);
});

test('structured color filter can use folder-derived color-group membership', async () => {
  const fixture = await makeFixture();
  try {
    const library = await loadFixture(fixture);
    const criteria = { product: '3연동중문', color: '베이지 그룹' };
    const storyContext = resolveProductStoryContext(library.productStoryContexts, criteria);
    const results = searchInternalAssetLibrary(library, criteria, { limit: 20, storyContext });
    assert.equal(results.length, 1);
    assert.equal(results[0].sha256, fixture.hashes[2]);
    assert.equal(results[0].narrativePlacements[0].optionMemberships[0].label, '베이지 그룹');
    assert.equal(results[0].storyPlacement.optionMemberships[0].label, '베이지 그룹');
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('internal mode rejects a candidate changed after the active pointer was sealed', async () => {
  const fixture = await makeFixture();
  try {
    await writeFile(fixture.candidatePath, `${await readFile(fixture.candidatePath, 'utf8')} `);
    await assert.rejects(loadFixture(fixture), /primaryCandidate SHA-256 mismatch/u);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('internal mode rejects an original whose bytes no longer match the reviewed SHA', async () => {
  const fixture = await makeFixture();
  try {
    await writeFile(fixture.originalPaths[0], 'tampered');
    await assert.rejects(loadFixture(fixture), /Original .* SHA-256 mismatch/u);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('internal handoff writes metadata and preview only for a registered consumer', async () => {
  const fixture = await makeFixture();
  try {
    const library = await loadFixture(fixture);
    const criteria = { product: '3연동중문' };
    const storyContext = resolveProductStoryContext(library.productStoryContexts, criteria);
    const results = searchInternalAssetLibrary(library, criteria, { limit: 20, storyContext });
    const contentBrief = buildInternalAssetBrief(library, criteria, results);
    const output = await writeInternalAssetHandoff(library, results, [fixture.hashes[2], fixture.hashes[1]], {
      consumerId: 'fixture-blog', outputName: 'selection-001', repoRoot: fixture.repoRoot,
      verifyConsumerDestination: async () => {}, generatedAt: '2026-09-10T00:00:00.000Z', contentBrief,
    });
    assert.equal(output.containsBinaryCopies, false);
    assert.deepEqual((await readdir(output.outputRoot)).sort(), ['asset-handoff.json', 'preview.html']);
    const handoff = JSON.parse(await readFile(output.handoffPath, 'utf8'));
    const preview = await readFile(output.previewPath, 'utf8');
    assert.equal(handoff.authorityStatus, 'non_authority');
    assert.equal(handoff.usageNotice.externalPublication, 'blocked_selected_asset_review_required');
    assert.deepEqual(handoff.selected.map((entry) => entry.sha256), [fixture.hashes[1], fixture.hashes[2]]);
    assert.deepEqual(handoff.contentBrief, contentBrief);
    assert.match(preview, /상품 전체 문맥/u);
    assert.match(preview, /3연동중문\/002\.jpg/u);
    assert.match(preview, /독자 질문 검수/u);
    assert.match(preview, /FIELD_JUDGMENT_RULES\.md/u);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('detail handoff preserves exact evidence priority instead of reverting to folder order', async () => {
  const fixture = await makeFixture();
  try {
    const library = await loadFixture(fixture);
    const context = library.productStoryContexts[0];
    const beige = context.optionSets[0].options.find((option) => option.optionId === 'beige');
    beige.details = [{ detailId: 'sand_beige', label: '샌드 베이지', aliases: [], code: 'DB100' }];
    beige.selectors = [{ pathPrefix: '3연동중문/', sequenceFrom: 2, sequenceTo: 3 }];
    beige.evidenceRoles = [{
      roleId: 'option_catalog', label: '세부 색상표', required: true,
      selectors: [{ pathPrefix: '3연동중문/', sequenceFrom: 3, sequenceTo: 3 }],
    }];
    library.records[2].acceptedObservations = [{ text: '샌드 베이지 DB100', recognizedText: '샌드 베이지 DB100' }];
    const criteria = { query: '3연동중문 샌드 베이지' };
    const results = searchInternalAssetLibrary(library, criteria, { storyContext: context, limit: 20 });
    assert.deepEqual(results.map((entry) => entry.sha256), [fixture.hashes[2], fixture.hashes[1]]);
    const contentBrief = buildInternalAssetBrief(library, criteria, results);
    const output = await writeInternalAssetHandoff(library, results, results.map((entry) => entry.sha256).reverse(), {
      consumerId: 'fixture-blog', outputName: 'detail-selection', repoRoot: fixture.repoRoot,
      verifyConsumerDestination: async () => {}, generatedAt: '2026-09-10T00:00:00.000Z', contentBrief,
    });
    const handoff = JSON.parse(await readFile(output.handoffPath, 'utf8'));
    assert.deepEqual(handoff.selected.map((entry) => entry.sha256), [fixture.hashes[2], fixture.hashes[1]]);
    assert.deepEqual(handoff.selected.map((entry) => entry.storyEvidenceMatch.kind), [
      'exact_detail_evidence', 'option_group_context',
    ]);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

async function loadFixture(fixture) {
  return loadInternalAssetLibrary(fixture.configPath, {
    repoRoot: fixture.repoRoot,
    trustedPrivateRoots: [fixture.privateRoot],
    consumerPolicy: [{
      consumerId: 'fixture-blog', channel: 'blog', privateRoot: fixture.outputRoot, requireGitIgnored: true,
    }],
    verifyCommittedConfig: async () => {},
    verifyCommittedConsumers: async () => {},
    storyContexts: fixture.storyContexts,
  });
}

async function makeFixture() {
  const root = join(tmpdir(), `mg-internal-library-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const repoRoot = join(root, 'repo');
  const privateRoot = join(root, 'private');
  const outputRoot = join(root, 'consumer-private');
  await Promise.all([mkdir(repoRoot, { recursive: true }), mkdir(privateRoot, { recursive: true }), mkdir(outputRoot, { recursive: true })]);
  const originalPaths = [];
  const hashes = [];
  const specs = [
    { body: 'swing-white', product: '스윙중문', color: '화이트', path: '스윙중문/001.jpg', claim: [], privacy: [] },
    { body: 'three-black', product: '3연동중문', color: '블랙', path: '3연동중문/002.jpg', claim: ['price'], privacy: [] },
    { body: 'three-beige', product: '3연동중문', color: '베이지', path: '3연동중문/003.jpg', claim: [], privacy: ['person'] },
  ];
  const records = [];
  for (const [index, spec] of specs.entries()) {
    const originalPath = join(privateRoot, `${index}.jpg`);
    await writeFile(originalPath, spec.body);
    const hash = digest(spec.body);
    originalPaths.push(originalPath);
    hashes.push(hash);
    records.push({
      sourceObjectSha256: hash,
      mediaKind: 'static',
      originalPath,
      sourceRefs: [{ sourceId: 'SRC-FIXTURE', sourceRelativePath: spec.path }],
      observedSummary: `${spec.product} ${spec.color} 현관 제품 사진`,
      contentType: 'product_photo',
      useCases: ['내부 콘텐츠 기획'],
      proposedSearchTags: {
        productTypes: [spec.product], scenes: ['현관'], colors: [spec.color], designs: [], topics: ['제품'],
      },
      acceptedObservations: [], unresolvedObservations: [], claimSignals: spec.claim, privacySignals: spec.privacy,
      releaseConstraints: [],
    });
  }
  const candidate = {
    schema: 'munjanggun.assetPrimaryContentStructuringCandidate.v2', version: '2.0', authorityStatus: 'non_authority',
    promotionEligible: false, coverage: { uniqueAssetCount: records.length, unresolvedObservationCount: 0 }, records,
  };
  const candidatePath = join(privateRoot, 'candidate.json');
  const candidateBytes = await writeJson(candidatePath, candidate);
  const candidateSha = digest(candidateBytes);
  const evidence = {
    schema: 'fixture', promotionEligible: false, sourceCandidate: { sha256: candidateSha },
    coverage: { assetCount: records.length, staticUniqueCropCount: records.length, gifUniqueFrameCount: 0 },
  };
  const receipt = { schema: 'fixture-receipt' };
  const ledger = { schema: 'fixture-ledger' };
  const evidencePath = join(privateRoot, 'evidence.json');
  const receiptPath = join(privateRoot, 'receipt.json');
  const ledgerPath = join(privateRoot, 'ledger.json');
  const evidenceBytes = await writeJson(evidencePath, evidence);
  const receiptBytes = await writeJson(receiptPath, receipt);
  const ledgerBytes = await writeJson(ledgerPath, ledger);

  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const fingerprint = contentReviewerKeyFingerprint(publicKeyPem);
  const trust = {
    schema: 'munjanggun.assetContentReviewerTrust.v1', version: '1.0', keys: [{
      principalId: 'fixture-reviewer', keyId: 'fixture-reviewer-v1', status: 'active', publicKeyPem, fingerprint,
    }],
  };
  const trustPath = join(privateRoot, 'trust.json');
  const trustBytes = await writeJson(trustPath, trust);
  const attestationPayload = {
    schema: 'munjanggun.assetContentReviewRawBatchAttestation.v1', version: '1.0',
    reviewerPrincipalId: 'fixture-reviewer', rawTranscriptSha256: candidateSha,
  };
  const attestation = {
    ...attestationPayload,
    signature: {
      algorithm: 'Ed25519', keyId: 'fixture-reviewer-v1',
      valueBase64: sign(null, Buffer.from(stableJson(attestationPayload), 'utf8'), privateKey).toString('base64'),
    },
  };
  const attestationPath = join(privateRoot, 'attestation.json');
  const attestationBytes = await writeJson(attestationPath, attestation);
  const pointer = {
    schema: 'munjanggun.assetPrimaryReviewActivePointer.v1', version: '1.0',
    authorityStatus: 'non_authority_primary_attested_pixel_evidence_verified_secondary_pending', promotionEligible: false,
    directReviewReceipt: ref(receiptPath, receiptBytes), structuredLedger: ref(ledgerPath, ledgerBytes),
    primaryCandidate: ref(candidatePath, candidateBytes), pixelEvidenceIndex: { ...ref(evidencePath, evidenceBytes), verifiedEvidenceFileCount: records.length },
    primaryAttestation: { ...ref(attestationPath, attestationBytes), reviewerPrincipalId: 'fixture-reviewer', keyFingerprint: fingerprint },
    coverage: { assetCount: records.length, verifiedEvidenceFileCount: records.length },
    remainingAuthorityNeeds: [
      'independent_secondary_semantic_verdict_for_489_assets_bound_to_final_primary_decisions',
      'continuous_original_playback_or_all_decoded_frames_review_for_80_gifs',
    ],
  };
  const pointerPath = join(privateRoot, 'pointer.json');
  const pointerBytes = await writeJson(pointerPath, pointer);
  const config = {
    schema: 'munjanggun.assetInternalLibraryConfig.v1', version: '1.0', libraryId: 'fixture-library',
    mode: 'primary_reviewed_internal_only', activePointerPath: pointerPath, activePointerSha256: digest(pointerBytes),
    reviewerTrustPath: trustPath, reviewerTrustSha256: digest(trustBytes),
    externalPublicationPolicy: 'selected_asset_review_required', publicGitStorage: false,
  };
  const configPath = join(repoRoot, 'config.json');
  await writeJson(configPath, config);
  const storyContexts = {
    schema: 'munjanggun.productStoryContexts.v1', version: '1.0', authorityStatus: 'curated_non_authority_context',
    contexts: [{
      contextId: 'STORY-FIXTURE-3PANEL', productId: 'PROD-FIXTURE-3PANEL',
      productNames: ['3연동중문', '3연동 중문'], sourceIds: ['SRC-FIXTURE'],
      summary: '두 색상 그룹이 있는 3연동중문 fixture.',
      wholeProductRule: '전체 색상 그룹을 먼저 확인한다.', subsetRule: '일부 색상임을 밝힌다.',
      requiredOptionSetsForWholeProduct: ['color_groups'], requiredSectionsForWholeProduct: ['overview'],
      optionSets: [{
        optionSetId: 'color_groups', label: '컬러 그룹', relationship: '두 그룹 모두 상품의 일부다.',
        options: [
          { optionId: 'black', label: '블랙 그룹', aliases: ['블랙'], summary: '블랙', selectors: [{ pathPrefix: '3연동중문/', sequenceFrom: 2, sequenceTo: 2 }] },
          { optionId: 'beige', label: '베이지 그룹', aliases: ['베이지'], summary: '베이지', selectors: [{ pathPrefix: '3연동중문/', sequenceFrom: 3, sequenceTo: 3 }] },
        ],
      }],
      sections: [{ sectionId: 'overview', order: 1, label: '개요', summary: '전체 개요', selectors: [{ pathPrefix: '3연동중문/' }] }],
      writingGuardrails: ['일부를 전체처럼 쓰지 않는다.'],
    }],
  };
  return { root, repoRoot, privateRoot, outputRoot, configPath, candidatePath, originalPaths, hashes, storyContexts };
}

async function writeJson(path, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await writeFile(path, bytes);
  return bytes;
}

function ref(path, bytes) {
  return { path, sha256: digest(bytes) };
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}
