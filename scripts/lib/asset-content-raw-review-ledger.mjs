import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import {
  normalizeReviewerPrincipal,
  parseContentReviewerTrust,
  verifyTrustedContentReviewerSignature,
} from './asset-content-reviewer-trust.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './schema-validation.mjs';

const SHA256 = /^[a-f0-9]{64}$/u;
const MODES = new Set(['integrity', 'pilot-complete']);
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const CANONICAL_DECISION_POINTERS = Object.freeze([
  '/observationMethod',
  '/openResult',
  '/rawObservationText',
  '/observedSummary',
  '/contentType',
  '/textPresence',
  '/visibleText',
  '/visibleTextLocations',
  '/practicalUses',
  '/signals/price',
  '/signals/event',
  '/signals/afterService',
  '/signals/spec',
  '/signals/review',
  '/signals/schedule',
  '/signals/people',
  '/signals/privacy',
  '/privacySignals',
]);
const CANONICAL_DECISION_POINTER_SET = new Set(CANONICAL_DECISION_POINTERS);

const schemaPaths = {
  rawBatch: fileURLToPath(new URL('../../schemas/asset-content-raw-review-batch.schema.json', import.meta.url)),
  attestation: fileURLToPath(new URL('../../schemas/asset-content-raw-review-attestation.schema.json', import.meta.url)),
  pairIndex: fileURLToPath(new URL('../../schemas/asset-content-review-pair-index.schema.json', import.meta.url)),
  adjudication: fileURLToPath(new URL('../../schemas/asset-content-review-adjudication.schema.json', import.meta.url)),
};

let schemasPromise;

export async function validateAssetContentRawReviewLedger({
  ledgerIndexPath,
  mode = 'integrity',
  reviewerTrustPath = null,
  attestationRoot = null,
  adjudicationRoot = null,
  now = Date.now(),
} = {}) {
  if (!MODES.has(mode)) throw new Error(`Raw review validation mode is invalid: ${mode}`);
  const context = await validateIntegrity({ ledgerIndexPath, now });
  if (mode === 'integrity') return summary(context, mode, 0, 0);

  const ledgerRoot = dirname(context.ledger.path);
  const trustPath = resolve(reviewerTrustPath ?? resolve(ledgerRoot, '..', 'reviewer-trust.json'));
  const attestationsPath = resolve(attestationRoot ?? resolve(ledgerRoot, 'attestations'));
  const adjudicationsPath = resolve(adjudicationRoot ?? resolve(ledgerRoot, 'adjudications'));
  const trustFile = await readJsonDocument(trustPath, 'Reviewer trust');
  const reviewerTrust = parseContentReviewerTrust(trustFile.bytes);
  const attestations = await validateAttestations(context, reviewerTrust, attestationsPath, now);
  const adjudications = await validateAdjudications(context, reviewerTrust, attestations, adjudicationsPath, now);
  if (context.ledger.value.freshReview.adjudicatedCount !== adjudications.size) {
    throw new Error('Raw review adjudicated-count binding mismatch');
  }
  return summary(context, mode, attestations.size, adjudications.size);
}

async function validateIntegrity({ ledgerIndexPath, now }) {
  const ledgerPath = requireAbsolutePath(ledgerIndexPath, 'Raw review ledger index');
  const ledger = await readJsonDocument(ledgerPath, 'Raw review ledger index');
  assertLedgerIndex(ledger.value);
  assertNotFuture(ledger.value.createdAt, now, 'Raw review ledger createdAt');

  const queuePath = requireAbsolutePath(ledger.value.queueRef, 'Visual review queue');
  const queue = await readJsonDocument(queuePath, 'Visual review queue');
  assertQueue(queue.value);
  assertDigest(queue.bytes, ledger.value.queueSha256, 'Visual review queue');
  const computedEntrySetSha256 = digest(Buffer.from(JSON.stringify(queue.value.entries), 'utf8'));
  if (queue.value.entrySetSha256 !== computedEntrySetSha256
    || ledger.value.entrySetSha256 !== computedEntrySetSha256) {
    throw new Error('Visual review queue entrySetSha256 mismatch');
  }
  const staticEntries = queue.value.entries.filter((entry) => entry.reviewMediaKind === 'static');
  if (staticEntries.length !== ledger.value.staticAssetCount
    || queue.value.counts?.staticCount !== staticEntries.length) {
    throw new Error('Static visual review queue count mismatch');
  }

  const schemas = await loadSchemas();
  const ledgerRoot = dirname(ledger.path);
  const batches = [];
  const batchBySha = new Map();
  const entriesByRole = {
    fresh_primary: new Map(),
    fresh_secondary: new Map(),
  };
  const originalCache = new Map();
  for (const pointer of ledger.value.freshReview.batches) {
    const path = resolveContainedReference(ledgerRoot, pointer.path, 'Raw review batch');
    const batch = await readJsonDocument(path, `Raw review batch ${pointer.transcriptId}`);
    assertSchema(batch.value, schemas.rawBatch, `Raw review batch ${pointer.transcriptId}`);
    assertDigest(batch.bytes, pointer.sha256, `Raw review batch ${pointer.transcriptId}`);
    if (batch.size !== pointer.byteSize || batch.value.entries.length !== pointer.entryCount
      || batch.value.transcriptId !== pointer.transcriptId
      || batch.value.reviewRole !== pointer.reviewRole
      || batch.value.reviewerPrincipalId !== pointer.reviewerPrincipalId
      || pointer.sourceHashMismatchCount !== 0
      || pointer.captureStatus !== 'captured_exact') {
      throw new Error(`Raw review batch index binding mismatch: ${pointer.transcriptId}`);
    }
    if (batchBySha.has(batch.sha256)) throw new Error(`Duplicate raw review batch SHA: ${batch.sha256}`);
    await assertSameExistingPath(batch.value.queueRef, queue.path, `Raw review batch queueRef ${pointer.transcriptId}`);
    if (batch.value.queueSha256 !== queue.sha256 || batch.value.entrySetSha256 !== computedEntrySetSha256) {
      throw new Error(`Raw review batch queue binding mismatch: ${pointer.transcriptId}`);
    }
    validateBatchChronology(batch.value, now);
    const seenIndices = new Set();
    for (const entry of batch.value.entries) {
      if (seenIndices.has(entry.queueIndex)) {
        throw new Error(`Raw review batch contains duplicate queueIndex ${entry.queueIndex}: ${pointer.transcriptId}`);
      }
      seenIndices.add(entry.queueIndex);
      const expected = staticEntries[entry.queueIndex];
      if (!expected || expected.reviewMediaKind !== 'static' || entry.sha256 !== expected.sha256) {
        throw new Error(`Raw review static projection binding mismatch at queueIndex ${entry.queueIndex}`);
      }
      await assertSameExistingPath(entry.primaryOriginalPath, expected.primaryOriginalPath,
        `Raw review original path at queueIndex ${entry.queueIndex}`);
      await verifyOriginal(entry.primaryOriginalPath, entry.sha256, expected.byteSize, originalCache);
      const roleEntries = entriesByRole[batch.value.reviewRole];
      if (roleEntries.has(entry.queueIndex)) {
        throw new Error(`Duplicate ${batch.value.reviewRole} queueIndex ${entry.queueIndex}`);
      }
      roleEntries.set(entry.queueIndex, { entry, batch, pointer });
    }
    batchBySha.set(batch.sha256, { batch, pointer });
    batches.push({ batch, pointer });
  }

  const primaryEntries = entriesByRole.fresh_primary;
  const secondaryEntries = entriesByRole.fresh_secondary;
  if (ledger.value.freshReview.primaryCapturedCount !== primaryEntries.size
    || ledger.value.freshReview.secondaryCapturedCount !== secondaryEntries.size) {
    throw new Error('Raw review captured-count binding mismatch');
  }

  const pairPointer = ledger.value.freshReview.pairIndex;
  const pairPath = resolveContainedReference(ledgerRoot, pairPointer.path, 'Raw review pair index');
  const pairIndex = await readJsonDocument(pairPath, 'Raw review pair index');
  assertSchema(pairIndex.value, schemas.pairIndex, 'Raw review pair index');
  assertDigest(pairIndex.bytes, pairPointer.sha256, 'Raw review pair index');
  if (pairIndex.size !== pairPointer.byteSize || pairIndex.value.comparisonStatus !== pairPointer.comparisonStatus) {
    throw new Error('Raw review pair index pointer mismatch');
  }
  assertNotFuture(pairIndex.value.createdAt, now, 'Raw review pair index createdAt');

  const pairsByIndex = new Map();
  for (const pair of pairIndex.value.pairs) {
    if (pairsByIndex.has(pair.queueIndex)) throw new Error(`Duplicate raw review pair queueIndex ${pair.queueIndex}`);
    const expected = staticEntries[pair.queueIndex];
    const primary = primaryEntries.get(pair.queueIndex);
    const secondary = secondaryEntries.get(pair.queueIndex);
    if (!expected || !primary || !secondary || pair.sha256 !== expected.sha256
      || primary.entry.sha256 !== pair.sha256 || secondary.entry.sha256 !== pair.sha256) {
      throw new Error(`Raw review pair source binding mismatch at queueIndex ${pair.queueIndex}`);
    }
    if (primary.batch.sha256 !== pair.primaryTranscriptSha256
      || secondary.batch.sha256 !== pair.secondaryTranscriptSha256
      || primary.batch.value.reviewRole !== 'fresh_primary'
      || secondary.batch.value.reviewRole !== 'fresh_secondary'
      || normalizeReviewerPrincipal(primary.batch.value.reviewerPrincipalId) !== normalizeReviewerPrincipal(pair.primaryReviewer)
      || normalizeReviewerPrincipal(secondary.batch.value.reviewerPrincipalId) !== normalizeReviewerPrincipal(pair.secondaryReviewer)) {
      throw new Error(`Raw review pair role or transcript binding mismatch at queueIndex ${pair.queueIndex}`);
    }
    if (normalizeReviewerPrincipal(pair.primaryReviewer) === normalizeReviewerPrincipal(pair.secondaryReviewer)) {
      throw new Error(`Raw review pair must use distinct reviewer principals at queueIndex ${pair.queueIndex}`);
    }
    assertDateOrder(primary.batch.value.completedAt, secondary.batch.value.startedAt,
      `Secondary raw review must start after primary completion at queueIndex ${pair.queueIndex}`);
    assertDateOrder(primary.batch.value.completedAt, pairIndex.value.createdAt,
      `Raw review pair index predates primary completion at queueIndex ${pair.queueIndex}`);
    assertDateOrder(secondary.batch.value.completedAt, pairIndex.value.createdAt,
      `Raw review pair index predates secondary completion at queueIndex ${pair.queueIndex}`);
    pairsByIndex.set(pair.queueIndex, { pair, primary, secondary });
  }
  if (ledger.value.freshReview.pairedCount !== pairsByIndex.size
    || pairsByIndex.size !== primaryEntries.size
    || pairsByIndex.size !== secondaryEntries.size) {
    throw new Error('Raw review pair coverage mismatch');
  }

  return {
    ledger,
    queue,
    staticEntries,
    batches,
    batchBySha,
    pairIndex,
    pairsByIndex,
  };
}

async function validateAttestations(context, reviewerTrust, root, now) {
  const files = await listJsonDocuments(root, 'Raw review attestation');
  const schemas = await loadSchemas();
  const byBatchSha = new Map();
  for (const file of files) {
    assertSchema(file.value, schemas.attestation, `Raw review attestation ${file.path}`);
    if (byBatchSha.has(file.value.rawTranscriptSha256)) {
      throw new Error(`Duplicate raw review attestation for ${file.value.rawTranscriptSha256}`);
    }
    const indexed = context.batchBySha.get(file.value.rawTranscriptSha256);
    if (!indexed) throw new Error(`Raw review attestation references an unknown batch: ${file.value.rawTranscriptSha256}`);
    const { batch, pointer } = indexed;
    await assertSameExistingPath(file.value.rawTranscriptPath, batch.path,
      `Raw review attestation rawTranscriptPath ${pointer.transcriptId}`);
    await assertSameExistingPath(file.value.queueRef, context.queue.path,
      `Raw review attestation queueRef ${pointer.transcriptId}`);
    if (file.value.rawTranscriptByteSize !== batch.size
      || file.value.transcriptId !== batch.value.transcriptId
      || file.value.reviewRole !== batch.value.reviewRole
      || normalizeReviewerPrincipal(file.value.reviewerPrincipalId) !== normalizeReviewerPrincipal(batch.value.reviewerPrincipalId)
      || file.value.queueSha256 !== context.queue.sha256
      || file.value.entrySetSha256 !== context.queue.value.entrySetSha256
      || !sameIntegerSet(file.value.queueIndices, batch.value.entries.map((entry) => entry.queueIndex))) {
      throw new Error(`Raw review attestation binding mismatch: ${pointer.transcriptId}`);
    }
    assertDateOrder(batch.value.completedAt, file.value.attestedAt,
      `Raw review attestation predates batch completion: ${pointer.transcriptId}`);
    assertNotFuture(file.value.attestedAt, now, `Raw review attestation ${pointer.transcriptId}`);
    const signer = verifyTrustedContentReviewerSignature(
      file.value,
      file.value.reviewerPrincipalId,
      reviewerTrust,
      `Raw review attestation ${pointer.transcriptId}`,
    );
    byBatchSha.set(batch.sha256, { file, signer, attestation: file.value });
  }
  for (const { batch } of context.batches) {
    if (!byBatchSha.has(batch.sha256)) {
      throw new Error(`Pilot-complete requires a verified raw review attestation for ${batch.value.transcriptId}`);
    }
  }
  if (byBatchSha.size !== context.batches.length) throw new Error('Raw review attestation coverage mismatch');
  return byBatchSha;
}

async function validateAdjudications(context, reviewerTrust, attestations, root, now) {
  const files = await listJsonDocuments(root, 'Raw review adjudication');
  const schemas = await loadSchemas();
  const byIndex = new Map();
  const evidenceCache = new Map();
  for (const file of files) {
    assertSchema(file.value, schemas.adjudication, `Raw review adjudication ${file.path}`);
    const value = file.value;
    if (value.schema !== 'munjanggun.assetContentReviewAdjudication.v2'
      || value.version !== '2.0'
      || value.baseTranscriptRole !== 'fresh_primary'
      || value.normalizationVersion !== 'raw-to-canonical-observation-v1'
      || value.reconstructionMethod !== 'primary-projection-plus-complete-decisions-v1') {
      throw new Error(`Pilot-complete requires complete-reconstruction adjudication v2 at queueIndex ${value.queueIndex}`);
    }
    if (byIndex.has(value.queueIndex)) throw new Error(`Duplicate raw review adjudication queueIndex ${value.queueIndex}`);
    const binding = context.pairsByIndex.get(value.queueIndex);
    if (!binding) throw new Error(`Raw review adjudication references an unknown pair: ${value.queueIndex}`);
    await assertSameExistingPath(value.pairIndexRef, context.pairIndex.path,
      `Raw review adjudication pairIndexRef ${value.queueIndex}`);
    await assertSameExistingPath(value.queueRef, context.queue.path,
      `Raw review adjudication queueRef ${value.queueIndex}`);
    const expectedAmendments = [binding.primary.batch.sha256, binding.secondary.batch.sha256];
    if (value.pairIndexSha256 !== context.pairIndex.sha256
      || value.queueSha256 !== context.queue.sha256
      || value.entrySetSha256 !== context.queue.value.entrySetSha256
      || value.sourceObjectSha256 !== binding.pair.sha256
      || value.primaryTranscriptSha256 !== binding.primary.batch.sha256
      || value.secondaryTranscriptSha256 !== binding.secondary.batch.sha256
      || !sameStringSet(value.amendsTranscriptSha256, expectedAmendments)
      || value.result !== 'resolved'
      || value.unresolvedUncertainties.length !== 0) {
      throw new Error(`Raw review adjudication binding is incomplete at queueIndex ${value.queueIndex}`);
    }
    const primaryAttestation = attestations.get(binding.primary.batch.sha256);
    const secondaryAttestation = attestations.get(binding.secondary.batch.sha256);
    assertDateOrder(context.pairIndex.value.createdAt, value.adjudicatedAt,
      `Raw review adjudication predates pair index at queueIndex ${value.queueIndex}`);
    assertDateOrder(primaryAttestation.attestation.attestedAt, value.adjudicatedAt,
      `Raw review adjudication predates primary attestation at queueIndex ${value.queueIndex}`);
    assertDateOrder(secondaryAttestation.attestation.attestedAt, value.adjudicatedAt,
      `Raw review adjudication predates secondary attestation at queueIndex ${value.queueIndex}`);
    assertNotFuture(value.adjudicatedAt, now, `Raw review adjudication ${value.queueIndex}`);
    assertCanonicalTextPresence(value.canonicalObservation, value.queueIndex);
    const primaryObservation = normalizeRawObservation(binding.primary.entry);
    const secondaryObservation = normalizeRawObservation(binding.secondary.entry);
    const reconstructedObservation = structuredClone(primaryObservation);
    const requiredDecisionFields = new Set(CANONICAL_DECISION_POINTERS.filter((pointer) => (
      !isDeepStrictEqual(readJsonPointer(primaryObservation, pointer, 'normalized primary raw observation'),
        readJsonPointer(secondaryObservation, pointer, 'normalized secondary raw observation'))
      || !isDeepStrictEqual(readJsonPointer(primaryObservation, pointer, 'normalized primary raw observation'),
        readJsonPointer(value.canonicalObservation, pointer, 'canonical observation'))
    )));
    const decisionFields = new Set();
    for (const decision of value.decisions) {
      if (!CANONICAL_DECISION_POINTER_SET.has(decision.field)) {
        throw new Error(`Raw review adjudication decision field is not atomic or allowed at queueIndex ${value.queueIndex}: ${decision.field}`);
      }
      if (decisionFields.has(decision.field)) {
        throw new Error(`Raw review adjudication repeats decision field ${decision.field} at queueIndex ${value.queueIndex}`);
      }
      decisionFields.add(decision.field);
      const primaryValue = readJsonPointer(primaryObservation, decision.field, 'normalized primary raw observation');
      const secondaryValue = readJsonPointer(secondaryObservation, decision.field, 'normalized secondary raw observation');
      const adjudicatedValue = readJsonPointer(value.canonicalObservation, decision.field, 'canonical observation');
      if (!isDeepStrictEqual(decision.primaryValue, primaryValue)
        || !isDeepStrictEqual(decision.secondaryValue, secondaryValue)) {
        throw new Error(`Raw review adjudication decision does not match the paired raw observations at queueIndex ${value.queueIndex}: ${decision.field}`);
      }
      if (!isDeepStrictEqual(decision.adjudicatedValue, adjudicatedValue)) {
        throw new Error(`Raw review adjudication decision does not match the canonical observation at queueIndex ${value.queueIndex}: ${decision.field}`);
      }
      if ((decision.resolution === 'accept_primary' && !isDeepStrictEqual(adjudicatedValue, primaryValue))
        || (decision.resolution === 'accept_secondary' && !isDeepStrictEqual(adjudicatedValue, secondaryValue))) {
        throw new Error(`Raw review adjudication accepted value does not match its declared source at queueIndex ${value.queueIndex}: ${decision.field}`);
      }
      if (decision.resolution === 'new_original_observation'
        && (isDeepStrictEqual(adjudicatedValue, primaryValue) || isDeepStrictEqual(adjudicatedValue, secondaryValue))) {
        throw new Error(`Raw review adjudication new observation duplicates a raw source at queueIndex ${value.queueIndex}: ${decision.field}`);
      }
      replaceJsonPointer(reconstructedObservation, decision.field, adjudicatedValue);
      for (const evidence of decision.evidenceRefs) {
        await verifyEvidence(evidence.path, evidence.sha256, evidenceCache,
          `Raw review adjudication evidence ${value.queueIndex}`);
      }
    }
    if (!sameStringSet([...decisionFields], [...requiredDecisionFields])) {
      const missing = [...requiredDecisionFields].filter((field) => !decisionFields.has(field));
      const extra = [...decisionFields].filter((field) => !requiredDecisionFields.has(field));
      throw new Error(`Raw review adjudication decision coverage mismatch at queueIndex ${value.queueIndex}; missing=${missing.join(',') || '<none>'}; extra=${extra.join(',') || '<none>'}`);
    }
    if (!isDeepStrictEqual(reconstructedObservation, value.canonicalObservation)) {
      throw new Error(`Raw review adjudication canonical observation is not fully reconstructed at queueIndex ${value.queueIndex}`);
    }
    const adjudicator = verifyTrustedContentReviewerSignature(
      value,
      value.adjudicatorPrincipalId,
      reviewerTrust,
      `Raw review adjudication ${value.queueIndex}`,
    );
    const primaryPrincipal = normalizeReviewerPrincipal(binding.primary.batch.value.reviewerPrincipalId);
    const secondaryPrincipal = normalizeReviewerPrincipal(binding.secondary.batch.value.reviewerPrincipalId);
    if (adjudicator.principalId === primaryPrincipal || adjudicator.principalId === secondaryPrincipal) {
      throw new Error(`Raw review adjudicator must be independent at queueIndex ${value.queueIndex}`);
    }
    byIndex.set(value.queueIndex, file);
  }
  for (const queueIndex of context.pairsByIndex.keys()) {
    if (!byIndex.has(queueIndex)) {
      throw new Error(`Pilot-complete requires a signed resolved adjudication for queueIndex ${queueIndex}`);
    }
  }
  if (byIndex.size !== context.pairsByIndex.size) throw new Error('Raw review adjudication coverage mismatch');
  return byIndex;
}

function assertLedgerIndex(value) {
  if (value?.schema !== 'munjanggun.assetContentRawReviewLedgerIndex.v1'
    || value.version !== '1.0'
    || value.authorityStatus !== 'non_authority'
    || value.libraryStatus !== 'blocked'
    || !isDate(value.createdAt)
    || !isAbsolute(value.queueRef ?? '')
    || !SHA256.test(value.queueSha256 ?? '')
    || !SHA256.test(value.entrySetSha256 ?? '')
    || !Number.isInteger(value.staticAssetCount) || value.staticAssetCount < 1
    || !Array.isArray(value.freshReview?.batches) || value.freshReview.batches.length < 1
    || !value.freshReview?.pairIndex
    || !Number.isInteger(value.freshReview.primaryCapturedCount)
    || !Number.isInteger(value.freshReview.secondaryCapturedCount)
    || !Number.isInteger(value.freshReview.pairedCount)
    || !Number.isInteger(value.freshReview.adjudicatedCount)
    || value.freshReview.adjudicatedCount < 0
    || value.freshReview.adjudicatedCount > value.freshReview.pairedCount) {
    throw new Error('Raw review ledger index schema is invalid');
  }
  for (const pointer of value.freshReview.batches) {
    if (!pointer?.path || !pointer.transcriptId || !['fresh_primary', 'fresh_secondary'].includes(pointer.reviewRole)
      || !pointer.reviewerPrincipalId || !SHA256.test(pointer.sha256 ?? '')
      || !Number.isInteger(pointer.byteSize) || pointer.byteSize < 1
      || !Number.isInteger(pointer.entryCount) || pointer.entryCount < 1
      || !Number.isInteger(pointer.sourceHashMismatchCount) || pointer.sourceHashMismatchCount < 0) {
      throw new Error('Raw review ledger batch pointer schema is invalid');
    }
  }
  const pair = value.freshReview.pairIndex;
  if (!pair.path || !SHA256.test(pair.sha256 ?? '') || !Number.isInteger(pair.byteSize) || pair.byteSize < 1
    || typeof pair.comparisonStatus !== 'string') {
    throw new Error('Raw review ledger pair pointer schema is invalid');
  }
}

function assertQueue(value) {
  if (value?.schema !== 'munjanggun.assetVisualReviewQueue.v1' || value.version !== '1.0'
    || value.status !== 'review_queue_only_not_authority' || !Array.isArray(value.entries)
    || !SHA256.test(value.entrySetSha256 ?? '') || !Number.isInteger(value.counts?.staticCount)) {
    throw new Error('Visual review queue schema is invalid');
  }
  for (const entry of value.entries) {
    if (!SHA256.test(entry?.sha256 ?? '') || !Number.isInteger(entry.byteSize) || entry.byteSize < 1
      || !['static', 'gif'].includes(entry.reviewMediaKind) || !isAbsolute(entry.primaryOriginalPath ?? '')) {
      throw new Error('Visual review queue entry schema is invalid');
    }
  }
}

function validateBatchChronology(batch, now) {
  assertNotFuture(batch.startedAt, now, `Raw review batch ${batch.transcriptId} startedAt`);
  assertNotFuture(batch.completedAt, now, `Raw review batch ${batch.transcriptId} completedAt`);
  assertDateOrder(batch.startedAt, batch.completedAt, `Raw review batch chronology is invalid: ${batch.transcriptId}`);
  for (const entry of batch.entries) {
    assertDateOrder(batch.startedAt, entry.openedAt, `Raw review openedAt predates batch at queueIndex ${entry.queueIndex}`);
    assertDateOrder(entry.openedAt, entry.observedAt, `Raw review observedAt predates open at queueIndex ${entry.queueIndex}`);
    assertDateOrder(entry.observedAt, batch.completedAt, `Raw review observedAt follows batch completion at queueIndex ${entry.queueIndex}`);
  }
}

function assertCanonicalTextPresence(observation, queueIndex) {
  const present = observation.textPresence === 'observed';
  const absent = observation.textPresence === 'none_observed';
  if ((present && (observation.visibleText.length < 1 || observation.visibleTextLocations.length < 1))
    || (absent && (observation.visibleText.length > 0 || observation.visibleTextLocations.length > 0))) {
    throw new Error(`Adjudicated textPresence binding mismatch at queueIndex ${queueIndex}`);
  }
}

async function verifyOriginal(pathValue, expectedSha256, expectedSize, cache) {
  const path = requireAbsolutePath(pathValue, 'Raw review original');
  const key = path.toLocaleLowerCase('en-US');
  let facts = cache.get(key);
  if (!facts) {
    const real = await assertRegularFile(path, 'Raw review original');
    const bytes = await readFile(real);
    facts = { sha256: digest(bytes), size: bytes.length };
    cache.set(key, facts);
  }
  if (facts.sha256 !== expectedSha256 || facts.size !== expectedSize) {
    throw new Error(`Raw review original SHA-256 or size mismatch: ${path}`);
  }
}

async function verifyEvidence(pathValue, expectedSha256, cache, label) {
  const path = requireAbsolutePath(pathValue, label);
  const real = await assertRegularFile(path, label);
  const key = real.toLocaleLowerCase('en-US');
  let actual = cache.get(key);
  if (!actual) {
    actual = digest(await readFile(real));
    cache.set(key, actual);
  }
  if (actual !== expectedSha256) throw new Error(`${label} SHA-256 mismatch: ${path}`);
}

async function readJsonDocument(pathValue, label) {
  const path = requireAbsolutePath(pathValue, label);
  const real = await assertRegularFile(path, label);
  const bytes = await readFile(real);
  let value;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid UTF-8 JSON: ${error.message}`);
  }
  return { path, real, bytes, size: bytes.length, sha256: digest(bytes), value };
}

async function listJsonDocuments(rootValue, label) {
  const root = requireAbsolutePath(rootValue, `${label} directory`);
  let info;
  try {
    info = await lstat(root);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Pilot-complete requires the ${label.toLowerCase()} directory: ${root}`);
    throw error;
  }
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${label} directory must be a regular non-symlink directory`);
  const names = (await readdir(root)).filter((name) => name.endsWith('.json')).sort();
  if (names.length < 1) throw new Error(`Pilot-complete requires ${label.toLowerCase()} documents`);
  return Promise.all(names.map((name) => readJsonDocument(resolve(root, name), label)));
}

async function assertRegularFile(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file`);
  return realpath(path);
}

async function assertSameExistingPath(leftValue, rightValue, label) {
  const left = requireAbsolutePath(leftValue, label);
  const right = requireAbsolutePath(rightValue, label);
  if (left.toLocaleLowerCase('en-US') === right.toLocaleLowerCase('en-US')) return;
  const [leftReal, rightReal] = await Promise.all([
    assertRegularFile(left, label),
    assertRegularFile(right, label),
  ]);
  if (leftReal.toLocaleLowerCase('en-US') !== rightReal.toLocaleLowerCase('en-US')) {
    throw new Error(`${label} does not resolve to the verified file`);
  }
}

function resolveContainedReference(root, value, label) {
  if (typeof value !== 'string' || !value || isAbsolute(value) || value.includes('\0')) {
    throw new Error(`${label} reference must be a relative path`);
  }
  const normalized = value.replaceAll('\\', '/');
  if (normalized.split('/').some((segment) => !segment || segment === '..')) {
    throw new Error(`${label} reference contains path traversal`);
  }
  const path = resolve(root, ...normalized.split('/'));
  const relation = relative(resolve(root), path);
  if (relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    throw new Error(`${label} reference escapes the ledger root`);
  }
  return path;
}

function requireAbsolutePath(value, label) {
  if (typeof value !== 'string' || !value.trim() || !isAbsolute(value) || value.includes('\0')) {
    throw new Error(`${label} must be an absolute path`);
  }
  if (value.replaceAll('\\', '/').split('/').includes('..')) throw new Error(`${label} contains path traversal`);
  return resolve(value);
}

function assertSchema(value, schema, label) {
  const result = validateAgainstSchema(value, schema);
  if (!result.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`);
}

function assertDigest(bytes, expected, label) {
  const actual = digest(bytes);
  if (actual !== expected) throw new Error(`${label} SHA-256 mismatch`);
}

function assertDateOrder(earlier, later, message) {
  const earlierValue = dateValue(earlier, message);
  const laterValue = dateValue(later, message);
  if (earlierValue > laterValue) throw new Error(message);
}

function assertNotFuture(value, now, label) {
  const timestamp = dateValue(value, `${label} is invalid`);
  if (timestamp > now + CLOCK_SKEW_MS) throw new Error(`${label} must not be in the future`);
}

function dateValue(value, message) {
  const result = new Date(value).valueOf();
  if (Number.isNaN(result)) throw new Error(message);
  return result;
}

function isDate(value) {
  return !Number.isNaN(new Date(value).valueOf());
}

function sameIntegerSet(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && JSON.stringify([...left].sort((a, b) => a - b)) === JSON.stringify([...right].sort((a, b) => a - b));
}

function sameStringSet(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function readJsonPointer(document, pointer, label) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/') || pointer === '/') {
    throw new Error(`Raw review adjudication decision field is not a supported JSON pointer: ${pointer}`);
  }
  let current = document;
  for (const encoded of pointer.slice(1).split('/')) {
    if (/~(?![01])/u.test(encoded)) {
      throw new Error(`Raw review adjudication decision field has an invalid escape: ${pointer}`);
    }
    const segment = encoded.replaceAll('~1', '/').replaceAll('~0', '~');
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/u.test(segment) || Number(segment) >= current.length) {
        throw new Error(`Raw review adjudication decision field is absent from ${label}: ${pointer}`);
      }
      current = current[Number(segment)];
    } else if (current && typeof current === 'object' && Object.hasOwn(current, segment)) {
      current = current[segment];
    } else {
      throw new Error(`Raw review adjudication decision field is absent from ${label}: ${pointer}`);
    }
  }
  return current;
}

function replaceJsonPointer(document, pointer, value) {
  const segments = pointer.slice(1).split('/').map((encoded) => encoded.replaceAll('~1', '/').replaceAll('~0', '~'));
  const leaf = segments.pop();
  let parent = document;
  for (const segment of segments) {
    if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, segment)) {
      throw new Error(`Raw review adjudication replacement path is absent: ${pointer}`);
    }
    parent = parent[segment];
  }
  if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, leaf)) {
    throw new Error(`Raw review adjudication replacement field is absent: ${pointer}`);
  }
  parent[leaf] = structuredClone(value);
}

function normalizeRawObservation(entry) {
  const openResult = {
    success: 'opened_successfully',
    opened: 'opened_successfully',
    opened_successfully: 'opened_successfully',
  }[entry.openResult];
  const textPresence = {
    present: 'observed',
    present_dense: 'observed',
    present_minimal: 'observed',
    observed: 'observed',
    none: 'none_observed',
    absent: 'none_observed',
    none_observed: 'none_observed',
    uncertain: 'uncertain',
  }[entry.textPresence];
  if (!openResult || !textPresence) throw new Error('Raw review observation uses an unsupported normalization alias');
  return {
    observationMethod: entry.observationMethod,
    openResult,
    rawObservationText: entry.rawObservationText,
    observedSummary: entry.observedSummary,
    contentType: entry.contentType,
    textPresence,
    visibleText: structuredClone(entry.visibleText),
    visibleTextLocations: structuredClone(entry.visibleTextLocations),
    practicalUses: structuredClone(entry.practicalUses),
    signals: structuredClone(entry.signals),
    privacySignals: structuredClone(entry.privacySignals),
  };
}

function summary(context, mode, attestedBatchCount, adjudicatedPairCount) {
  return {
    result: 'passed',
    mode,
    integrityStatus: 'valid_non_authority',
    pilotStatus: mode === 'pilot-complete' ? 'complete_non_authority' : 'not_requested',
    authorityStatus: context.ledger.value.authorityStatus,
    libraryStatus: context.ledger.value.libraryStatus,
    staticAssetCount: context.staticEntries.length,
    primaryCapturedCount: context.ledger.value.freshReview.primaryCapturedCount,
    secondaryCapturedCount: context.ledger.value.freshReview.secondaryCapturedCount,
    pairedCount: context.pairsByIndex.size,
    attestedBatchCount,
    adjudicatedPairCount,
    promotionEligible: false,
  };
}

async function loadSchemas() {
  schemasPromise ??= Promise.all(Object.entries(schemaPaths).map(async ([key, path]) => [
    key,
    JSON.parse(await readFile(path, 'utf8')),
  ])).then((entries) => Object.fromEntries(entries));
  return schemasPromise;
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
