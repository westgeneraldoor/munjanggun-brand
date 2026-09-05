import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { computeTreeHash, summarizeEntries } from '../scripts/lib/asset-inventory.mjs';
import { parseSourceState, validateSourceArguments, verifyReceiptEvidence } from '../scripts/check-asset-intake-completion.mjs';
import { validateAgainstSchema } from '../scripts/lib/schema-validation.mjs';

const hash = 'a'.repeat(64);
const entries = [{
  sourceRelativePath: '상품/001.png', byteSize: 10, sha256: hash, extension: '.png', kind: 'visual', disposition: 'managed',
}];

function makeReceipt(overrides = {}) {
  const treeHash = computeTreeHash(entries);
  return {
    entries,
    counts: summarizeEntries(entries),
    sourceTreeHash: treeHash,
    recoveryTreeHash: treeHash,
    recoveryVerification: { status: 'verified', missing: [], extra: [], sizeMismatch: [], hashMismatch: [] },
    ...overrides,
  };
}

function makeInventory(overrides = {}) {
  return { entries, counts: summarizeEntries(entries), treeHash: computeTreeHash(entries), ...overrides };
}

const assets = [{ sourceRelativePath: '상품/001.png', sha256: hash, byteSize: 10 }];

test('source_retired mode forbids a live source but requires a live recovery root', () => {
  assert.equal(parseSourceState('source_retired'), 'source_retired');
  assert.deepEqual(validateSourceArguments({ sourceState: 'source_retired', recovery: 'Z:/raw' }), {
    sourceState: 'source_retired', source: null, recovery: 'Z:/raw',
  });
  assert.throws(() => validateSourceArguments({ sourceState: 'source_retired', source: 'C:/new', recovery: 'Z:/raw' }), /must not be supplied/);
  assert.throws(() => validateSourceArguments({ sourceState: 'source_retired' }), /--recovery/);
  assert.throws(() => validateSourceArguments({ sourceState: 'active', recovery: 'Z:/raw' }), /--source/);
});

test('source_retired evidence passes from receipt plus live recovery and manifest mapping', () => {
  const result = verifyReceiptEvidence({
    receipt: makeReceipt(), sourceState: 'source_retired', sourceInventory: null, recoveryInventory: makeInventory(), assets,
  });
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.manifestReceiptMatched, true);
});

test('source_retired evidence fails closed on recovery or manifest drift', () => {
  const changedEntries = [{ ...entries[0], byteSize: 11 }];
  const result = verifyReceiptEvidence({
    receipt: makeReceipt(),
    sourceState: 'source_retired',
    sourceInventory: null,
    recoveryInventory: { entries: changedEntries, counts: summarizeEntries(changedEntries), treeHash: computeTreeHash(changedEntries) },
    assets: [{ ...assets[0], sha256: 'b'.repeat(64) }],
  });
  assert.ok(result.mismatchCount >= 2);
  assert.equal(result.manifestReceiptMatched, false);
});

test('source_retired evidence rejects a self-consistent live copy when receipt counts are forged', () => {
  const receipt = makeReceipt({ counts: { ...summarizeEntries(entries), managed: 2 } });
  const result = verifyReceiptEvidence({
    receipt, sourceState: 'source_retired', sourceInventory: null, recoveryInventory: makeInventory(), assets,
  });
  assert.match(result.errors.join('\n'), /declared counts do not match/);
});

test('completion schema can pin source retirement only with live recovery verification', async () => {
  const schema = JSON.parse(await readFile(resolve('schemas/asset-completion-gates.schema.json'), 'utf8'));
  const expected = {
    receiptManaged: 1, visualManifestPaths: 1, binaryGroups: 1, uniqueGifBinaries: 0, gifSourcePaths: 0,
    unresolvedVisualGroups: 0, urlRecords: 0, unverifiedRightsPublishable: 0, receiptMismatch: 0, visualGroups: 1,
  };
  const valid = validateAgainstSchema({
    schema: 'munjanggun.assetCompletionGates.v2', version: '2.0', intakeId: 'INTAKE-20260904-01',
    sourceEvidence: { sourceState: 'source_retired', recoveryLiveVerificationRequired: true }, expected,
  }, schema);
  assert.equal(valid.valid, true);
  const invalid = validateAgainstSchema({
    schema: 'munjanggun.assetCompletionGates.v2', version: '2.0', intakeId: 'INTAKE-20260904-01',
    sourceEvidence: { sourceState: 'source_retired', recoveryLiveVerificationRequired: false }, expected,
  }, schema);
  assert.equal(invalid.valid, false);
});
