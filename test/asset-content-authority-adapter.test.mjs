import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { buildRawReviewAuthorityDrafts } from '../scripts/lib/asset-content-authority-adapter.mjs';
import { computeStaticTileCoverageDigest } from '../scripts/lib/asset-content-revalidation.mjs';
import { runBuildContentAuthorityDrafts } from '../scripts/build-content-authority-drafts.mjs';
import { validateAgainstSchema } from '../scripts/lib/schema-validation.mjs';

test('adapter splits exact queue origins by intake, preserves shared SHA origins, and remains fail-closed', async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const result = await buildRawReviewAuthorityDrafts({
    ...fixture.options,
    checkOnly: true,
    validateStaticLedger: passingStaticValidator,
    validatePlaybackReceipt: () => true,
    validateGifAdjudicationCandidate: passingGifAdjudicationValidator,
  });

  assert.deepEqual(result.report.coverage, {
    queueUniqueAssets: 5,
    staticUniqueAssets: 2,
    gifUniqueAssets: 3,
    catalogEntries: 6,
    crossIntakeDuplicateAssets: 1,
    missingSemanticAssets: 0,
    duplicateSemanticAssets: 0,
  });
  assert.equal(result.report.authorityStatus, 'non_authority');
  assert.equal(result.report.promotionReadiness, 'needs_evidence');
  assert.deepEqual(result.report.conversionIntegrity.staticTextPresenceUniqueAssets, { observed: 1, noneObserved: 0, uncertain: 1 });
  assert.deepEqual(result.report.conversionIntegrity.gifReviewProvenance, {
    occurrenceCount: 4,
    uniqueAssetCount: 3,
    technicalPlaybackMethod: 'continuous_original_playback',
    sampledSemanticMethod: 'chronological_original_frame_samples',
    adjudicationMethod: 'independent_field_adjudication',
    continuousSemanticObservationTrueCount: 0,
    everySourceFrameVisuallyInspectedTrueCount: 0,
    directThirdPartyReviewUniqueAssetCount: 1,
  });
  assert.equal(result.report.sharedOrigins[0].sha256, fixture.shas.gifShared);
  assert.deepEqual(result.report.sharedOrigins[0].intakeIds, ['INTAKE-20260904-01', 'INTAKE-20260907-01']);
  assert.equal(result.documents.flatMap((document) => document.entries).length, 6);
  assert.deepEqual(result.documents.map((document) => [document.intakeId, document.mediaKind, document.entries.length]), [
    ['INTAKE-20260904-01', 'gif', 2],
    ['INTAKE-20260904-01', 'static', 1],
    ['INTAKE-20260907-01', 'gif', 2],
    ['INTAKE-20260907-01', 'static', 1],
  ]);
  for (const document of result.documents) {
    assert.equal(Object.hasOwn(document, 'signature'), false);
    for (const entry of document.entries) {
      assert.equal(entry.verificationStatus, 'needs_escalation');
      assert.equal(Object.hasOwn(entry, 'secondarySemanticVerdict'), false);
      assert.ok(entry.uncertainties.includes('secondary_semantic_verdict_receipt_missing'));
    }
  }
  const gifEntries = result.documents.filter((document) => document.mediaKind === 'gif').flatMap((document) => document.entries);
  assert.equal(gifEntries.every((entry) => entry.reviewEvidence.method === 'sampled_timeline_original_opened'), true);
  assert.equal(gifEntries.every((entry) => entry.reviewEvidence.reviewer === 'fresh_gif_p7'), true);
  assert.equal(gifEntries.every((entry) => entry.reviewHistory.technicalPlayback.reviewer === 'fresh_gif_p1'), true);
  assert.equal(gifEntries.every((entry) => entry.reviewHistory.sampledSemanticReview.continuousNaturalSpeedVisualObservation === false), true);
  assert.equal(gifEntries.every((entry) => entry.reviewHistory.sampledSemanticReview.everySourceFrameVisuallyInspected === false), true);
  assert.equal(gifEntries.every((entry) => entry.reviewHistory.adjudication.reviewer === 'fresh_gif_p5'), true);
  assert.equal(gifEntries.filter((entry) => entry.reviewHistory.adjudication.directThirdPartyReview.performed).length, 1);
  assert.equal(gifEntries.every((entry) => entry.reviewHistory.adjudication.fieldDecisionCount === 10), true);
  const uncertainStatic = result.documents.filter((document) => document.mediaKind === 'static')
    .flatMap((document) => document.entries).find((entry) => entry.textPresence === 'uncertain');
  assert.ok(uncertainStatic);
  assert.deepEqual(uncertainStatic.visibleText, []);
  assert.ok(uncertainStatic.uncertainties.includes('canonical_text_presence_requires_resolution'));
  const schema = await readJson(resolve(process.cwd(), 'schemas', 'asset-content-review-input.schema.json'));
  for (const document of result.documents) {
    const falselySigned = { ...document, signature: { algorithm: 'Ed25519', keyId: 'fixture', valueBase64: 'YWJjZA==' } };
    const schemaResult = validateAgainstSchema(falselySigned, schema);
    assert.equal(schemaResult.valid, false);
    assert.equal(schemaResult.errors.some((error) => /reviewHistory|reviewEvidence|textPresence/u.test(error.instancePath ?? '')), false, JSON.stringify(schemaResult.errors));
  }
});

test('adapter rejects a GIF draft when separate technical, sampled, and adjudication reviewers collapse', async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const collapsedValidator = async (options) => {
    const result = await passingGifAdjudicationValidator(options);
    const value = JSON.parse(result.validatedEvidence.adjudicationLedger.bytes);
    value.adjudications[0].evidenceSeparation.sampledSemanticVisualEvidence.reviewerPrincipalId = 'fresh_gif_p5';
    const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    const snapshot = { ...result.validatedEvidence.adjudicationLedger, bytes, sha256: sha(bytes) };
    return { ...result, adjudicationLedgerSha256: snapshot.sha256, validatedEvidence: { ...result.validatedEvidence, adjudicationLedger: snapshot } };
  };
  await assert.rejects(buildRawReviewAuthorityDrafts({
    ...fixture.options,
    checkOnly: true,
    validateStaticLedger: passingStaticValidator,
    validatePlaybackReceipt: () => true,
    validateGifAdjudicationCandidate: collapsedValidator,
  }), /review provenance was collapsed or widened/u);
});

test('adapter rejects a static segment when a higher sibling version exists', async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const first = fixture.options.staticSegments[0];
  const higher = resolve(dirname(dirname(first.ledgerIndexPath)), 'STATIC-0000-0000-v2');
  await mkdir(higher, { recursive: true });
  await assert.rejects(buildRawReviewAuthorityDrafts({
    ...fixture.options,
    checkOnly: true,
    validateStaticLedger: passingStaticValidator,
    validatePlaybackReceipt: () => true,
    validateGifAdjudicationCandidate: passingGifAdjudicationValidator,
  }), /superseded by a higher segment version/u);
});

test('adapter rejects direct or legacy GIF semantic inputs outside the P5 active pointer', async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const rejectedPath = fixture.paths.gifRejectedLedger;
  const directConfig = {
    schema: 'munjanggun.assetContentAuthorityDraftAdapterConfig.v1', version: '1.0',
    ...fixture.config, gifLedgerPath: rejectedPath, gifActiveCandidatePath: fixture.paths.gifLedger,
  };
  const directConfigPath = resolve(fixture.root, 'direct-rejected-config.json');
  await writeJson(directConfigPath, directConfig);
  await assert.rejects(runBuildContentAuthorityDrafts(['--config', directConfigPath, '--check-only'], {
    emit: () => {}, validateStaticLedger: passingStaticValidator, validatePlaybackReceipt: () => true,
    validateGifAdjudicationCandidate: passingGifAdjudicationValidator,
  }), /GIF semantics must be selected only through gifAdjudicationActiveCandidatePath/u);
});

test('adapter writes only unsigned non-authority drafts outside the repository', async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const outputRoot = resolve(fixture.root, 'private-output');
  await mkdir(resolve(fixture.root, 'public-repo'));
  const result = await buildRawReviewAuthorityDrafts({
    ...fixture.options,
    repoRoot: resolve(fixture.root, 'public-repo'),
    outputRoot,
    validateStaticLedger: passingStaticValidator,
    validatePlaybackReceipt: () => true,
    validateGifAdjudicationCandidate: passingGifAdjudicationValidator,
  });
  const report = await readJson(resolve(outputRoot, 'draft-set-report.json'));
  assert.equal(report.promotionReadiness, 'needs_evidence');
  assert.equal(report.documents.every((document) => document.signingAllowed === false), true);
  for (const file of result.report.documentFiles) {
    const draft = await readJson(file.path);
    assert.equal(Object.hasOwn(draft, 'signature'), false);
  }
});

test('adapter consumes static validator snapshots even if adjudication files change after validation', async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  let mutated = false;
  const snapshotThenMutate = async (options) => {
    const result = await passingStaticValidator(options);
    if (!mutated) {
      mutated = true;
      await writeFile(result.validatedEvidence.adjudications[0].path, '{"injected":true}\n', 'utf8');
    }
    return result;
  };
  const result = await buildRawReviewAuthorityDrafts({
    ...fixture.options,
    checkOnly: true,
    validateStaticLedger: snapshotThenMutate,
    validatePlaybackReceipt: () => true,
    validateGifAdjudicationCandidate: passingGifAdjudicationValidator,
  });
  assert.equal(result.report.coverage.staticUniqueAssets, 2);
  assert.equal(result.report.coverage.missingSemanticAssets, 0);
});

test('adapter rejects any mismatch between GIF validator result hashes and consumed byte snapshots', async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const mismatched = async (options) => ({
    ...await passingGifAdjudicationValidator(options),
    adjudicationLedgerSha256: 'f'.repeat(64),
  });
  await assert.rejects(buildRawReviewAuthorityDrafts({
    ...fixture.options,
    checkOnly: true,
    validateStaticLedger: passingStaticValidator,
    validatePlaybackReceipt: () => true,
    validateGifAdjudicationCandidate: mismatched,
  }), /snapshot paths or byte hashes differ/u);
});

test('adapter rejects an output parent junction into the public repository without writing drafts there', async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const repoRoot = resolve(fixture.root, 'public-repo');
  const bridge = resolve(fixture.root, 'private-looking-output');
  await mkdir(repoRoot);
  try { await symlink(repoRoot, bridge, 'junction'); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip(`junction creation unavailable: ${error.code}`); return; }
    throw error;
  }
  await assert.rejects(buildRawReviewAuthorityDrafts({
    ...fixture.options,
    repoRoot,
    outputRoot: resolve(bridge, 'drafts'),
    validateStaticLedger: passingStaticValidator,
    validatePlaybackReceipt: () => true,
    validateGifAdjudicationCandidate: passingGifAdjudicationValidator,
  }), /symlink, or junction|symlink or junction/u);
  assert.deepEqual(await readdir(repoRoot), []);
});

test('adapter preserves another writer destination when the exclusive rename loses a race', async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const repoRoot = resolve(fixture.root, 'public-repo');
  const outputRoot = resolve(fixture.root, 'private-race-output');
  const otherOwnerFile = resolve(outputRoot, 'OTHER_OWNER_FILE');
  await mkdir(repoRoot);
  await assert.rejects(buildRawReviewAuthorityDrafts({
    ...fixture.options,
    repoRoot,
    outputRoot,
    validateStaticLedger: passingStaticValidator,
    validatePlaybackReceipt: () => true,
    validateGifAdjudicationCandidate: passingGifAdjudicationValidator,
    beforeOutputCommit: async ({ destination }) => {
      assert.equal(destination, outputRoot);
      await mkdir(destination);
      await writeFile(otherOwnerFile, 'owned by another writer', { flag: 'wx' });
    },
  }), /EEXIST|EPERM|ENOTEMPTY/u);
  assert.equal(await readFile(otherOwnerFile, 'utf8'), 'owned by another writer');
  assert.deepEqual(await readdir(outputRoot), ['OTHER_OWNER_FILE']);
  assert.equal((await readdir(fixture.root)).some((name) => name.startsWith('private-race-output.partial-')), false);
});

test('partial cleanup requires the original directory identity even if an ownership marker is copied', async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const repoRoot = resolve(fixture.root, 'public-repo');
  const outputRoot = resolve(fixture.root, 'identity-race-output');
  await mkdir(repoRoot);
  let replacementPartial;
  await assert.rejects(buildRawReviewAuthorityDrafts({
    ...fixture.options,
    repoRoot,
    outputRoot,
    validateStaticLedger: passingStaticValidator,
    validatePlaybackReceipt: () => true,
    validateGifAdjudicationCandidate: passingGifAdjudicationValidator,
    beforeOutputCommit: async ({ partial }) => {
      const displaced = `${partial}.displaced-original`;
      const markerName = '.asset-content-authority-draft-owner';
      const marker = await readFile(resolve(partial, markerName));
      await rename(partial, displaced);
      await mkdir(partial);
      await writeFile(resolve(partial, markerName), marker);
      await writeFile(resolve(partial, 'OTHER_OWNER_FILE'), 'must survive cleanup');
      replacementPartial = partial;
      throw new Error('induced post-replacement failure');
    },
  }), /induced post-replacement failure/u);
  assert.equal(await readFile(resolve(replacementPartial, 'OTHER_OWNER_FILE'), 'utf8'), 'must survive cleanup');
});

async function createFixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'authority-adapter-'));
  const rawA = resolve(root, 'raw-a');
  const rawB = resolve(root, 'raw-b');
  const catalogDir = resolve(root, 'catalogs');
  const evidenceRoot = resolve(root, 'evidence');
  const gifRoot = resolve(root, 'gif-secondary');
  await Promise.all([rawA, rawB, catalogDir, evidenceRoot, gifRoot].map((path) => mkdir(path, { recursive: true })));
  const files = {
    staticA: await source(rawA, 'a/static-a.jpg', 'static-a'),
    staticB: await source(rawB, 'b/static-b.jpg', 'static-b'),
    gifA: await source(rawA, 'a/gif-a.gif', 'gif-a'),
    gifB: await source(rawB, 'b/gif-b.gif', 'gif-b'),
    gifSharedA: await source(rawA, 'a/shared.gif', 'gif-shared'),
    gifSharedB: await source(rawB, 'b/shared.gif', 'gif-shared'),
  };
  const refs = {
    staticA: origin('INTAKE-20260904-01', 'CAT-A', 'SRC-A', 'a/static-a.jpg', files.staticA.path),
    staticB: origin('INTAKE-20260907-01', 'CAT-B', 'SRC-B', 'b/static-b.jpg', files.staticB.path),
    gifA: origin('INTAKE-20260904-01', 'CAT-A', 'SRC-A', 'a/gif-a.gif', files.gifA.path),
    gifB: origin('INTAKE-20260907-01', 'CAT-B', 'SRC-B', 'b/gif-b.gif', files.gifB.path),
    gifSharedA: origin('INTAKE-20260904-01', 'CAT-A', 'SRC-A', 'a/shared.gif', files.gifSharedA.path),
    gifSharedB: origin('INTAKE-20260907-01', 'CAT-B', 'SRC-B', 'b/shared.gif', files.gifSharedB.path),
  };
  const catalogAPath = resolve(catalogDir, 'catalog-a.json');
  const catalogBPath = resolve(catalogDir, 'catalog-b.json');
  const catalogA = catalog('INTAKE-20260904-01', [
    catalogEntry(files.staticA, refs.staticA), catalogEntry(files.gifA, refs.gifA), catalogEntry(files.gifSharedA, refs.gifSharedA),
  ]);
  const catalogB = catalog('INTAKE-20260907-01', [
    catalogEntry(files.staticB, refs.staticB), catalogEntry(files.gifB, refs.gifB), catalogEntry(files.gifSharedB, refs.gifSharedB),
  ]);
  const catalogASha = await writeJson(catalogAPath, catalogA);
  const catalogBSha = await writeJson(catalogBPath, catalogB);
  for (const key of ['staticA', 'gifA', 'gifSharedA']) refs[key].catalogSha256 = catalogASha;
  for (const key of ['staticB', 'gifB', 'gifSharedB']) refs[key].catalogSha256 = catalogBSha;
  catalogA.entries.forEach((entry, index) => { entry.sourceRefs = [sourceRef([refs.staticA, refs.gifA, refs.gifSharedA][index])]; });
  catalogB.entries.forEach((entry, index) => { entry.sourceRefs = [sourceRef([refs.staticB, refs.gifB, refs.gifSharedB][index])]; });
  await writeJson(catalogAPath, catalogA, { overwrite: true });
  await writeJson(catalogBPath, catalogB, { overwrite: true });
  const finalCatalogASha = sha(await readFile(catalogAPath));
  const finalCatalogBSha = sha(await readFile(catalogBPath));
  for (const key of ['staticA', 'gifA', 'gifSharedA']) refs[key].catalogSha256 = finalCatalogASha;
  for (const key of ['staticB', 'gifB', 'gifSharedB']) refs[key].catalogSha256 = finalCatalogBSha;

  const entries = [
    queueEntry(files.staticA, 'static', [refs.staticA]),
    queueEntry(files.staticB, 'static', [refs.staticB]),
    queueEntry(files.gifA, 'gif', [refs.gifA]),
    queueEntry(files.gifB, 'gif', [refs.gifB]),
    queueEntry(files.gifSharedA, 'gif', [refs.gifSharedA, refs.gifSharedB]),
  ];
  const queuePath = resolve(root, 'review-queue.json');
  const queue = {
    schema: 'munjanggun.assetVisualReviewQueue.v1', version: '1.0', status: 'review_queue_only_not_authority',
    catalogs: [
      { intakeId: 'INTAKE-20260904-01', catalogPath: catalogAPath, catalogSha256: finalCatalogASha, rawRoot: rawA, entryCount: 3 },
      { intakeId: 'INTAKE-20260907-01', catalogPath: catalogBPath, catalogSha256: finalCatalogBSha, rawRoot: rawB, entryCount: 3 },
    ],
    counts: { staticCount: 2, gifCount: 3 },
    entrySetSha256: sha(Buffer.from(JSON.stringify(entries), 'utf8')),
    entries,
  };
  const queueSha256 = await writeJson(queuePath, queue);

  const staticSegments = [];
  for (let index = 0; index < 2; index += 1) {
    const segmentRoot = resolve(root, 'segments', `STATIC-${String(index).padStart(4, '0')}-${String(index).padStart(4, '0')}-v1`);
    const adjudicationRoot = resolve(segmentRoot, 'adjudications');
    await mkdir(adjudicationRoot, { recursive: true });
    const ledgerIndexPath = resolve(segmentRoot, 'LEDGER_INDEX.json');
    await writeJson(ledgerIndexPath, {
      schema: 'munjanggun.assetContentRawReviewLedgerIndex.v1', version: '1.0', authorityStatus: 'non_authority', libraryStatus: 'blocked',
      queueRef: queuePath, queueSha256, freshReview: { adjudicatedCount: 1 },
    });
    await writeJson(resolve(adjudicationRoot, `adjudication-${index}.json`), adjudication(index, entries[index], queuePath, queueSha256));
    const reviewerTrustPath = resolve(segmentRoot, 'reviewer-trust.json');
    await writeJson(reviewerTrustPath, { schema: 'munjanggun.assetContentReviewerTrust.v1', version: '1.0', keys: [] });
    staticSegments.push({ ledgerIndexPath, reviewerTrustPath });
  }

  const evidenceEntries = [];
  for (const item of [files.staticA, files.staticB]) {
    const manifest = {
      sourceObjectSha256: item.sha256, sourceWidth: 1, sourceHeight: 1, sourcePixelSha256: 'a'.repeat(64),
      decoderVersion: 'fixture', encoderVersion: 'fixture', coverageMode: 'fixture', tiles: [],
    };
    manifest.coverageDigest = computeStaticTileCoverageDigest(manifest);
    const manifestRef = resolve(evidenceRoot, item.sha256, 'manifest.json');
    const manifestSha256 = await writeJson(manifestRef, manifest);
    evidenceEntries.push({ sourceObjectSha256: item.sha256, manifestRef, manifestSha256, coverageDigest: manifest.coverageDigest });
  }
  const staticEvidenceIndexPath = resolve(evidenceRoot, 'index.json');
  await writeJson(staticEvidenceIndexPath, {
    queuePath, queueSha256, selectedCount: 2, sourceVerificationPerformed: true, outputWritten: true, entries: evidenceEntries,
  });

  const gifQueue = entries.filter((entry) => entry.reviewMediaKind === 'gif');
  const gifEntries = [];
  let physicalReceiptCount = 0;
  for (let index = 0; index < gifQueue.length; index += 1) {
    const entry = gifQueue[index];
    const receipt = playbackReceipt(entry, queueSha256);
    const receiptRefs = [];
    for (const intakeId of [...new Set(entry.origins.map((item) => item.intakeId))]) {
      const relativePath = `${intakeId}/gif-playback-observations/${entry.sha256}.json`;
      const receiptSha256 = await writeJson(resolve(gifRoot, relativePath), receipt);
      receiptRefs.push({ path: relativePath, sha256: receiptSha256 });
      physicalReceiptCount += 1;
    }
    gifEntries.push({
      gifProjectionIndex: index, sourceObjectSha256: entry.sha256, byteSize: entry.byteSize, mediaType: 'image/gif',
      primaryOriginalPath: entry.primaryOriginalPath, origins: entry.origins, decodedFrameCount: 1, decodedDurationMs: 100,
      decodedLoopCount: 0, reviewerPrincipalId: 'fresh_gif_p1', reviewRole: 'fresh_secondary', priorSemanticResultsConsulted: false,
      playbackEvidence: {
        method: 'continuous_original_playback', observedFromMs: 0, observedToMs: 100,
        completedAt: receipt.reviewedAt, receiptSha256: receiptRefs[0].sha256, receiptRefs,
      },
      rawObservation: `gif observation ${index}`, sceneAndTransitions: `gif scene ${index}`,
      visibleTextTranscription: `GIF TEXT ${index}`,
      screeningSignals: { price: index === 0, eventOrPromotion: false, serviceOrAsClaim: false, personDepicted: false, privacyRelevant: false, absoluteOrDurabilityClaim: false },
      uncertainties: [],
    });
  }
  const gifLedger = {
    schema: 'munjanggun.gifSecondarySemanticRawLedger.v1', version: '1.0', status: 'unsigned_draft_active_candidate_not_authority',
    reviewerPrincipalId: 'fresh_gif_p1', reviewRole: 'fresh_secondary', priorSemanticResultsConsulted: false,
    queue: { path: queuePath, sha256: queueSha256, gifProjectionCount: 3 }, completedAt: '2026-09-09T01:00:00.000Z', entries: gifEntries,
  };
  const rejectedGifLedgerPath = resolve(gifRoot, 'gif-secondary-semantic-raw-ledger-v1-R2.json');
  const rejectedGifLedgerSha256 = await writeJson(rejectedGifLedgerPath, { ...gifLedger, status: 'unsigned_draft_not_authority' });
  const gifLedgerPath = resolve(gifRoot, 'gif-secondary-semantic-raw-ledger-v1-R3.json');
  const gifLedgerSha256 = await writeJson(gifLedgerPath, gifLedger);
  const correctionChain = [
    { path: 'gif-secondary-semantic-raw-ledger-v1-R2.json', sha256: rejectedGifLedgerSha256, status: 'rejected_superseded' },
    { path: 'gif-secondary-semantic-raw-ledger-v1-R3.json', sha256: gifLedgerSha256, status: 'unsigned_active_candidate_not_authority' },
  ];
  await writeJson(resolve(gifRoot, 'gif-secondary-semantic-raw-ledger-v1-R2.rejection.json'), {
    schema: 'munjanggun.reviewDraftRejectionReceipt.v1', version: '1.0',
    rejectedPath: rejectedGifLedgerPath, rejectedSha256: rejectedGifLedgerSha256,
    replacementPath: gifLedgerPath, replacementSha256: gifLedgerSha256,
  });
  const screeningTotals = { price: 1, eventOrPromotion: 0, serviceOrAsClaim: 0, personDepicted: 0, privacyRelevant: 0, absoluteOrDurabilityClaim: 0 };
  const gifActiveCandidatePath = resolve(gifRoot, 'gif-secondary-active-candidate-v1.json');
  const activeSha256 = await writeJson(gifActiveCandidatePath, {
    schema: 'munjanggun.gifSecondaryActiveCandidate.v1', version: '1.0', status: 'unsigned_candidate_not_authority',
    activeCandidate: { path: 'gif-secondary-semantic-raw-ledger-v1-R3.json', sha256: gifLedgerSha256 },
    verification: { path: 'gif-secondary-verification-v1-R3.json' }, correctionChain, expectedScreeningTotals: screeningTotals,
  });
  const gifVerificationPath = resolve(gifRoot, 'gif-secondary-verification-v1-R3.json');
  await writeJson(gifVerificationPath, {
    schema: 'munjanggun.gifSecondaryReviewVerification.v1', version: '1.0', status: 'pass',
    activeCandidate: { path: 'gif-secondary-active-candidate-v1.json', sha256: activeSha256, ledgerPath: 'gif-secondary-semantic-raw-ledger-v1-R3.json', ledgerSha256: gifLedgerSha256 },
    correctionChain, coverage: { expected: 3, actual: 3, missing: 0, uniqueSourceSha256: 3 },
    screeningTotals,
    receiptBinding: { expectedPhysicalRefs: physicalReceiptCount, actualPhysicalRefs: physicalReceiptCount, failureCount: 0 },
    sourceObjects: { verified: 3, hashOrSizeMismatchCount: 0 },
    bindings: { projectionFailureCount: 0, chronologyFailureCount: 0, semanticBindingFailureCount: 0 },
    priorSemanticResultsConsulted: false,
  });
  const p5Root = resolve(root, 'gif-adjudication-p5');
  const p5PairPath = resolve(p5Root, 'PAIR-INDEX.json');
  const p5LedgerPath = resolve(p5Root, 'adjudication-ledger-signed-v1.json');
  const p5VerificationPath = resolve(p5Root, 'verification-receipt-signed-v1.json');
  const p5PointerVerificationPath = resolve(p5Root, 'gif-adjudication-active-candidate-verification-v1.json');
  const p5ActivePath = resolve(p5Root, 'gif-adjudication-active-candidate-v1.json');
  await writeJson(p5PairPath, {
    pairs: gifEntries.map((entry) => ({
      gifProjectionIndex: entry.gifProjectionIndex,
      byteSize: entry.byteSize,
      decodedFrameCount: entry.decodedFrameCount,
      decodedDurationMs: entry.decodedDurationMs,
    })),
  });
  await writeJson(p5LedgerPath, {
    reviewer: { principalId: 'fresh_gif_p5' }, chronology: { completedAt: '2026-09-09T02:00:00.000Z' },
    adjudications: gifEntries.map((entry) => ({
      pairIndex: entry.gifProjectionIndex,
      sourceObjectSha256: entry.sourceObjectSha256,
      sourcePath: entry.primaryOriginalPath,
      evidenceSeparation: {
        technicalFullPlayback: {
          authority: 'technical_only_not_content_authority', reviewerPrincipalId: 'fresh_gif_p1',
          receiptRefs: entry.playbackEvidence.receiptRefs, observedFromMs: 0,
          observedToMs: entry.decodedDurationMs, decodedDurationMs: entry.decodedDurationMs,
        },
        sampledSemanticVisualEvidence: {
          reviewerPrincipalId: 'fresh_gif_p7',
          overview: { path: resolve(p5Root, `overview-${entry.gifProjectionIndex}.jpg`), sha256: entry.sourceObjectSha256, selectedFrames: [0] },
          supplementalOriginalPixelFrames: [],
          continuousNaturalSpeedVisualObservation: false,
          everySourceFrameVisuallyInspected: false,
        },
      },
      canonicalObservation: {
        sceneAndTransitions: entry.sceneAndTransitions,
        visibleText: { readings: [entry.visibleTextTranscription] },
        signals: Object.fromEntries(Object.entries(entry.screeningSignals).map(([key, value]) => [key, { state: value ? 'observed_signal' : 'not_observed' }])),
        uncertainties: entry.uncertainties,
      },
      fieldDecisions: Array.from({ length: 10 }, (_, decisionIndex) => ({ field: `/fixture/${decisionIndex}` })),
      directThirdPartyReview: entry.gifProjectionIndex === 0
        ? { performed: true, reviewerPrincipalId: 'fresh_gif_p5', evidenceOpened: ['original_gif'], finding: 'fixture direct review' }
        : { performed: false, reason: 'fixture sources agreed' },
    })),
  });
  await writeJson(p5VerificationPath, { status: 'pass' });
  await writeJson(p5PointerVerificationPath, { status: 'pass' });
  await writeJson(p5ActivePath, {
    selection: { pairIndex: { path: p5PairPath }, adjudicationLedger: { path: p5LedgerPath }, verificationReceipt: { path: p5VerificationPath } },
  });
  const config = {
    queuePath, staticSegments, staticEvidenceIndexPath, gifAdjudicationActiveCandidatePath: p5ActivePath,
    catalogs: [{ catalogPath: catalogAPath, rawRoot: rawA }, { catalogPath: catalogBPath, rawRoot: rawB }],
  };
  return {
    root,
    options: config,
    config,
    shas: { gifShared: files.gifSharedA.sha256 },
    paths: {
      gifRoot, gifLedger: gifLedgerPath, gifRejectedLedger: rejectedGifLedgerPath, gifVerification: gifVerificationPath,
      p5ActivePath, p5PointerVerificationPath, p5PairPath, p5LedgerPath, p5VerificationPath, queuePath,
    },
  };
}

async function passingStaticValidator({ ledgerIndexPath }) {
  const ledgerBytes = await readFile(ledgerIndexPath);
  const ledger = JSON.parse(ledgerBytes);
  const queueBytes = await readFile(ledger.queueRef);
  const adjudicationRoot = resolve(dirname(ledgerIndexPath), 'adjudications');
  const adjudications = await Promise.all((await readdir(adjudicationRoot)).sort().map(async (name) => {
    const path = resolve(adjudicationRoot, name);
    const bytes = await readFile(path);
    return { path, sha256: sha(bytes), bytes };
  }));
  return {
    result: 'passed', mode: 'pilot-complete', pilotStatus: 'complete_non_authority', promotionEligible: false,
    adjudicatedPairCount: adjudications.length,
    validatedEvidence: {
      ledger: { path: resolve(ledgerIndexPath), sha256: sha(ledgerBytes), bytes: ledgerBytes },
      queue: { path: resolve(ledger.queueRef), sha256: sha(queueBytes), bytes: queueBytes },
      adjudications,
    },
  };
}

async function passingGifAdjudicationValidator({ activeCandidatePath }) {
  const active = await snapshotFile(activeCandidatePath);
  const pointer = JSON.parse(active.bytes);
  const pairIndex = await snapshotFile(pointer.selection.pairIndex.path);
  const adjudicationLedger = await snapshotFile(pointer.selection.adjudicationLedger.path);
  const verificationReceipt = await snapshotFile(pointer.selection.verificationReceipt.path);
  const root = dirname(activeCandidatePath);
  const pointerVerification = await snapshotFile(resolve(root, 'gif-adjudication-active-candidate-verification-v1.json'));
  const fixtureRoot = dirname(root);
  const r4Root = resolve(fixtureRoot, 'gif-secondary');
  const r4ActiveCandidate = await snapshotFile(resolve(r4Root, 'gif-secondary-active-candidate-v1.json'));
  const r4Pointer = JSON.parse(r4ActiveCandidate.bytes);
  const r4Ledger = await snapshotFile(resolve(r4Root, r4Pointer.activeCandidate.path));
  const r4Verification = await snapshotFile(resolve(r4Root, r4Pointer.verification.path));
  const queue = await snapshotFile(resolve(fixtureRoot, 'review-queue.json'));
  const p5Ledger = JSON.parse(adjudicationLedger.bytes);
  const p7Bytes = Buffer.from(`${JSON.stringify({
    schema: 'p7-unsigned-raw-gif-semantic-ledger-v1',
    createdAt: '2026-09-09T01:30:00.000Z',
    reviewerPrincipal: 'fresh_gif_p7',
    records: p5Ledger.adjudications.map((item) => ({
      index: item.pairIndex + 1,
      sourceObjectSha256: item.sourceObjectSha256,
      observationMethod: {
        type: 'chronological_original_frame_samples',
        sourceRangeFromMs: 0,
        sourceRangeToMs: 100,
        visuallyReadFrameIndices: [0],
        supplementalOriginalPixelFrames: [],
      },
    })),
  }, null, 2)}\n`, 'utf8');
  const p7Ledger = { path: resolve(fixtureRoot, 'p7-ledger.json'), sha256: sha(p7Bytes), bytes: p7Bytes };
  return {
    status: 'pass', authorityStatus: 'signed_non_authority_candidate', libraryStatus: 'blocked',
    activeCandidatePath: active.path, activeCandidateSha256: active.sha256,
    pointerVerificationPath: pointerVerification.path, pointerVerificationSha256: pointerVerification.sha256,
    pairIndexPath: pairIndex.path, pairIndexSha256: pairIndex.sha256,
    adjudicationLedgerPath: adjudicationLedger.path, adjudicationLedgerSha256: adjudicationLedger.sha256,
    verificationReceiptPath: verificationReceipt.path, verificationReceiptSha256: verificationReceipt.sha256,
    reviewerTrustPath: active.path, reviewerTrustSha256: active.sha256,
    r4LedgerSha256: r4Ledger.sha256, r4VerificationSha256: r4Verification.sha256,
    p7LedgerSha256: p7Ledger.sha256,
    validatedEvidence: { activeCandidate: active, pointerVerification, pairIndex, adjudicationLedger, verificationReceipt, reviewerTrust: active, queue, r4ActiveCandidate, r4Ledger, r4Verification, p7Ledger },
  };
}

async function snapshotFile(path) {
  const bytes = await readFile(path);
  return { path: resolve(path), sha256: sha(bytes), bytes };
}

function catalog(intakeId, entries) {
  return { schema: 'fixture.catalog', intakeId, binaryGroupCount: entries.length, entries };
}

function catalogEntry(file, originValue) {
  return { sha256: file.sha256, byteSize: file.byteSize, mediaType: file.path.endsWith('.gif') ? 'image/gif' : 'image/jpeg', objectRef: file.sha256, sourceRefs: [sourceRef(originValue)] };
}

function sourceRef(value) { return { sourceId: value.sourceId, sourceRelativePath: value.sourceRelativePath }; }

function origin(intakeId, catalogSha256, sourceId, sourceRelativePath, originalPath) {
  return { intakeId, catalogSha256, sourceId, sourceRelativePath, originalPath };
}

function queueEntry(file, reviewMediaKind, origins) {
  return {
    sha256: file.sha256, mediaType: reviewMediaKind === 'gif' ? 'image/gif' : 'image/jpeg', byteSize: file.byteSize,
    origins, reviewMediaKind, primaryOriginalPath: origins[0].originalPath,
    intakeIds: [...new Set(origins.map((item) => item.intakeId))],
  };
}

function adjudication(queueIndex, entry, queueRef, queueSha256) {
  const uncertainText = queueIndex === 1;
  return {
    schema: 'munjanggun.assetContentReviewAdjudication.v2', version: '2.0', authorityStatus: 'non_authority', result: 'resolved',
    queueIndex, sourceObjectSha256: entry.sha256, queueRef, queueSha256, unresolvedUncertainties: [],
    canonicalObservation: {
      observationMethod: 'view_image_original', openResult: 'opened_successfully', rawObservationText: `static ${queueIndex}`,
      observedSummary: `static summary ${queueIndex}`, contentType: 'fixture_static', textPresence: uncertainText ? 'uncertain' : 'observed',
      visibleText: uncertainText ? [] : [`STATIC ${queueIndex}`], visibleTextLocations: uncertainText ? [] : [{ text: `STATIC ${queueIndex}`, region: 'fixture', certainty: 'certain' }],
      practicalUses: ['fixture'],
      signals: { price: queueIndex === 0 ? 'observed' : 'none_observed', event: 'none_observed', afterService: 'none_observed', spec: 'none_observed', review: 'none_observed', schedule: 'none_observed', people: 'none_observed', privacy: 'none_observed' },
      privacySignals: [],
    },
    adjudicatorPrincipalId: `static-reviewer-${queueIndex}`, adjudicatedAt: `2026-09-09T00:0${queueIndex}:00.000Z`,
    signature: { algorithm: 'Ed25519', keyId: `key-${queueIndex}`, valueBase64: 'YWJjZA==' },
  };
}

function playbackReceipt(entry, queueSha256) {
  return {
    schema: 'munjanggun.gifPlaybackObservation.v1', version: '1.0', observed: true, sourceObjectSha256: entry.sha256,
    method: 'continuous_original_playback',
    reviewer: 'fresh_gif_p1', queueSha256, decodedFrameCount: 1, decodedDurationMs: 100, decodedLoopCount: 0,
    reviewedAt: '2026-09-09T00:30:00.000Z',
  };
}

async function source(root, relativePath, content) {
  const path = resolve(root, ...relativePath.split('/'));
  await mkdir(dirname(path), { recursive: true });
  const bytes = Buffer.from(content, 'utf8');
  await writeFile(path, bytes);
  return { path, sha256: sha(bytes), byteSize: bytes.length };
}

async function writeJson(path, value, { overwrite = false } = {}) {
  await mkdir(dirname(path), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await writeFile(path, bytes, overwrite ? undefined : { flag: 'wx' });
  return sha(bytes);
}

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
