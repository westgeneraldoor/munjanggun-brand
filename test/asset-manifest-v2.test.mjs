import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { readAndValidateManifestV2 } from '../scripts/lib/asset-manifest-v2.mjs';
import { resolveAssetObject, verifyManifestObjects } from '../scripts/lib/asset-resolver.mjs';
import { runAssetExtract } from '../scripts/assets-extract.mjs';
import { runAssetsMaterialize } from '../scripts/assets-materialize.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = resolve('.');

test('manifest v2 validates array counts and fail-closed review defaults', async () => {
  const fixture = await makeFixture();
  const { manifest, findings } = await readAndValidateManifestV2(fixture.manifestPath);

  assert.deepEqual(findings, []);
  const resolved = await resolveAssetObject(fixture.objectRoot, manifest.assets[0]);
  assert.equal(resolved, fixture.objectPath);
  const verified = await verifyManifestObjects(manifest, fixture.objectRoot);
  assert.deepEqual(verified, { verified: 1, referenced: 1, errors: [] });
});

test('manifest v2 rejects unsafe publication state and inconsistent identifiers', async () => {
  const fixture = await makeFixture();
  const manifest = JSON.parse(await readFile(fixture.manifestPath, 'utf8'));
  manifest.assets[0].objectId = `sha256:${'f'.repeat(64)}`;
  manifest.assets[0].rightsStatus = 'not_reviewed';
  manifest.assets[0].humanReviewStatus = 'not_reviewed';
  manifest.assets[0].publishStatus = 'eligible';
  manifest.assets[0].publicRepoEligibility = 'eligible';
  manifest.publishStatusCounts = [{ key: 'eligible', count: 1 }];
  await writeFile(fixture.manifestPath, JSON.stringify(manifest, null, 2));

  const { findings } = await readAndValidateManifestV2(fixture.manifestPath);
  assert(findings.some((finding) => finding.message.includes('objectId does not match')));
  assert(findings.some((finding) => finding.message.includes('while rightsStatus is not_reviewed')));
  assert(findings.some((finding) => finding.message.includes('before human review')));
  assert(findings.some((finding) => finding.message.includes('publicRepoEligibility eligible requires')));
});

test('object resolver rejects hash mismatch', async () => {
  const fixture = await makeFixture();
  const { manifest } = await readAndValidateManifestV2(fixture.manifestPath);
  await writeFile(fixture.objectPath, 'tampered');

  await assert.rejects(resolveAssetObject(fixture.objectRoot, manifest.assets[0]), /byteSize mismatch|sha256 mismatch/);
});

test('resolver, extract, verify, and materialize CLIs preserve compatibility paths', async () => {
  const fixture = await makeFixture();
  const extracted = join(fixture.root, 'output', 'picked.jpg');
  const materialized = join(fixture.root, 'materialized');
  const common = ['--manifest', fixture.manifestPath, '--object-root', fixture.objectRoot];

  const resolved = await execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-resolve.mjs'),
    ...common,
    '--asset-id', 'ASSET-TEST-001',
    '--json',
  ]);
  assert.equal(JSON.parse(resolved.stdout).objectPath, fixture.objectPath);

  const recovery = [
    '--purpose', 'internal-recovery', '--destination-class', 'private-recovery',
    '--approved-private-root', fixture.root, '--recovery-ref', 'RECOVERY-TEST-001',
    '--requested-by', 'test-operator', '--reason', '비공개 복원 회귀 테스트를 위한 명시적 요청입니다.',
    '--acknowledge-no-publication',
  ];
  await assert.rejects(execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-extract.mjs'),
    ...common,
    '--asset-id', 'ASSET-TEST-001',
    '--output', extracted,
  ]), /internal-recovery only/);
  await assert.rejects(readFile(extracted), { code: 'ENOENT' });
  await runAssetExtract([...common, ...recovery, '--asset-id', 'ASSET-TEST-001', '--output', extracted], testDependencies(fixture));
  assert.equal(await readFile(extracted, 'utf8'), 'image-data');
  const extractReceipt = JSON.parse(await readFile(`${extracted}.receipt.json`, 'utf8'));
  assert.equal(extractReceipt.assets[0].publishStatus, undefined);
  assert.equal(extractReceipt.assets[0].observed.publishStatus, 'blocked');
  assert.equal(extractReceipt.noPublicationAcknowledged, true);

  const verified = await execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-verify-objects.mjs'),
    ...common,
  ]);
  assert.match(verified.stdout, /1 unique objects for 1 logical paths/);

  await assert.rejects(execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-materialize.mjs'),
    ...common, '--output-root', materialized,
  ]), /internal-recovery only/);
  await runAssetsMaterialize([...common, ...recovery, '--output-root', materialized], testDependencies(fixture));
  assert.equal(await readFile(join(materialized, '문장군상품', '테스트', '001.jpg'), 'utf8'), 'image-data');
  const materializeReceipt = JSON.parse(await readFile(join(materialized, '_asset-recovery-receipt.json'), 'utf8'));
  assert.equal(materializeReceipt.assetCount, 1);
  assert.equal(materializeReceipt.assets[0].observed.rightsStatus, 'not_reviewed');
});

test('compatibility copy tools reject external use and private-root escape', async () => {
  const fixture = await makeFixture();
  const common = ['--manifest', fixture.manifestPath, '--object-root', fixture.objectRoot];
  await assert.rejects(execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-extract.mjs'), ...common, '--asset-id', 'ASSET-TEST-001',
    '--output', join(fixture.root, 'external.jpg'), '--purpose', 'external-publication',
    '--destination-class', 'local-publication-staging',
  ]), /assets:extract-content/);
  const outside = join(tmpdir(), `mg-outside-${Date.now()}`, 'file.jpg');
  await assert.rejects(runAssetExtract([
    ...common, '--asset-id', 'ASSET-TEST-001', '--output', outside,
    '--purpose', 'internal-recovery', '--destination-class', 'private-recovery', '--approved-private-root', fixture.root,
    '--recovery-ref', 'RECOVERY-TEST-ESCAPE', '--requested-by', 'test-operator',
    '--reason', '승인된 비공개 루트를 벗어나는지 확인하는 테스트입니다.', '--acknowledge-no-publication',
  ], testDependencies(fixture)), /must stay under/);
});

test('production recovery CLI ignores environment and argument trust-root overrides', async () => {
  const fixture = await makeFixture();
  const output = join(fixture.root, 'spoofed', 'asset.jpg');
  const base = [
    '--manifest', fixture.manifestPath, '--object-root', fixture.objectRoot,
    '--asset-id', 'ASSET-TEST-001', '--output', output,
    '--purpose', 'internal-recovery', '--destination-class', 'private-recovery',
    '--approved-private-root', fixture.root, '--recovery-ref', 'RECOVERY-TEST-SPOOF',
    '--requested-by', 'test-operator', '--reason', '임의 신뢰 루트 주입을 차단하는 운영 CLI 테스트입니다.',
    '--acknowledge-no-publication',
  ];
  await assert.rejects(execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-extract.mjs'), ...base,
  ], { env: { ...process.env, MUNJANGGUN_TEST_PRIVATE_ROOT: fixture.root } }), /not in the trusted private-root policy/);
  await assert.rejects(execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-extract.mjs'), ...base, '--trusted-private-root', fixture.root,
  ]), /Unknown argument --trusted-private-root/);
  await assert.rejects(readFile(output), { code: 'ENOENT' });
});

test('recovery copy rejects flag-as-value and rolls back if receipt commit fails', async () => {
  const fixture = await makeFixture();
  const common = ['--manifest', fixture.manifestPath, '--object-root', fixture.objectRoot, '--asset-id', 'ASSET-TEST-001'];
  const output = join(fixture.root, 'rollback', 'asset.jpg');
  await assert.rejects(execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-extract.mjs'), ...common, '--output', output,
    '--purpose', 'internal-recovery', '--destination-class', 'private-recovery', '--approved-private-root', fixture.root,
    '--recovery-ref', 'RECOVERY-TEST-STRICT', '--requested-by', 'test-operator', '--reason', '--acknowledge-no-publication',
  ]), /Missing value for --reason/);
  await mkdir(`${output}.receipt.json`, { recursive: true });
  await assert.rejects(runAssetExtract([
    ...common, '--output', output,
    '--purpose', 'internal-recovery', '--destination-class', 'private-recovery', '--approved-private-root', fixture.root,
    '--recovery-ref', 'RECOVERY-TEST-ROLLBACK', '--requested-by', 'test-operator',
    '--reason', '영수증 확정 실패 시 자산을 되돌리는 회귀 테스트입니다.', '--acknowledge-no-publication',
  ], testDependencies(fixture)));
  await assert.rejects(readFile(output), { code: 'ENOENT' });
});

async function makeFixture() {
  const root = join(tmpdir(), `mg-v2-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const objectRoot = join(root, 'objects');
  const body = 'image-data';
  const hash = createHash('sha256').update(body).digest('hex');
  const objectRef = `sha256/${hash.slice(0, 2)}/${hash}.jpg`;
  const objectPath = join(objectRoot, ...objectRef.split('/'));
  const manifestPath = join(root, 'asset-manifest.v2.json');
  await mkdir(join(objectPath, '..'), { recursive: true });
  await writeFile(objectPath, body);
  const asset = {
    assetInstanceId: 'ASSET-TEST-001',
    productId: 'PROD-TEST',
    sourceId: 'SRC-TEST-001',
    sourceRelativePath: '테스트/001.jpg',
    logicalPath: '문장군상품/테스트/001.jpg',
    sourceOrder: 1,
    objectId: `sha256:${hash}`,
    objectRef,
    sha256: hash,
    byteSize: Buffer.byteLength(body),
    originalExtension: '.jpg',
    mediaType: 'image/jpeg',
    width: 100,
    height: 100,
    frameCount: null,
    durationMs: null,
    loopCount: null,
    folderRole: 'root',
    contentId: `CONTENT-${hash.slice(0, 12)}`,
    binaryGroupId: `sha256:${hash}`,
    visualGroupId: null,
    comparisonMethod: ['sha256_exact'],
    humanReviewStatus: 'not_reviewed',
    preservationStatus: 'verified',
    privacyStatus: 'not_reviewed',
    rightsStatus: 'not_reviewed',
    rightsScope: [],
    rightsEvidenceRef: [],
    claimRisk: 'low',
    claimReviewStatus: 'not_reviewed',
    claimEvidenceRef: [],
    publishStatus: 'blocked',
    publishConditions: ['human_review_required', 'rights_review_required'],
    publicRepoEligibility: 'not_reviewed',
    publicSyncStatus: 'absent',
    publicObjectRef: null,
    notes: '',
  };
  const now = new Date().toISOString();
  const manifest = {
    schema: 'munjanggun.productDetailAssets.v2',
    version: '2.0',
    generatedAt: now,
    updatedAt: now,
    intakeId: 'INTAKE-20260904-01',
    sourceId: 'SRC-TEST-001',
    productId: 'PROD-TEST',
    product: '테스트',
    assetCount: 1,
    roleCounts: [{ key: 'root', count: 1 }],
    claimRiskCounts: [{ key: 'low', count: 1 }],
    rightsStatusCounts: [{ key: 'not_reviewed', count: 1 }],
    publishStatusCounts: [{ key: 'blocked', count: 1 }],
    assets: [asset],
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  process.once('exit', () => { try { rmSync(root, { recursive: true, force: true }); } catch {} });
  return { root, objectRoot, objectPath, manifestPath, hash, fileName: basename(objectPath) };
}

function testDependencies(fixture) {
  return { trustedPrivateRoots: [fixture.root], emit: () => {} };
}
