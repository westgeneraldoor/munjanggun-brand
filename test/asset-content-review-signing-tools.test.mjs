import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { runBuildContentReviewerTrust } from '../scripts/build-content-reviewer-trust.mjs';
import { runCreateContentReviewerKey } from '../scripts/create-content-reviewer-key.mjs';
import { runSignContentReviewDocument } from '../scripts/sign-content-review-document.mjs';
import {
  contentReviewerKeyFingerprint,
  parseContentReviewerTrust,
  verifyTrustedContentReviewerSignature,
} from '../scripts/lib/asset-content-reviewer-trust.mjs';

test('reviewer key CLI creates a private Ed25519 key pair without exposing private bytes and refuses overwrite', async (t) => {
  const fixture = await makeFixture(t);
  const emitted = [];
  const result = await runCreateContentReviewerKey([
    '--output-dir', fixture.primaryDir,
    '--principal-id', 'reviewer alpha',
    '--key-id', 'reviewer-alpha-20260908',
  ], { emit: (value) => emitted.push(value), repoRoot: fixture.repoRoot, createdAt: '2026-09-08T01:00:00.000Z' });

  const [metadata, publicKeyPem, privateKeyPem] = await Promise.all([
    readJson(result.metadataPath),
    readFile(result.publicKeyPath, 'utf8'),
    readFile(result.privateKeyPath, 'utf8'),
  ]);
  assert.equal(metadata.algorithm, 'Ed25519');
  assert.equal(metadata.fingerprint, contentReviewerKeyFingerprint(publicKeyPem));
  assert.match(privateKeyPem, /BEGIN PRIVATE KEY/u);
  assert.doesNotMatch(emitted.join('\n'), /BEGIN PRIVATE KEY/u);
  const originalPrivateHash = digest(privateKeyPem);

  await assert.rejects(runCreateContentReviewerKey([
    '--output-dir', fixture.primaryDir,
    '--principal-id', 'reviewer alpha',
    '--key-id', 'reviewer-alpha-20260908',
  ], { emit: () => {}, repoRoot: fixture.repoRoot }), /already exists/u);
  assert.equal(digest(await readFile(result.privateKeyPath, 'utf8')), originalPrivateHash);
});

test('reviewer trust CLI canonicalizes public keys and rejects duplicate principal, keyId, or fingerprint', async (t) => {
  const fixture = await makeFixture(t);
  const primary = await createKey(fixture, fixture.primaryDir, 'reviewer alpha', 'reviewer-alpha');
  const second = await createKey(fixture, fixture.secondDir, 'reviewer beta', 'reviewer-beta');
  const trustPath = resolve(fixture.privateRoot, 'reviewer-trust.json');
  const trustResult = await runBuildContentReviewerTrust([
    '--entry', primary.metadataPath,
    '--entry', second.metadataPath,
    '--output', trustPath,
  ], { emit: () => {}, repoRoot: fixture.repoRoot });
  const trustBytes = await readFile(trustPath);
  const parsed = parseContentReviewerTrust(trustBytes);
  assert.equal(trustResult.entryCount, 2);
  assert.equal(parsed.keys.length, 2);

  const primaryMetadata = await readJson(primary.metadataPath);
  const variants = [
    ['duplicate-principal.json', { ...primaryMetadata, keyId: 'other-key', principalId: ' REVIEWER ALPHA ' }, /Duplicate reviewer principal/u],
    ['duplicate-key-id.json', { ...primaryMetadata, principalId: 'reviewer gamma' }, /Duplicate reviewer keyId/u],
    ['duplicate-fingerprint.json', {
      ...primaryMetadata,
      keyId: 'other-key',
      principalId: 'reviewer gamma',
      publicKeyPem: primaryMetadata.publicKeyPem.replaceAll('\n', '\r\n'),
    }, /Duplicate reviewer key fingerprint/u],
  ];
  for (const [name, duplicate, pattern] of variants) {
    const entryPath = resolve(fixture.privateRoot, name);
    await writeJson(entryPath, duplicate);
    await assert.rejects(runBuildContentReviewerTrust([
      '--entry', primary.metadataPath,
      '--entry', entryPath,
      '--output', resolve(fixture.privateRoot, `trust-${name}`),
    ], { emit: () => {}, repoRoot: fixture.repoRoot }), pattern);
  }
});

test('signing CLI replaces an existing signature and signs known and extended review documents with stable JSON', async (t) => {
  const fixture = await makeFixture(t);
  const key = await createKey(fixture, fixture.primaryDir, 'reviewer alpha', 'reviewer-alpha');
  const trustPath = resolve(fixture.privateRoot, 'reviewer-trust.json');
  await runBuildContentReviewerTrust([
    '--entry', key.metadataPath,
    '--output', trustPath,
  ], { emit: () => {}, repoRoot: fixture.repoRoot });
  const trust = parseContentReviewerTrust(await readFile(trustPath));

  const documents = [
    ['second-review', secondReviewDocument(), 'reviewer alpha'],
    ['primary-review', primaryReviewDocument(), 'reviewer alpha'],
    ['secondary-semantic-verdict', secondarySemanticVerdictDocument(), 'reviewer alpha'],
    ['future-review-receipt', {
      schema: 'munjanggun.futureReviewReceipt.v1',
      version: '1.0',
      reviewerPrincipalId: 'reviewer alpha',
      decision: { status: 'confirmed', objectSha256: 'f'.repeat(64) },
      signature: { algorithm: 'Ed25519', keyId: 'old-key', valueBase64: 'invalid-old-signature' },
    }, 'reviewer alpha'],
  ];
  const signatures = new Map();
  for (const [name, document, principal] of documents) {
    const inputPath = resolve(fixture.privateRoot, `${name}-unsigned.json`);
    const outputPath = resolve(fixture.privateRoot, `${name}-signed.json`);
    await writeJson(inputPath, document);
    const emitted = [];
    const result = await runSignContentReviewDocument([
      '--input', inputPath,
      '--private-key', key.privateKeyPath,
      '--key-id', 'reviewer-alpha',
      '--output', outputPath,
    ], { emit: (value) => emitted.push(value), repoRoot: fixture.repoRoot });
    const signed = await readJson(outputPath);
    assert.equal(signed.signature.algorithm, 'Ed25519');
    assert.notEqual(signed.signature.valueBase64, 'invalid-old-signature');
    signatures.set(name, signed.signature.valueBase64);
    assert.equal(verifyTrustedContentReviewerSignature(signed, principal, trust, name).keyId, 'reviewer-alpha');
    assert.equal(result.sha256, digest(await readFile(outputPath)));
    assert.doesNotMatch(emitted.join('\n'), /BEGIN PRIVATE KEY/u);
    await assert.rejects(runSignContentReviewDocument([
      '--input', inputPath,
      '--private-key', key.privateKeyPath,
      '--key-id', 'reviewer-alpha',
      '--output', outputPath,
    ], { emit: () => {}, repoRoot: fixture.repoRoot }), /already exists/u);
  }

  const reorderedInputPath = resolve(fixture.privateRoot, 'second-review-reordered.json');
  const reorderedOutputPath = resolve(fixture.privateRoot, 'second-review-reordered-signed.json');
  await writeJson(reorderedInputPath, Object.fromEntries(Object.entries(secondReviewDocument()).reverse()));
  await runSignContentReviewDocument([
    '--input', reorderedInputPath,
    '--private-key', key.privateKeyPath,
    '--key-id', 'reviewer-alpha',
    '--output', reorderedOutputPath,
  ], { emit: () => {}, repoRoot: fixture.repoRoot });
  assert.equal((await readJson(reorderedOutputPath)).signature.valueBase64, signatures.get('second-review'));
});

test('key and signing outputs are rejected inside the public repository and non-Ed25519 keys cannot sign', async (t) => {
  const fixture = await makeFixture(t);
  await assert.rejects(runCreateContentReviewerKey([
    '--output-dir', resolve(fixture.repoRoot, 'keys'),
    '--principal-id', 'reviewer alpha',
    '--key-id', 'reviewer-alpha',
  ], { emit: () => {}, repoRoot: fixture.repoRoot }), /outside the public repository/u);

  const inputPath = resolve(fixture.privateRoot, 'second-review.json');
  const outputPath = resolve(fixture.privateRoot, 'signed.json');
  await writeJson(inputPath, secondReviewDocument());
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsaPath = resolve(fixture.privateRoot, 'rsa-private.pem');
  await writeFile(rsaPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx' });
  await assert.rejects(runSignContentReviewDocument([
    '--input', inputPath,
    '--private-key', rsaPath,
    '--key-id', 'reviewer-alpha',
    '--output', outputPath,
  ], { emit: () => {}, repoRoot: fixture.repoRoot }), /must be Ed25519/u);
});

async function makeFixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'munjanggun-review-signing-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repoRoot = resolve(root, 'public-repo');
  const privateRoot = resolve(root, 'private');
  await Promise.all([mkdir(repoRoot, { recursive: true }), mkdir(privateRoot, { recursive: true })]);
  return {
    root,
    repoRoot,
    privateRoot,
    primaryDir: resolve(privateRoot, 'primary'),
    secondDir: resolve(privateRoot, 'second'),
  };
}

function createKey(fixture, outputDir, principalId, keyId) {
  return runCreateContentReviewerKey([
    '--output-dir', outputDir,
    '--principal-id', principalId,
    '--key-id', keyId,
  ], { emit: () => {}, repoRoot: fixture.repoRoot, createdAt: '2026-09-08T01:00:00.000Z' });
}

function secondReviewDocument() {
  return {
    schema: 'munjanggun.visibleTextSecondReview.v1',
    version: '1.0',
    status: 'confirmed_visible',
    method: 'independent_crop_review',
    sourceObjectSha256: 'a'.repeat(64),
    observedText: '표시 가격 100만원',
    region: { x: 0, y: 0, width: 1, height: 0.2, unit: 'normalized' },
    pixelEvidenceSha256: 'b'.repeat(64),
    observationDigest: 'c'.repeat(64),
    reviewerPrincipalId: 'reviewer alpha',
    reviewedAt: '2026-09-08T01:00:00.000Z',
    signature: { algorithm: 'Ed25519', keyId: 'old-key', valueBase64: 'invalid-old-signature' },
  };
}

function primaryReviewDocument() {
  return {
    schema: 'munjanggun.assetContentReviewInput.v1',
    version: '1.0',
    intakeId: 'INTAKE-20260908-01',
    reviewId: 'static-001',
    mediaKind: 'static',
    reviewedAt: '2026-09-08T01:00:00.000Z',
    reviewer: 'reviewer alpha',
    entries: [{
      sha256: 'a'.repeat(64),
      sourceRefs: [{ sourceId: 'SRC-FIXTURE', sourceRelativePath: '제품/001.png' }],
      verificationStatus: 'verified',
      observedSummary: '제품 한 개가 보이는 정지 이미지',
      contentType: 'product_image',
      useCases: ['제품 소개'],
      searchTags: { productTypes: ['제품'], scenes: [], colors: [], designs: [], topics: [] },
      textPresence: 'none_observed',
      visibleText: [],
      visibleTextObservations: [],
      ocrText: '',
      sourceContext: ['제품/001.png'],
      inferredText: [],
      claimSignals: [],
      claimEvidence: [],
      privacySignals: [],
      uncertainties: [],
      reviewEvidence: {
        method: 'full_resolution_original_opened',
        originalPath: 'Z:\\private\\raw\\제품\\001.png',
        reviewer: 'reviewer alpha',
        reviewedAt: '2026-09-08T01:00:00.000Z',
      },
      staticTileCoverage: {
        manifestRef: 'Z:\\private\\evidence\\static-tile-coverage.json',
        manifestSha256: 'b'.repeat(64),
        coverageDigest: 'c'.repeat(64),
      },
      secondarySemanticVerdict: {
        status: 'confirmed_match',
        method: 'independent_full_content_review',
        reviewerPrincipalId: 'reviewer beta',
        reviewedAt: '2026-09-08T01:00:00.000Z',
        primaryDecisionDigest: 'd'.repeat(64),
        evidenceRef: 'Z:\\private\\evidence\\secondary-semantic-verdict.json',
        evidenceSha256: 'e'.repeat(64),
      },
    }],
    signature: { algorithm: 'Ed25519', keyId: 'old-key', valueBase64: 'invalid-old-signature' },
  };
}

function secondarySemanticVerdictDocument() {
  return {
    schema: 'munjanggun.assetContentSecondarySemanticVerdict.v1',
    version: '1.0',
    status: 'confirmed_match',
    method: 'independent_full_content_review',
    sourceObjectSha256: 'd'.repeat(64),
    primaryDecisionDigest: 'e'.repeat(64),
    observedSummary: '제품 한 개가 보이는 정지 이미지',
    contentType: 'product_image',
    useCases: ['제품 소개'],
    searchTags: { productTypes: ['제품'], scenes: [], colors: [], designs: [], topics: [] },
    textPresence: 'none_observed',
    visibleText: [],
    privacySignals: [],
    uncertainties: [],
    reviewerPrincipalId: 'reviewer alpha',
    reviewedAt: '2026-09-08T01:00:00.000Z',
    signature: { algorithm: 'Ed25519', keyId: 'old-key', valueBase64: 'invalid-old-signature' },
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}
