import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadIntakeProfile } from '../scripts/lib/asset-intake-profile.mjs';

function fixture() {
  return {
    schema: 'munjanggun.assetIntakeProfile.v1',
    version: '1.0',
    intakeId: 'INTAKE-20260905-01',
    sourceDate: '2026-09-05',
    logicalRoot: '문장군상품',
    canonicalExcludeFolders: ['신규'],
    products: [
      { folder: '새상품', productId: 'PROD-NEW', label: '새 상품', slug: 'new', sourceId: 'SRC-2026-09-05-NEW' },
    ],
    review: {
      catalogReports: [{ id: 'static', file: 'static.json', kind: 'static', comparisonMethods: [] }],
      catalogAuditReport: { id: 'audit', file: 'audit.json' },
      similarityReports: [{ id: 'similarity', file: 'similarity.json' }],
      additionalReports: [],
      supportingCollections: [],
    },
  };
}

async function writeProfile(value) {
  const root = join(tmpdir(), `mg-profile-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  const path = join(root, 'profile.json');
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

test('intake profile accepts a future product set without source-code changes', async () => {
  const path = await writeProfile(fixture());
  const { profile, productByFolder } = await loadIntakeProfile(path, 'INTAKE-20260905-01');
  assert.equal(profile.products.length, 1);
  assert.equal(productByFolder.get('새상품').productId, 'PROD-NEW');
});

test('intake profile rejects intake mismatch and duplicate identity fields', async () => {
  const mismatch = await writeProfile(fixture());
  await assert.rejects(loadIntakeProfile(mismatch, 'INTAKE-20260906-01'), /does not match/);

  const duplicate = fixture();
  duplicate.products.push({
    folder: '다른상품', productId: 'PROD-OTHER', label: '다른 상품', slug: 'new', sourceId: 'SRC-2026-09-05-OTHER',
  });
  await assert.rejects(loadIntakeProfile(await writeProfile(duplicate)), /Duplicate intake profile slug/);
});

test('intake profile rejects traversal in configured paths', async () => {
  const value = fixture();
  value.logicalRoot = '../outside';
  await assert.rejects(loadIntakeProfile(await writeProfile(value)), /schema failed/);
});

test('intake profile requires comparison methods for every catalog review shard', async () => {
  const value = fixture();
  delete value.review.catalogReports[0].comparisonMethods;
  await assert.rejects(loadIntakeProfile(await writeProfile(value)), /schema failed/);
});
