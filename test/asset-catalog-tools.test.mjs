import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { runAssetExtractContent } from '../scripts/assets-extract-content.mjs';
import { runAssetSearchCatalog } from '../scripts/assets-search-catalog.mjs';
import { runBlogAssetPicker } from '../scripts/assets-pick-for-blog.mjs';
import { verifyApprovalAuthority } from '../scripts/lib/asset-owner-approval.mjs';
import { verifyTrustedOwnerSignature } from '../scripts/lib/asset-owner-trust.mjs';
import { verifyUseEvidenceAuthority } from '../scripts/lib/asset-use-evidence.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = resolve('.');
const trustedTestRoot = resolve(tmpdir(), 'mg-catalog-tests');
const fixtureRoots = new Set();
process.once('exit', () => {
  for (const root of fixtureRoots) {
    try { rmSync(root, { recursive: true, force: true }); } catch {}
  }
});

test('catalog search works and external extraction denies an unreviewed asset', async () => {
  const fixture = await createFixture();
  const search = await runAssetSearchCatalog([
    '--catalog', fixture.catalogPath, '--query', '손 끼임',
  ], { emit: () => {}, verifyContentQuality: async () => {} });
  assert.equal(search.results[0].contentId, fixture.entry.contentId);
  const picker = await runBlogAssetPicker([
    '--catalog', fixture.catalogPath, '--product', '상품', '--consultation-topic', '손 끼임',
    '--select-content-id', fixture.entry.contentId,
  ], { emit: () => {}, verifyContentQuality: async () => {} });
  assert.equal(picker.candidates[0].catalogMetadataStatus, 'review_only');
  assert.equal(picker.selection.externalExtractionRequestStatus, 'blocked_by_catalog_metadata');
  assert.equal(picker.selection.nextStep, null);
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /signing key is not trusted/);
  await assert.rejects(readFile(fixture.outputRoot), { code: 'ENOENT' });
});

test('internal audit requires exact per-gate acknowledgements and writes an atomic receipt bundle', async () => {
  const fixture = await createFixture();
  const base = [
    '--purpose', 'internal-audit', '--destination-class', 'private-temporary',
    '--approved-private-root', fixture.root, '--audit-ref', 'AUDIT-TEST-001', '--requested-by', 'test-operator',
    '--reason', '회귀 테스트를 위한 비공개 감사용 추출입니다.',
    '--expires-at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), '--acknowledge-no-publication',
  ];
  await assert.rejects(runExtract(fixture, base), /exact --override-gate acknowledgements/);
  const output = await runTrustedTestExtract(fixture, [...base,
    '--override-gate', 'rightsStatus=not_reviewed',
    '--override-gate', 'rightsScope.external_reuse=absent',
    '--override-gate', 'rightsEvidenceRef=0',
    '--override-gate', 'privacyStatus=not_reviewed',
    '--override-gate', 'claimReviewStatus=not_reviewed',
    '--override-gate', 'publishStatus=blocked',
  ]);
  const receipt = JSON.parse(await readFile(output.receiptPath, 'utf8'));
  assert.equal(receipt.extractionMode, 'internal_audit_override');
  assert.equal(receipt.externalUseAllowed, false);
  assert.equal(receipt.overrideAcknowledgements.length, 6);
  assert.equal(receipt.output.sha256, fixture.sha256);
});

test('external extraction remains blocked before owner trust enrollment', async () => {
  const fixture = await createFixture({ humanReviewStatus: 'needs_escalation', approved: true });
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /signing key is not trusted/);
});

test('catalog cannot upgrade a sealed needs-escalation decision to reviewed', async () => {
  const fixture = await createFixture({ approved: true, humanReviewStatus: 'reviewed', evidenceHumanReviewStatus: 'needs_escalation' });
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /signing key is not trusted/);
});

test('self-signed fixture cannot produce an external receipt through the production CLI', async () => {
  const fixture = await createFixture({ approved: true });
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /signing key is not trusted/);
  await assert.rejects(readFile(fixture.outputRoot), { code: 'ENOENT' });
});

test('tampered sealed review evidence blocks extraction before output creation', async () => {
  const fixture = await createFixture({ approved: true });
  await writeFile(fixture.reportPath, '{"entries":[]}\n');
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /signing key is not trusted/);
  await assert.rejects(readFile(fixture.outputRoot), { code: 'ENOENT' });
});

test('external extraction requires the registered evidence artifact to exist and match its hash', async () => {
  const fixture = await createFixture({ approved: true });
  await rm(join(fixture.evidenceRoot, 'rights-evidence.json'));
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /signing key is not trusted/);
  await assert.rejects(readFile(fixture.outputRoot), { code: 'ENOENT' });
});

test('owner decision receipt blocks schema-valid catalog gate tampering', async () => {
  const fixture = await createFixture({ approved: true });
  const catalog = JSON.parse(await readFile(fixture.catalogPath, 'utf8'));
  catalog.entries[0].rightsEvidenceRef = ['RIGHTS-EV-FORGED-001'];
  await writeFile(fixture.catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /signing key is not trusted/);
});

test('owner decision receipt blocks ledger evidence tampering', async () => {
  const fixture = await createFixture({ approved: true });
  const ledger = JSON.parse(await readFile(fixture.approvalLedgerPath, 'utf8'));
  ledger.assetDecisions[0].rightsEvidenceRefs = ['RIGHTS-EV-FORGED-001'];
  await writeFile(fixture.approvalLedgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /signing key is not trusted/);
});

test('public repository extraction additionally requires public Git scope and eligibility', async () => {
  const fixture = await createFixture({ approved: true });
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'public-repository', '--destination-class', 'public-repository', '--approved-public-root', fixture.root,
  ]), /signing key is not trusted/);
});

test('repeating an evidence ID without a registered artifact never authorizes release', async () => {
  const fixture = await createFixture({ approved: true });
  const registry = JSON.parse(await readFile(fixture.useEvidenceRegistryPath, 'utf8'));
  registry.entryCount = 0; registry.entries = [];
  await writeFile(fixture.useEvidenceRegistryPath, `${JSON.stringify(registry, null, 2)}\n`);
  const receipt = JSON.parse(await readFile(fixture.useEvidenceReceiptPath, 'utf8'));
  receipt.registrySha256 = hash(await readFile(fixture.useEvidenceRegistryPath));
  receipt.fileCount = 0; receipt.entries = []; receipt.treeHash = hash(Buffer.from(''));
  await writeFile(fixture.useEvidenceReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /signing key is not trusted/);
  await assert.rejects(readFile(fixture.outputRoot), { code: 'ENOENT' });
});

test('self-consistent metadata without a trusted owner signature cannot authorize release', async () => {
  const fixture = await createFixture({ approved: true });
  const receipt = JSON.parse(await readFile(fixture.approvalReceiptPath, 'utf8'));
  receipt.signature = null;
  await writeFile(fixture.approvalReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /has no trusted owner signature/);
  await assert.rejects(readFile(fixture.outputRoot), { code: 'ENOENT' });
});

test('owner signature verifier uses explicit test injection but production ignores environment overrides', async () => {
  const fixture = await createFixture({ approved: true });
  const document = JSON.parse(await readFile(fixture.approvalReceiptPath, 'utf8'));
  await verifyTrustedOwnerSignature(document, 'Test owner receipt', fixture.trustConfigPath);
  const beforeContext = process.env.NODE_TEST_CONTEXT;
  const beforeConfig = process.env.MUNJANGGUN_TEST_OWNER_TRUST_CONFIG;
  process.env.NODE_TEST_CONTEXT = 'spoofed'; process.env.MUNJANGGUN_TEST_OWNER_TRUST_CONFIG = fixture.trustConfigPath;
  try {
    await assert.rejects(verifyTrustedOwnerSignature(document, 'Production owner receipt'), /signing key is not trusted/);
  } finally {
    if (beforeContext === undefined) delete process.env.NODE_TEST_CONTEXT; else process.env.NODE_TEST_CONTEXT = beforeContext;
    if (beforeConfig === undefined) delete process.env.MUNJANGGUN_TEST_OWNER_TRUST_CONFIG; else process.env.MUNJANGGUN_TEST_OWNER_TRUST_CONFIG = beforeConfig;
  }
  await assert.rejects(verifyTrustedOwnerSignature({ ...document, assetDecisionCount: 999 }, 'Tampered owner receipt', fixture.trustConfigPath), /signature is invalid/);
});

test('isolated trusted verifier reaches and passes both approval and use-evidence chains', async () => {
  const fixture = await createFixture({ approved: true });
  const { approval, evidence } = await verifyFixtureAuthorities(fixture);
  assert.equal(approval.assetDecisionBySha.get(fixture.sha256).rightsDecision, 'verified');
  assert.deepEqual(evidence.resolvedEvidence.map((item) => item.evidenceId), ['RIGHTS-EV-TEST-001']);
});

test('internal audit resolves a sealed legacy review path from the evidence receipt root', async () => {
  const fixture = await createFixture();
  const catalog = JSON.parse(await readFile(fixture.catalogPath, 'utf8'));
  catalog.entries[0].reviewEvidenceRefs = [`../review-evidence/report.json#sha256=${fixture.sha256}`];
  await writeFile(fixture.catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  const output = await runTrustedTestExtract(fixture, [
    '--purpose', 'internal-audit', '--destination-class', 'private-temporary',
    '--approved-private-root', fixture.root, '--audit-ref', 'AUDIT-TEST-LEGACY-PATH', '--requested-by', 'test-operator',
    '--reason', '기존 상대경로 증빙 참조의 안전한 해석을 검증합니다.',
    '--expires-at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), '--acknowledge-no-publication',
    '--override-gate', 'rightsStatus=not_reviewed', '--override-gate', 'rightsScope.external_reuse=absent',
    '--override-gate', 'rightsEvidenceRef=0', '--override-gate', 'privacyStatus=not_reviewed',
    '--override-gate', 'claimReviewStatus=not_reviewed', '--override-gate', 'publishStatus=blocked',
  ]);
  assert.equal(JSON.parse(await readFile(output.receiptPath, 'utf8')).result, 'success');
});

test('internal audit resolves a Windows-backslash legacy review path from the evidence receipt root', async () => {
  const fixture = await createFixture();
  const catalog = JSON.parse(await readFile(fixture.catalogPath, 'utf8'));
  catalog.entries[0].reviewEvidenceRefs = [`..\\review-evidence\\report.json#sha256=${fixture.sha256}`];
  await writeFile(fixture.catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  const output = await runTrustedTestExtract(fixture, [
    '--purpose', 'internal-audit', '--destination-class', 'private-temporary',
    '--approved-private-root', fixture.root, '--audit-ref', 'AUDIT-TEST-LEGACY-WINDOWS-PATH', '--requested-by', 'test-operator',
    '--reason', 'Windows 역슬래시 상대경로 증빙 참조의 안전한 해석을 검증합니다.',
    '--expires-at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), '--acknowledge-no-publication',
    '--override-gate', 'rightsStatus=not_reviewed', '--override-gate', 'rightsScope.external_reuse=absent',
    '--override-gate', 'rightsEvidenceRef=0', '--override-gate', 'privacyStatus=not_reviewed',
    '--override-gate', 'claimReviewStatus=not_reviewed', '--override-gate', 'publishStatus=blocked',
  ]);
  assert.equal(JSON.parse(await readFile(output.receiptPath, 'utf8')).result, 'success');
});

test('external extraction fails closed when content accuracy authority rejects the catalog', async () => {
  const fixture = await createFixture({ approved: true });
  const { approval, evidence } = await verifyFixtureAuthorities(fixture);
  await assert.rejects(runTrustedTestExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ], {
    verifyContentQuality: async () => { throw new Error('content accuracy quarantine fixture'); },
    verifyApproval: async () => approval,
    verifyUseEvidence: async () => evidence,
  }), /content accuracy quarantine fixture/u);
});

test('external extraction applies overlay claim signals before evidence and release gates', async () => {
  const fixture = await createFixture({ approved: true });
  const { approval, evidence } = await verifyFixtureAuthorities(fixture);
  const authority = fixtureContentAuthority(fixture);
  authority.overlay.entries[0].claimSignals = ['price_or_commercial_terms'];
  let observedClaims = null;
  await assert.rejects(runTrustedTestExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ], {
    verifyContentQuality: async () => authority,
    verifyApproval: async () => approval,
    verifyUseEvidence: async ({ entry }) => { observedClaims = entry.claimSignals; return evidence; },
  }), /claimSignalsConsistency=1/u);
  assert.deepEqual(observedClaims, ['price_or_commercial_terms']);
  await assert.rejects(readFile(fixture.outputRoot), { code: 'ENOENT' });
});

test('isolated trusted verifier rejects a missing evidence artifact', async () => {
  const fixture = await createFixture({ approved: true });
  await rm(join(fixture.evidenceRoot, 'rights-evidence.json'));
  await assert.rejects(verifyFixtureUseEvidence(fixture), /ENOENT/);
});

test('isolated trusted verifier rejects a tampered evidence artifact', async () => {
  const fixture = await createFixture({ approved: true });
  await writeFile(join(fixture.evidenceRoot, 'rights-evidence.json'), '{"tampered":true}\n');
  await assert.rejects(verifyFixtureUseEvidence(fixture), /Use evidence artifact integrity mismatch/);
});

test('isolated trusted verifier rejects catalog tampering in both authority chains', async () => {
  const fixture = await createFixture({ approved: true });
  const catalog = JSON.parse(await readFile(fixture.catalogPath, 'utf8'));
  catalog.entries[0].semanticSummary = 'tampered catalog summary';
  await writeFile(fixture.catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await assert.rejects(verifyFixtureApproval(fixture, catalog), /Owner decision catalog SHA mismatch/);
  await assert.rejects(verifyFixtureUseEvidence(fixture, { catalog }), /Use evidence catalog SHA mismatch/);
});

test('isolated trusted verifier rejects ledger tampering after signature verification', async () => {
  const fixture = await createFixture({ approved: true });
  const ledger = JSON.parse(await readFile(fixture.approvalLedgerPath, 'utf8'));
  ledger.assetDecisions[0].notes = 'tampered ledger note';
  await writeFile(fixture.approvalLedgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  await assert.rejects(verifyFixtureApproval(fixture), /Owner decision receipt ledger SHA mismatch/);
});

test('isolated trusted verifier rejects a use-evidence channel mismatch', async () => {
  const fixture = await createFixture({ approved: true });
  await assert.rejects(verifyFixtureUseEvidence(fixture, { channel: 'sns' }), /Use evidence scope\/channel mismatch/);
});

async function verifyFixtureAuthorities(fixture) {
  const catalog = JSON.parse(await readFile(fixture.catalogPath, 'utf8'));
  const [approval, evidence] = await Promise.all([
    verifyFixtureApproval(fixture, catalog),
    verifyFixtureUseEvidence(fixture, { catalog }),
  ]);
  return { approval, evidence };
}

async function verifyFixtureApproval(fixture, catalog = null) {
  const resolvedCatalog = catalog ?? JSON.parse(await readFile(fixture.catalogPath, 'utf8'));
  return verifyApprovalAuthority({
    catalog: resolvedCatalog,
    catalogPath: fixture.catalogPath,
    ledgerPath: fixture.approvalLedgerPath,
    receiptPath: fixture.approvalReceiptPath,
    useEvidenceReceiptPath: fixture.useEvidenceReceiptPath,
    ownerSignatureVerifier: testOwnerSignatureVerifier(fixture),
  });
}

async function verifyFixtureUseEvidence(fixture, options = {}) {
  const catalog = options.catalog ?? JSON.parse(await readFile(fixture.catalogPath, 'utf8'));
  return verifyUseEvidenceAuthority({
    catalog,
    catalogPath: fixture.catalogPath,
    registryPath: fixture.useEvidenceRegistryPath,
    receiptPath: fixture.useEvidenceReceiptPath,
    entry: catalog.entries[0],
    purpose: 'external-publication',
    channel: options.channel ?? 'blog',
    ownerSignatureVerifier: testOwnerSignatureVerifier(fixture),
  });
}

function testOwnerSignatureVerifier(fixture) {
  return (document, label) => verifyTrustedOwnerSignature(document, label, fixture.trustConfigPath);
}

async function createFixture(options = {}) {
  const root = join(trustedTestRoot, `mg-catalog-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fixtureRoots.add(root);
  const objectRoot = join(root, 'objects');
  const outputRoot = join(root, 'output');
  const evidenceRoot = join(root, 'evidence');
  const body = Buffer.from('asset-body');
  const sha256 = createHash('sha256').update(body).digest('hex');
  const objectRef = `sha256/${sha256.slice(0, 2)}/${sha256}.jpg`;
  const objectPath = join(objectRoot, ...objectRef.split('/'));
  const catalogPath = join(root, 'catalog.json');
  const reportPath = join(evidenceRoot, 'report.json');
  const evidenceReceiptPath = join(evidenceRoot, 'receipt.json');
  const useEvidenceArtifactPath = join(evidenceRoot, 'rights-evidence.json');
  const useEvidenceRegistryPath = join(evidenceRoot, 'use-evidence-registry.json');
  const useEvidenceReceiptPath = join(evidenceRoot, 'use-evidence-receipt.json');
  const trustConfigPath = join(root, 'owner-trust.json');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const keyId = 'TEST-OWNER-KEY';
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  await mkdir(root, { recursive: true });
  await writeFile(trustConfigPath, `${JSON.stringify({ schema: 'munjanggun.assetOwnerTrust.v1', version: '1.0', keys: [{ keyId, status: 'active', publicKeyPem, fingerprint: hash(Buffer.from(publicKeyPem)) }] }, null, 2)}\n`);
  const approvalLedgerPath = join(root, 'owner-decisions.json');
  const approvalReceiptPath = join(root, 'owner-decisions-receipt.json');
  await mkdir(join(objectPath, '..'), { recursive: true });
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(objectPath, body);
  const approved = Boolean(options.approved);
  const entry = {
    binaryGroupId: `sha256:${sha256}`, objectRef, sha256, byteSize: body.length, mediaType: 'image/jpeg',
    sourcePathCount: 1, sourceRefs: [{ sourceId: 'SRC-TEST', sourceRelativePath: '상품/안전.jpg' }],
    contentId: 'CONTENT-TEST-SAFETY', visualGroupId: 'VISUAL-TEST', comparisonMethod: ['sha256_exact', 'human_visual_review'],
    humanReviewStatus: options.humanReviewStatus ?? 'reviewed', semanticSummary: '손 끼임 안전 안내', ocrText: '안전 커버',
    gifReviewStatus: 'not_applicable', claimSignals: [], privacySignals: [], rightsSignals: approved ? [] : ['source_rights_unverified'],
    rightsStatus: approved ? 'verified' : 'not_reviewed', rightsScope: approved ? ['external_reuse'] : [],
    rightsEvidenceRef: approved ? ['RIGHTS-EV-TEST-001'] : [], privacyStatus: approved ? 'cleared' : 'not_reviewed',
    claimEvidenceRef: [],
    claimReviewStatus: approved ? 'not_applicable' : 'not_reviewed', publishStatus: approved ? 'eligible' : 'blocked',
    publicRepoEligibility: approved ? 'eligible' : 'not_reviewed',
    reviewEvidenceRefs: [`evidence/report.json#sha256=${sha256}`],
  };
  const evidenceFields = ['binaryGroupId', 'sha256', 'contentId', 'byteSize', 'mediaType', 'sourcePathCount', 'sourceRefs', 'semanticSummary', 'ocrText', 'humanReviewStatus', 'claimSignals', 'privacySignals', 'rightsSignals'];
  const evidenceRow = Object.fromEntries(evidenceFields.map((field) => [field, entry[field]]));
  evidenceRow.humanReviewStatus = options.evidenceHumanReviewStatus ?? entry.humanReviewStatus;
  const report = { entries: [evidenceRow] };
  await writeFile(reportPath, `${JSON.stringify(report)}\n`);
  const reportBody = await readFile(reportPath);
  const evidenceReceipt = {
    schema: 'munjanggun.reviewEvidenceReceipt.v1', version: '1.0', intakeId: 'INTAKE-20260904-01',
    sealedAt: '2026-09-05T00:00:00.000Z', fileCount: 1,
    treeHash: createHash('sha256').update(`report.json\0${reportBody.length}\0${hash(reportBody)}\n`).digest('hex'),
    entries: [{ relativePath: 'report.json', byteSize: reportBody.length, sha256: hash(reportBody), kind: 'review_report' }],
  };
  await writeFile(evidenceReceiptPath, `${JSON.stringify(evidenceReceipt, null, 2)}\n`);
  const catalog = {
    schema: 'munjanggun.assetContentCatalog.v2', version: '2.0', intakeId: 'INTAKE-20260904-01',
    generatedAt: '2026-09-05T00:00:00.000Z', reviewedAt: '2026-09-05T00:00:00.000Z', binaryGroupCount: 1,
    reviewEvidenceReceiptRef: 'evidence/receipt.json', reviewEvidenceReceiptSha256: hash(await readFile(evidenceReceiptPath)), entries: [entry],
  };
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  const catalogSha256 = hash(await readFile(catalogPath));
  const useEvidenceEntries = [];
  const useEvidenceReceiptEntries = [];
  if (approved) {
    const artifact = {
      schema: 'munjanggun.assetUseEvidenceArtifact.v1', version: '1.0', evidenceId: 'RIGHTS-EV-TEST-001', kind: 'rights',
      decisionRef: 'OWNER-TEST-DECISION-001', decisionStatus: 'verified', subjectSha256: sha256, contentId: entry.contentId,
      scopes: ['external_reuse'], channels: ['blog'], validFrom: '2026-09-01T00:00:00.000Z', validUntil: null,
      assertedBy: 'owner-test-fixture', assertedAt: '2026-09-05T00:00:00.000Z', sourceEvidenceRefs: ['approval://OWNER-TEST-DECISION-001'],
    };
    await writeFile(useEvidenceArtifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
    const artifactBody = await readFile(useEvidenceArtifactPath);
    useEvidenceEntries.push({
      evidenceId: 'RIGHTS-EV-TEST-001', kind: 'rights', status: 'verified', subjectSha256: sha256, contentId: entry.contentId,
      scopes: ['external_reuse'], channels: ['blog'], validFrom: '2026-09-01T00:00:00.000Z', validUntil: null,
      artifactRef: 'rights-evidence.json', artifactByteSize: artifactBody.length, artifactSha256: hash(artifactBody), issuer: 'owner-test-fixture', decisionRef: 'OWNER-TEST-DECISION-001',
    });
    useEvidenceReceiptEntries.push({ evidenceId: 'RIGHTS-EV-TEST-001', relativePath: 'rights-evidence.json', byteSize: artifactBody.length, sha256: hash(artifactBody) });
  }
  const useEvidenceRegistry = {
    schema: 'munjanggun.assetUseEvidenceRegistry.v1', version: '1.0', intakeId: catalog.intakeId, catalogSha256,
    sealedAt: '2026-09-05T00:00:00.000Z', entryCount: useEvidenceEntries.length, entries: useEvidenceEntries,
  };
  await writeFile(useEvidenceRegistryPath, `${JSON.stringify(useEvidenceRegistry, null, 2)}\n`);
  const useEvidenceReceipt = {
    schema: 'munjanggun.assetUseEvidenceReceipt.v1', version: '1.0', intakeId: catalog.intakeId,
    sealedAt: '2026-09-05T00:00:00.000Z', catalogSha256, registryRef: 'use-evidence-registry.json', registrySha256: hash(await readFile(useEvidenceRegistryPath)),
    fileCount: useEvidenceReceiptEntries.length,
    treeHash: hash(Buffer.from(useEvidenceReceiptEntries.map((item) => `${item.evidenceId}\0${item.relativePath}\0${item.byteSize}\0${item.sha256}\n`).join(''))),
    entries: useEvidenceReceiptEntries, signature: null,
  };
  useEvidenceReceipt.signature = signDocument(useEvidenceReceipt, privateKey, keyId);
  await writeFile(useEvidenceReceiptPath, `${JSON.stringify(useEvidenceReceipt, null, 2)}\n`);
  const decision = approved
    ? { humanReviewDecision: 'approved', claimDecision: 'not_applicable', privacyDecision: 'cleared', rightsDecision: 'verified', rightsEvidenceRefs: ['RIGHTS-EV-TEST-001'], claimEvidenceRefs: [] }
    : { humanReviewDecision: 'pending', claimDecision: 'pending', privacyDecision: 'pending', rightsDecision: 'pending', rightsEvidenceRefs: [], claimEvidenceRefs: [] };
  const globalDecision = (status, evidenceRefs = []) => ({ status, evidenceRefs, notes: '' });
  const approvalLedger = {
    schema: 'munjanggun.assetOwnerDecisions.v1', version: '1.0', intakeId: catalog.intakeId,
    generatedAt: '2026-09-05T00:00:00.000Z', catalogSha256, useEvidenceReceiptSha256: hash(await readFile(useEvidenceReceiptPath)),
    inheritancePolicy: 'global_answers_do_not_propagate_to_asset_decisions',
    rightsDecisions: {
      internalPreservation: globalDecision('pending'),
      publicGitStorage: globalDecision('pending'),
      externalReuse: globalDecision(approved ? 'approved' : 'pending', approved ? ['RIGHTS-EV-TEST-001'] : []),
      specialAssetRestrictions: globalDecision(approved ? 'approved' : 'pending', approved ? ['RIGHTS-EV-TEST-001'] : []),
    },
    assetDecisionCount: 1,
    assetDecisions: [{ sha256, contentId: entry.contentId, needsEscalation: entry.humanReviewStatus === 'needs_escalation', ...decision, notes: '' }],
    escalationDecisionCount: entry.humanReviewStatus === 'needs_escalation' ? 1 : 0,
    escalationDecisions: entry.humanReviewStatus === 'needs_escalation'
      ? [{ sha256, contentId: entry.contentId, ...decision, notes: '' }]
      : [],
  };
  await writeFile(approvalLedgerPath, `${JSON.stringify(approvalLedger, null, 2)}\n`);
  const globalStatuses = new Set(Object.values(approvalLedger.rightsDecisions).map((item) => item.status));
  const approvalReceipt = {
    schema: 'munjanggun.assetOwnerDecisionReceipt.v1', version: '1.0', intakeId: catalog.intakeId,
    sealedAt: '2026-09-05T00:00:00.000Z', catalogSha256: approvalLedger.catalogSha256, useEvidenceReceiptSha256: approvalLedger.useEvidenceReceiptSha256,
    ledgerRef: 'owner-decisions.json', ledgerSha256: hash(await readFile(approvalLedgerPath)),
    globalDecisionStatus: globalStatuses.size === 1 ? [...globalStatuses][0] : 'mixed',
    assetDecisionCount: 1, escalationDecisionCount: approvalLedger.escalationDecisionCount,
    signature: null,
  };
  approvalReceipt.signature = signDocument(approvalReceipt, privateKey, keyId);
  await writeFile(approvalReceiptPath, `${JSON.stringify(approvalReceipt, null, 2)}\n`);
  return { root, objectRoot, outputRoot, evidenceRoot, evidenceReceiptPath, useEvidenceRegistryPath, useEvidenceReceiptPath, trustConfigPath, reportPath, catalogPath, approvalLedgerPath, approvalReceiptPath, entry, sha256 };
}

function runExtract(fixture, extras) {
  return execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-extract-content.mjs'), '--catalog', fixture.catalogPath,
    '--object-root', fixture.objectRoot, '--output-root', fixture.outputRoot,
    '--evidence-receipt', fixture.evidenceReceiptPath,
    '--approval-ledger', fixture.approvalLedgerPath, '--approval-receipt', fixture.approvalReceiptPath,
    '--use-evidence-registry', fixture.useEvidenceRegistryPath, '--use-evidence-receipt', fixture.useEvidenceReceiptPath,
    '--channel', 'blog',
    '--content-id', fixture.entry.contentId, ...extras,
  ], { env: { ...process.env, MUNJANGGUN_TEST_OWNER_TRUST_CONFIG: fixture.trustConfigPath } });
}

function runTrustedTestExtract(fixture, extras, options = {}) {
  return runAssetExtractContent([
    '--catalog', fixture.catalogPath,
    '--object-root', fixture.objectRoot,
    '--output-root', fixture.outputRoot,
    '--evidence-receipt', fixture.evidenceReceiptPath,
    '--approval-ledger', fixture.approvalLedgerPath,
    '--approval-receipt', fixture.approvalReceiptPath,
    '--use-evidence-registry', fixture.useEvidenceRegistryPath,
    '--use-evidence-receipt', fixture.useEvidenceReceiptPath,
    '--channel', 'blog',
    '--content-id', fixture.entry.contentId,
    ...extras,
  ], { trustedPrivateRoots: [fixture.root], emit: () => {}, verifyContentQuality: async () => fixtureContentAuthority(fixture), ...options });
}

function fixtureContentAuthority(fixture) {
  const overlayEntry = {
    sha256: fixture.entry.sha256,
    semanticSummary: fixture.entry.semanticSummary,
    assetType: 'product_guide',
    useCases: ['safety_guide'],
    searchTags: { productTypes: ['상품'], scenes: [], colors: [], designs: [], topics: ['안전'] },
    ocrText: fixture.entry.ocrText,
    claimSignals: fixture.entry.claimSignals,
    privacySignals: fixture.entry.privacySignals,
    humanReviewStatus: 'verified',
    annotationMethod: 'full_resolution_original_reviewed',
    reviewEvidenceRefs: fixture.entry.reviewEvidenceRefs,
    decisionHash: 'e'.repeat(64),
    gifMetadata: null,
  };
  return {
    record: { overlaySha256: 'c'.repeat(64), receiptSha256: 'd'.repeat(64), verifiedAt: '2099-01-01T00:00:00.000Z' },
    overlay: { entryCount: 1, entries: [overlayEntry] },
    receipt: { entryCount: 1 },
  };
}

function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function signDocument(document, privateKey, keyId) {
  const payload = { ...document }; delete payload.signature;
  return { algorithm: 'Ed25519', keyId, valueBase64: sign(null, Buffer.from(stableJson(payload), 'utf8'), privateKey).toString('base64') };
}
