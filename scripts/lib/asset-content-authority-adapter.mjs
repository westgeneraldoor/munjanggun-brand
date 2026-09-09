import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetContentRawReviewLedger } from './asset-content-raw-review-ledger.mjs';
import { computeStaticTileCoverageDigest } from './asset-content-revalidation.mjs';
import { assertGifPlaybackWorkbenchReceipt } from './gif-playback-workbench.mjs';
import { validateGifAdjudicationActiveCandidate } from './gif-adjudication-active-candidate.mjs';

const SHA256 = /^[a-f0-9]{64}$/u;
const OUTPUT_OWNER_MARKER = '.asset-content-authority-draft-owner';
const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const CLAIM_SIGNALS = Object.freeze({
  price: 'price',
  event: 'event',
  afterService: 'after_sales_service',
  spec: 'specification',
  review: 'review',
  schedule: 'schedule',
});

/**
 * Convert independently verified raw ledgers into fail-closed signing candidates.
 *
 * The emitted files deliberately omit `signature` and
 * `secondarySemanticVerdict`. They keep every entry at `needs_escalation` and
 * list the evidence still needed by content-evidence-v4. A caller cannot pass
 * these drafts to the authority builder until the missing evidence is supplied
 * and a trusted reviewer signs the completed document.
 */
export async function buildRawReviewAuthorityDrafts({
  queuePath,
  staticSegments,
  staticEvidenceIndexPath,
  gifAdjudicationActiveCandidatePath,
  catalogs,
  outputRoot = null,
  checkOnly = false,
  generatedAt = new Date().toISOString(),
  repoRoot = DEFAULT_REPO_ROOT,
  validateStaticLedger = validateAssetContentRawReviewLedger,
  validatePlaybackReceipt = assertGifPlaybackWorkbenchReceipt,
  validateGifAdjudicationCandidate = validateGifAdjudicationActiveCandidate,
  beforeOutputCommit = null,
} = {}) {
  requireArray(staticSegments, 'staticSegments', 1);
  requireArray(catalogs, 'catalogs', 2);
  const queue = await readJsonFile(queuePath, 'Visual review queue');
  assertQueue(queue.value);
  const queueSha256 = digest(queue.bytes);
  if (queue.value.entrySetSha256 !== digest(Buffer.from(JSON.stringify(queue.value.entries), 'utf8'))) {
    throw new Error('Visual review queue entrySetSha256 mismatch');
  }
  const staticQueue = queue.value.entries.filter((entry) => entry.reviewMediaKind === 'static');
  const gifQueue = queue.value.entries.filter((entry) => entry.reviewMediaKind === 'gif');
  if (staticQueue.length !== queue.value.counts.staticCount || gifQueue.length !== queue.value.counts.gifCount) {
    throw new Error('Visual review queue media counts do not match its entries');
  }

  const loadedCatalogs = await loadCatalogs(catalogs, queue.value, queueSha256);
  const catalogByIntake = new Map(loadedCatalogs.map((item) => [item.catalog.intakeId, item]));
  assertCatalogProjection(queue.value.entries, loadedCatalogs);

  const staticByIndex = await loadStaticAdjudications({
    staticSegments, queuePath: queue.path, queueSha256, staticQueue, validateStaticLedger,
  });
  const staticEvidence = await loadStaticEvidence(staticEvidenceIndexPath, queue.path, queueSha256, staticQueue);
  const gif = await loadGifEvidence({
    gifAdjudicationActiveCandidatePath, queue, gifQueue, validatePlaybackReceipt, validateGifAdjudicationCandidate,
  });

  const semanticBySha = new Map();
  for (const [queueIndex, value] of staticByIndex) {
    const expected = staticQueue[queueIndex];
    if (semanticBySha.has(expected.sha256)) throw new Error(`Duplicate semantic SHA across static ledgers: ${expected.sha256}`);
    semanticBySha.set(expected.sha256, { mediaKind: 'static', queueIndex, queueEntry: expected, ...value });
  }
  for (const [projectionIndex, value] of gif.byIndex) {
    const expected = gifQueue[projectionIndex];
    if (semanticBySha.has(expected.sha256)) throw new Error(`Duplicate semantic SHA across media projections: ${expected.sha256}`);
    semanticBySha.set(expected.sha256, { mediaKind: 'gif', queueIndex: projectionIndex, queueEntry: expected, ...value });
  }
  if (semanticBySha.size !== queue.value.entries.length) {
    throw new Error(`Semantic coverage mismatch: expected ${queue.value.entries.length}, got ${semanticBySha.size}`);
  }

  const draftGroups = new Map();
  const evidenceNeeds = [];
  for (const loaded of loadedCatalogs) {
    for (const catalogEntry of loaded.catalog.entries) {
      const semantic = semanticBySha.get(catalogEntry.sha256);
      if (!semantic) throw new Error(`Catalog entry is absent from verified semantic inputs: ${catalogEntry.sha256}`);
      const reviewer = semantic.mediaKind === 'static'
        ? semantic.adjudication.adjudicatorPrincipalId
        : gif.ledger.value.reviewer.principalId;
      const groupKey = `${loaded.catalog.intakeId}\0${semantic.mediaKind}\0${reviewer}`;
      const group = draftGroups.get(groupKey) ?? {
        intakeId: loaded.catalog.intakeId,
        mediaKind: semantic.mediaKind,
        reviewer,
        reviewedAt: semantic.mediaKind === 'static' ? semantic.adjudication.adjudicatedAt : gif.ledger.value.chronology.completedAt,
        entries: [],
      };
      const originalPath = originalForCatalogEntry(loaded.rawRoot, catalogEntry, semantic.queueEntry);
      await verifyFileHashAndSize(originalPath, catalogEntry.sha256, catalogEntry.byteSize, 'Catalog draft original');
      const result = semantic.mediaKind === 'static'
        ? staticDraftEntry(catalogEntry, originalPath, semantic.adjudication, staticEvidence.get(catalogEntry.sha256))
        : gifDraftEntry(catalogEntry, originalPath, semantic.entry, semantic.playbackReceipt, semantic.queueEntry);
      group.entries.push(result.entry);
      group.reviewedAt = maxDate(group.reviewedAt, result.entry.reviewEvidence.reviewedAt);
      evidenceNeeds.push({
        intakeId: loaded.catalog.intakeId,
        mediaKind: semantic.mediaKind,
        sourceObjectSha256: catalogEntry.sha256,
        reviewer,
        needs: result.needs,
        sourceUncertainties: result.sourceUncertainties,
        sourceRefs: normalizeSourceRefs(catalogEntry.sourceRefs),
      });
      draftGroups.set(groupKey, group);
    }
  }

  const documents = [...draftGroups.values()]
    .sort((left, right) => `${left.intakeId}\0${left.mediaKind}\0${left.reviewer}`.localeCompare(`${right.intakeId}\0${right.mediaKind}\0${right.reviewer}`))
    .map((group, index) => ({
      schema: 'munjanggun.assetContentReviewInput.v1',
      version: '1.0',
      intakeId: group.intakeId,
      reviewId: `RAW-AUTHORITY-DRAFT-${group.intakeId}-${group.mediaKind.toUpperCase()}-${String(index + 1).padStart(2, '0')}`,
      mediaKind: group.mediaKind,
      reviewedAt: group.reviewedAt,
      reviewer: group.reviewer,
      entries: group.entries.sort((left, right) => left.sha256.localeCompare(right.sha256)),
    }));
  const conversionIntegrity = summarizeDraftConversion(documents);

  const sharedOrigins = queue.value.entries
    .filter((entry) => new Set(entry.origins.map((origin) => origin.intakeId)).size > 1)
    .map((entry) => ({
      sha256: entry.sha256,
      mediaKind: entry.reviewMediaKind,
      intakeIds: [...new Set(entry.origins.map((origin) => origin.intakeId))].sort(),
      origins: normalizeOrigins(entry.origins),
    }));
  const report = {
    schema: 'munjanggun.assetContentReviewDraftSet.v1',
    version: '1.0',
    authorityStatus: 'non_authority',
    promotionReadiness: 'needs_evidence',
    generatedAt: normalizeDate(generatedAt, 'generatedAt'),
    queue: { path: queue.path, sha256: queueSha256 },
    coverage: {
      queueUniqueAssets: queue.value.entries.length,
      staticUniqueAssets: staticQueue.length,
      gifUniqueAssets: gifQueue.length,
      catalogEntries: loadedCatalogs.reduce((sum, item) => sum + item.catalog.entries.length, 0),
      crossIntakeDuplicateAssets: sharedOrigins.length,
      missingSemanticAssets: 0,
      duplicateSemanticAssets: 0,
    },
    sources: {
      staticSegments: staticSegments.map((item) => ({ ledgerIndexPath: resolve(item.ledgerIndexPath), reviewerTrustPath: resolve(item.reviewerTrustPath) })),
      staticEvidenceIndex: { path: staticEvidence.index.path, sha256: staticEvidence.index.sha256 },
      gifAdjudicationLedger: { path: gif.ledger.path, sha256: gif.ledger.sha256 },
      gifAdjudicationVerification: { path: gif.verification.path, sha256: gif.verification.sha256 },
      gifAdjudicationActiveCandidate: { path: gif.active.path, sha256: gif.active.sha256 },
      gifAdjudicationPointerVerification: { path: gif.pointerVerification.path, sha256: gif.pointerVerification.sha256 },
      playbackReceiptPhysicalCount: gif.physicalReceiptCount,
      playbackReceiptUniqueAssetCount: gif.byIndex.size,
    },
    conversionIntegrity,
    catalogs: loadedCatalogs.map((item) => ({
      intakeId: item.catalog.intakeId,
      path: item.path,
      sha256: item.sha256,
      entryCount: item.catalog.entries.length,
    })),
    sharedOrigins,
    evidenceNeedSummary: summarizeEvidenceNeeds(evidenceNeeds),
    documents: documents.map((document) => {
      const needs = evidenceNeeds.filter((item) => item.intakeId === document.intakeId
        && item.mediaKind === document.mediaKind && item.reviewer === document.reviewer);
      return {
        reviewId: document.reviewId,
        intakeId: document.intakeId,
        mediaKind: document.mediaKind,
        reviewer: document.reviewer,
        entryCount: document.entries.length,
        authorityStatus: 'non_authority',
        promotionReadiness: 'needs_evidence',
        signingAllowed: false,
        missingSignature: true,
        missingSecondarySemanticVerdictCount: needs.filter((item) => item.needs.includes('secondary_semantic_verdict_receipt_missing')).length,
        evidenceNeedCount: needs.reduce((sum, item) => sum + item.needs.length, 0),
      };
    }),
    evidenceNeeds,
    guard: 'Unsigned drafts are non-authority and must not be signed or passed to buildVerifiedContentAuthority until every evidence need is resolved and the completed v1 document validates.',
  };

  if (checkOnly) return { report, documents, outputRoot: null };
  const destination = requireOutputRoot(outputRoot, repoRoot);
  const outputSafety = await prepareSafeOutputRoot(destination, repoRoot);
  const partial = `${destination}.partial-${process.pid}-${Date.now()}`;
  const expectedPartialReal = resolve(outputSafety.parentReal, basename(partial));
  const ownerToken = randomUUID();
  await mkdir(partial);
  let partialIdentity = null;
  try {
    partialIdentity = await assertCreatedDirectorySafe(partial, expectedPartialReal, outputSafety.repoReal, 'Draft partial output root');
    await writeFile(resolve(partial, OUTPUT_OWNER_MARKER), ownerToken, { flag: 'wx' });
    const documentFiles = [];
    for (const document of documents) {
      const name = `${document.reviewId.toLowerCase()}.unsigned.json`;
      const path = resolve(partial, name);
      await writeFile(path, jsonBytes(document), { flag: 'wx' });
      documentFiles.push({ reviewId: document.reviewId, path: resolve(destination, name), sha256: digest(jsonBytes(document)), entryCount: document.entries.length });
    }
    const finalReport = { ...report, documentFiles };
    await writeFile(resolve(partial, 'draft-set-report.json'), jsonBytes(finalReport), { flag: 'wx' });
    if (beforeOutputCommit) await beforeOutputCommit({ partial, destination });
    await rename(partial, destination);
    await assertCreatedDirectorySafe(destination, outputSafety.destinationReal, outputSafety.repoReal, 'Draft output root');
    if (!await hasExactOutputOwnerMarker(destination, ownerToken)) throw new Error('Draft output ownership marker changed after commit');
    await rm(resolve(destination, OUTPUT_OWNER_MARKER));
    return { report: finalReport, documents, outputRoot: destination };
  } catch (error) {
    await cleanupOwnedOutputPath(partial, expectedPartialReal, ownerToken, partialIdentity);
    throw error;
  }
}

async function loadCatalogs(specs, queue, queueSha256) {
  const queueCatalogByIntake = new Map((queue.catalogs ?? []).map((item) => [item.intakeId, item]));
  const result = [];
  const seen = new Set();
  for (const spec of specs) {
    const file = await readJsonFile(spec.catalogPath, 'Content catalog');
    const catalog = file.value;
    if (!catalog?.intakeId || !Array.isArray(catalog.entries) || catalog.binaryGroupCount !== catalog.entries.length) {
      throw new Error('Content catalog shape is invalid');
    }
    if (seen.has(catalog.intakeId)) throw new Error(`Duplicate catalog intakeId: ${catalog.intakeId}`);
    const queued = queueCatalogByIntake.get(catalog.intakeId);
    if (!queued || queued.catalogSha256 !== file.sha256 || resolve(queued.catalogPath) !== file.path
      || queued.entryCount !== catalog.entries.length) {
      throw new Error(`Catalog does not match the visual review queue: ${catalog.intakeId}`);
    }
    const rawRoot = requireAbsolutePath(spec.rawRoot ?? queued.rawRoot, `Raw root ${catalog.intakeId}`);
    await assertDirectory(rawRoot, `Raw root ${catalog.intakeId}`);
    const shas = new Set();
    for (const entry of catalog.entries) {
      if (!SHA256.test(entry?.sha256 ?? '') || shas.has(entry.sha256) || !Array.isArray(entry.sourceRefs) || entry.sourceRefs.length < 1) {
        throw new Error(`Catalog contains an invalid or duplicate entry: ${catalog.intakeId}`);
      }
      shas.add(entry.sha256);
    }
    result.push({ catalog, path: file.path, sha256: file.sha256, rawRoot, queueSha256 });
    seen.add(catalog.intakeId);
  }
  if (seen.size !== queueCatalogByIntake.size || [...queueCatalogByIntake.keys()].some((intakeId) => !seen.has(intakeId))) {
    throw new Error('Catalog specs do not exactly cover the visual review queue catalogs');
  }
  return result;
}

function assertCatalogProjection(queueEntries, catalogs) {
  const queueBySha = uniqueMap(queueEntries, (entry) => entry.sha256, 'Visual review queue');
  const expectedPairs = new Set();
  for (const item of catalogs) {
    for (const entry of item.catalog.entries) {
      const queued = queueBySha.get(entry.sha256);
      if (!queued || queued.byteSize !== entry.byteSize || queued.mediaType !== entry.mediaType) {
        throw new Error(`Catalog entry is missing or conflicts with the visual review queue: ${entry.sha256}`);
      }
      const expectedRefs = queued.origins
        .filter((origin) => origin.intakeId === item.catalog.intakeId && origin.catalogSha256 === item.sha256)
        .map(({ sourceId, sourceRelativePath }) => ({ sourceId, sourceRelativePath }));
      if (canonicalJson(normalizeSourceRefs(expectedRefs)) !== canonicalJson(normalizeSourceRefs(entry.sourceRefs))) {
        throw new Error(`Catalog sourceRefs do not match queue origins: ${entry.sha256}`);
      }
      expectedPairs.add(`${item.catalog.intakeId}:${entry.sha256}`);
    }
  }
  const actualPairs = new Set(queueEntries.flatMap((entry) => [...new Set(entry.origins.map((origin) => origin.intakeId))]
    .map((intakeId) => `${intakeId}:${entry.sha256}`)));
  if (canonicalJson([...expectedPairs].sort()) !== canonicalJson([...actualPairs].sort())) {
    throw new Error('Catalog projection does not exactly cover queue intake origins');
  }
}

async function loadStaticAdjudications({ staticSegments, queuePath, queueSha256, staticQueue, validateStaticLedger }) {
  const result = new Map();
  for (const spec of staticSegments) {
    const ledgerPath = requireAbsolutePath(spec.ledgerIndexPath, 'Static ledger index');
    await assertNotSupersededStaticSegment(ledgerPath);
    const validation = await validateStaticLedger({
      ledgerIndexPath: ledgerPath,
      mode: 'pilot-complete',
      reviewerTrustPath: requireAbsolutePath(spec.reviewerTrustPath, 'Static reviewer trust'),
      ...(spec.attestationRoot ? { attestationRoot: requireAbsolutePath(spec.attestationRoot, 'Static attestation root') } : {}),
      ...(spec.adjudicationRoot ? { adjudicationRoot: requireAbsolutePath(spec.adjudicationRoot, 'Static adjudication root') } : {}),
      includeValidatedEvidence: true,
    });
    if (validation?.result !== 'passed' || validation?.mode !== 'pilot-complete'
      || validation?.pilotStatus !== 'complete_non_authority' || validation?.promotionEligible !== false) {
      throw new Error(`Static ledger did not pass fail-closed pilot-complete validation: ${ledgerPath}`);
    }
    const snapshots = validation.validatedEvidence;
    if (!snapshots || !Array.isArray(snapshots.adjudications)) {
      throw new Error(`Static validator did not return exact validated evidence snapshots: ${ledgerPath}`);
    }
    const ledger = parseSnapshot(snapshots.ledger, 'Static ledger index snapshot');
    const queueSnapshot = parseSnapshot(snapshots.queue, 'Static queue snapshot');
    if (ledger.path !== ledgerPath || queueSnapshot.path !== resolve(queuePath) || queueSnapshot.sha256 !== queueSha256) {
      throw new Error(`Static validator snapshot path or queue hash mismatch: ${ledgerPath}`);
    }
    if (resolve(ledger.value.queueRef) !== resolve(queuePath) || ledger.value.queueSha256 !== queueSha256
      || ledger.value.authorityStatus !== 'non_authority' || ledger.value.libraryStatus !== 'blocked') {
      throw new Error(`Static ledger queue or authority binding mismatch: ${ledgerPath}`);
    }
    if (!snapshots.adjudications.length || snapshots.adjudications.length !== validation.adjudicatedPairCount) {
      throw new Error(`Static validator snapshot adjudication count mismatch: ${ledgerPath}`);
    }
    for (const snapshot of snapshots.adjudications) {
      const file = parseSnapshot(snapshot, 'Static adjudication snapshot');
      const value = file.value;
      if (value.schema !== 'munjanggun.assetContentReviewAdjudication.v2' || value.version !== '2.0'
        || value.authorityStatus !== 'non_authority' || value.result !== 'resolved'
        || !Number.isInteger(value.queueIndex) || value.queueIndex < 0 || value.queueIndex >= staticQueue.length
        || value.sourceObjectSha256 !== staticQueue[value.queueIndex].sha256
        || value.queueSha256 !== queueSha256 || value.unresolvedUncertainties?.length !== 0
        || !value.signature) {
        throw new Error(`Static adjudication is not a signed resolved v2 reconstruction: ${file.path}`);
      }
      if (result.has(value.queueIndex)) throw new Error(`Duplicate static adjudication queueIndex across active segments: ${value.queueIndex}`);
      result.set(value.queueIndex, { adjudication: value, path: file.path, sha256: file.sha256 });
    }
  }
  const missing = staticQueue.map((_, index) => index).filter((index) => !result.has(index));
  if (missing.length || result.size !== staticQueue.length) {
    throw new Error(`Static active segment coverage mismatch; missing=${missing.slice(0, 10).join(',') || '<none>'}; actual=${result.size}; expected=${staticQueue.length}`);
  }
  return result;
}

function parseSnapshot(snapshot, label) {
  if (!snapshot || !Buffer.isBuffer(snapshot.bytes) || !SHA256.test(snapshot.sha256 ?? '')) {
    throw new Error(`${label} is missing exact bytes or SHA-256`);
  }
  const path = requireAbsolutePath(snapshot.path, label);
  const bytes = Buffer.from(snapshot.bytes);
  const sha256 = digest(bytes);
  if (sha256 !== snapshot.sha256) throw new Error(`${label} bytes do not match its SHA-256`);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (error) { throw new Error(`${label} is not valid UTF-8 JSON: ${error.message}`); }
  return { path, bytes, sha256, value };
}

async function assertNotSupersededStaticSegment(ledgerPath) {
  const segment = basename(dirname(ledgerPath));
  const match = /^STATIC-(\d{4})-(\d{4})-v(\d+)$/u.exec(segment);
  if (!match) return;
  const siblings = await readdir(dirname(dirname(ledgerPath)), { withFileTypes: true });
  const higher = siblings.filter((item) => item.isDirectory())
    .map((item) => /^STATIC-(\d{4})-(\d{4})-v(\d+)$/u.exec(item.name))
    .filter((candidate) => candidate && candidate[1] === match[1] && candidate[2] === match[2] && Number(candidate[3]) > Number(match[3]));
  if (higher.length) throw new Error(`Static ledger is superseded by a higher segment version: ${ledgerPath}`);
}

async function loadStaticEvidence(indexPath, queuePath, queueSha256, staticQueue) {
  const index = await readJsonFile(indexPath, 'Static evidence index');
  if (resolve(index.value.queuePath) !== resolve(queuePath) || index.value.queueSha256 !== queueSha256
    || index.value.sourceVerificationPerformed !== true || index.value.outputWritten !== true
    || index.value.selectedCount !== staticQueue.length || !Array.isArray(index.value.entries)) {
    throw new Error('Static evidence index binding is invalid');
  }
  const bySha = uniqueMap(index.value.entries, (entry) => entry.sourceObjectSha256, 'Static evidence index');
  if (bySha.size !== staticQueue.length) throw new Error('Static evidence index does not exactly cover the static queue');
  for (const queued of staticQueue) {
    const pointer = bySha.get(queued.sha256);
    if (!pointer) throw new Error(`Static evidence is missing: ${queued.sha256}`);
    const manifest = await readJsonFile(pointer.manifestRef, 'Static tile manifest');
    if (manifest.sha256 !== pointer.manifestSha256 || manifest.value.sourceObjectSha256 !== queued.sha256
      || manifest.value.coverageDigest !== pointer.coverageDigest
      || computeStaticTileCoverageDigest(manifest.value) !== pointer.coverageDigest) {
      throw new Error(`Static evidence manifest hash or coverage binding mismatch: ${queued.sha256}`);
    }
  }
  bySha.index = index;
  return bySha;
}

async function loadGifEvidence({ gifAdjudicationActiveCandidatePath, queue, gifQueue, validatePlaybackReceipt, validateGifAdjudicationCandidate }) {
  const activeValidation = await validateGifAdjudicationCandidate({
    activeCandidatePath: resolve(gifAdjudicationActiveCandidatePath),
    includeValidatedEvidence: true,
  });
  if (activeValidation?.status !== 'pass' || activeValidation?.authorityStatus !== 'signed_non_authority_candidate'
    || activeValidation?.libraryStatus !== 'blocked') {
    throw new Error('GIF adjudication candidate validator did not return a fail-closed exact-pointer pass');
  }
  const snapshots = activeValidation.validatedEvidence;
  if (!snapshots) throw new Error('GIF adjudication validator did not return exact validated evidence snapshots');
  const active = parseSnapshot(snapshots.activeCandidate, 'GIF adjudication active candidate snapshot');
  const pointerVerification = parseSnapshot(snapshots.pointerVerification, 'GIF adjudication pointer verification snapshot');
  const pairIndex = parseSnapshot(snapshots.pairIndex, 'GIF adjudication pair index snapshot');
  const ledger = parseSnapshot(snapshots.adjudicationLedger, 'GIF adjudication ledger snapshot');
  const verification = parseSnapshot(snapshots.verificationReceipt, 'GIF adjudication verification snapshot');
  const reviewerTrust = parseSnapshot(snapshots.reviewerTrust, 'GIF adjudication reviewer trust snapshot');
  const queueSnapshot = parseSnapshot(snapshots.queue, 'GIF adjudication queue snapshot');
  const r4Ledger = parseSnapshot(snapshots.r4Ledger, 'GIF R4 technical ledger snapshot');
  const r4Verification = parseSnapshot(snapshots.r4Verification, 'GIF R4 technical verification snapshot');
  const p7Ledger = parseSnapshot(snapshots.p7Ledger, 'GIF P7 sampled semantic ledger snapshot');
  if (active.path !== resolve(gifAdjudicationActiveCandidatePath)
    || active.sha256 !== activeValidation.activeCandidateSha256
    || pointerVerification.path !== resolve(activeValidation.pointerVerificationPath) || pointerVerification.sha256 !== activeValidation.pointerVerificationSha256
    || pairIndex.path !== resolve(activeValidation.pairIndexPath) || pairIndex.sha256 !== activeValidation.pairIndexSha256
    || ledger.path !== resolve(activeValidation.adjudicationLedgerPath) || ledger.sha256 !== activeValidation.adjudicationLedgerSha256
    || verification.path !== resolve(activeValidation.verificationReceiptPath) || verification.sha256 !== activeValidation.verificationReceiptSha256
    || reviewerTrust.path !== resolve(activeValidation.reviewerTrustPath) || reviewerTrust.sha256 !== activeValidation.reviewerTrustSha256
    || r4Ledger.sha256 !== activeValidation.r4LedgerSha256 || r4Verification.sha256 !== activeValidation.r4VerificationSha256
    || p7Ledger.sha256 !== activeValidation.p7LedgerSha256
    || queueSnapshot.path !== queue.path || queueSnapshot.sha256 !== queue.sha256) {
    throw new Error('GIF adjudication validator snapshot paths or byte hashes differ from its validation result');
  }
  if (!Array.isArray(ledger.value.adjudications) || ledger.value.adjudications.length !== gifQueue.length
    || !Array.isArray(pairIndex.value.pairs) || pairIndex.value.pairs.length !== gifQueue.length) throw new Error('GIF P5 canonical coverage is invalid');
  const technicalRoot = dirname(snapshots.r4ActiveCandidate.path);
  const pairByIndex = new Map(pairIndex.value.pairs.map((item) => [item.gifProjectionIndex, item]));
  const p7ByProjectionIndex = new Map((p7Ledger.value.records ?? []).map((item) => [item.index - 1, item]));
  if (p7ByProjectionIndex.size !== gifQueue.length) throw new Error('GIF P7 sampled semantic coverage is invalid');
  const byIndex = new Map();
  const receiptBytesByPath = new Map();
  let physicalReceiptCount = 0;
  for (const adjudication of ledger.value.adjudications) {
    const index = adjudication.pairIndex;
    const pair = pairByIndex.get(index);
    const p7 = p7ByProjectionIndex.get(index);
    const expected = gifQueue[index];
    if (!Number.isInteger(index) || !expected || byIndex.has(index)
      || adjudication.sourceObjectSha256 !== expected.sha256 || pair?.byteSize !== expected.byteSize
      || resolve(adjudication.sourcePath) !== resolve(expected.primaryOriginalPath)
      || p7?.sourceObjectSha256 !== expected.sha256) {
      throw new Error(`GIF projection binding mismatch at index ${index}`);
    }
    await verifyQueueOrigins(expected.origins, expected.sha256, expected.byteSize);
    const technical = adjudication.evidenceSeparation?.technicalFullPlayback;
    const refs = technical?.receiptRefs;
    if (!Array.isArray(refs) || refs.length < 1 || technical.authority !== 'technical_only_not_content_authority'
      || technical.observedFromMs !== 0 || technical.observedToMs !== technical.decodedDurationMs) {
      throw new Error(`GIF playback evidence is incomplete: ${expected.sha256}`);
    }
    let selectedReceipt = null;
    for (const pointer of refs) {
      const receiptPath = await resolveContainedExistingFile(technicalRoot, pointer.path, 'GIF playback receipt');
      let receiptFile = receiptBytesByPath.get(receiptPath);
      if (!receiptFile) {
        receiptFile = await readJsonFile(receiptPath, 'GIF playback receipt');
        receiptBytesByPath.set(receiptPath, receiptFile);
      }
      if (receiptFile.sha256 !== pointer.sha256) {
        throw new Error(`GIF playback receipt hash mismatch: ${expected.sha256}`);
      }
      const receipt = receiptFile.value;
      validatePlaybackReceipt(receipt, {
        sha256: expected.sha256,
        decodedFrameCount: pair.decodedFrameCount,
        decodedDurationMs: pair.decodedDurationMs,
      });
      if (receipt.reviewer !== technical.reviewerPrincipalId || receipt.queueSha256 !== queue.sha256) {
        throw new Error(`GIF playback receipt semantic binding mismatch: ${expected.sha256}`);
      }
      selectedReceipt ??= { path: receiptFile.path, sha256: receiptFile.sha256, receipt };
      physicalReceiptCount += 1;
    }
    byIndex.set(index, {
      entry: canonicalGifAdapterEntry(adjudication, pair, ledger, p7, p7Ledger, selectedReceipt),
      playbackReceipt: selectedReceipt,
    });
  }
  const missing = gifQueue.map((_, index) => index).filter((index) => !byIndex.has(index));
  if (missing.length || byIndex.size !== gifQueue.length) throw new Error(`GIF semantic coverage mismatch; missing=${missing.join(',') || '<none>'}`);
  if (physicalReceiptCount !== r4Verification.value.receiptBinding.expectedPhysicalRefs
    || physicalReceiptCount !== r4Verification.value.receiptBinding.actualPhysicalRefs) {
    throw new Error('GIF physical playback receipt count mismatch');
  }
  return { ledger, verification, active, pointerVerification, byIndex, physicalReceiptCount };
}

function canonicalGifAdapterEntry(adjudication, pair, ledgerFile, p7, p7LedgerFile, selectedReceipt) {
  const ledger = ledgerFile.value;
  const canonical = adjudication.canonicalObservation;
  const technical = adjudication.evidenceSeparation.technicalFullPlayback;
  const sampled = adjudication.evidenceSeparation.sampledSemanticVisualEvidence;
  const observationMethod = p7.observationMethod;
  return {
    reviewerPrincipalId: ledger.reviewer.principalId,
    rawObservation: canonical.sceneAndTransitions,
    sceneAndTransitions: canonical.sceneAndTransitions,
    visibleTextTranscription: (canonical.visibleText?.readings ?? []).join('\n'),
    screeningSignals: Object.fromEntries(Object.entries(canonical.signals).map(([key, value]) => [key, value.state === 'observed_signal'])),
    signalUncertainties: Object.entries(canonical.signals).filter(([, value]) => value.state === 'uncertain_signal').map(([key]) => key),
    uncertainties: canonical.uncertainties,
    playbackEvidence: { completedAt: selectedReceipt.receipt.reviewedAt },
    decodedFrameCount: pair.decodedFrameCount,
    decodedDurationMs: pair.decodedDurationMs,
    reviewHistory: {
      technicalPlayback: {
        method: selectedReceipt.receipt.method,
        authority: technical.authority,
        reviewer: technical.reviewerPrincipalId,
        reviewedAt: selectedReceipt.receipt.reviewedAt,
        observedFromMs: technical.observedFromMs,
        observedToMs: technical.observedToMs,
        decodedDurationMs: technical.decodedDurationMs,
        receiptRefs: technical.receiptRefs.map((item) => ({ path: item.path, sha256: item.sha256 })),
      },
      sampledSemanticReview: {
        method: observationMethod.type,
        authority: 'sampled_semantic_non_authority',
        reviewer: sampled.reviewerPrincipalId,
        reviewedAt: p7LedgerFile.value.createdAt,
        reviewedAtBasis: 'p7_ledger_created_at_no_per_asset_timestamp',
        sourceRangeFromMs: observationMethod.sourceRangeFromMs,
        sourceRangeToMs: observationMethod.sourceRangeToMs,
        selectedFrameIndices: [...observationMethod.visuallyReadFrameIndices],
        overview: { path: sampled.overview.path, sha256: sampled.overview.sha256 },
        supplementalOriginalPixelFrames: observationMethod.supplementalOriginalPixelFrames.map((item) => ({
          frameIndex: item.frame,
          startMs: item.startMs,
          path: item.path,
          sha256: item.sha256,
        })),
        continuousNaturalSpeedVisualObservation: sampled.continuousNaturalSpeedVisualObservation,
        everySourceFrameVisuallyInspected: sampled.everySourceFrameVisuallyInspected,
      },
      adjudication: {
        method: 'independent_field_adjudication',
        authority: 'signed_non_authority_candidate',
        reviewer: ledger.reviewer.principalId,
        reviewedAt: ledger.chronology.completedAt,
        evidenceRef: ledgerFile.path,
        evidenceSha256: ledgerFile.sha256,
        pairIndex: adjudication.pairIndex,
        fieldDecisionCount: adjudication.fieldDecisions.length,
        directThirdPartyReview: structuredClone(adjudication.directThirdPartyReview),
      },
    },
  };
}

async function verifyQueueOrigins(origins, sha256, byteSize) {
  for (const origin of origins ?? []) {
    const file = requireAbsolutePath(origin.originalPath, 'Queue origin original');
    await verifyFileHashAndSize(file, sha256, byteSize, 'Queue origin original');
  }
}

async function verifyFileHashAndSize(path, sha256, byteSize, label) {
  const bytes = await readFile(path);
  if (bytes.length !== byteSize || digest(bytes) !== sha256) throw new Error(`${label} hash or size mismatch: ${path}`);
}

function staticDraftEntry(catalogEntry, originalPath, adjudication, tile) {
  const canonical = adjudication.canonicalObservation;
  const needs = ['search_tags_review_missing', 'secondary_semantic_verdict_receipt_missing'];
  const claimSignals = Object.entries(CLAIM_SIGNALS)
    .filter(([key]) => canonical.signals?.[key] === 'observed')
    .map(([, signal]) => signal);
  if (canonical.textPresence === 'observed') {
    needs.push('visible_text_normalized_regions_missing', 'visible_text_static_crop_pixels_missing');
  } else if (canonical.textPresence === 'uncertain') {
    needs.push('canonical_text_presence_requires_resolution');
  }
  if (claimSignals.length) needs.push('claim_pixel_evidence_missing', 'sensitive_visible_text_second_review_missing');
  if (canonical.signals?.people === 'uncertain' || canonical.signals?.privacy === 'uncertain') needs.push('privacy_signal_requires_resolution');
  for (const [key, value] of Object.entries(canonical.signals ?? {})) {
    if (value === 'uncertain') needs.push(`canonical_signal_requires_resolution:${key}`);
  }
  if (!['observed', 'none_observed', 'uncertain'].includes(canonical.textPresence)) {
    throw new Error(`Unsupported canonical text presence: ${canonical.textPresence}`);
  }
  const textPresence = canonical.textPresence;
  const entry = {
    sha256: catalogEntry.sha256,
    sourceRefs: normalizeSourceRefs(catalogEntry.sourceRefs),
    verificationStatus: 'needs_escalation',
    observedSummary: canonical.observedSummary,
    contentType: canonical.contentType,
    useCases: uniqueStrings(canonical.practicalUses),
    searchTags: emptySearchTags(),
    textPresence,
    visibleText: textPresence === 'none_observed' ? [] : orderedUniqueStrings(canonical.visibleText),
    visibleTextObservations: [],
    ocrText: '',
    sourceContext: [],
    inferredText: [],
    claimSignals: uniqueStrings(claimSignals),
    claimEvidence: [],
    privacySignals: uniqueStrings(canonical.privacySignals),
    uncertainties: uniqueStrings(needs),
    reviewEvidence: {
      method: 'full_resolution_original_opened',
      originalPath,
      reviewer: adjudication.adjudicatorPrincipalId,
      reviewedAt: adjudication.adjudicatedAt,
    },
    staticTileCoverage: {
      manifestRef: tile.manifestRef,
      manifestSha256: tile.manifestSha256,
      coverageDigest: tile.coverageDigest,
    },
  };
  return { entry, needs: uniqueStrings(needs), sourceUncertainties: [] };
}

function gifDraftEntry(catalogEntry, originalPath, raw, playbackReceipt, queueEntry) {
  const needs = [
    'gif_semantic_fields_require_primary_structuring',
    'search_tags_review_missing',
    'gif_sample_frame_pixel_evidence_missing',
    'gif_visible_text_atomic_transcription_and_regions_missing',
    'secondary_semantic_verdict_receipt_missing',
  ];
  const signals = raw.screeningSignals ?? {};
  const claimSignals = [
    ...(signals.price ? ['price'] : []),
    ...(signals.eventOrPromotion ? ['event'] : []),
    ...(signals.serviceOrAsClaim ? ['after_sales_service'] : []),
    ...(signals.absoluteOrDurabilityClaim ? ['durability_or_absolute_claim'] : []),
  ];
  if (claimSignals.length) needs.push('claim_pixel_evidence_missing', 'sensitive_visible_text_second_review_missing');
  if (signals.privacyRelevant || signals.personDepicted) needs.push('privacy_signal_requires_primary_disposition');
  for (const signal of raw.signalUncertainties ?? []) needs.push(`gif_canonical_signal_requires_resolution:${signal}`);
  if ((raw.uncertainties ?? []).length) needs.push('gif_raw_semantic_uncertainties_require_resolution');
  if (resolve(originalPath) !== resolve(queueEntry.primaryOriginalPath)) needs.push('review_original_path_requires_rebinding');
  const entry = {
    sha256: catalogEntry.sha256,
    sourceRefs: normalizeSourceRefs(catalogEntry.sourceRefs),
    verificationStatus: 'needs_escalation',
    observedSummary: String(raw.rawObservation ?? '').trim(),
    contentType: 'animated_visual_pending_structuring',
    useCases: [],
    searchTags: emptySearchTags(),
    textPresence: String(raw.visibleTextTranscription ?? '').trim() ? 'observed' : 'none_observed',
    visibleText: String(raw.visibleTextTranscription ?? '').trim() ? [String(raw.visibleTextTranscription).trim()] : [],
    visibleTextObservations: [],
    ocrText: '',
    sourceContext: uniqueStrings([raw.sceneAndTransitions]),
    inferredText: [],
    claimSignals: uniqueStrings(claimSignals),
    claimEvidence: [],
    privacySignals: uniqueStrings([
      ...(signals.personDepicted ? ['person_depicted'] : []),
      ...(signals.privacyRelevant ? ['privacy_relevant'] : []),
    ]),
    uncertainties: uniqueStrings([...needs, ...(raw.uncertainties ?? [])]),
    reviewEvidence: {
      method: 'sampled_timeline_original_opened',
      originalPath,
      reviewer: raw.reviewHistory.sampledSemanticReview.reviewer,
      reviewedAt: raw.reviewHistory.sampledSemanticReview.reviewedAt,
    },
    reviewHistory: raw.reviewHistory,
  };
  return {
    entry,
    needs: uniqueStrings(needs),
    sourceUncertainties: uniqueStrings(raw.uncertainties),
    playbackReceipt: { path: playbackReceipt.path, sha256: playbackReceipt.sha256 },
  };
}

function summarizeEvidenceNeeds(values) {
  const occurrencesByKind = {};
  const uniqueByKind = new Map();
  let sourceSemanticUncertaintyCount = 0;
  const uniqueSourceSemanticUncertaintyAssets = new Set();
  for (const item of values) {
    for (const need of item.needs) {
      occurrencesByKind[need] = (occurrencesByKind[need] ?? 0) + 1;
      const shas = uniqueByKind.get(need) ?? new Set();
      shas.add(item.sourceObjectSha256);
      uniqueByKind.set(need, shas);
    }
    sourceSemanticUncertaintyCount += item.sourceUncertainties.length;
    if (item.sourceUncertainties.length) uniqueSourceSemanticUncertaintyAssets.add(item.sourceObjectSha256);
  }
  return {
    assetOccurrences: values.length,
    uniqueAssets: new Set(values.map((item) => item.sourceObjectSha256)).size,
    needOccurrences: Object.values(occurrencesByKind).reduce((sum, value) => sum + value, 0),
    sourceSemanticUncertaintyCount,
    uniqueSourceSemanticUncertaintyAssets: uniqueSourceSemanticUncertaintyAssets.size,
    byKind: Object.fromEntries(Object.keys(occurrencesByKind).sort().map((key) => [key, {
      occurrences: occurrencesByKind[key],
      uniqueAssets: uniqueByKind.get(key).size,
    }])),
  };
}

function summarizeDraftConversion(documents) {
  const entries = documents.flatMap((document) => document.entries.map((entry) => ({ ...entry, mediaKind: document.mediaKind })));
  const staticEntries = entries.filter((entry) => entry.mediaKind === 'static');
  const gifEntries = entries.filter((entry) => entry.mediaKind === 'gif');
  const staticUnique = [...new Map(staticEntries.map((entry) => [entry.sha256, entry])).values()];
  const gifUnique = [...new Map(gifEntries.map((entry) => [entry.sha256, entry])).values()];
  const staticTextPresence = { observed: 0, noneObserved: 0, uncertain: 0 };
  for (const entry of staticUnique) {
    if (entry.textPresence === 'observed') staticTextPresence.observed += 1;
    else if (entry.textPresence === 'none_observed') staticTextPresence.noneObserved += 1;
    else if (entry.textPresence === 'uncertain') staticTextPresence.uncertain += 1;
    else throw new Error(`Static draft text presence is invalid: ${entry.sha256}`);
  }
  const directThirdPartyUnique = new Set();
  for (const entry of gifEntries) {
    const history = entry.reviewHistory;
    if (entry.reviewEvidence.method !== 'sampled_timeline_original_opened'
      || entry.reviewEvidence.reviewer !== history?.sampledSemanticReview?.reviewer
      || history?.technicalPlayback?.authority !== 'technical_only_not_content_authority'
      || history?.sampledSemanticReview?.continuousNaturalSpeedVisualObservation !== false
      || history?.sampledSemanticReview?.everySourceFrameVisuallyInspected !== false
      || history?.adjudication?.authority !== 'signed_non_authority_candidate'
      || new Set([history.technicalPlayback.reviewer, history.sampledSemanticReview.reviewer, history.adjudication.reviewer]).size !== 3) {
      throw new Error(`GIF draft review provenance was collapsed or widened: ${entry.sha256}`);
    }
    if (history.adjudication.directThirdPartyReview.performed) directThirdPartyUnique.add(entry.sha256);
  }
  return {
    staticTextPresenceUniqueAssets: staticTextPresence,
    gifReviewProvenance: {
      occurrenceCount: gifEntries.length,
      uniqueAssetCount: gifUnique.length,
      technicalPlaybackMethod: 'continuous_original_playback',
      sampledSemanticMethod: 'chronological_original_frame_samples',
      adjudicationMethod: 'independent_field_adjudication',
      continuousSemanticObservationTrueCount: 0,
      everySourceFrameVisuallyInspectedTrueCount: 0,
      directThirdPartyReviewUniqueAssetCount: directThirdPartyUnique.size,
    },
  };
}

function originalForCatalogEntry(rawRoot, catalogEntry, queueEntry) {
  const refs = normalizeSourceRefs(catalogEntry.sourceRefs);
  const primaryRelative = refs.find((ref) => resolveContained(rawRoot, ref.sourceRelativePath, 'Catalog original') === resolve(queueEntry.primaryOriginalPath));
  const ref = primaryRelative ?? refs[0];
  const path = resolveContained(rawRoot, ref.sourceRelativePath, 'Catalog original');
  return path;
}

function assertQueue(value) {
  if (value?.schema !== 'munjanggun.assetVisualReviewQueue.v1' || value.version !== '1.0'
    || value.status !== 'review_queue_only_not_authority' || !Array.isArray(value.entries)
    || !Array.isArray(value.catalogs) || !Number.isInteger(value.counts?.staticCount)
    || !Number.isInteger(value.counts?.gifCount)) {
    throw new Error('Visual review queue shape is invalid');
  }
  uniqueMap(value.entries, (entry) => entry.sha256, 'Visual review queue');
}

async function readJsonFile(pathValue, label) {
  const path = requireAbsolutePath(pathValue, label);
  const real = await assertFile(path, label);
  const bytes = await readFile(real);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (error) { throw new Error(`${label} is not valid UTF-8 JSON: ${error.message}`); }
  return { path, real, bytes, sha256: digest(bytes), value };
}

async function assertFile(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file`);
  return realpath(path);
}

async function assertDirectory(path, label) {
  const info = await stat(path);
  if (!info.isDirectory()) throw new Error(`${label} must be a directory`);
}

async function assertMissing(path, label) {
  try { await lstat(path); throw new Error(`${label} already exists: ${path}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

async function prepareSafeOutputRoot(destination, repoRootValue) {
  await assertMissing(destination, 'Draft output root');
  const repoRoot = requireAbsolutePath(repoRootValue, 'Public repository root');
  const repoReal = await realpath(repoRoot);
  const parent = dirname(destination);
  const volumeRoot = parse(parent).root;
  const rel = relative(volumeRoot, parent);
  let current = volumeRoot;
  let currentReal = await realpath(volumeRoot);
  for (const component of rel.split(sep).filter(Boolean)) {
    current = resolve(current, component);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await mkdir(current);
      info = await lstat(current);
    }
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`Draft output parent chain contains a non-directory, symlink, or junction: ${current}`);
    }
    const actualReal = await realpath(current);
    const expectedReal = resolve(currentReal, component);
    if (actualReal !== expectedReal) throw new Error(`Draft output parent chain realpath changed or escaped: ${current}`);
    currentReal = actualReal;
    if (isContained(repoReal, currentReal)) throw new Error('Draft output parent resolves inside the public repository');
  }
  const destinationReal = resolve(currentReal, basename(destination));
  if (isContained(repoReal, destinationReal)) throw new Error('Draft output root resolves inside the public repository');
  return { parentReal: currentReal, destinationReal, repoReal };
}

async function assertCreatedDirectorySafe(path, expectedReal, repoReal, label) {
  const info = await lstat(path, { bigint: true });
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${label} became a symlink, junction, or non-directory`);
  const actualReal = await realpath(path);
  if (actualReal !== expectedReal || isContained(repoReal, actualReal)) {
    throw new Error(`${label} realpath changed or entered the public repository`);
  }
  return { dev: info.dev, ino: info.ino };
}

async function cleanupOwnedOutputPath(path, expectedReal, ownerToken, expectedIdentity) {
  try {
    const info = await lstat(path, { bigint: true });
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== expectedReal) return;
    if (!expectedIdentity || info.dev !== expectedIdentity.dev || info.ino !== expectedIdentity.ino) return;
    if (!await hasExactOutputOwnerMarker(path, ownerToken)) return;
    await rm(path, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function hasExactOutputOwnerMarker(root, ownerToken) {
  const marker = resolve(root, OUTPUT_OWNER_MARKER);
  try {
    const info = await lstat(marker);
    if (!info.isFile() || info.isSymbolicLink()) return false;
    return await readFile(marker, 'utf8') === ownerToken;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function requireOutputRoot(value, repoRoot) {
  const path = requireAbsolutePath(value, 'Draft output root');
  if (isContained(resolve(repoRoot), path)) throw new Error('Draft output root must be outside the public repository');
  return path;
}

function requireAbsolutePath(value, label) {
  if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) throw new Error(`${label} must be an absolute path`);
  return resolve(value);
}

function resolveContained(rootValue, refValue, label) {
  const root = requireAbsolutePath(rootValue, `${label} root`);
  if (typeof refValue !== 'string' || !refValue || isAbsolute(refValue) || refValue.includes('\0')) {
    throw new Error(`${label} reference must be relative`);
  }
  const parts = refValue.replaceAll('\\', '/').split('/');
  if (parts.some((part) => !part || part === '..')) throw new Error(`${label} reference contains path traversal`);
  const path = resolve(root, ...parts);
  if (!isContained(root, path) || path === root) throw new Error(`${label} reference escapes its root`);
  return path;
}

async function resolveContainedExistingFile(rootValue, refValue, label) {
  const root = requireAbsolutePath(rootValue, `${label} root`);
  const path = resolveContained(root, refValue, label);
  const rootReal = await realpath(root);
  const rel = relative(root, path);
  let current = root;
  for (const component of rel.split(sep).filter(Boolean)) {
    current = resolve(current, component);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error(`${label} contains a symlink or junction path component: ${current}`);
  }
  const actualReal = await realpath(path);
  if (!isContained(rootReal, actualReal)) throw new Error(`${label} escapes its root through a reparse point`);
  return actualReal;
}

function normalizeOrigins(values) {
  return [...(values ?? [])].map((value) => ({
    intakeId: String(value.intakeId),
    catalogSha256: String(value.catalogSha256),
    sourceId: String(value.sourceId),
    sourceRelativePath: String(value.sourceRelativePath),
    originalPath: resolve(String(value.originalPath)),
  })).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

function normalizeSourceRefs(values) {
  return [...(values ?? [])].map((value) => ({ sourceId: String(value.sourceId), sourceRelativePath: String(value.sourceRelativePath) }))
    .sort((left, right) => `${left.sourceId}\0${left.sourceRelativePath}`.localeCompare(`${right.sourceId}\0${right.sourceRelativePath}`));
}

function uniqueMap(values, keyOf, label) {
  const map = new Map();
  for (const value of values ?? []) {
    const key = keyOf(value);
    if (!key || map.has(key)) throw new Error(`${label} contains a missing or duplicate key: ${key}`);
    map.set(key, value);
  }
  return map;
}

function requireArray(value, label, minimum) {
  if (!Array.isArray(value) || value.length < minimum) throw new Error(`${label} must contain at least ${minimum} item(s)`);
}

function emptySearchTags() {
  return { productTypes: [], scenes: [], colors: [], designs: [], topics: [] };
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).map((value) => String(value ?? '').trim()).filter(Boolean))].sort();
}

function orderedUniqueStrings(values) {
  return [...new Set((values ?? []).map((value) => String(value ?? '').trim()).filter(Boolean))];
}

function maxDate(left, right) {
  return new Date(left).valueOf() >= new Date(right).valueOf() ? left : right;
}

function normalizeDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error(`${label} must be a date-time`);
  return date.toISOString();
}

function isContained(root, candidate) {
  const value = relative(root, candidate);
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
