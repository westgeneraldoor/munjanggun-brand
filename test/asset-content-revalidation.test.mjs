import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildVerifiedContentAuthority } from '../scripts/lib/asset-content-revalidation.mjs';
import { assertCatalogContentUsable } from '../scripts/lib/asset-content-quality.mjs';

test('builder seals a per-object original review and verified quality authority replays it', async () => {
  const fixture = await makeFixture({ visibleText: ['제품 가격 600,000원'], claimSignals: ['price_or_discount_claim'] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const policy = qualityPolicy(result);
  const authority = await assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy,
    trustedRoots: [fixture.root],
  });
  assert.equal(authority.overlay.entryCount, 1);
  assert.equal(authority.receipt.verifiedCount, 1);
  assert.equal(authority.overlay.entries[0].semanticSummary, '한 가지 제품 디자인과 가격을 안내하는 정지 이미지');
});

test('builder rejects visible price text without a price claim signal', async () => {
  const fixture = await makeFixture({ visibleText: ['₩ 600'], claimSignals: [] });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /requires a price claim signal/u);
});

test('builder rejects a product name that conflicts with the source product profile', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const profile = JSON.parse(await readFile(fixture.options.profilePath, 'utf8'));
  profile.products.push({ folder: '다른상품', productId: 'PROD-OTHER', label: '원슬라이딩중문', slug: 'other', sourceId: 'SRC-OTHER', exclusiveAliases: ['원슬라이딩중문'], requiredAliases: ['원슬라이딩중문'] });
  await writeFile(fixture.options.profilePath, bytes(profile));
  const review = JSON.parse(await readFile(fixture.options.reviewFiles[0], 'utf8'));
  review.entries[0].observedSummary = '원슬라이딩중문 제품 이미지';
  review.entries[0].searchTags.productTypes = ['원슬라이딩중문'];
  await writeFile(fixture.options.reviewFiles[0], bytes(review));
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /product identity conflicts with source/u);
});

test('builder rejects a nonempty product tag that omits its single-source product identity', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const review = JSON.parse(await readFile(fixture.options.reviewFiles[0], 'utf8'));
  review.entries[0].observedSummary = '가격을 안내하는 상세 이미지';
  review.entries[0].searchTags.productTypes = ['일반 중문'];
  await writeFile(fixture.options.reviewFiles[0], bytes(review));
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /omits its single-source product identity/u);
});

test('builder rejects a source product named in the summary but omitted from productTypes', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const review = JSON.parse(await readFile(fixture.options.reviewFiles[0], 'utf8'));
  review.entries[0].searchTags.productTypes = [];
  await writeFile(fixture.options.reviewFiles[0], bytes(review));
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /names a source product but omits its productTypes tag/u);
});

test('builder does not accept a generic shared token as a detailed product identity', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const profile = JSON.parse(await readFile(fixture.options.profilePath, 'utf8'));
  profile.products[0].label = 'ABS도어 방문교체';
  profile.products[0].requiredAliases = ['ABS도어 방문교체', '방문교체'];
  await writeFile(fixture.options.profilePath, bytes(profile));
  const review = JSON.parse(await readFile(fixture.options.reviewFiles[0], 'utf8'));
  review.entries[0].observedSummary = 'ABS도어 제품 이미지';
  review.entries[0].searchTags.productTypes = ['ABS도어'];
  await writeFile(fixture.options.reviewFiles[0], bytes(review));
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /omits its single-source product identity/u);
});

test('builder accepts a generic family tag only with profile support and an explicit visual reason', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const profile = JSON.parse(await readFile(fixture.options.profilePath, 'utf8'));
  profile.products[0].label = 'ABS도어 방문교체';
  profile.products[0].requiredAliases = ['ABS도어 방문교체', '방문교체'];
  profile.products[0].genericAliases = ['ABS도어'];
  await writeFile(fixture.options.profilePath, bytes(profile));
  const review = JSON.parse(await readFile(fixture.options.reviewFiles[0], 'utf8'));
  review.entries[0].observedSummary = '세부 패키지를 특정하지 않는 ABS도어 공용 색상표';
  review.entries[0].searchTags.productTypes = ['ABS도어'];
  review.entries[0].genericSourceProduct = true;
  review.entries[0].genericSourceProductReason = '원본에는 ABS도어 공용 색상만 보이고 세부 서비스명은 표시되지 않는다.';
  await writeFile(fixture.options.reviewFiles[0], bytes(review));
  const result = await buildVerifiedContentAuthority(fixture.options);
  assert.equal(result.entryCount, 1);
});

test('builder rejects cross-product declarations duplicated from catalog sourceRefs', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const review = JSON.parse(await readFile(fixture.options.reviewFiles[0], 'utf8'));
  review.entries[0].crossProductSourceIds = ['SRC-FIXTURE'];
  await writeFile(fixture.options.reviewFiles[0], bytes(review));
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /duplicates a catalog sourceRef/u);
});

test('sealed quality authority rejects review evidence changed after receipt creation', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const receipt = JSON.parse(await readFile(result.receiptPath, 'utf8'));
  await writeFile(receipt.reviewFiles[0].path, '{}\n', 'utf8');
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy: qualityPolicy(result),
    trustedRoots: [fixture.root],
  }), /Content review shard SHA-256 mismatch/u);
});

test('sealed quality authority rejects a policy bound to a different intake profile', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const policy = qualityPolicy(result);
  policy.records[0].profileSha256 = 'f'.repeat(64);
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy,
    trustedRoots: [fixture.root],
  }), /authority binding is invalid/u);
});

test('sealed quality authority rejects a changed intake profile snapshot', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const receipt = JSON.parse(await readFile(result.receiptPath, 'utf8'));
  await writeFile(receipt.profilePath, '{}\n', 'utf8');
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy: qualityPolicy(result),
    trustedRoots: [fixture.root],
  }), /Content intake profile snapshot SHA-256 mismatch/u);
});

test('sealed quality authority recomputes claim risk counts from overlay entries', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const receipt = JSON.parse(await readFile(result.receiptPath, 'utf8'));
  receipt.claimSignalAssetCount = 1;
  const receiptBytes = bytes(receipt);
  await writeFile(result.receiptPath, receiptBytes);
  const policy = qualityPolicy(result);
  policy.records[0].receiptSha256 = digest(receiptBytes);
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy,
    trustedRoots: [fixture.root],
  }), /authority binding is invalid/u);
});

async function makeFixture({ visibleText, claimSignals }) {
  const root = await mkdtemp(join(tmpdir(), 'munjanggun-content-review-'));
  const rawRoot = resolve(root, 'raw');
  const objectRoot = resolve(root, 'objects');
  const outputRoot = resolve(root, 'authority');
  const original = Buffer.from('fixture image bytes', 'utf8');
  const sha256 = digest(original);
  const sourceRelativePath = '제품/001.png';
  const originalPath = resolve(rawRoot, ...sourceRelativePath.split('/'));
  const objectRef = `sha256/${sha256.slice(0, 2)}/${sha256}.png`;
  await mkdir(resolve(originalPath, '..'), { recursive: true });
  await mkdir(resolve(objectRoot, 'sha256', sha256.slice(0, 2)), { recursive: true });
  await writeFile(originalPath, original);
  await writeFile(resolve(objectRoot, ...objectRef.split('/')), original);
  const catalog = {
    schema: 'fixture', version: '1', intakeId: 'INTAKE-20990101-01', generatedAt: '2099-01-01T00:00:00.000Z', binaryGroupCount: 1,
    entries: [{
      sha256, byteSize: original.length, objectRef, mediaType: 'image/png', contentId: 'CONTENT-FIXTURE',
      sourceRefs: [{ sourceId: 'SRC-FIXTURE', sourceRelativePath }],
    }],
  };
  const catalogBytes = bytes(catalog);
  const catalogPath = resolve(root, 'catalog.json');
  await writeFile(catalogPath, catalogBytes);
  const profilePath = resolve(root, 'profile.json');
  await writeFile(profilePath, bytes({
    schema: 'munjanggun.assetIntakeProfile.v1', version: '1.0', intakeId: catalog.intakeId,
    products: [{ folder: '제품', productId: 'PROD-FIXTURE', label: '제품', slug: 'fixture', sourceId: 'SRC-FIXTURE', exclusiveAliases: [], requiredAliases: ['제품'] }],
  }));
  const review = {
    schema: 'raw-fixture', version: '1', intakeId: catalog.intakeId, reviewId: 'static-fixture', reviewedAt: '2099-01-01T00:00:00.000Z', reviewer: 'fixture reviewer',
    entries: [{
      sha256, sourceRefs: catalog.entries[0].sourceRefs, verificationStatus: 'verified',
      observedSummary: '한 가지 제품 디자인과 가격을 안내하는 정지 이미지', contentType: 'product_guide',
      visibleTextVerified: visibleText,
      searchTags: { productTypes: ['제품'], scenes: [], colors: [], designs: ['단일 디자인'], topics: ['상품 안내'] },
      claimSignals, privacySignals: [], uncertainties: [],
      reviewEvidence: { method: 'full_resolution_original_opened', originalPath, reviewer: 'fixture reviewer', reviewedAt: '2099-01-01T00:00:00.000Z' },
    }],
  };
  const reviewPath = resolve(root, 'review.json');
  await writeFile(reviewPath, bytes(review));
  return {
    root, catalog, catalogSha256: digest(catalogBytes),
    options: { catalogPath, profilePath, objectRoot, rawRoot, reviewFiles: [reviewPath], outputRoot, generatedAt: '2099-01-02T00:00:00.000Z', repoRoot: resolve(root, 'public-repo') },
  };
}

function qualityPolicy(result) {
  return {
    schema: 'munjanggun.assetContentQualityPolicy.v1', version: '1.0', updatedAt: '2099-01-02T00:00:00.000Z',
    records: [{
      intakeId: 'INTAKE-20990101-01', catalogSha256: result.baseCatalogSha256,
      status: 'visually_verified', reason: 'fixture verified original review', verifiedAt: '2099-01-02T00:00:00.000Z',
      profileSha256: result.profileSha256,
      overlayPath: result.overlayPath, overlaySha256: result.overlaySha256,
      receiptPath: result.receiptPath, receiptSha256: result.receiptSha256,
    }],
  };
}

function bytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
