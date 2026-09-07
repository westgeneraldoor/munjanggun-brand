import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildOwnerOrderDocuments, validateOwnerOrderDocuments } from '../scripts/lib/asset-owner-order.mjs';
import { validateAgainstSchema } from '../scripts/lib/schema-validation.mjs';

test('owner order records rights while public Git, signatures, claim, privacy, and escalation remain closed', async () => {
  const documents = buildDocuments(fixtureCatalog(), '2026-09-05T04:00:00.000Z', {
    reviewEvidenceReceiptRef: '../../review-evidence/receipt.json',
  });
  assert.deepEqual(validateOwnerOrderDocuments(documents), []);
  assert.equal(documents.attestation.document.signature, null);
  assert.equal(documents.useEvidenceReceipt.document.signature, null);
  assert.equal(documents.ownerDecisionReceipt.document.signature, null);
  assert.equal(documents.registry.document.entries.every((entry) => entry.status === 'attested_unsealed'), true);
  assert.equal(documents.catalog.document.entries.every((entry) => entry.rightsStatus === 'owner_approved_recorded' && entry.publishStatus === 'blocked' && entry.publicRepoEligibility === 'not_reviewed'), true);
  assert.equal(documents.ledger.document.rightsDecisions.internalPreservation.status, 'approved');
  assert.equal(documents.ledger.document.rightsDecisions.externalReuse.status, 'approved');
  assert.equal(documents.ledger.document.rightsDecisions.specialAssetRestrictions.status, 'approved');
  assert.equal(documents.ledger.document.rightsDecisions.publicGitStorage.status, 'pending');
  assert.equal(documents.ledger.document.assetDecisions.every((decision) => decision.rightsDecision === 'verified' && decision.humanReviewDecision === 'pending' && decision.claimDecision === 'pending' && decision.privacyDecision === 'pending'), true);
  assert.equal(documents.rightsState.document.effectiveAccess.privateCodexSource, 'allowed_by_recorded_owner_order');
  assert.equal(documents.rightsState.document.effectiveAccess.blogSnsPublication, 'blocked_pending_signature_claim_privacy_and_human_review');
  assert.equal(documents.rightsState.document.effectiveAccess.publicGit, 'blocked_owner_pending');
});

test('owner attestation and worker mapping remain separate, catalog-bound records', () => {
  const documents = buildDocuments();
  assert.equal('entries' in documents.attestation.document, false);
  assert.equal(documents.mapping.document.generatedBy, 'codex_worker_catalog_expansion');
  assert.equal(documents.mapping.document.assetCount, 407);
  assert.equal(documents.mapping.document.sourcePathCount, 1134);
  assert.equal(documents.mapping.document.catalogSha256, documents.catalog.sha256);
  assert.equal(documents.mapping.document.ownerAttestationSha256, documents.attestation.sha256);
  assert.equal(new Set(documents.mapping.document.entries.map((entry) => entry.sha256)).size, 407);
  assert.equal(documents.artifacts.every((artifact) => artifact.document.evidenceOrigin === 'owner_attestation_worker_mapping'), true);
  assert.equal(documents.artifacts.every((artifact) => JSON.stringify(artifact.document.channels) === JSON.stringify(['private_codex', 'blog', 'sns'])), true);
});

test('owner order schemas accept the generated fail-closed bundle', async () => {
  const documents = buildDocuments();
  const cases = [
    ['asset-content-catalog.schema.json', documents.catalog.document],
    ['asset-owner-attestation.schema.json', documents.attestation.document],
    ['asset-owner-attestation-mapping.schema.json', documents.mapping.document],
    ['asset-use-evidence-artifact.schema.json', documents.artifacts[0].document],
    ['asset-use-evidence-registry.schema.json', documents.registry.document],
    ['asset-use-evidence-receipt.schema.json', documents.useEvidenceReceipt.document],
    ['asset-owner-decisions.schema.json', documents.ledger.document],
    ['asset-owner-decision-receipt.schema.json', documents.ownerDecisionReceipt.document],
    ['asset-rights-state.schema.json', documents.rightsState.document],
  ];
  for (const [name, value] of cases) {
    const schema = JSON.parse(await readFile(resolve('schemas', name), 'utf8'));
    const result = validateAgainstSchema(value, schema);
    assert.equal(result.valid, true, `${name}: ${JSON.stringify(result.errors)}`);
  }
});

test('owner order invariant detects public Git or publication widening', () => {
  const documents = buildDocuments();
  documents.ledger.document.rightsDecisions.publicGitStorage.status = 'approved';
  documents.catalog.document.entries[0].publishStatus = 'eligible';
  const errors = validateOwnerOrderDocuments(documents);
  assert.match(errors.join('\n'), /public Git decision must remain pending/);
  assert.match(errors.join('\n'), /catalog release state is not fail-closed/);
});

test('owner order invariant detects a worker mapping pointed at the wrong catalog asset', () => {
  const documents = buildDocuments();
  documents.mapping.document.entries[0].contentId = 'CONTENT-WRONG';
  const errors = validateOwnerOrderDocuments(documents);
  assert.match(errors.join('\n'), /worker mapping target mismatch/);
});

test('owner order invariant rejects a channel wider than the owner attestation', () => {
  const documents = buildDocuments();
  documents.artifacts[0].document.channels.push('detail_page');
  const errors = validateOwnerOrderDocuments(documents);
  assert.match(errors.join('\n'), /owner rights artifact target mismatch/);
});

test('owner order invariant rejects verified registry status while receipts are unsigned', () => {
  const documents = buildDocuments();
  documents.registry.document.entries[0].status = 'verified';
  const errors = validateOwnerOrderDocuments(documents);
  assert.match(errors.join('\n'), /unsigned rights registry must remain attested_unsealed/);
});

test('owner order derives counts for a different future intake instead of requiring 407 assets', () => {
  const source = fixtureCatalog();
  source.intakeId = 'INTAKE-20261001-01';
  source.entries = source.entries.slice(0, 3);
  source.binaryGroupCount = 3;
  const documents = buildDocuments(source, '2026-10-01T01:00:00.000Z');
  assert.deepEqual(validateOwnerOrderDocuments(documents), []);
  assert.equal(documents.mapping.document.assetCount, 3);
  assert.equal(documents.mapping.document.sourcePathCount, 9);
  assert.deepEqual(documents.rightsState.document.remainingGates, {
    trustedOwnerSignature: 'missing', claimAssetCount: 3, privacyAssetCount: 3, escalationAssetCount: 3,
  });
});

test('owner order never applies the current owner decision to a future intake without explicit input', () => {
  assert.throws(() => buildOwnerOrderDocuments(fixtureCatalog()), /explicit intake-specific attestation input/);
});

test('owner order never expands an attestation to a changed catalog in the same intake', () => {
  const original = fixtureCatalog();
  const attestationInput = fixtureAttestation(original, '2026-09-05T04:00:00.000Z');
  const changed = structuredClone(original);
  changed.entries = changed.entries.slice(0, -1);
  changed.binaryGroupCount = changed.entries.length;
  assert.throws(() => buildOwnerOrderDocuments(changed, {
    attestationInput,
    sourceCatalogSha256: sourceCatalogHash(changed),
  }), /source catalog SHA-256 does not match/);
});

function buildDocuments(source = fixtureCatalog(), recordedAt = '2026-09-05T04:00:00.000Z', options = {}) {
  return buildOwnerOrderDocuments(source, {
    ...options,
    sourceCatalogSha256: sourceCatalogHash(source),
    attestationInput: fixtureAttestation(source, recordedAt),
  });
}

function fixtureAttestation(source, recordedAt) {
  const sourceGroupIds = [...new Set(source.entries.flatMap((entry) => entry.sourceRefs.map((ref) => ref.sourceId)))].sort();
  return {
    schema: 'munjanggun.assetOwnerAttestation.v1', version: '1.0',
    attestationId: `OWNER-ATTESTATION-${recordedAt.slice(0, 10).replaceAll('-', '')}-01`, intakeId: source.intakeId,
    sourceCatalogSha256: sourceCatalogHash(source),
    recordedAt, recordingContext: 'current_codex_session_user_instruction', sourceGroupIds,
    statements: {
      selfProduced: 'attested', privateCodexSourceUse: 'approved',
      externalReuse: { status: 'approved', channels: ['blog', 'sns'] },
      specialAssetRestrictions: 'no_additional_owner_restriction', publicGitStorage: 'pending',
    },
    excludedApprovals: { claimCurrentness: true, privacyClearance: true, humanReviewEscalations: true },
    signature: null,
  };
}

function sourceCatalogHash(source) {
  return createHash('sha256').update(`${JSON.stringify(source, null, 2)}\n`).digest('hex');
}

function fixtureCatalog() {
  const entries = Array.from({ length: 407 }, (_, index) => fixtureEntry(index));
  return {
    schema: 'munjanggun.assetContentCatalog.v2', version: '2.0', intakeId: 'INTAKE-20260904-01',
    generatedAt: '2026-09-04T00:00:00.000Z', reviewedAt: '2026-09-04T01:00:00.000Z', binaryGroupCount: entries.length,
    reviewEvidenceReceiptRef: '../review-evidence/receipt.json', reviewEvidenceReceiptSha256: 'e'.repeat(64), entries,
  };
}

function fixtureEntry(index) {
  const sha256 = createHash('sha256').update(`asset-${index}`).digest('hex');
  const sourcePathCount = index < 320 ? 3 : 2;
  const sourceRefs = Array.from({ length: sourcePathCount }, (_, refIndex) => ({
    sourceId: `SRC-2026-09-04-GROUP-${String((index + refIndex) % 10).padStart(2, '0')}`,
    sourceRelativePath: `group-${(index + refIndex) % 10}/asset-${index}-${refIndex}.jpg`,
  }));
  return {
    binaryGroupId: `sha256:${sha256}`, objectRef: `sha256/${sha256.slice(0, 2)}/${sha256}.jpg`, sha256, byteSize: 1,
    mediaType: 'image/jpeg', sourcePathCount, sourceRefs, contentId: `CONTENT-${String(index).padStart(4, '0')}`,
    visualGroupId: `VG-${String(index).padStart(4, '0')}`, comparisonMethod: ['sha256_exact', 'human_visual_review'],
    humanReviewStatus: index < 57 ? 'needs_escalation' : 'reviewed', semanticSummary: `asset ${index}`, ocrText: '', gifReviewStatus: 'not_applicable',
    claimSignals: index < 174 ? ['claim_requires_currentness'] : [], privacySignals: index < 15 ? ['privacy_requires_review'] : [],
    rightsSignals: ['source_rights_unverified'], rightsStatus: 'not_reviewed', rightsScope: [], rightsEvidenceRef: [], claimEvidenceRef: [],
    privacyStatus: 'not_reviewed', claimReviewStatus: 'not_reviewed', publishStatus: 'blocked', publicRepoEligibility: 'not_reviewed',
    reviewEvidenceRefs: [`review.json#sha256=${sha256}`],
  };
}
