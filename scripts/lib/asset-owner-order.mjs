import { createHash } from 'node:crypto';

export function buildOwnerOrderDocuments(sourceCatalog, {
  recordedAt = new Date().toISOString(),
  attestationId = defaultAttestationId(recordedAt),
  catalogRef = 'reviewed-content-catalog-v6.json',
  reviewEvidenceReceiptRef,
} = {}) {
  const sortedEntries = [...sourceCatalog.entries].sort((left, right) => left.sha256.localeCompare(right.sha256));
  const sourceGroupIds = [...new Set(sortedEntries.flatMap((entry) => entry.sourceRefs.map((ref) => ref.sourceId)))].sort();
  const evidenceIdBySha = new Map(sortedEntries.map((entry) => [entry.sha256, `RIGHTS-EV-OWNER-ORDER-${entry.sha256.slice(0, 16).toUpperCase()}`]));
  const catalog = {
    ...sourceCatalog,
    generatedAt: recordedAt,
    reviewEvidenceReceiptRef: reviewEvidenceReceiptRef ?? sourceCatalog.reviewEvidenceReceiptRef,
    entries: sortedEntries.map((entry) => ({
      ...entry,
      rightsSignals: [...new Set(entry.rightsSignals.map((signal) => signal === 'source_rights_unverified' ? 'owner_attested_self_produced_pending_signature' : signal))],
      rightsStatus: 'pending',
      rightsScope: ['internal_preservation', 'private_codex_source', 'external_reuse'],
      rightsEvidenceRef: [evidenceIdBySha.get(entry.sha256)],
      publishStatus: 'blocked',
      publicRepoEligibility: 'not_reviewed',
    })),
  };
  const catalogText = jsonText(catalog);
  const catalogSha256 = hash(catalogText);
  const attestation = {
    schema: 'munjanggun.assetOwnerAttestation.v1',
    version: '1.0',
    attestationId,
    intakeId: catalog.intakeId,
    recordedAt,
    recordingContext: 'current_codex_session_user_instruction',
    sourceGroupIds,
    statements: {
      selfProduced: 'attested',
      privateCodexSourceUse: 'approved',
      externalReuse: { status: 'approved', channels: ['blog', 'sns'] },
      specialAssetRestrictions: 'no_additional_owner_restriction',
      publicGitStorage: 'pending',
    },
    excludedApprovals: { claimCurrentness: true, privacyClearance: true, humanReviewEscalations: true },
    signature: null,
  };
  const attestationText = jsonText(attestation);
  const attestationSha256 = hash(attestationText);
  const mapping = {
    schema: 'munjanggun.assetOwnerAttestationMapping.v1',
    version: '1.0',
    intakeId: catalog.intakeId,
    generatedAt: recordedAt,
    generatedBy: 'codex_worker_catalog_expansion',
    mappingMethod: 'exact_catalog_sha_membership',
    catalogRef,
    catalogSha256,
    ownerAttestationRef: 'owner-rights-attestation.json',
    ownerAttestationSha256: attestationSha256,
    assetCount: catalog.entries.length,
    sourcePathCount: catalog.entries.reduce((sum, entry) => sum + entry.sourcePathCount, 0),
    entries: catalog.entries.map((entry) => {
      const evidenceId = evidenceIdBySha.get(entry.sha256);
      return {
        sha256: entry.sha256,
        contentId: entry.contentId,
        evidenceId,
        artifactRef: `evidence/assets/${evidenceId}.json`,
        sourceGroupIds: [...new Set(entry.sourceRefs.map((ref) => ref.sourceId))].sort(),
        sourcePathCount: entry.sourcePathCount,
      };
    }),
  };
  const mappingText = jsonText(mapping);
  const mappingSha256 = hash(mappingText);
  const artifacts = catalog.entries.map((entry) => {
    const evidenceId = evidenceIdBySha.get(entry.sha256);
    const document = {
      schema: 'munjanggun.assetUseEvidenceArtifact.v1',
      version: '1.0',
      evidenceId,
      kind: 'rights',
      decisionRef: attestationId,
      decisionStatus: 'verified',
      subjectSha256: entry.sha256,
      contentId: entry.contentId,
      scopes: ['internal_preservation', 'external_reuse'],
      channels: ['private_codex', 'blog', 'sns'],
      validFrom: recordedAt,
      validUntil: null,
      assertedBy: `owner-attestation:${attestationId}`,
      assertedAt: recordedAt,
      sourceEvidenceRefs: [
        `owner-rights-attestation.json#sha256=${attestationSha256}`,
        `owner-attestation-mapping.json#sha256=${mappingSha256}`,
      ],
      evidenceOrigin: 'owner_attestation_worker_mapping',
      ownerAttestationRef: 'owner-rights-attestation.json',
      ownerAttestationSha256: attestationSha256,
      workerMappingRef: 'owner-attestation-mapping.json',
      workerMappingSha256: mappingSha256,
    };
    const text = jsonText(document);
    return { evidenceId, relativePath: `evidence/assets/${evidenceId}.json`, document, text, byteSize: Buffer.byteLength(text), sha256: hash(text) };
  });
  const registry = {
    schema: 'munjanggun.assetUseEvidenceRegistry.v1',
    version: '1.0',
    intakeId: catalog.intakeId,
    catalogSha256,
    sealedAt: recordedAt,
    entryCount: artifacts.length,
    entries: artifacts.map((artifact) => {
      const entry = catalog.entries.find((candidate) => evidenceIdBySha.get(candidate.sha256) === artifact.evidenceId);
      return {
        evidenceId: artifact.evidenceId,
        kind: 'rights',
        status: 'attested_unsealed',
        subjectSha256: entry.sha256,
        contentId: entry.contentId,
        scopes: artifact.document.scopes,
        channels: artifact.document.channels,
        validFrom: recordedAt,
        validUntil: null,
        artifactRef: artifact.relativePath,
        artifactByteSize: artifact.byteSize,
        artifactSha256: artifact.sha256,
        issuer: artifact.document.assertedBy,
        decisionRef: attestationId,
      };
    }),
  };
  const registryText = jsonText(registry);
  const registrySha256 = hash(registryText);
  const useEvidenceReceipt = {
    schema: 'munjanggun.assetUseEvidenceReceipt.v1',
    version: '1.0',
    intakeId: catalog.intakeId,
    sealedAt: recordedAt,
    catalogSha256,
    registryRef: 'use-evidence-registry.json',
    registrySha256,
    fileCount: artifacts.length,
    treeHash: receiptTreeHash(artifacts),
    entries: artifacts.map((artifact) => ({ evidenceId: artifact.evidenceId, relativePath: artifact.relativePath, byteSize: artifact.byteSize, sha256: artifact.sha256 })),
    signature: null,
  };
  const useEvidenceReceiptText = jsonText(useEvidenceReceipt);
  const useEvidenceReceiptSha256 = hash(useEvidenceReceiptText);
  const evidenceIds = artifacts.map((artifact) => artifact.evidenceId);
  const globalDecision = (status, evidenceRefs, notes) => ({ status, evidenceRefs, notes });
  const assetDecisions = catalog.entries.map((entry) => ({
    sha256: entry.sha256,
    contentId: entry.contentId,
    needsEscalation: entry.humanReviewStatus === 'needs_escalation',
    humanReviewDecision: 'pending',
    claimDecision: 'pending',
    privacyDecision: 'pending',
    rightsDecision: 'verified',
    rightsEvidenceRefs: [evidenceIdBySha.get(entry.sha256)],
    claimEvidenceRefs: [],
    notes: 'Owner rights order recorded; human review, claim currentness, and privacy remain separate pending gates.',
  }));
  const ledger = {
    schema: 'munjanggun.assetOwnerDecisions.v1',
    version: '1.0',
    intakeId: catalog.intakeId,
    generatedAt: recordedAt,
    catalogSha256,
    useEvidenceReceiptSha256,
    inheritancePolicy: 'global_answers_do_not_propagate_to_asset_decisions',
    rightsDecisions: {
      internalPreservation: globalDecision('approved', evidenceIds, 'Owner attested self-production and private preservation permission.'),
      publicGitStorage: globalDecision('pending', [], 'Public Git storage remains pending and blocked.'),
      externalReuse: globalDecision('approved', evidenceIds, 'Owner approved blog and SNS reuse; claim and privacy gates remain separate.'),
      specialAssetRestrictions: globalDecision('approved', evidenceIds, 'No additional owner restriction; this is not privacy clearance or third-party consent.'),
    },
    assetDecisionCount: assetDecisions.length,
    assetDecisions,
    escalationDecisionCount: assetDecisions.filter((decision) => decision.needsEscalation).length,
    escalationDecisions: assetDecisions.filter((decision) => decision.needsEscalation).map(({ needsEscalation, ...decision }) => decision),
  };
  const ledgerText = jsonText(ledger);
  const ledgerSha256 = hash(ledgerText);
  const ownerDecisionReceipt = {
    schema: 'munjanggun.assetOwnerDecisionReceipt.v1',
    version: '1.0',
    intakeId: catalog.intakeId,
    sealedAt: recordedAt,
    catalogSha256,
    useEvidenceReceiptSha256,
    ledgerRef: 'owner-decisions.json',
    ledgerSha256,
    globalDecisionStatus: 'mixed',
    assetDecisionCount: assetDecisions.length,
    escalationDecisionCount: ledger.escalationDecisionCount,
    signature: null,
  };
  const ownerDecisionReceiptText = jsonText(ownerDecisionReceipt);
  const ownerDecisionReceiptSha256 = hash(ownerDecisionReceiptText);
  const rightsState = {
    schema: 'munjanggun.assetRightsState.v1',
    version: '1.0',
    intakeId: catalog.intakeId,
    generatedAt: recordedAt,
    catalogSha256,
    ownerAttestation: { ref: 'owner-rights-attestation.json', sha256: attestationSha256, status: 'recorded_unsigned' },
    workerMapping: { ref: 'owner-attestation-mapping.json', sha256: mappingSha256, status: 'verified_catalog_membership' },
    ownerDecisionLedger: { ref: 'owner-decisions.json', sha256: ledgerSha256, status: 'recorded_unsigned' },
    effectiveAccess: {
      privatePreservation: 'allowed_by_recorded_owner_order',
      privateCodexSource: 'allowed_by_recorded_owner_order',
      blogSnsRights: 'owner_approved_unsealed',
      blogSnsPublication: 'blocked_pending_signature_claim_privacy_and_human_review',
      publicGit: 'blocked_owner_pending',
    },
    remainingGates: { trustedOwnerSignature: 'missing', claimAssetCount: 174, privacyAssetCount: 15, escalationAssetCount: 57 },
  };
  return {
    catalog: { document: catalog, text: catalogText, sha256: catalogSha256 },
    attestation: { document: attestation, text: attestationText, sha256: attestationSha256 },
    mapping: { document: mapping, text: mappingText, sha256: mappingSha256 },
    artifacts,
    registry: { document: registry, text: registryText, sha256: registrySha256 },
    useEvidenceReceipt: { document: useEvidenceReceipt, text: useEvidenceReceiptText, sha256: useEvidenceReceiptSha256 },
    ledger: { document: ledger, text: ledgerText, sha256: ledgerSha256 },
    ownerDecisionReceipt: { document: ownerDecisionReceipt, text: ownerDecisionReceiptText, sha256: ownerDecisionReceiptSha256 },
    rightsState: { document: rightsState, text: jsonText(rightsState) },
  };
}

export function validateOwnerOrderDocuments(documents) {
  const errors = [];
  const { catalog, attestation, mapping, artifacts, registry, useEvidenceReceipt, ledger, ownerDecisionReceipt, rightsState } = documents;
  const catalogBySha = new Map(catalog.document.entries.map((entry) => [entry.sha256, entry]));
  const artifactById = new Map(artifacts.map((artifact) => [artifact.evidenceId, artifact]));
  if (catalog.document.entries.length !== 407) errors.push('catalog asset count must be 407');
  if (mapping.document.assetCount !== 407 || mapping.document.entries.length !== 407) errors.push('worker mapping asset count mismatch');
  if (mapping.document.sourcePathCount !== 1134) errors.push('worker mapping source path count must be 1134');
  if (new Set(mapping.document.entries.map((entry) => entry.sha256)).size !== 407) errors.push('worker mapping SHA coverage mismatch');
  if (artifacts.length !== 407 || registry.document.entryCount !== 407 || useEvidenceReceipt.document.fileCount !== 407) errors.push('rights artifact coverage mismatch');
  if (registry.document.entries.some((entry) => entry.status !== 'attested_unsealed')) errors.push('unsigned rights registry must remain attested_unsealed');
  if (ledger.document.assetDecisionCount !== 407 || ledger.document.escalationDecisionCount !== 57) errors.push('owner decision coverage mismatch');
  if (catalog.document.entries.filter((entry) => entry.claimSignals.length > 0).length !== 174) errors.push('claim gate count mismatch');
  if (catalog.document.entries.filter((entry) => entry.privacySignals.length > 0).length !== 15) errors.push('privacy gate count mismatch');
  if (catalog.document.entries.some((entry) => entry.publishStatus !== 'blocked' || entry.publicRepoEligibility !== 'not_reviewed' || entry.rightsStatus !== 'pending')) errors.push('catalog release state is not fail-closed');
  if (ledger.document.rightsDecisions.publicGitStorage.status !== 'pending') errors.push('public Git decision must remain pending');
  if (ledger.document.assetDecisions.some((decision) => decision.humanReviewDecision !== 'pending' || decision.claimDecision !== 'pending' || decision.privacyDecision !== 'pending')) errors.push('non-rights asset gates were changed');
  if (attestation.document.signature !== null || useEvidenceReceipt.document.signature !== null || ownerDecisionReceipt.document.signature !== null) errors.push('unsigned documents must not contain a signature');
  if (rightsState.document.effectiveAccess.publicGit !== 'blocked_owner_pending' || !rightsState.document.effectiveAccess.blogSnsPublication.startsWith('blocked_')) errors.push('effective access is not fail-closed');
  const expectedSourceGroups = [...new Set(catalog.document.entries.flatMap((entry) => entry.sourceRefs.map((ref) => ref.sourceId)))].sort();
  if (JSON.stringify(attestation.document.sourceGroupIds) !== JSON.stringify(expectedSourceGroups)) errors.push('owner attestation source group coverage mismatch');
  for (const mapped of mapping.document.entries) {
    const catalogEntry = catalogBySha.get(mapped.sha256);
    const expectedEvidenceId = `RIGHTS-EV-OWNER-ORDER-${mapped.sha256.slice(0, 16).toUpperCase()}`;
    const expectedGroups = catalogEntry ? [...new Set(catalogEntry.sourceRefs.map((ref) => ref.sourceId))].sort() : [];
    if (!catalogEntry || mapped.contentId !== catalogEntry.contentId || mapped.sourcePathCount !== catalogEntry.sourcePathCount
      || JSON.stringify(mapped.sourceGroupIds) !== JSON.stringify(expectedGroups) || mapped.evidenceId !== expectedEvidenceId
      || mapped.artifactRef !== `evidence/assets/${expectedEvidenceId}.json`) {
      errors.push(`worker mapping target mismatch: ${mapped.sha256}`);
      continue;
    }
    if (JSON.stringify(catalogEntry.rightsEvidenceRef) !== JSON.stringify([mapped.evidenceId])) errors.push(`catalog rights evidence binding mismatch: ${mapped.sha256}`);
    const artifact = artifactById.get(mapped.evidenceId)?.document;
    if (!artifact || artifact.subjectSha256 !== mapped.sha256 || artifact.contentId !== mapped.contentId
      || artifact.ownerAttestationSha256 !== attestation.sha256 || artifact.workerMappingSha256 !== mapping.sha256
      || JSON.stringify(artifact.channels) !== JSON.stringify(['private_codex', 'blog', 'sns'])
      || JSON.stringify(artifact.scopes) !== JSON.stringify(['internal_preservation', 'external_reuse'])) {
      errors.push(`owner rights artifact target mismatch: ${mapped.evidenceId}`);
    }
  }
  return errors;
}

export function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function receiptTreeHash(artifacts) {
  const digest = createHash('sha256');
  for (const artifact of artifacts) digest.update(`${artifact.evidenceId}\0${artifact.relativePath}\0${artifact.byteSize}\0${artifact.sha256}\n`, 'utf8');
  return digest.digest('hex');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function defaultAttestationId(recordedAt) {
  const date = recordedAt.slice(0, 10).replaceAll('-', '');
  return `OWNER-ATTESTATION-${date}-01`;
}
