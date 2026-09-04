import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = resolve('.');

test('check-manifests validates product manifest fixtures', async () => {
  const root = await makeFixtureRoot();
  await writeManifestFixture(root);

  const { stdout } = await execFileAsync(process.execPath, [join(repoRoot, 'scripts/check-manifests.mjs'), '--root', root]);

  assert.match(stdout, /Manifest check passed/);
  assert.match(stdout, /1 manifest/);
});

test('check-manifests excludes untrusted manifests inside 신규 intake folders', async () => {
  const root = await makeFixtureRoot();
  await writeManifestFixture(root);
  const intakeRoot = join(root, '문장군상품', '신규', '복사본');
  await mkdir(intakeRoot, { recursive: true });
  await writeFile(join(intakeRoot, 'asset-manifest.json'), '{"stale":true}');

  const { stdout } = await execFileAsync(process.execPath, [join(repoRoot, 'scripts/check-manifests.mjs'), '--root', root]);

  assert.match(stdout, /Manifest check passed/);
  assert.match(stdout, /1 manifest/);
});

test('report-asset-coverage emits JSON informational coverage', async () => {
  const root = await makeFixtureRoot();
  await writeFile(
    join(root, 'ASSET_SEMANTIC_INDEX.md'),
    [
      '| product_id | 상품 | 전체 자산 | 대표 의미 태깅 | manifest |',
      '| --- | --- | ---: | ---: | --- |',
      '| `PROD-A` | A | 10 | 2 | `a/asset-manifest.json` |',
      '| `PROD-B` | B | 5 | 1 | `b/asset-manifest.json` |',
      '',
    ].join('\n'),
  );

  const { stdout } = await execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/report-asset-coverage.mjs'),
    '--root',
    root,
    '--json',
  ]);

  assert.deepEqual(JSON.parse(stdout), {
    totalAssets: 15,
    taggedAssets: 3,
    coveragePercent: 20,
    severity: 'info',
    products: [
      { productId: 'PROD-A', productName: 'A', totalAssets: 10, taggedAssets: 2, coveragePercent: 20 },
      { productId: 'PROD-B', productName: 'B', totalAssets: 5, taggedAssets: 1, coveragePercent: 20 },
    ],
  });
});

test('validate-brand-docs aggregates manifest and registry checks', async () => {
  const root = await makeFixtureRoot();
  await writeManifestFixture(root);
  await writeFile(
    join(root, 'EVIDENCE_REGISTER.md'),
    [
      '| Claim | 상태 |',
      '| --- | --- |',
      '| 테스트 claim | `publishable` |',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(root, 'OPEN_QUESTIONS_REGISTER.md'),
    [
      '| id | 항목 | 상태 |',
      '| --- | --- | --- |',
      '| OQ-001 | 테스트 확인 | `resolved` |',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(root, 'SOURCE_REGISTRY.md'),
    [
      '| source_id | index_status | review_status |',
      '| --- | --- | --- |',
      '| `SRC-1` | `indexed` | `approved_public` |',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(root, 'ASSET_SEMANTIC_INDEX.md'),
    [
      '| product_id | 상품 | 전체 자산 | 태깅 자산 | manifest |',
      '| --- | --- | ---: | ---: | --- |',
      '| `PROD-TEST` | 테스트 | 1 | 1 | `asset-manifest.json` |',
      '',
    ].join('\n'),
  );

  const { stdout } = await execFileAsync(process.execPath, [join(repoRoot, 'scripts/validate-brand-docs.mjs'), '--root', root]);

  assert.match(stdout, /Brand docs validation passed/);
  assert.match(stdout, /0 warning/);
});

test('validate-brand-docs fails when required registry tables are missing', async () => {
  const root = await makeFixtureRoot();
  await writeManifestFixture(root);
  await writeFile(join(root, 'EVIDENCE_REGISTER.md'), '# Evidence without required table\n');
  await writeFile(join(root, 'OPEN_QUESTIONS_REGISTER.md'), '# Open questions without required table\n');
  await writeFile(join(root, 'SOURCE_REGISTRY.md'), '# Sources without required table\n');
  await writeFile(
    join(root, 'ASSET_SEMANTIC_INDEX.md'),
    [
      '| product_id | 상품 | 전체 자산 | 대표 의미 태깅 | manifest |',
      '| --- | --- | ---: | ---: | --- |',
      '| `PROD-TEST` | 테스트 | 1 | 1 | `asset-manifest.json` |',
      '',
    ].join('\n'),
  );

  await assert.rejects(
    execFileAsync(process.execPath, [join(repoRoot, 'scripts/validate-brand-docs.mjs'), '--root', root]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stdout, /required evidence table not found/);
      assert.match(error.stdout, /required open question table not found/);
      assert.match(error.stdout, /required source registry table not found/);
      return true;
    },
  );
});

async function makeFixtureRoot() {
  const root = join(tmpdir(), `mg-brand-cli-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  return root;
}

async function writeManifestFixture(root) {
  const productRoot = join(root, '문장군상품', '테스트');
  await mkdir(productRoot, { recursive: true });
  const assetBody = 'image-data';
  await writeFile(join(productRoot, '001.jpg'), assetBody);
  const manifest = {
    schema: 'munjanggun.productDetailAssets.v1',
    version: '1.0',
    generatedAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
    productId: 'PROD-TEST',
    product: '테스트',
    slug: 'test',
    sourceId: 'SRC-TEST',
    proofId: 'PROOF-TEST',
    sourceFolder: '문장군상품/테스트/',
    sourceType: 'detailpage_assets',
    sourcePolicy: 'official_reviewed',
    consumerRule: 'check_manifest_and_claim_gate',
    assetCount: 1,
    roleCounts: { root: 1 },
    collectionCounts: {},
    claimRiskCounts: { low: 1 },
    privacyStatusCounts: { official_reviewed: 1 },
    duplicateGroupCount: 0,
    assets: [
      {
        assetId: 'mg-test-001',
        productId: 'PROD-TEST',
        sourceId: 'SRC-TEST',
        proofId: 'PROOF-TEST',
        product: '테스트',
        relativePath: '문장군상품/테스트/001.jpg',
        repositoryPath: '문장군상품/테스트/001.jpg',
        fileName: '001.jpg',
        extension: '.jpg',
        sequence: 1,
        folderRole: 'root',
        collection: null,
        byteSize: Buffer.byteLength(assetBody),
        width: 100,
        height: 100,
        gifFrameCount: null,
        sha256: createHash('sha256').update(assetBody).digest('hex'),
        duplicateGroup: null,
        usageStatus: 'candidate',
        privacyStatus: 'official_reviewed',
        claimRisk: 'low',
        externalPublish: 'check_manifest_and_claim_gate',
        notes: '',
      },
    ],
  };
  await writeFile(join(productRoot, 'asset-manifest.json'), JSON.stringify(manifest, null, 2));
}
