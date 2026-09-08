import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  buildContentReviewerTrust,
  createContentReviewerKeyPair,
  signContentReviewDocument,
} from '../scripts/lib/asset-content-review-signing.mjs';
import { validateAssetContentRawReviewLedger } from '../scripts/lib/asset-content-raw-review-ledger.mjs';

const NOW = new Date('2026-09-09T00:00:00.000Z').valueOf();

test('integrity validates raw files through the static-only queue projection', async (t) => {
  const fixture = await makeFixture(t);
  const result = await validateAssetContentRawReviewLedger({
    ledgerIndexPath: fixture.ledgerPath,
    mode: 'integrity',
    now: NOW,
  });
  assert.deepEqual(result, {
    result: 'passed',
    mode: 'integrity',
    integrityStatus: 'valid_non_authority',
    pilotStatus: 'not_requested',
    authorityStatus: 'non_authority',
    libraryStatus: 'blocked',
    staticAssetCount: 2,
    primaryCapturedCount: 2,
    secondaryCapturedCount: 2,
    pairedCount: 2,
    attestedBatchCount: 0,
    adjudicatedPairCount: 0,
    promotionEligible: false,
  });
});

test('integrity rejects a queueIndex resolved against the unfiltered queue instead of the static projection', async (t) => {
  const fixture = await makeFixture(t, { wrongStaticProjection: true });
  await assert.rejects(validateAssetContentRawReviewLedger({
    ledgerIndexPath: fixture.ledgerPath,
    now: NOW,
  }), /static projection binding mismatch/u);
});

test('integrity rejects source mutation, batch hash drift, chronology reversal, and reused reviewer principals', async (t) => {
  await t.test('source mutation', async (st) => {
    const fixture = await makeFixture(st);
    await writeFile(fixture.staticPaths[0], 'changed source bytes');
    await assert.rejects(validateAssetContentRawReviewLedger({ ledgerIndexPath: fixture.ledgerPath, now: NOW }),
      /original SHA-256 or size mismatch/u);
  });

  await t.test('batch hash drift', async (st) => {
    const fixture = await makeFixture(st);
    await writeFile(fixture.primaryBatch.path, Buffer.concat([fixture.primaryBatch.bytes, Buffer.from(' ')]));
    await assert.rejects(validateAssetContentRawReviewLedger({ ledgerIndexPath: fixture.ledgerPath, now: NOW }),
      /batch .* SHA-256 mismatch/u);
  });

  await t.test('chronology reversal', async (st) => {
    const fixture = await makeFixture(st, { secondaryStartsEarly: true });
    await assert.rejects(validateAssetContentRawReviewLedger({ ledgerIndexPath: fixture.ledgerPath, now: NOW }),
      /Secondary raw review must start after primary completion/u);
  });

  await t.test('same normalized principal', async (st) => {
    const fixture = await makeFixture(st, { sameReviewer: true });
    await assert.rejects(validateAssetContentRawReviewLedger({ ledgerIndexPath: fixture.ledgerPath, now: NOW }),
      /distinct reviewer principals/u);
  });
});

test('pilot-complete explicitly rejects the unsigned integrity-only fixture', async (t) => {
  const fixture = await makeFixture(t);
  await createTrust(fixture);
  await assert.rejects(validateAssetContentRawReviewLedger({
    ledgerIndexPath: fixture.ledgerPath,
    mode: 'pilot-complete',
    now: NOW,
  }), /requires the raw review attestation directory/u);
});

test('pilot-complete verifies every exact-byte attestation and signed resolved adjudication', async (t) => {
  const fixture = await makeFixture(t);
  const signing = await createTrust(fixture);
  await createSignedPilotEvidence(fixture, signing);
  const result = await validateAssetContentRawReviewLedger({
    ledgerIndexPath: fixture.ledgerPath,
    mode: 'pilot-complete',
    now: NOW,
  });
  assert.equal(result.integrityStatus, 'valid_non_authority');
  assert.equal(result.pilotStatus, 'complete_non_authority');
  assert.equal(result.attestedBatchCount, 2);
  assert.equal(result.adjudicatedPairCount, 2);
  assert.equal(result.libraryStatus, 'blocked');
  assert.equal(result.promotionEligible, false);
});

test('pilot-complete rejects a missing adjudication without changing integrity status', async (t) => {
  const fixture = await makeFixture(t);
  const signing = await createTrust(fixture);
  await createSignedPilotEvidence(fixture, signing, { adjudicationCount: 1 });
  await assert.rejects(validateAssetContentRawReviewLedger({
    ledgerIndexPath: fixture.ledgerPath,
    mode: 'pilot-complete',
    now: NOW,
  }), /requires a signed resolved adjudication for queueIndex 1/u);

  const integrity = await validateAssetContentRawReviewLedger({ ledgerIndexPath: fixture.ledgerPath, now: NOW });
  assert.equal(integrity.result, 'passed');
  assert.equal(integrity.libraryStatus, 'blocked');
});

test('pilot-complete rejects a signed adjudication changed after signing', async (t) => {
  const fixture = await makeFixture(t);
  const signing = await createTrust(fixture);
  await createSignedPilotEvidence(fixture, signing);
  const path = resolve(fixture.ledgerRoot, 'adjudications', 'adjudication-0.json');
  const changed = JSON.parse(await readFile(path, 'utf8'));
  changed.decisions[0].rationale = '서명 뒤에 바뀐 판정 사유';
  await writeFile(path, `${JSON.stringify(changed, null, 2)}\n`);
  await assert.rejects(validateAssetContentRawReviewLedger({
    ledgerIndexPath: fixture.ledgerPath,
    mode: 'pilot-complete',
    now: NOW,
  }), /reviewer signature is invalid/u);
});

test('pilot-complete rejects a freshly re-signed canonical value that contradicts its decision', async (t) => {
  const fixture = await makeFixture(t);
  const signing = await createTrust(fixture);
  await createSignedPilotEvidence(fixture, signing);
  const signedPath = resolve(fixture.ledgerRoot, 'adjudications', 'adjudication-0.json');
  const changed = JSON.parse(await readFile(signedPath, 'utf8'));
  delete changed.signature;
  changed.canonicalObservation.textPresence = 'uncertain';
  const changedInput = resolve(fixture.privateRoot, 're-signed-contradiction.json');
  await writeJson(changedInput, changed);
  await rm(signedPath);
  await signContentReviewDocument({
    inputPath: changedInput,
    privateKeyPath: signing.adjudicator.privateKeyPath,
    keyId: signing.adjudicator.keyId,
    reviewerTrustPath: signing.trustPath,
    outputPath: signedPath,
    repoRoot: fixture.repoRoot,
  });
  await assert.rejects(validateAssetContentRawReviewLedger({
    ledgerIndexPath: fixture.ledgerPath,
    mode: 'pilot-complete',
    now: NOW,
  }), /decision does not match the canonical observation/u);
});

test('pilot-complete rejects a primary reviewer reused as the adjudicator', async (t) => {
  const fixture = await makeFixture(t, { adjudicatorPrincipal: 'reviewer alpha' });
  const signing = await createTrust(fixture, { adjudicatorUsesPrimaryKey: true });
  await createSignedPilotEvidence(fixture, signing);
  await assert.rejects(validateAssetContentRawReviewLedger({
    ledgerIndexPath: fixture.ledgerPath,
    mode: 'pilot-complete',
    now: NOW,
  }), /adjudicator must be independent/u);
});

async function makeFixture(t, {
  wrongStaticProjection = false,
  sameReviewer = false,
  secondaryStartsEarly = false,
  adjudicatorPrincipal = 'reviewer gamma',
} = {}) {
  const root = await mkdtemp(resolve(tmpdir(), 'munjanggun-raw-ledger-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repoRoot = resolve(root, 'public-repo');
  const privateRoot = resolve(root, 'private');
  const ledgerRoot = resolve(privateRoot, 'raw-review-ledger-v1');
  const sourceRoot = resolve(privateRoot, 'raw');
  await Promise.all([
    mkdir(repoRoot, { recursive: true }),
    mkdir(ledgerRoot, { recursive: true }),
    mkdir(sourceRoot, { recursive: true }),
  ]);

  const staticPaths = [resolve(sourceRoot, '000.jpg'), resolve(sourceRoot, '001.jpg')];
  const gifPath = resolve(sourceRoot, 'between.gif');
  await Promise.all([
    writeFile(staticPaths[0], 'static-zero'),
    writeFile(gifPath, 'gif-between'),
    writeFile(staticPaths[1], 'static-one'),
  ]);
  const [staticZero, gif, staticOne] = await Promise.all([
    fileFacts(staticPaths[0]), fileFacts(gifPath), fileFacts(staticPaths[1]),
  ]);
  const queue = {
    schema: 'munjanggun.assetVisualReviewQueue.v1',
    version: '1.0',
    generatedAt: '2026-09-08T00:00:00.000Z',
    status: 'review_queue_only_not_authority',
    counts: { staticCount: 2 },
    entries: [
      queueEntry(staticZero, 'image/jpeg', 'static'),
      queueEntry(gif, 'image/gif', 'gif'),
      queueEntry(staticOne, 'image/jpeg', 'static'),
    ],
  };
  queue.entrySetSha256 = digest(Buffer.from(JSON.stringify(queue.entries), 'utf8'));
  const queueFile = await writeJson(resolve(privateRoot, 'review-queue.json'), queue);

  const primaryPrincipal = 'reviewer alpha';
  const secondaryPrincipal = sameReviewer ? ' REVIEWER ALPHA ' : 'reviewer beta';
  const projectedSecond = wrongStaticProjection ? gif : staticOne;
  const primaryValue = rawBatch({
    transcriptId: 'STATIC-FRESH-PRIMARY-0000-0001',
    reviewRole: 'fresh_primary',
    reviewerPrincipalId: primaryPrincipal,
    queueFile,
    entrySetSha256: queue.entrySetSha256,
    startedAt: '2026-09-08T01:00:00.000Z',
    completedAt: '2026-09-08T01:02:00.000Z',
    entries: [rawEntry(0, staticZero, '01:00:30', '01:01:30'), rawEntry(1, projectedSecond, '01:00:40', '01:01:40')],
  });
  const secondaryValue = rawBatch({
    transcriptId: 'STATIC-FRESH-SECONDARY-0000-0001',
    reviewRole: 'fresh_secondary',
    reviewerPrincipalId: secondaryPrincipal,
    queueFile,
    entrySetSha256: queue.entrySetSha256,
    startedAt: secondaryStartsEarly ? '2026-09-08T01:01:00.000Z' : '2026-09-08T02:00:00.000Z',
    completedAt: '2026-09-08T02:02:00.000Z',
    entries: [rawEntry(0, staticZero, '02:00:30', '02:01:30'), rawEntry(1, projectedSecond, '02:00:40', '02:01:40')],
  });
  const primaryBatch = await writeJson(resolve(ledgerRoot, 'PRIMARY.raw.json'), primaryValue);
  const secondaryBatch = await writeJson(resolve(ledgerRoot, 'SECONDARY.raw.json'), secondaryValue);

  const pairIndex = {
    schema: 'munjanggun.assetContentReviewPairIndex.v1',
    version: '1.0',
    createdAt: '2026-09-08T03:00:00.000Z',
    authorityStatus: 'non_authority',
    comparisonStatus: 'pending',
    pairs: [0, 1].map((queueIndex) => ({
      queueIndex,
      sha256: queueIndex === 0 ? staticZero.sha256 : projectedSecond.sha256,
      primaryTranscriptSha256: primaryBatch.sha256,
      primaryReviewer: primaryPrincipal,
      secondaryTranscriptSha256: secondaryBatch.sha256,
      secondaryReviewer: secondaryPrincipal,
      status: 'paired_pending_comparison',
    })),
  };
  const pairFile = await writeJson(resolve(ledgerRoot, 'PAIRS.json'), pairIndex);
  const ledger = {
    schema: 'munjanggun.assetContentRawReviewLedgerIndex.v1',
    version: '1.0',
    createdAt: '2026-09-08T00:30:00.000Z',
    authorityStatus: 'non_authority',
    libraryStatus: 'blocked',
    queueRef: queueFile.path,
    queueSha256: queueFile.sha256,
    entrySetSha256: queue.entrySetSha256,
    staticAssetCount: 2,
    freshReview: {
      primaryCapturedCount: 2,
      secondaryCapturedCount: 2,
      pairedCount: 2,
      adjudicatedCount: 2,
      batches: [
        batchPointer(primaryBatch, primaryValue),
        batchPointer(secondaryBatch, secondaryValue),
      ],
      pairIndex: {
        path: 'PAIRS.json',
        sha256: pairFile.sha256,
        byteSize: pairFile.size,
        comparisonStatus: 'pending',
      },
    },
  };
  const ledgerFile = await writeJson(resolve(ledgerRoot, 'LEDGER_INDEX.json'), ledger);
  return {
    root,
    repoRoot,
    privateRoot,
    ledgerRoot,
    ledgerPath: ledgerFile.path,
    queueFile,
    queue,
    pairFile,
    pairIndex,
    primaryBatch,
    secondaryBatch,
    staticPaths,
    staticFacts: [staticZero, staticOne],
    principals: { primary: primaryPrincipal, secondary: secondaryPrincipal, adjudicator: adjudicatorPrincipal },
  };
}

async function createTrust(fixture, { adjudicatorUsesPrimaryKey = false } = {}) {
  const primary = await createContentReviewerKeyPair({
    outputDir: resolve(fixture.privateRoot, 'keys-primary'),
    principalId: fixture.principals.primary,
    keyId: 'reviewer-alpha',
    repoRoot: fixture.repoRoot,
    createdAt: '2026-09-08T00:00:00.000Z',
  });
  const secondary = await createContentReviewerKeyPair({
    outputDir: resolve(fixture.privateRoot, 'keys-secondary'),
    principalId: fixture.principals.secondary,
    keyId: 'reviewer-beta',
    repoRoot: fixture.repoRoot,
    createdAt: '2026-09-08T00:00:00.000Z',
  });
  const adjudicator = adjudicatorUsesPrimaryKey ? primary : await createContentReviewerKeyPair({
    outputDir: resolve(fixture.privateRoot, 'keys-adjudicator'),
    principalId: fixture.principals.adjudicator,
    keyId: 'reviewer-gamma',
    repoRoot: fixture.repoRoot,
    createdAt: '2026-09-08T00:00:00.000Z',
  });
  const trustPath = resolve(fixture.privateRoot, 'reviewer-trust.json');
  await buildContentReviewerTrust({
    entryPaths: adjudicatorUsesPrimaryKey
      ? [primary.metadataPath, secondary.metadataPath]
      : [primary.metadataPath, secondary.metadataPath, adjudicator.metadataPath],
    outputPath: trustPath,
    repoRoot: fixture.repoRoot,
  });
  return { primary, secondary, adjudicator, trustPath };
}

async function createSignedPilotEvidence(fixture, signing, { adjudicationCount = 2 } = {}) {
  const unsignedRoot = resolve(fixture.privateRoot, 'unsigned');
  const attestationRoot = resolve(fixture.ledgerRoot, 'attestations');
  const adjudicationRoot = resolve(fixture.ledgerRoot, 'adjudications');
  await Promise.all([
    mkdir(unsignedRoot, { recursive: true }),
    mkdir(attestationRoot, { recursive: true }),
    mkdir(adjudicationRoot, { recursive: true }),
  ]);

  const batches = [
    [fixture.primaryBatch, fixture.principals.primary, signing.primary, 'reviewer-alpha'],
    [fixture.secondaryBatch, fixture.principals.secondary, signing.secondary, 'reviewer-beta'],
  ];
  for (const [batch, principal, key, keyId] of batches) {
    const value = batch.value;
    const unsignedPath = resolve(unsignedRoot, `${value.transcriptId}.attestation.json`);
    await writeJson(unsignedPath, {
      schema: 'munjanggun.assetContentReviewRawBatchAttestation.v1',
      version: '1.0',
      authorityStatus: 'non_authority',
      attestationStatus: 'reviewer_attested_exact_bytes',
      rawTranscriptPath: batch.path,
      rawTranscriptSha256: batch.sha256,
      rawTranscriptByteSize: batch.size,
      transcriptId: value.transcriptId,
      reviewRole: value.reviewRole,
      reviewerPrincipalId: principal,
      queueRef: fixture.queueFile.path,
      queueSha256: fixture.queueFile.sha256,
      entrySetSha256: fixture.queue.entrySetSha256,
      queueIndices: value.entries.map((entry) => entry.queueIndex),
      attestedAt: '2026-09-08T04:00:00.000Z',
    });
    await signContentReviewDocument({
      inputPath: unsignedPath,
      privateKeyPath: key.privateKeyPath,
      keyId,
      reviewerTrustPath: signing.trustPath,
      outputPath: resolve(attestationRoot, `${value.transcriptId}.attestation.json`),
      repoRoot: fixture.repoRoot,
    });
  }

  for (let queueIndex = 0; queueIndex < adjudicationCount; queueIndex += 1) {
    const pair = fixture.pairIndex.pairs[queueIndex];
    const source = fixture.staticFacts[queueIndex];
    const unsignedPath = resolve(unsignedRoot, `adjudication-${queueIndex}.json`);
    await writeJson(unsignedPath, adjudicationValue(fixture, pair, source, queueIndex));
    await signContentReviewDocument({
      inputPath: unsignedPath,
      privateKeyPath: signing.adjudicator.privateKeyPath,
      keyId: signing.adjudicator.keyId,
      reviewerTrustPath: signing.trustPath,
      outputPath: resolve(adjudicationRoot, `adjudication-${queueIndex}.json`),
      repoRoot: fixture.repoRoot,
    });
  }
}

function adjudicationValue(fixture, pair, source, queueIndex) {
  return {
    schema: 'munjanggun.assetContentReviewAdjudication.v1',
    version: '1.0',
    authorityStatus: 'non_authority',
    adjudicationId: `ADJ-${queueIndex}`,
    pairIndexRef: fixture.pairFile.path,
    pairIndexSha256: fixture.pairFile.sha256,
    queueRef: fixture.queueFile.path,
    queueSha256: fixture.queueFile.sha256,
    entrySetSha256: fixture.queue.entrySetSha256,
    queueIndex,
    sourceObjectSha256: pair.sha256,
    primaryTranscriptSha256: fixture.primaryBatch.sha256,
    secondaryTranscriptSha256: fixture.secondaryBatch.sha256,
    amendsTranscriptSha256: [fixture.primaryBatch.sha256, fixture.secondaryBatch.sha256],
    result: 'resolved',
    decisions: [{
      field: '/textPresence',
      classification: 'status_alias_equivalent',
      resolution: 'new_original_observation',
      primaryValue: 'none',
      secondaryValue: 'none',
      adjudicatedValue: 'none_observed',
      rationale: '독립 원문 비교 결과 동일한 무문자 관찰로 판정',
      evidenceRefs: [{ path: source.path, sha256: source.sha256 }],
    }],
    unresolvedUncertainties: [],
    canonicalObservation: {
      observationMethod: 'view_image_original',
      openResult: 'opened_successfully',
      rawObservationText: '원본에서 제품 이미지가 보이고 문구는 보이지 않는다.',
      observedSummary: '문구가 없는 제품 이미지',
      contentType: 'interior_product_visual',
      textPresence: 'none_observed',
      visibleText: [],
      visibleTextLocations: [],
      practicalUses: ['비공개 비교 검토'],
      signals: noSignals(),
      privacySignals: [],
    },
    adjudicatorPrincipalId: fixture.principals.adjudicator,
    adjudicatedAt: '2026-09-08T05:00:00.000Z',
  };
}

function rawBatch({
  transcriptId, reviewRole, reviewerPrincipalId, queueFile, entrySetSha256,
  startedAt, completedAt, entries,
}) {
  return {
    schema: 'munjanggun.assetContentReviewRawBatch.v1',
    version: '1.0',
    transcriptId,
    reviewRole,
    reviewerPrincipalId,
    queueRef: queueFile.path,
    queueSha256: queueFile.sha256,
    entrySetSha256,
    priorSemanticResultsConsulted: false,
    startedAt,
    completedAt,
    captureStatus: 'complete',
    entries,
  };
}

function rawEntry(queueIndex, source, openedTime, observedTime) {
  return {
    queueIndex,
    sha256: source.sha256,
    primaryOriginalPath: source.path,
    openedAt: `2026-09-08T${openedTime}.000Z`,
    observedAt: `2026-09-08T${observedTime}.000Z`,
    observationMethod: 'view_image_original',
    openResult: 'opened',
    rawObservationText: '제품 이미지가 보이고 문구는 보이지 않는다.',
    observedSummary: '문구가 없는 제품 이미지',
    contentType: 'interior_product_visual',
    textPresence: 'none',
    visibleText: [],
    visibleTextLocations: [],
    practicalUses: ['비공개 비교 검토'],
    signals: noSignals(),
    privacySignals: [],
    uncertainties: ['제품 세부 사양은 이미지에서 확정할 수 없음'],
  };
}

function noSignals() {
  return {
    price: 'none_observed', event: 'none_observed', afterService: 'none_observed', spec: 'none_observed',
    review: 'none_observed', schedule: 'none_observed', people: 'none_observed', privacy: 'none_observed',
  };
}

function queueEntry(source, mediaType, reviewMediaKind) {
  return {
    sha256: source.sha256,
    mediaType,
    byteSize: source.size,
    reviewMediaKind,
    primaryOriginalPath: source.path,
  };
}

function batchPointer(batch, value) {
  return {
    transcriptId: value.transcriptId,
    reviewRole: value.reviewRole,
    reviewerPrincipalId: value.reviewerPrincipalId,
    path: batch.path.split(/[\\/]/u).at(-1),
    sha256: batch.sha256,
    byteSize: batch.size,
    entryCount: value.entries.length,
    sourceHashMismatchCount: 0,
    captureStatus: 'captured_exact',
    cryptographicStatus: 'unsigned_hash_bound',
    semanticStatus: value.reviewRole === 'fresh_primary'
      ? 'observation_only_unadjudicated'
      : 'paired_pending_comparison',
  };
}

async function fileFacts(path) {
  const bytes = await readFile(path);
  return { path, bytes, size: bytes.length, sha256: digest(bytes) };
}

async function writeJson(path, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await writeFile(path, bytes, { flag: 'wx' });
  return { path, value, bytes, size: bytes.length, sha256: digest(bytes) };
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}
