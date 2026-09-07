import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIntakeAuditContract } from '../scripts/lib/asset-intake-audit-contract.mjs';

function fixture() {
  const intakeId = 'INTAKE-20260905-01';
  return {
    contract: { intakeId, profileSha256: 'a'.repeat(64), expected: { receiptEntries: 2, receiptManaged: 2, productManifests: 1, visualManifestPaths: 1, intakeBinaryGroups: 1, uniqueGifBinaries: 0, gifSourcePaths: 0, urlRecords: 1, combinedCounts: { canonicalVisualPaths: 0, intakeVisualPaths: 1, logicalVisualPaths: 1, binaryGroups: 1, sharedBinaryGroups: 0, canonicalOnlyBinaryGroups: 0, intakeOnlyBinaryGroups: 1, gifBinaryGroups: 0 }, visualGroups: 1, unjudgedVisualGroups: 0 } },
    profileSha256: 'a'.repeat(64),
    profile: { intakeId, products: [{ sourceId: 'SRC-NEW', productId: 'PROD-NEW', label: '새 상품', folder: '새상품' }] },
    receipt: { intakeId, entries: [{}, {}], counts: { managed: 2 } },
    manifests: [{ intakeId, sourceId: 'SRC-NEW', productId: 'PROD-NEW', product: '새 상품', assets: [{ sha256: 'b'.repeat(64), mediaType: 'image/png' }] }],
    catalog: { intakeId, entries: [{}] },
    combinedInventory: { intakeId, counts: { canonicalVisualPaths: 0, intakeVisualPaths: 1, logicalVisualPaths: 1, binaryGroups: 1, sharedBinaryGroups: 0, canonicalOnlyBinaryGroups: 0, intakeOnlyBinaryGroups: 1, gifBinaryGroups: 0 } },
    similarityMap: { intakeId, visualGroupCount: 1, unjudgedCount: 0 },
    urlReview: { intakeId, entries: [{}] },
  };
}

test('per-intake contract pins counts without putting them in the generic engine', () => {
  const input = fixture();
  assert.equal(validateIntakeAuditContract(input).passed, true);
  input.similarityMap.visualGroupCount = 2;
  const result = validateIntakeAuditContract(input);
  assert.equal(result.passed, false);
  assert(result.errors.some((entry) => entry.includes('visualGroups')));
});

test('per-intake contract rejects a profile hash or source-set mismatch', () => {
  const input = fixture();
  input.profileSha256 = 'c'.repeat(64);
  input.manifests[0].sourceId = 'SRC-WRONG';
  const result = validateIntakeAuditContract(input);
  assert(result.errors.includes('profile: SHA-256 mismatch'));
  assert(result.errors.includes('manifests: profile product/source coverage mismatch'));
});

test('per-intake contract rejects product identity drift under a valid sourceId', () => {
  const input = fixture();
  input.manifests[0].productId = 'PROD-WRONG';
  const result = validateIntakeAuditContract(input);
  assert(result.errors.includes('manifests: product identity mismatch for SRC-NEW'));
});
