import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildOwnerApprovalInput, validateOwnerApprovalInputAgainstCatalog } from '../scripts/lib/asset-owner-approval-input.mjs';
import { validateAgainstSchema } from '../scripts/lib/schema-validation.mjs';

const catalogSha256 = 'f'.repeat(64);

test('owner approval input keeps four axes pending and covers overlapping review queues exactly', async () => {
  const catalog = fixtureCatalog();
  const input = buildOwnerApprovalInput(catalog, catalogSha256, '2026-09-05T00:00:00.000Z');
  const schema = await readSchema();
  assert.equal(validateAgainstSchema(input, schema).valid, true);
  assert.deepEqual(input.requiredTotals, {
    assets: 4, escalations: 1, claimAssets: 2, privacyAssets: 1, specialRestrictionAssets: 2,
  });
  assert.deepEqual(input.overlapSummary, {
    escalationAndClaim: 1, escalationAndPrivacy: 1, claimAndPrivacy: 1, allThree: 1,
  });
  assert.deepEqual(Object.values(input.rightsAxes).map((decision) => decision.status), Array(4).fill('pending'));
  assert.equal(input.groupReviewResponses.length, 2);
  assert.equal(input.groupReviewResponses.every((group) => Object.values(group.rightsAxes).every((decision) => decision.status === 'pending')), true);
  assert.deepEqual(Object.fromEntries(Object.entries(input.reviewQueues).map(([name, queue]) => [name, queue.count])), {
    escalation: 1, claim: 2, privacy: 1, specialRestrictions: 2,
  });
  assert.deepEqual(validateOwnerApprovalInputAgainstCatalog(input, catalog, catalogSha256), []);
});

test('owner approval input schema rejects a non-pending group answer without evidence', async () => {
  const input = buildOwnerApprovalInput(fixtureCatalog(), catalogSha256, '2026-09-05T00:00:00.000Z');
  input.groupReviewResponses[0].rightsAxes.externalReuse.status = 'approved';
  const result = validateAgainstSchema(input, await readSchema());
  assert.equal(result.valid, false);
  assert.match(result.errors.map((error) => error.message).join('\n'), /must NOT have fewer than 1 items/);
});

test('catalog-bound validation rejects queue removal and source-group drift', () => {
  const catalog = fixtureCatalog();
  const input = buildOwnerApprovalInput(catalog, catalogSha256, '2026-09-05T00:00:00.000Z');
  input.reviewQueues.claim.assets.pop();
  input.reviewQueues.claim.count -= 1;
  input.sourceGroups[0].claimAssetCount -= 1;
  const errors = validateOwnerApprovalInputAgainstCatalog(input, catalog, catalogSha256);
  assert.match(errors.join('\n'), /sourceGroups mismatch/);
  assert.match(errors.join('\n'), /claim queue mismatch/);
});

test('catalog-bound validation rejects duplicate exceptions and wrong targets', () => {
  const catalog = fixtureCatalog();
  const input = buildOwnerApprovalInput(catalog, catalogSha256, '2026-09-05T00:00:00.000Z');
  const exception = {
    sha256: 'a'.repeat(64), contentId: 'WRONG', humanReviewDecision: 'pending', claimDecision: 'pending',
    privacyDecision: 'pending', rightsDecision: 'pending', rightsEvidenceRefs: [], claimEvidenceRefs: [], notes: '',
  };
  input.assetExceptions = [exception, { ...exception }];
  const errors = validateOwnerApprovalInputAgainstCatalog(input, catalog, catalogSha256);
  assert.match(errors.join('\n'), /target mismatch/);
  assert.match(errors.join('\n'), /duplicate/);
});

test('owner decision schema keeps rights and verified claim decisions fail-closed without evidence', async () => {
  const schema = JSON.parse(await readFile(resolve('schemas/asset-owner-decisions.schema.json'), 'utf8'));
  const globalWithoutEvidence = ownerDecisionFixture();
  globalWithoutEvidence.rightsDecisions.externalReuse.status = 'approved';
  assert.equal(validateAgainstSchema(globalWithoutEvidence, schema).valid, false);

  const assetWithoutEvidence = ownerDecisionFixture();
  assetWithoutEvidence.assetDecisions[0].rightsDecision = 'verified';
  assetWithoutEvidence.assetDecisions[0].claimDecision = 'verified';
  assert.equal(validateAgainstSchema(assetWithoutEvidence, schema).valid, false);
});

function fixtureCatalog() {
  return {
    intakeId: 'INTAKE-20260904-01',
    entries: [
      entry('a', ['SRC-A', 'SRC-B'], { escalation: true, claim: ['price'], privacy: ['person'], rights: ['source_rights_unverified', 'model_release_unverified'] }),
      entry('b', ['SRC-A'], { claim: ['service'], rights: ['source_rights_unverified'] }),
      entry('c', ['SRC-B'], { rights: ['source_rights_unverified', 'campaign_creative_rights_scope_check'] }),
      entry('d', ['SRC-B'], { rights: ['source_rights_unverified'] }),
    ],
  };
}

function entry(seed, sourceIds, options = {}) {
  const sha256 = seed.repeat(64);
  return {
    sha256,
    contentId: `CONTENT-${seed.toUpperCase()}`,
    humanReviewStatus: options.escalation ? 'needs_escalation' : 'reviewed',
    claimSignals: options.claim ?? [],
    privacySignals: options.privacy ?? [],
    rightsSignals: options.rights ?? [],
    sourceRefs: sourceIds.map((sourceId) => ({ sourceId, sourceRelativePath: `${sourceId}/asset-${seed}.jpg` })),
  };
}

async function readSchema() {
  return JSON.parse(await readFile(resolve('schemas/asset-owner-approval-input.schema.json'), 'utf8'));
}

function ownerDecisionFixture() {
  const pending = () => ({ status: 'pending', evidenceRefs: [], notes: '' });
  return {
    schema: 'munjanggun.assetOwnerDecisions.v1', version: '1.0', intakeId: 'INTAKE-20260904-01',
    generatedAt: '2026-09-05T00:00:00.000Z', catalogSha256: 'd'.repeat(64), useEvidenceReceiptSha256: 'e'.repeat(64),
    inheritancePolicy: 'global_answers_do_not_propagate_to_asset_decisions',
    rightsDecisions: {
      internalPreservation: pending(), publicGitStorage: pending(), externalReuse: pending(), specialAssetRestrictions: pending(),
    },
    assetDecisionCount: 1,
    assetDecisions: [{
      sha256: 'a'.repeat(64), contentId: 'CONTENT-A', needsEscalation: false, humanReviewDecision: 'pending', claimDecision: 'pending',
      privacyDecision: 'pending', rightsDecision: 'pending', rightsEvidenceRefs: [], claimEvidenceRefs: [], notes: '',
    }],
    escalationDecisionCount: 0,
    escalationDecisions: [],
  };
}
