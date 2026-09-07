import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
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
    loadVerifiedAuthority: async (record) => ({ record, overlay: { entries: [] }, receipt: {} }),
  });
  assert.equal(result.record.status, 'visually_verified');
});

test('visually verified status without sealed overlay and receipt is rejected', async () => {
  const value = policy([{ status: 'visually_verified' }]);
  delete value.records[0].overlaySha256;
  await assert.rejects(assertCatalogContentUsable({ intakeId: 'INTAKE-TEST', catalogSha256: CATALOG_SHA }, {
    policy: value,
  }), /missing sealed authority fields/u);
});

test('legacy visually verified authority without the evidence contract is rejected', async () => {
  const value = policy([{ status: 'visually_verified' }]);
  delete value.records[0].authorityContractVersion;
  await assert.rejects(assertCatalogContentUsable({ intakeId: 'INTAKE-TEST', catalogSha256: CATALOG_SHA }, {
    policy: value,
  }), /missing sealed authority fields/u);
});

test('older evidence contract cannot be promoted under the v3 runtime', async () => {
  const value = policy([{ status: 'visually_verified' }]);
  value.records[0].authorityContractVersion = 'content-evidence-v2';
  await assert.rejects(assertCatalogContentUsable({ intakeId: 'INTAKE-TEST', catalogSha256: CATALOG_SHA }, {
    policy: value,
  }), /missing sealed authority fields/u);
});

function policy(records) {
  return {
    schema: 'munjanggun.assetContentQualityPolicy.v1', version: '1.0', updatedAt: '2026-09-07T06:00:00.000Z',
    records: records.map((record) => ({
      intakeId: 'INTAKE-TEST', catalogSha256: CATALOG_SHA,
      reason: 'fixture visual review status', ...record,
      ...(record.status === 'visually_verified' ? {
        overlayPath: resolve('fixture-private', 'content-overlay.json'), overlaySha256: 'c'.repeat(64),
        receiptPath: resolve('fixture-private', 'receipt.json'), receiptSha256: 'd'.repeat(64),
        profileSha256: 'e'.repeat(64), reviewerTrustSha256: 'f'.repeat(64),
        authorityContractVersion: 'content-evidence-v3',
        verifiedAt: '2026-09-07T06:00:00.000Z',
      } : {}),
    })),
  };
}
