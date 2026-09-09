import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateGifSecondaryActiveCandidate } from '../scripts/lib/gif-secondary-active-candidate.mjs';
import { runValidateGifSecondaryActiveCandidate } from '../scripts/validate-gif-secondary-active-candidate.mjs';

test('active pointer validates the exact current ledger, hashes, chain, status, and totals', async () => {
  const fixture = await makeFixture();
  try {
    const result = await validateGifSecondaryActiveCandidate({ activeCandidatePath: fixture.pointerPath, includeValidatedEvidence: true });
    assert.equal(result.status, 'pass');
    assert.equal(result.authorityStatus, 'unsigned_candidate_not_authority');
    assert.equal(result.libraryStatus, 'blocked');
    assert.equal(result.ledgerSha256, fixture.currentLedgerSha256);
    assert.deepEqual(result.screeningTotals, expectedTotals());
    for (const [key, shaKey] of [['activeCandidate', 'activeCandidateSha256'], ['ledger', 'ledgerSha256'], ['verification', 'verificationSha256']]) {
      assert.ok(Buffer.isBuffer(result.validatedEvidence[key].bytes));
      assert.equal(digest(result.validatedEvidence[key].bytes), result[shaKey]);
      assert.equal(result.validatedEvidence[key].sha256, result[shaKey]);
    }
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('CLI requires the active pointer and exposes no direct ledger argument', async () => {
  const fixture = await makeFixture();
  try {
    await assert.rejects(runValidateGifSecondaryActiveCandidate([], { emit() {} }), /Missing required argument --active-candidate/u);
    await assert.rejects(runValidateGifSecondaryActiveCandidate(['--ledger', fixture.currentLedgerPath], { emit() {} }), /Unknown argument --ledger/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('rejected ledger path cannot be consumed as an active pointer', async () => {
  const fixture = await makeFixture();
  try {
    await assert.rejects(
      validateGifSecondaryActiveCandidate({ activeCandidatePath: fixture.rejectedLedgerPath }),
      /active candidate pointer schema or current status/u,
    );
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('directory input is rejected instead of being enumerated for a passing file', async () => {
  const fixture = await makeFixture();
  try {
    await assert.rejects(
      validateGifSecondaryActiveCandidate({ activeCandidatePath: fixture.root }),
      /must be an exact regular file/u,
    );
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('old pass verification cannot authorize a rejected ledger after pointer advancement', async () => {
  const fixture = await makeFixture();
  try {
    const pointer = JSON.parse(await readFile(fixture.pointerPath, 'utf8'));
    pointer.activeCandidate = { path: 'ledger-R1.json', sha256: fixture.rejectedLedgerSha256 };
    pointer.correctionChain = [
      { path: 'ledger-R1.json', sha256: fixture.rejectedLedgerSha256, status: 'unsigned_active_candidate_not_authority' },
      { path: 'ledger-R4.json', sha256: fixture.currentLedgerSha256, status: 'rejected_superseded' },
    ];
    await writeJson(fixture.pointerPath, pointer);
    await assert.rejects(
      validateGifSecondaryActiveCandidate({ activeCandidatePath: fixture.pointerPath }),
      /correction-chain status is not current|verification does not bind/u,
    );
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('ledger byte tampering and screening-total tampering are rejected', async () => {
  const fixture = await makeFixture();
  try {
    const ledger = JSON.parse(await readFile(fixture.currentLedgerPath, 'utf8'));
    ledger.entries[0].screeningSignals.price = false;
    await writeJson(fixture.currentLedgerPath, ledger);
    await assert.rejects(
      validateGifSecondaryActiveCandidate({ activeCandidatePath: fixture.pointerPath }),
      /ledger hash mismatch/u,
    );
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('a mid-directory junction cannot escape the active-candidate evidence root', async (t) => {
  const fixture = await makeFixture();
  const outside = join(tmpdir(), `mg-gif-outside-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    await mkdir(outside, { recursive: true });
    try { await symlink(outside, join(fixture.root, 'bridge'), 'junction'); }
    catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip(`junction creation unavailable: ${error.code}`); return; }
      throw error;
    }
    const pointer = JSON.parse(await readFile(fixture.pointerPath, 'utf8'));
    pointer.activeCandidate.path = 'bridge/ledger-R4.json';
    pointer.correctionChain[1].path = 'bridge/ledger-R4.json';
    await writeJson(fixture.pointerPath, pointer);
    await assert.rejects(
      validateGifSecondaryActiveCandidate({ activeCandidatePath: fixture.pointerPath }),
      /symlink or junction path component/u,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('a rejection receipt for the selected chain tail fails closed', async () => {
  const fixture = await makeFixture();
  try {
    await writeJson(join(fixture.root, 'ledger-R4.rejection.json'), {
      schema: 'munjanggun.reviewDraftRejectionReceipt.v1', version: '1.0',
      rejectedPath: fixture.currentLedgerPath, rejectedSha256: fixture.currentLedgerSha256,
      replacementPath: join(fixture.root, 'ledger-R5.json'), replacementSha256: 'f'.repeat(64),
    });
    await assert.rejects(
      validateGifSecondaryActiveCandidate({ activeCandidatePath: fixture.pointerPath }),
      /selected tail has a rejection receipt and is superseded/u,
    );
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

async function makeFixture() {
  const root = join(tmpdir(), `mg-gif-active-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  const rejectedLedgerPath = join(root, 'ledger-R1.json');
  const currentLedgerPath = join(root, 'ledger-R4.json');
  const pointerPath = join(root, 'active.json');
  const verificationPath = join(root, 'verification-R4.json');
  const rejectedLedger = ledger('rejected_superseded');
  const currentLedger = ledger('unsigned_draft_active_candidate_not_authority');
  await writeJson(rejectedLedgerPath, rejectedLedger);
  await writeJson(currentLedgerPath, currentLedger);
  const rejectedLedgerSha256 = digest(await readFile(rejectedLedgerPath));
  const currentLedgerSha256 = digest(await readFile(currentLedgerPath));
  await writeJson(join(root, 'ledger-R1.rejection.json'), {
    schema: 'munjanggun.reviewDraftRejectionReceipt.v1', version: '1.0',
    rejectedPath: rejectedLedgerPath, rejectedSha256: rejectedLedgerSha256,
    replacementPath: currentLedgerPath, replacementSha256: currentLedgerSha256,
  });
  const correctionChain = [
    { path: 'ledger-R1.json', sha256: rejectedLedgerSha256, status: 'rejected_superseded' },
    { path: 'ledger-R4.json', sha256: currentLedgerSha256, status: 'unsigned_active_candidate_not_authority' },
  ];
  const pointer = {
    schema: 'munjanggun.gifSecondaryActiveCandidate.v1', version: '1.0', status: 'unsigned_candidate_not_authority',
    activeCandidate: { path: 'ledger-R4.json', sha256: currentLedgerSha256 },
    verification: { path: 'verification-R4.json' }, correctionChain, expectedScreeningTotals: expectedTotals(),
  };
  await writeJson(pointerPath, pointer);
  const pointerSha256 = digest(await readFile(pointerPath));
  await writeJson(verificationPath, {
    schema: 'munjanggun.gifSecondaryReviewVerification.v1', version: '1.0', status: 'pass',
    activeCandidate: { path: 'active.json', sha256: pointerSha256, ledgerPath: 'ledger-R4.json', ledgerSha256: currentLedgerSha256 },
    correctionChain, coverage: { expected: 1, actual: 1, missing: 0, uniqueSourceSha256: 1 },
    receiptBinding: { failureCount: 0 }, sourceObjects: { hashOrSizeMismatchCount: 0 },
    bindings: { projectionFailureCount: 0, chronologyFailureCount: 0, semanticBindingFailureCount: 0 },
    screeningTotals: expectedTotals(), priorSemanticResultsConsulted: false,
  });
  return { root, pointerPath, rejectedLedgerPath, currentLedgerPath, rejectedLedgerSha256, currentLedgerSha256 };
}

function ledger(status) {
  return {
    schema: 'munjanggun.gifSecondarySemanticRawLedger.v1', version: '1.0', status,
    priorSemanticResultsConsulted: false,
    entries: [{
      gifProjectionIndex: 0, sourceObjectSha256: 'a'.repeat(64),
      screeningSignals: {
        price: true, eventOrPromotion: true, serviceOrAsClaim: true,
        personDepicted: true, privacyRelevant: true, absoluteOrDurabilityClaim: true,
      },
    }],
  };
}

function expectedTotals() {
  return { price: 1, eventOrPromotion: 1, serviceOrAsClaim: 1, personDepicted: 1, privacyRelevant: 1, absoluteOrDurabilityClaim: 1 };
}

async function writeJson(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
