import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCatalogContentUsable } from '../scripts/lib/asset-content-quality.mjs';

const CATALOG_SHA = 'a'.repeat(64);

test('content quality quarantine blocks the exact intake and catalog authority', async () => {
  await assert.rejects(assertCatalogContentUsable({ intakeId: 'INTAKE-TEST', catalogSha256: CATALOG_SHA }, {
    policy: policy([{ status: 'blocked_pending_visual_revalidation' }]),
  }), /blocked pending visual revalidation/u);
});

test('unregistered catalog SHA is denied by default', async () => {
  await assert.rejects(assertCatalogContentUsable({ intakeId: 'INTAKE-TEST', catalogSha256: 'b'.repeat(64) }, {
    policy: policy([{ status: 'blocked_pending_visual_revalidation' }]),
  }), /not registered as visually verified/u);
});

test('visually verified catalog authority is usable', async () => {
  const result = await assertCatalogContentUsable({ intakeId: 'INTAKE-TEST', catalogSha256: CATALOG_SHA }, {
    policy: policy([{ status: 'visually_verified' }]),
  });
  assert.equal(result.status, 'visually_verified');
});

function policy(records) {
  return {
    schema: 'munjanggun.assetContentQualityPolicy.v1', version: '1.0', updatedAt: '2099-01-01T00:00:00.000Z',
    records: records.map((record) => ({
      intakeId: 'INTAKE-TEST', catalogSha256: CATALOG_SHA,
      reason: 'fixture visual review status', ...record,
    })),
  };
}
