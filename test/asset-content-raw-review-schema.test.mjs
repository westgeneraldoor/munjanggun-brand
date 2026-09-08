import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateAgainstSchema } from '../scripts/lib/schema-validation.mjs';

const [rawBatchSchema, attestationSchema, pairIndexSchema, adjudicationSchema] = await Promise.all([
  readSchema('asset-content-raw-review-batch.schema.json'),
  readSchema('asset-content-raw-review-attestation.schema.json'),
  readSchema('asset-content-review-pair-index.schema.json'),
  readSchema('asset-content-review-adjudication.schema.json'),
]);

const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);
const THIRD_HASH = 'c'.repeat(64);

test('raw review schema accepts the six captured batch value families', () => {
  const batches = [
    rawBatch('fresh_primary', 'fresh_static_p0', [
      rawEntry(0, 'success', 'none_observed'),
      rawEntry(1, 'success', 'observed'),
    ]),
    rawBatch('fresh_primary', 'fresh_static_p1', [
      rawEntry(4, 'opened_successfully', 'present'),
      rawEntry(5, 'opened_successfully', 'present_dense'),
    ]),
    rawBatch('fresh_primary', 'fresh_static_p2', [
      rawEntry(8, 'opened', 'none'),
      rawEntry(11, 'opened', 'uncertain'),
    ]),
    rawBatch('fresh_secondary', 'fresh_static_p2', [
      rawEntry(0, 'opened', 'none'),
      rawEntry(1, 'opened', 'present'),
    ]),
    rawBatch('fresh_secondary', 'fresh_static_p0', [
      rawEntry(4, 'success', 'observed'),
    ]),
    rawBatch('fresh_secondary', 'fresh_static_p1', [
      rawEntry(8, 'opened_successfully', 'absent'),
      rawEntry(11, 'opened_successfully', 'present_minimal'),
    ]),
  ];

  for (const batch of batches) assertValid(batch, rawBatchSchema);
});

test('raw review schema rejects signatures because raw transcript bytes remain unsigned', () => {
  const batch = rawBatch('fresh_primary', 'fresh_static_p0', [rawEntry(0, 'success', 'none_observed')]);
  batch.signature = signature();
  assertInvalid(batch, rawBatchSchema, 'additionalProperties');
});

test('raw review schema keeps text-presence invariants without requiring one location per text item', () => {
  const grouped = rawEntry(5, 'success', 'observed');
  grouped.visibleText = ['첫 줄', '둘째 줄'];
  grouped.visibleTextLocations = [{ text: '첫 줄\n둘째 줄', region: '중앙 카드', certainty: 'certain' }];
  assertValid(rawBatch('fresh_secondary', 'fresh_static_p0', [grouped]), rawBatchSchema);

  const absentWithText = rawEntry(8, 'opened', 'absent');
  absentWithText.visibleText = ['문장군'];
  assertInvalid(rawBatch('fresh_secondary', 'fresh_static_p1', [absentWithText]), rawBatchSchema, 'maxItems');

  const presentWithoutLocation = rawEntry(11, 'opened_successfully', 'present_minimal');
  presentWithoutLocation.visibleTextLocations = [];
  assertInvalid(rawBatch('fresh_secondary', 'fresh_static_p1', [presentWithoutLocation]), rawBatchSchema, 'minItems');
});

test('raw review attestation binds exact bytes, queue indices and a required signature', () => {
  const value = validAttestation();
  assertValid(value, attestationSchema);

  const unsigned = structuredClone(value);
  delete unsigned.signature;
  assertInvalid(unsigned, attestationSchema, 'required');

  const duplicateIndices = structuredClone(value);
  duplicateIndices.queueIndices = [0, 0];
  assertInvalid(duplicateIndices, attestationSchema, 'uniqueItems');
});

test('pair index schema accepts the preserved pending pair structure', () => {
  const value = {
    schema: 'munjanggun.assetContentReviewPairIndex.v1',
    version: '1.0',
    createdAt: '2026-09-08T05:30:00.000Z',
    authorityStatus: 'non_authority',
    comparisonStatus: 'pending',
    pairs: [{
      queueIndex: 5,
      sha256: HASH,
      primaryTranscriptSha256: OTHER_HASH,
      primaryReviewer: 'fresh_static_p1',
      secondaryTranscriptSha256: THIRD_HASH,
      secondaryReviewer: 'fresh_static_p0',
      status: 'paired_pending_comparison',
    }],
  };
  assertValid(value, pairIndexSchema);

  value.pairs[0].status = 'approved';
  assertInvalid(value, pairIndexSchema, 'enum');
});

test('resolved adjudication is signed, remains non-authority and carries a canonical observation', () => {
  const value = validAdjudication();
  assertValid(value, adjudicationSchema);

  const promoted = structuredClone(value);
  promoted.authorityStatus = 'candidate_eligible';
  assertInvalid(promoted, adjudicationSchema, 'const');

  const unsigned = structuredClone(value);
  delete unsigned.signature;
  assertInvalid(unsigned, adjudicationSchema, 'required');

  const unresolvedDecision = structuredClone(value);
  unresolvedDecision.decisions[0].resolution = 'unresolved';
  delete unresolvedDecision.decisions[0].adjudicatedValue;
  assertInvalid(unresolvedDecision, adjudicationSchema, 'not');
});

function rawBatch(reviewRole, reviewerPrincipalId, entries) {
  return {
    schema: 'munjanggun.assetContentReviewRawBatch.v1',
    version: '1.0',
    transcriptId: `STATIC-${reviewRole}-${entries[0].queueIndex}`,
    reviewRole,
    reviewerPrincipalId,
    queueRef: 'Z:/private/review-queue.json',
    queueSha256: HASH,
    entrySetSha256: OTHER_HASH,
    priorSemanticResultsConsulted: false,
    startedAt: '2026-09-08T05:00:00.000Z',
    completedAt: '2026-09-08T05:02:00.000Z',
    captureStatus: 'complete',
    entries,
  };
}

function rawEntry(queueIndex, openResult, textPresence) {
  const textObserved = ['observed', 'present', 'present_dense', 'present_minimal'].includes(textPresence);
  return {
    queueIndex,
    sha256: HASH,
    primaryOriginalPath: `Z:\\private\\raw\\${queueIndex}.jpg`,
    openedAt: '2026-09-08T05:00:30.000Z',
    observedAt: '2026-09-08T05:01:30.000Z',
    observationMethod: 'view_image_original',
    openResult,
    rawObservationText: '원본에서 직접 관찰한 내용',
    observedSummary: '원본 이미지 관찰 요약',
    contentType: 'interior_product_visual',
    textPresence,
    visibleText: textObserved ? ['문장군'] : [],
    visibleTextLocations: textObserved
      ? [{ text: '문장군', region: '우측 상단', certainty: 'certain' }]
      : [],
    practicalUses: ['비공개 비교 검토'],
    signals: {
      price: 'none_observed',
      event: 'none_observed',
      afterService: 'none_observed',
      spec: 'none_observed',
      review: 'none_observed',
      schedule: 'none_observed',
      people: 'none_observed',
      privacy: 'none_observed',
    },
    privacySignals: [],
    uncertainties: ['내용 정확성은 별도 비교가 필요함'],
  };
}

function validAttestation() {
  return {
    schema: 'munjanggun.assetContentReviewRawBatchAttestation.v1',
    version: '1.0',
    authorityStatus: 'non_authority',
    attestationStatus: 'reviewer_attested_exact_bytes',
    rawTranscriptPath: 'Z:/private/raw/primary-0000-0003.raw.json',
    rawTranscriptSha256: HASH,
    rawTranscriptByteSize: 8962,
    transcriptId: 'STATIC-FRESH-PRIMARY-0000-0003',
    reviewRole: 'fresh_primary',
    reviewerPrincipalId: 'fresh_static_p0',
    queueRef: 'Z:/private/review-queue.json',
    queueSha256: OTHER_HASH,
    entrySetSha256: THIRD_HASH,
    queueIndices: [0, 1, 2, 3],
    attestedAt: '2026-09-08T06:00:00.000Z',
    signature: signature(),
  };
}

function validAdjudication() {
  return {
    schema: 'munjanggun.assetContentReviewAdjudication.v1',
    version: '1.0',
    authorityStatus: 'non_authority',
    adjudicationId: 'STATIC-ADJUDICATION-0005',
    pairIndexRef: 'Z:/private/raw/STATIC-FRESH-PAIRS-0000-0011.json',
    pairIndexSha256: HASH,
    queueRef: 'Z:/private/review-queue.json',
    queueSha256: OTHER_HASH,
    entrySetSha256: THIRD_HASH,
    queueIndex: 5,
    sourceObjectSha256: HASH,
    primaryTranscriptSha256: OTHER_HASH,
    secondaryTranscriptSha256: THIRD_HASH,
    amendsTranscriptSha256: [OTHER_HASH, THIRD_HASH],
    result: 'resolved',
    decisions: [{
      field: '/visibleText/4',
      classification: 'semantic_conflict',
      resolution: 'new_original_observation',
      primaryValue: '눈을 높혀고',
      secondaryValue: '눈을 넓히고',
      adjudicatedValue: '눈을 넓히고',
      rationale: '원본을 다시 열어 확인한 교정 전사',
      evidenceRefs: [{ path: 'Z:/private/raw/5.jpg', sha256: HASH }],
    }],
    unresolvedUncertainties: [],
    canonicalObservation: {
      observationMethod: 'view_image_original',
      openResult: 'opened_successfully',
      rawObservationText: '원본을 재확인한 별도 교정 관찰',
      observedSummary: '무이자 할부 안내 이미지',
      contentType: 'installment_promotion_infographic',
      textPresence: 'observed',
      visibleText: ['눈을 넓히고'],
      visibleTextLocations: [{ text: '눈을 넓히고', region: '중앙 목록', certainty: 'certain' }],
      practicalUses: ['비공개 비교 검토'],
      signals: {
        price: 'observed',
        event: 'observed',
        afterService: 'none_observed',
        spec: 'none_observed',
        review: 'none_observed',
        schedule: 'none_observed',
        people: 'none_observed',
        privacy: 'none_observed',
      },
      privacySignals: [],
    },
    adjudicatorPrincipalId: 'fresh_static_adjudicator',
    adjudicatedAt: '2026-09-08T06:30:00.000Z',
    signature: signature(),
  };
}

function signature() {
  return {
    algorithm: 'Ed25519',
    keyId: 'reviewer-key-20260908',
    valueBase64: 'A'.repeat(86) + '==',
  };
}

function assertValid(value, schema) {
  const result = validateAgainstSchema(value, schema);
  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
}

function assertInvalid(value, schema, keyword) {
  const result = validateAgainstSchema(value, schema);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.keyword === keyword), JSON.stringify(result.errors, null, 2));
}

async function readSchema(name) {
  const url = new URL(`../schemas/${name}`, import.meta.url);
  return JSON.parse(await readFile(fileURLToPath(url), 'utf8'));
}
