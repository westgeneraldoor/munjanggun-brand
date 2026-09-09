import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import {
  assertGifAdjudicationPointerChecks,
  assertGifAdjudicationReceiptChecks,
  validateGifAdjudicationActiveCandidate,
} from '../scripts/lib/gif-adjudication-active-candidate.mjs';
import { runValidateGifAdjudicationActiveCandidate } from '../scripts/validate-gif-adjudication-active-candidate.mjs';

const ACTIVE = 'Z:\\문장군_브랜드_원본보관\\VISUAL-REVIEW-2026-09-08\\gif-adjudication-p5-v1\\gif-adjudication-active-candidate-v1.json';

test('P5 active adjudication pointer validates exact signed snapshots, 80 sources, and 800 decisions', async (t) => {
  if (!await exists(ACTIVE)) { t.skip('private P5 integration evidence is unavailable'); return; }
  const result = await validateGifAdjudicationActiveCandidate({ activeCandidatePath: ACTIVE, includeValidatedEvidence: true });
  assert.equal(result.status, 'pass');
  assert.equal(result.activeCandidateSha256, '1f5cc8ed65bc125d4a3b92ea0c72f811c51b4a9e573d09bca44e59566ab4b5b7');
  assert.equal(result.pointerVerificationSha256, '119786f7ef3549e93533520b3f90c971cec0ed430766e5ad1ed9c71e1a6131af');
  assert.equal(result.pairIndexSha256, '5fa4d9228d71d43c3ad917ddba4a1d8282ee0f9f0d6f28ed1db9713e62911a5c');
  assert.equal(result.adjudicationLedgerSha256, '9a66530577de1ef825f197f0f6784e2b03c30a6c5a63d9ee15c11f74528f3d8b');
  assert.equal(result.verificationReceiptSha256, 'f68c16af58d5db0dac55b24aae089a7e0702d2b1d39a89bf029d4c7b571b0476');
  assert.equal(result.sourceCount, 80);
  assert.equal(result.fieldDecisionCount, 800);
  assert.deepEqual(result.canonicalSignalTotals, {
    price: 22, eventOrPromotion: 10, serviceOrAsClaim: 1, personDepicted: 6,
    privacyRelevant: 3, absoluteOrDurabilityClaim: 9,
    realPersonNatureObserved: 4, realPersonNatureUncertain: 2, privacyRelevantUncertain: 2,
  });
  for (const snapshot of Object.values(result.validatedEvidence)) {
    assert.ok(Buffer.isBuffer(snapshot.bytes));
    assert.equal(digest(snapshot.bytes), snapshot.sha256);
  }
});

test('P5 validator rejects old direct files, directories, tail rejection, and a junction parent', async (t) => {
  if (!await exists(ACTIVE)) { t.skip('private P5 integration evidence is unavailable'); return; }
  await assert.rejects(validateGifAdjudicationActiveCandidate({ activeCandidatePath: dirname(ACTIVE) }), /exact gif-adjudication-active-candidate-v1.json pointer/u);
  await assert.rejects(validateGifAdjudicationActiveCandidate({ activeCandidatePath: resolve(dirname(ACTIVE), 'adjudication-ledger-signed-v1.json') }), /exact gif-adjudication-active-candidate-v1.json pointer/u);

  const temp = await mkdtemp(resolve(tmpdir(), 'p5-active-regression-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const copiedPointer = resolve(temp, 'gif-adjudication-active-candidate-v1.json');
  await writeFile(copiedPointer, await readFile(ACTIVE));
  await writeFile(resolve(temp, 'gif-adjudication-active-candidate-v1.rejection.json'), '{}\n');
  await assert.rejects(validateGifAdjudicationActiveCandidate({ activeCandidatePath: copiedPointer }), /rejection receipt and is superseded/u);

  await rm(resolve(temp, 'gif-adjudication-active-candidate-v1.rejection.json'));
  const selectedBridge = resolve(temp, 'selected-bridge');
  try { await symlink(dirname(ACTIVE), selectedBridge, 'junction'); }
  catch (error) {
    if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
  }
  if (await exists(selectedBridge)) {
    const changed = JSON.parse(await readFile(ACTIVE));
    changed.selection.pairIndex.path = resolve(selectedBridge, 'PAIR-INDEX.json');
    await writeFile(copiedPointer, `${JSON.stringify(changed, null, 2)}\n`);
    await assert.rejects(validateGifAdjudicationActiveCandidate({ activeCandidatePath: copiedPointer }), /symlink or junction path component/u);
  }

  const bridge = resolve(temp, 'junction');
  try { await symlink(dirname(ACTIVE), bridge, 'junction'); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return;
    throw error;
  }
  await assert.rejects(validateGifAdjudicationActiveCandidate({ activeCandidatePath: resolve(bridge, 'gif-adjudication-active-candidate-v1.json') }), /symlink or junction path component/u);
});

test('P5 CLI accepts only the active adjudication pointer flag', async () => {
  await assert.rejects(runValidateGifAdjudicationActiveCandidate([], { emit() {} }), /Missing required argument --active-candidate/u);
  await assert.rejects(runValidateGifAdjudicationActiveCandidate(['--ledger', 'x'], { emit() {} }), /Unknown argument --ledger/u);
});

test('P5 pointer and signed receipt checks fail if any required boolean is false', async (t) => {
  if (!await exists(ACTIVE)) { t.skip('private P5 integration evidence is unavailable'); return; }
  const pointerVerification = JSON.parse(await readFile(resolve(dirname(ACTIVE), 'gif-adjudication-active-candidate-verification-v1.json')));
  const receipt = JSON.parse(await readFile(resolve(dirname(ACTIVE), 'verification-receipt-signed-v1.json')));
  assert.doesNotThrow(() => assertGifAdjudicationPointerChecks(pointerVerification.checks));
  assert.doesNotThrow(() => assertGifAdjudicationReceiptChecks(receipt.checks));
  for (const key of ['exactPairIndexHash', 'directoryEnumerationForbidden']) {
    assert.throws(() => assertGifAdjudicationPointerChecks({ ...pointerVerification.checks, [key]: false }), /not an exact pass/u);
  }
  for (const key of ['coverage80', 'exactInputBindings', 'ledgerAttestationVerified', 'technicalVsSemanticEvidenceSeparated']) {
    assert.throws(() => assertGifAdjudicationReceiptChecks({ ...receipt.checks, [key]: false }), /not an exact pass/u);
  }
});

async function exists(path) { try { await access(path); return true; } catch { return false; } }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
