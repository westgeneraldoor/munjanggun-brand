import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = resolve('.');

test('catalog search works and external extraction denies an unreviewed asset', async () => {
  const fixture = await createFixture();
  const search = await execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-search-catalog.mjs'), '--catalog', fixture.catalogPath, '--query', '손 끼임',
  ]);
  assert.equal(JSON.parse(search.stdout).results[0].contentId, fixture.entry.contentId);
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /Extraction blocked by release gate/);
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
  const result = await runExtract(fixture, [...base,
    '--override-gate', 'rightsStatus=not_reviewed',
    '--override-gate', 'rightsScope.external_reuse=absent',
    '--override-gate', 'rightsEvidenceRef=0',
    '--override-gate', 'privacyStatus=not_reviewed',
    '--override-gate', 'claimReviewStatus=not_reviewed',
    '--override-gate', 'publishStatus=blocked',
  ]);
  const output = JSON.parse(result.stdout);
  const receipt = JSON.parse(await readFile(output.receiptPath, 'utf8'));
  assert.equal(receipt.extractionMode, 'internal_audit_override');
  assert.equal(receipt.externalUseAllowed, false);
  assert.equal(receipt.overrideAcknowledgements.length, 6);
  assert.equal(receipt.output.sha256, fixture.sha256);
});

test('human review escalation blocks otherwise eligible external extraction', async () => {
  const fixture = await createFixture({ humanReviewStatus: 'needs_escalation', approved: true });
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /humanReviewStatus=needs_escalation/);
});

test('catalog cannot upgrade a sealed needs-escalation decision to reviewed', async () => {
  const fixture = await createFixture({ approved: true, humanReviewStatus: 'reviewed', evidenceHumanReviewStatus: 'needs_escalation' });
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /Review evidence humanReviewStatus mismatch/);
});

test('fully reviewed and evidenced external asset produces a receipt', async () => {
  const fixture = await createFixture({ approved: true });
  const result = await runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]);
  const output = JSON.parse(result.stdout);
  const receipt = JSON.parse(await readFile(output.receiptPath, 'utf8'));
  assert.equal(receipt.extractionMode, 'release_eligible');
  assert.equal(receipt.externalUseAllowed, true);
  assert.equal(receipt.gates.every((gate) => gate.passed), true);
});

test('tampered sealed review evidence blocks extraction before output creation', async () => {
  const fixture = await createFixture({ approved: true });
  await writeFile(fixture.reportPath, '{"entries":[]}\n');
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /Review evidence integrity mismatch/);
  await assert.rejects(readFile(fixture.outputRoot), { code: 'ENOENT' });
});

test('owner decision receipt blocks schema-valid catalog gate tampering', async () => {
  const fixture = await createFixture({ approved: true });
  const catalog = JSON.parse(await readFile(fixture.catalogPath, 'utf8'));
  catalog.entries[0].rightsEvidenceRef = ['RIGHTS-EV-FORGED-001'];
  await writeFile(fixture.catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /Owner decision catalog SHA mismatch/);
});

test('owner decision receipt blocks ledger evidence tampering', async () => {
  const fixture = await createFixture({ approved: true });
  const ledger = JSON.parse(await readFile(fixture.approvalLedgerPath, 'utf8'));
  ledger.assetDecisions[0].evidenceRefs = ['RIGHTS-EV-FORGED-001'];
  await writeFile(fixture.approvalLedgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
  ]), /Owner decision receipt ledger SHA mismatch/);
});

test('public repository extraction additionally requires public Git scope and eligibility', async () => {
  const fixture = await createFixture({ approved: true });
  await assert.rejects(runExtract(fixture, [
    '--purpose', 'public-repository', '--destination-class', 'public-repository', '--approved-public-root', fixture.root,
  ]), /rightsScope.public_git_storage=absent/);
});

async function createFixture(options = {}) {
  const root = join(tmpdir(), `mg-catalog-${Date.now()}-${Math.random().toString(16).slice(2)}`);
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
  const decision = approved
    ? { humanReviewDecision: 'approved', claimDecision: 'not_applicable', privacyDecision: 'cleared', rightsDecision: 'verified', evidenceRefs: ['RIGHTS-EV-TEST-001'] }
    : { humanReviewDecision: 'pending', claimDecision: 'pending', privacyDecision: 'pending', rightsDecision: 'pending', evidenceRefs: [] };
  const globalDecision = (status, evidenceRefs = []) => ({ status, evidenceRefs, notes: '' });
  const approvalLedger = {
    schema: 'munjanggun.assetOwnerDecisions.v1', version: '1.0', intakeId: catalog.intakeId,
    generatedAt: '2026-09-05T00:00:00.000Z', catalogSha256: hash(await readFile(catalogPath)),
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
    sealedAt: '2026-09-05T00:00:00.000Z', catalogSha256: approvalLedger.catalogSha256,
    ledgerRef: 'owner-decisions.json', ledgerSha256: hash(await readFile(approvalLedgerPath)),
    globalDecisionStatus: globalStatuses.size === 1 ? [...globalStatuses][0] : 'mixed',
    assetDecisionCount: 1, escalationDecisionCount: approvalLedger.escalationDecisionCount,
  };
  await writeFile(approvalReceiptPath, `${JSON.stringify(approvalReceipt, null, 2)}\n`);
  return { root, objectRoot, outputRoot, evidenceRoot, evidenceReceiptPath, reportPath, catalogPath, approvalLedgerPath, approvalReceiptPath, entry, sha256 };
}

function runExtract(fixture, extras) {
  return execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-extract-content.mjs'), '--catalog', fixture.catalogPath,
    '--object-root', fixture.objectRoot, '--output-root', fixture.outputRoot,
    '--evidence-receipt', fixture.evidenceReceiptPath,
    '--approval-ledger', fixture.approvalLedgerPath, '--approval-receipt', fixture.approvalReceiptPath,
    '--content-id', fixture.entry.contentId, ...extras,
  ]);
}

function hash(value) { return createHash('sha256').update(value).digest('hex'); }
