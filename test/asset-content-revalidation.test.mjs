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
    options: { catalogPath, objectRoot, rawRoot, reviewFiles: [reviewPath], outputRoot, generatedAt: '2099-01-02T00:00:00.000Z', repoRoot: resolve(root, 'public-repo') },
  };
}

function qualityPolicy(result) {
  return {
    schema: 'munjanggun.assetContentQualityPolicy.v1', version: '1.0', updatedAt: '2099-01-02T00:00:00.000Z',
    records: [{
      intakeId: 'INTAKE-20990101-01', catalogSha256: result.baseCatalogSha256,
      status: 'visually_verified', reason: 'fixture verified original review', verifiedAt: '2099-01-02T00:00:00.000Z',
      overlayPath: result.overlayPath, overlaySha256: result.overlaySha256,
      receiptPath: result.receiptPath, receiptSha256: result.receiptSha256,
    }],
  };
}

function bytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
