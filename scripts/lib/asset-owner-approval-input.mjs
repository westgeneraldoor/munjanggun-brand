const BASELINE_RIGHTS_SIGNAL = 'source_rights_unverified';

export function buildOwnerApprovalInput(catalog, catalogSha256, generatedAt = new Date().toISOString()) {
  const entries = [...catalog.entries].sort((left, right) => left.sha256.localeCompare(right.sha256));
  const escalations = entries.filter(isEscalation);
  const claims = entries.filter(hasClaimSignals);
  const privacy = entries.filter(hasPrivacySignals);
  const specialRestrictions = entries.filter(isSpecialRestrictionCandidate);
  const sourceGroups = buildSourceGroups(entries);
  return {
    schema: 'munjanggun.assetOwnerApprovalInput.v1',
    version: '1.0',
    intakeId: catalog.intakeId,
    generatedAt,
    catalogSha256,
    authorityPolicy: 'worksheet_only_no_release_authority',
    inheritancePolicy: 'group_answers_do_not_automatically_authorize_assets',
    specialRestrictionSelectionPolicy: 'privacy_signal_or_nonbaseline_rights_signal',
    requiredTotals: {
      assets: entries.length,
      escalations: escalations.length,
      claimAssets: claims.length,
      privacyAssets: privacy.length,
      specialRestrictionAssets: specialRestrictions.length,
    },
    overlapSummary: {
      escalationAndClaim: entries.filter((entry) => isEscalation(entry) && hasClaimSignals(entry)).length,
      escalationAndPrivacy: entries.filter((entry) => isEscalation(entry) && hasPrivacySignals(entry)).length,
      claimAndPrivacy: entries.filter((entry) => hasClaimSignals(entry) && hasPrivacySignals(entry)).length,
      allThree: entries.filter((entry) => isEscalation(entry) && hasClaimSignals(entry) && hasPrivacySignals(entry)).length,
    },
    rightsAxes: pendingRightsAxes(),
    sourceGroups,
    groupReviewResponses: sourceGroups.map((group) => ({ sourceId: group.sourceId, rightsAxes: pendingRightsAxes() })),
    reviewQueues: {
      escalation: buildQueue(escalations),
      claim: buildQueue(claims),
      privacy: buildQueue(privacy),
      specialRestrictions: buildQueue(specialRestrictions),
    },
    assetExceptions: [],
  };
}

export function validateOwnerApprovalInputAgainstCatalog(input, catalog, catalogSha256) {
  const errors = [];
  if (input.catalogSha256 !== catalogSha256) errors.push('approval input catalog SHA mismatch');
  if (input.intakeId !== catalog.intakeId) errors.push('approval input intakeId mismatch');
  const expected = buildOwnerApprovalInput(catalog, catalogSha256, input.generatedAt);
  if (JSON.stringify(input.requiredTotals) !== JSON.stringify(expected.requiredTotals)) errors.push('approval input requiredTotals mismatch');
  if (JSON.stringify(input.overlapSummary) !== JSON.stringify(expected.overlapSummary)) errors.push('approval input overlapSummary mismatch');
  if (JSON.stringify(input.sourceGroups) !== JSON.stringify(expected.sourceGroups)) errors.push('approval input sourceGroups mismatch');
  for (const queueName of ['escalation', 'claim', 'privacy', 'specialRestrictions']) {
    const actual = input.reviewQueues?.[queueName];
    const wanted = expected.reviewQueues[queueName];
    if (!actual || actual.count !== actual.assets?.length || JSON.stringify(actual) !== JSON.stringify(wanted)) {
      errors.push(`approval input ${queueName} queue mismatch`);
    }
  }
  const expectedSourceIds = expected.sourceGroups.map((group) => group.sourceId);
  const responseIds = input.groupReviewResponses?.map((group) => group.sourceId) ?? [];
  if (new Set(responseIds).size !== responseIds.length || JSON.stringify([...responseIds].sort()) !== JSON.stringify(expectedSourceIds)) {
    errors.push('approval input groupReviewResponses coverage mismatch');
  }
  const catalogBySha = new Map(catalog.entries.map((entry) => [entry.sha256, entry]));
  const exceptionShas = new Set();
  for (const exception of input.assetExceptions ?? []) {
    if (exceptionShas.has(exception.sha256)) errors.push(`duplicate approval input asset exception ${exception.sha256}`);
    exceptionShas.add(exception.sha256);
    const entry = catalogBySha.get(exception.sha256);
    if (!entry || entry.contentId !== exception.contentId) errors.push(`approval input asset exception target mismatch ${exception.sha256}`);
  }
  return errors;
}

export function isSpecialRestrictionCandidate(entry) {
  return hasPrivacySignals(entry) || entry.rightsSignals.some((signal) => signal !== BASELINE_RIGHTS_SIGNAL);
}

function buildSourceGroups(entries) {
  const sourceIds = [...new Set(entries.flatMap((entry) => entry.sourceRefs.map((ref) => ref.sourceId)))].sort();
  return sourceIds.map((sourceId) => {
    const members = entries.filter((entry) => entry.sourceRefs.some((ref) => ref.sourceId === sourceId));
    const matchingRefs = members.flatMap((entry) => entry.sourceRefs.filter((ref) => ref.sourceId === sourceId));
    return {
      sourceId,
      label: sourceLabel(matchingRefs[0]?.sourceRelativePath, sourceId),
      assetCount: members.length,
      sourcePathCount: matchingRefs.length,
      escalationCount: members.filter(isEscalation).length,
      claimAssetCount: members.filter(hasClaimSignals).length,
      privacyAssetCount: members.filter(hasPrivacySignals).length,
      specialRestrictionAssetCount: members.filter(isSpecialRestrictionCandidate).length,
    };
  });
}

function buildQueue(entries) {
  const assets = entries.map((entry) => ({
    sha256: entry.sha256,
    contentId: entry.contentId,
    sourceGroupIds: [...new Set(entry.sourceRefs.map((ref) => ref.sourceId))].sort(),
  }));
  return { count: assets.length, assets };
}

function pendingRightsAxes() {
  return {
    internalPreservation: pendingDecision(),
    publicGitStorage: pendingDecision(),
    externalReuse: pendingDecision(),
    specialAssetRestrictions: pendingDecision(),
  };
}

function pendingDecision() {
  return { status: 'pending', evidenceRefs: [], notes: '' };
}

function sourceLabel(relativePath, fallback) {
  return String(relativePath ?? fallback).split(/[\\/]/)[0] || fallback;
}

function isEscalation(entry) {
  return entry.humanReviewStatus === 'needs_escalation';
}

function hasClaimSignals(entry) {
  return entry.claimSignals.length > 0;
}

function hasPrivacySignals(entry) {
  return entry.privacySignals.length > 0;
}
