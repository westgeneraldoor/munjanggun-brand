import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  loadInternalAssetLibrary, searchInternalAssetLibrary, writeInternalAssetHandoff,
} from '../scripts/lib/asset-internal-library.mjs';
import { contentReviewerKeyFingerprint } from '../scripts/lib/asset-content-reviewer-trust.mjs';
import { stableJson } from '../scripts/lib/asset-owner-trust.mjs';

test('primary-reviewed internal mode searches across all records and keeps publication blocked', async () => {
  const fixture = await makeFixture();
  try {
    const library = await loadFixture(fixture);
    const results = searchInternalAssetLibrary(library, { product: '3연동 중문', color: '베이지' }, { limit: 1 });
    assert.equal(library.records.length, 3);
    assert.equal(results.length, 1);
    assert.equal(results[0].sha256, fixture.hashes[2]);
    assert.equal(results[0].usageStatus.internalSearchPreview.status, 'usable');
    assert.equal(results[0].usageStatus.externalPublication.status, 'blocked_selected_asset_review_required');
    assert.equal(results[0].usageStatus.publicGit.status, 'blocked');
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('internal mode rejects a candidate changed after the active pointer was sealed', async () => {
  const fixture = await makeFixture();
  try {
    await writeFile(fixture.candidatePath, `${await readFile(fixture.candidatePath, 'utf8')} `);
    await assert.rejects(loadFixture(fixture), /primaryCandidate SHA-256 mismatch/u);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('internal mode rejects an original whose bytes no longer match the reviewed SHA', async () => {
  const fixture = await makeFixture();
  try {
    await writeFile(fixture.originalPaths[0], 'tampered');
    await assert.rejects(loadFixture(fixture), /Original .* SHA-256 mismatch/u);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('internal handoff writes metadata and preview only for a registered consumer', async () => {
  const fixture = await makeFixture();
  try {
    const library = await loadFixture(fixture);
    const results = searchInternalAssetLibrary(library, { query: '현관' }, { limit: 20 });
    const output = await writeInternalAssetHandoff(library, results, [fixture.hashes[0]], {
      consumerId: 'fixture-blog', outputName: 'selection-001', repoRoot: fixture.repoRoot,
      verifyConsumerDestination: async () => {}, generatedAt: '2026-09-10T00:00:00.000Z',
    });
    assert.equal(output.containsBinaryCopies, false);
    assert.deepEqual((await readdir(output.outputRoot)).sort(), ['asset-handoff.json', 'preview.html']);
    const handoff = JSON.parse(await readFile(output.handoffPath, 'utf8'));
    assert.equal(handoff.authorityStatus, 'non_authority');
    assert.equal(handoff.usageNotice.externalPublication, 'blocked_selected_asset_review_required');
    assert.equal(handoff.selected[0].sha256, fixture.hashes[0]);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

async function loadFixture(fixture) {
  return loadInternalAssetLibrary(fixture.configPath, {
    repoRoot: fixture.repoRoot,
    trustedPrivateRoots: [fixture.privateRoot],
    consumerPolicy: [{
      consumerId: 'fixture-blog', channel: 'blog', privateRoot: fixture.outputRoot, requireGitIgnored: true,
    }],
    verifyCommittedConfig: async () => {},
    verifyCommittedConsumers: async () => {},
  });
}

async function makeFixture() {
  const root = join(tmpdir(), `mg-internal-library-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const repoRoot = join(root, 'repo');
  const privateRoot = join(root, 'private');
  const outputRoot = join(root, 'consumer-private');
  await Promise.all([mkdir(repoRoot, { recursive: true }), mkdir(privateRoot, { recursive: true }), mkdir(outputRoot, { recursive: true })]);
  const originalPaths = [];
  const hashes = [];
  const specs = [
    { body: 'swing-white', product: '스윙중문', color: '화이트', path: '스윙중문/001.jpg', claim: [], privacy: [] },
    { body: 'three-black', product: '3연동중문', color: '블랙', path: '3연동중문/002.jpg', claim: ['price'], privacy: [] },
    { body: 'three-beige', product: '3연동중문', color: '베이지', path: '3연동중문/003.jpg', claim: [], privacy: ['person'] },
  ];
  const records = [];
  for (const [index, spec] of specs.entries()) {
    const originalPath = join(privateRoot, `${index}.jpg`);
    await writeFile(originalPath, spec.body);
    const hash = digest(spec.body);
    originalPaths.push(originalPath);
    hashes.push(hash);
    records.push({
      sourceObjectSha256: hash,
      mediaKind: 'static',
      originalPath,
      sourceRefs: [{ sourceId: 'SRC-FIXTURE', sourceRelativePath: spec.path }],
      observedSummary: `${spec.product} ${spec.color} 현관 제품 사진`,
      contentType: 'product_photo',
      useCases: ['내부 콘텐츠 기획'],
      proposedSearchTags: {
        productTypes: [spec.product], scenes: ['현관'], colors: [spec.color], designs: [], topics: ['제품'],
      },
      acceptedObservations: [], unresolvedObservations: [], claimSignals: spec.claim, privacySignals: spec.privacy,
      releaseConstraints: [],
    });
  }
  const candidate = {
    schema: 'munjanggun.assetPrimaryContentStructuringCandidate.v2', version: '2.0', authorityStatus: 'non_authority',
    promotionEligible: false, coverage: { uniqueAssetCount: records.length, unresolvedObservationCount: 0 }, records,
  };
  const candidatePath = join(privateRoot, 'candidate.json');
  const candidateBytes = await writeJson(candidatePath, candidate);
  const candidateSha = digest(candidateBytes);
  const evidence = {
    schema: 'fixture', promotionEligible: false, sourceCandidate: { sha256: candidateSha },
    coverage: { assetCount: records.length, staticUniqueCropCount: records.length, gifUniqueFrameCount: 0 },
  };
  const receipt = { schema: 'fixture-receipt' };
  const ledger = { schema: 'fixture-ledger' };
  const evidencePath = join(privateRoot, 'evidence.json');
  const receiptPath = join(privateRoot, 'receipt.json');
  const ledgerPath = join(privateRoot, 'ledger.json');
  const evidenceBytes = await writeJson(evidencePath, evidence);
  const receiptBytes = await writeJson(receiptPath, receipt);
  const ledgerBytes = await writeJson(ledgerPath, ledger);

  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const fingerprint = contentReviewerKeyFingerprint(publicKeyPem);
  const trust = {
    schema: 'munjanggun.assetContentReviewerTrust.v1', version: '1.0', keys: [{
      principalId: 'fixture-reviewer', keyId: 'fixture-reviewer-v1', status: 'active', publicKeyPem, fingerprint,
    }],
  };
  const trustPath = join(privateRoot, 'trust.json');
  const trustBytes = await writeJson(trustPath, trust);
  const attestationPayload = {
    schema: 'munjanggun.assetContentReviewRawBatchAttestation.v1', version: '1.0',
    reviewerPrincipalId: 'fixture-reviewer', rawTranscriptSha256: candidateSha,
  };
  const attestation = {
    ...attestationPayload,
    signature: {
      algorithm: 'Ed25519', keyId: 'fixture-reviewer-v1',
      valueBase64: sign(null, Buffer.from(stableJson(attestationPayload), 'utf8'), privateKey).toString('base64'),
    },
  };
  const attestationPath = join(privateRoot, 'attestation.json');
  const attestationBytes = await writeJson(attestationPath, attestation);
  const pointer = {
    schema: 'munjanggun.assetPrimaryReviewActivePointer.v1', version: '1.0',
    authorityStatus: 'non_authority_primary_attested_pixel_evidence_verified_secondary_pending', promotionEligible: false,
    directReviewReceipt: ref(receiptPath, receiptBytes), structuredLedger: ref(ledgerPath, ledgerBytes),
    primaryCandidate: ref(candidatePath, candidateBytes), pixelEvidenceIndex: { ...ref(evidencePath, evidenceBytes), verifiedEvidenceFileCount: records.length },
    primaryAttestation: { ...ref(attestationPath, attestationBytes), reviewerPrincipalId: 'fixture-reviewer', keyFingerprint: fingerprint },
    coverage: { assetCount: records.length, verifiedEvidenceFileCount: records.length },
    remainingAuthorityNeeds: [
      'independent_secondary_semantic_verdict_for_489_assets_bound_to_final_primary_decisions',
      'continuous_original_playback_or_all_decoded_frames_review_for_80_gifs',
    ],
  };
  const pointerPath = join(privateRoot, 'pointer.json');
  const pointerBytes = await writeJson(pointerPath, pointer);
  const config = {
    schema: 'munjanggun.assetInternalLibraryConfig.v1', version: '1.0', libraryId: 'fixture-library',
    mode: 'primary_reviewed_internal_only', activePointerPath: pointerPath, activePointerSha256: digest(pointerBytes),
    reviewerTrustPath: trustPath, reviewerTrustSha256: digest(trustBytes),
    externalPublicationPolicy: 'selected_asset_review_required', publicGitStorage: false,
  };
  const configPath = join(repoRoot, 'config.json');
  await writeJson(configPath, config);
  return { root, repoRoot, privateRoot, outputRoot, configPath, candidatePath, originalPaths, hashes };
}

async function writeJson(path, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await writeFile(path, bytes);
  return bytes;
}

function ref(path, bytes) {
  return { path, sha256: digest(bytes) };
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}
