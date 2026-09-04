import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

import {
  computeSemanticCoverage,
  parseMarkdownTable,
  parseMarkdownTables,
  validateContentReferences,
  validateRegistryStatuses,
  validateManifest,
} from '../scripts/lib/brand-validation-core.mjs';

test('validateManifest accepts a manifest with required metadata and matching file facts', async () => {
  const root = await makeTempDir();
  const assetPath = join(root, 'assets', '001.jpg');
  await mkdir(join(root, 'assets'), { recursive: true });
  await writeFile(assetPath, 'brand-image');
  const hash = sha256('brand-image');

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
    sourceFolder: 'assets/',
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
        relativePath: 'assets/001.jpg',
        repositoryPath: 'assets/001.jpg',
        fileName: '001.jpg',
        extension: '.jpg',
        sequence: 1,
        folderRole: 'root',
        collection: null,
        byteSize: 11,
        width: 100,
        height: 100,
        gifFrameCount: null,
        sha256: hash,
        duplicateGroup: null,
        usageStatus: 'candidate',
        privacyStatus: 'official_reviewed',
        claimRisk: 'low',
        externalPublish: 'check_manifest_and_claim_gate',
        notes: '',
      },
    ],
  };

  const findings = await validateManifest(manifest, { rootDir: root, manifestPath: 'asset-manifest.json' });

  assert.deepEqual(findings, []);
});

test('validateManifest flags missing required fields and stale file metadata', async () => {
  const root = await makeTempDir();
  const assetPath = join(root, 'assets', '001.jpg');
  await mkdir(join(root, 'assets'), { recursive: true });
  await writeFile(assetPath, 'actual');

  const manifest = {
    assetCount: 1,
    assets: [
      {
        assetId: 'mg-test-001',
        relativePath: 'assets/001.jpg',
        byteSize: 999,
        sha256: sha256('wrong'),
        usageStatus: 'approved',
        privacyStatus: 'official_reviewed',
        claimRisk: 'low',
      },
    ],
  };

  const findings = await validateManifest(manifest, { rootDir: root, manifestPath: 'asset-manifest.json' });

  assert(findings.some((finding) => finding.message.includes('missing required field productId')));
  assert(findings.some((finding) => finding.message.includes('missing required manifest field productId')));
  assert(findings.some((finding) => finding.message.includes('missing required field notes')));
  assert(findings.some((finding) => finding.message.includes('byteSize mismatch')));
  assert(findings.some((finding) => finding.message.includes('sha256 mismatch')));
  assert(findings.some((finding) => finding.message.includes('invalid usageStatus approved')));
});

test('validateManifest verifies aggregate count summaries', async () => {
  const root = await makeTempDir();
  const assetPath = join(root, 'assets', '001.jpg');
  await mkdir(join(root, 'assets'), { recursive: true });
  await writeFile(assetPath, 'brand-image');
  const hash = sha256('brand-image');

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
    sourceFolder: 'assets/',
    sourceType: 'detailpage_assets',
    sourcePolicy: 'official_reviewed',
    consumerRule: 'check_manifest_and_claim_gate',
    assetCount: 1,
    roleCounts: { root: 2 },
    collectionCounts: { basic: 1 },
    claimRiskCounts: { high: 1 },
    privacyStatusCounts: { not_verified: 1 },
    duplicateGroupCount: 1,
    assets: [
      {
        assetId: 'mg-test-001',
        productId: 'PROD-TEST',
        sourceId: 'SRC-TEST',
        proofId: 'PROOF-TEST',
        product: '테스트',
        relativePath: 'assets/001.jpg',
        repositoryPath: 'assets/001.jpg',
        fileName: '001.jpg',
        extension: '.jpg',
        sequence: 1,
        folderRole: 'root',
        collection: null,
        byteSize: 11,
        width: 100,
        height: 100,
        gifFrameCount: null,
        sha256: hash,
        duplicateGroup: null,
        usageStatus: 'candidate',
        privacyStatus: 'official_reviewed',
        claimRisk: 'low',
        externalPublish: 'check_manifest_and_claim_gate',
        notes: '',
      },
    ],
  };

  const findings = await validateManifest(manifest, { rootDir: root, manifestPath: 'asset-manifest.json' });

  assert(findings.some((finding) => finding.message.includes('roleCounts.root mismatch')));
  assert(findings.some((finding) => finding.message.includes('collectionCounts.basic mismatch')));
  assert(findings.some((finding) => finding.message.includes('claimRiskCounts.high mismatch')));
  assert(findings.some((finding) => finding.message.includes('privacyStatusCounts.not_verified mismatch')));
  assert(findings.some((finding) => finding.message.includes('duplicateGroupCount 1 does not match')));
});

test('computeSemanticCoverage treats semantic index coverage as an informational metric', () => {
  const coverage = computeSemanticCoverage([
    { productId: 'PROD-A', totalAssets: 10, taggedAssets: 2 },
    { productId: 'PROD-B', totalAssets: 5, taggedAssets: 1 },
  ]);

  assert.equal(coverage.totalAssets, 15);
  assert.equal(coverage.taggedAssets, 3);
  assert.equal(coverage.coveragePercent, 20);
  assert.equal(coverage.severity, 'info');
});

test('parseMarkdownTable parses standard pipe tables with Korean text', () => {
  const rows = parseMarkdownTable(`
| id | 항목 | 상태 |
| --- | --- | --- |
| OQ-001 | 최신 리뷰 수 | \`resolved\` |
| OQ-002 | 예약 리뷰 수 | \`open\` |
  `);

  assert.deepEqual(rows, [
    { id: 'OQ-001', '항목': '최신 리뷰 수', '상태': '`resolved`' },
    { id: 'OQ-002', '항목': '예약 리뷰 수', '상태': '`open`' },
  ]);
});

test('parseMarkdownTables keeps separate markdown tables independent', () => {
  const tables = parseMarkdownTables(`
| status | 뜻 |
| --- | --- |
| \`open\` | 확인 필요 |

문단입니다.

| id | 항목 | 상태 |
| --- | --- | --- |
| OQ-001 | 질문 | \`resolved\` |
  `);

  assert.equal(tables.length, 2);
  assert.deepEqual(tables[1], [{ id: 'OQ-001', '항목': '질문', '상태': '`resolved`' }]);
});

test('validateRegistryStatuses fails unknown statuses and warns unresolved open questions', () => {
  const findings = validateRegistryStatuses({
    evidenceRows: [
      { Claim: '확인된 claim', '상태': '`publishable`' },
      { Claim: '이상한 claim', '상태': '`almost_done`' },
    ],
    openQuestionRows: [
      { id: 'OQ-001', '항목': '정식 로고', '상태': '`open`' },
      { id: 'bad-id', '항목': '형식 오류', '상태': '`resolved`' },
    ],
    sourceRows: [
      { source_id: '`SRC-1`', index_status: '`indexed`', review_status: '`needs_review`' },
      { source_id: '`SRC-2`', index_status: '`current`', review_status: '`approved_public`' },
    ],
  });

  assert(findings.some((finding) => finding.severity === 'error' && finding.message.includes('unknown evidence status')));
  assert(findings.some((finding) => finding.severity === 'warning' && finding.message.includes('open question remains')));
  assert(findings.some((finding) => finding.severity === 'error' && finding.message.includes('invalid open question id')));
  assert(findings.some((finding) => finding.severity === 'warning' && finding.message.includes('not public-approved')));
  assert(findings.some((finding) => finding.severity === 'error' && finding.message.includes('unknown source index_status')));
});

test('validateRegistryStatuses fails blank source statuses', () => {
  const findings = validateRegistryStatuses({
    sourceRows: [{ source_id: '`SRC-1`', index_status: '', review_status: '' }],
  });

  assert(findings.some((finding) => finding.severity === 'error' && finding.message.includes('missing source index_status')));
  assert(findings.some((finding) => finding.severity === 'error' && finding.message.includes('missing source review_status')));
});

test('validateContentReferences warns when risky registry items appear in reusable docs', () => {
  const findings = validateContentReferences({
    evidenceRows: [{ Claim: '전체 브랜드 리뷰 수', '상태': '`needs_confirmation`' }],
    openQuestionRows: [{ id: 'OQ-003', '상태': '`open`' }],
    sourceRows: [{ source_id: '`SRC-OLD`', index_status: '`retired`', review_status: '`reviewed_candidate`' }],
    documents: [
      {
        path: 'COPY_ASSET_BANK.md',
        text: '전체 브랜드 리뷰 수와 OQ-003, SRC-OLD를 외부 카피에 그대로 적었다.',
      },
    ],
  });

  assert(findings.some((finding) => finding.message.includes('risky evidence claim reference')));
  assert(findings.some((finding) => finding.message.includes('unresolved open question reference')));
  assert(findings.some((finding) => finding.message.includes('retired or superseded source reference')));
});

async function makeTempDir() {
  const root = join(tmpdir(), `mg-brand-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  return root;
}

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}
