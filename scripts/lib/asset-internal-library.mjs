import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  lstat, mkdir, readFile, realpath, rename, rm, writeFile,
} from 'node:fs/promises';
import {
  dirname, isAbsolute, parse, relative, resolve, sep,
} from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { verifyGitCommittedConsumerPolicy, verifyGitIgnoredConsumerDestination } from './asset-library.mjs';
import { parseContentReviewerTrust, verifyTrustedContentReviewerSignature } from './asset-content-reviewer-trust.mjs';

const execFileAsync = promisify(execFile);
const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DEFAULT_CONSUMER_POLICY = resolve(fileURLToPath(new URL('../../config/asset-library-consumers.json', import.meta.url)));
const DEFAULT_STORY_CONTEXTS = resolve(fileURLToPath(new URL('../../config/product-story-contexts.json', import.meta.url)));
const DEFAULT_TRUSTED_ROOTS = [
  'C:/Users/hjh/안티그래비티/문장군_브랜드_private',
  'Z:/문장군_브랜드_원본보관',
].map((value) => resolve(value));
const REQUIRED_REMAINING_GATES = [
  'independent_secondary_semantic_verdict_for_489_assets_bound_to_final_primary_decisions',
  'continuous_original_playback_or_all_decoded_frames_review_for_80_gifs',
];

export async function loadInternalAssetLibrary(configPath, {
  repoRoot = DEFAULT_REPO_ROOT,
  trustedPrivateRoots = DEFAULT_TRUSTED_ROOTS,
  consumerPolicyPath = DEFAULT_CONSUMER_POLICY,
  consumerPolicy = null,
  storyContextPath = DEFAULT_STORY_CONTEXTS,
  storyContexts = null,
  verifyCommittedConfig = verifyGitCommittedJson,
  verifyCommittedConsumers = verifyGitCommittedConsumerPolicy,
  verifyOriginals = true,
} = {}) {
  const configFile = await assertRepositoryFile(configPath, repoRoot, 'Internal library config');
  const configBytes = await readFile(configFile);
  await verifyCommittedConfig(configFile, repoRoot);
  const config = JSON.parse(configBytes.toString('utf8'));
  validateConfig(config);

  const pointerPath = await assertTrustedFile(config.activePointerPath, trustedPrivateRoots, 'Primary review pointer');
  const pointerBytes = await readFile(pointerPath);
  assertDigest(pointerBytes, config.activePointerSha256, 'Primary review pointer');
  const pointer = JSON.parse(pointerBytes.toString('utf8'));
  validatePointer(pointer);

  const refs = {
    directReviewReceipt: pointer.directReviewReceipt,
    structuredLedger: pointer.structuredLedger,
    primaryCandidate: pointer.primaryCandidate,
    pixelEvidenceIndex: pointer.pixelEvidenceIndex,
    primaryAttestation: pointer.primaryAttestation,
  };
  const loaded = {};
  for (const [name, ref] of Object.entries(refs)) {
    const path = await assertTrustedFile(ref?.path, trustedPrivateRoots, name);
    const bytes = await readFile(path);
    assertDigest(bytes, ref.sha256, name);
    loaded[name] = { path, bytes, value: JSON.parse(bytes.toString('utf8')) };
  }

  const trustPath = await assertTrustedFile(config.reviewerTrustPath, trustedPrivateRoots, 'Primary reviewer trust');
  const trustBytes = await readFile(trustPath);
  assertDigest(trustBytes, config.reviewerTrustSha256, 'Primary reviewer trust');
  const trust = parseContentReviewerTrust(trustBytes);
  const candidate = loaded.primaryCandidate.value;
  const evidence = loaded.pixelEvidenceIndex.value;
  const attestation = loaded.primaryAttestation.value;
  const signer = verifyTrustedContentReviewerSignature(
    attestation, attestation.reviewerPrincipalId, trust, 'Primary review attestation',
  );
  validateBindings({ pointer, candidate, evidence, attestation, signer });

  const records = await validateRecords(candidate.records, trustedPrivateRoots, { verifyOriginals });
  let consumers = consumerPolicy;
  if (!consumers) {
    const policyPath = await assertRepositoryFile(consumerPolicyPath, repoRoot, 'Consumer policy');
    await verifyCommittedConsumers(policyPath, repoRoot);
    consumers = JSON.parse(await readFile(policyPath, 'utf8'));
  }
  validateConsumers(consumers);

  let productStoryContexts = storyContexts;
  let storyContextMetadata;
  if (!productStoryContexts) {
    const contextFile = await assertRepositoryFile(storyContextPath, repoRoot, 'Product story contexts');
    const contextBytes = await readFile(contextFile);
    productStoryContexts = JSON.parse(contextBytes.toString('utf8'));
    storyContextMetadata = {
      path: contextFile, schema: productStoryContexts.schema, version: productStoryContexts.version,
      updatedAt: productStoryContexts.updatedAt, sha256: digest(contextBytes),
    };
  } else {
    storyContextMetadata = {
      path: null, schema: productStoryContexts.schema, version: productStoryContexts.version,
      updatedAt: productStoryContexts.updatedAt ?? null,
      sha256: digest(Buffer.from(canonicalJson(productStoryContexts), 'utf8')),
    };
  }
  productStoryContexts = validateStoryContexts(productStoryContexts);
  validateStoryContextBindings(productStoryContexts, records);

  return {
    configPath: configFile,
    configSha256: digest(configBytes),
    config,
    pointerPath,
    pointerSha256: digest(pointerBytes),
    pointer,
    candidatePath: loaded.primaryCandidate.path,
    candidateSha256: pointer.primaryCandidate.sha256,
    candidate,
    signer,
    records,
    consumers,
    productStoryContexts,
    storyContextMetadata,
    trustedPrivateRoots,
  };
}

export function searchInternalAssetLibrary(library, criteria, { mediaType, limit = 20, storyContext = null } = {}) {
  const normalized = compactCriteria(criteria);
  if (Object.keys(normalized).length === 0) {
    throw new Error('Provide at least one criterion: query, product, scene, color, design, or topic');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('limit must be an integer from 1 to 500');
  const productRequest = analyzeProductRequest(library.productStoryContexts, criteria);
  const requestScope = storyContext ? determineRequestScope(storyContext, criteria, productRequest) : null;
  if (requestScope && ['comparison_requires_split', 'conflicting_options_requires_clarification'].includes(requestScope.kind)) return [];
  const matches = library.records
    .filter((record) => !mediaType || mediaTypeFor(record) === mediaType)
    .map((record) => ({ record, dimensions: matchDimensions(record, normalized, storyContext, requestScope) }))
    .filter(({ dimensions }) => Object.keys(dimensions).length === Object.keys(normalized).length)
    .map(({ record, dimensions }) => summarizeRecord(
      record, dimensions, scoreRecord(record, normalized, storyContext), storyContext, requestScope,
    ))
    .sort((left, right) => compareSearchResults(left, right, storyContext, requestScope))
    .slice(0, limit);
  return matches.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function buildInternalAssetBrief(library, criteria, results) {
  const context = resolveProductStoryContext(library.productStoryContexts, criteria);
  if (!context) return null;
  const productRequest = analyzeProductRequest(library.productStoryContexts, criteria);
  const requestScope = determineRequestScope(context, criteria, productRequest);
  const coverage = buildStoryCoverage(context, results);
  const requestResolution = buildRequestResolution(requestScope, results);
  return {
    schema: 'munjanggun.assetInternalContentBrief.v1',
    contextId: context.contextId,
    productId: context.productId,
    authorityStatus: context.authorityStatus,
    storyContextProvenance: {
      ...library.storyContextMetadata,
      contextId: context.contextId,
      sourceIds: context.sourceIds,
    },
    requestScope,
    productSummary: context.summary,
    wholeProductRule: context.wholeProductRule,
    subsetRule: context.subsetRule,
    optionSets: context.optionSets,
    storyOutline: context.sections.map(({ sectionId, order, label, summary }) => ({ sectionId, order, label, summary })),
    sourceWarnings: context.sourceWarnings ?? [],
    applicableConstraints: applicableConstraints(context, requestScope),
    requestResolution,
    resultCoverage: coverage,
    completionAssessment: buildCompletionAssessment(context, requestScope, coverage, requestResolution),
    writingGuardrails: context.writingGuardrails,
  };
}

export function resolveProductStoryContext(contexts, criteria) {
  return analyzeProductRequest(contexts, criteria).primaryContext;
}

function analyzeProductRequest(contexts, criteria) {
  const productMentions = findProductMentions(contexts, criteria?.product, 'product');
  const queryMentions = findProductMentions(contexts, criteria?.query, 'query');
  const orderedMentions = [...productMentions, ...queryMentions];
  const targets = uniqueMentionsByContext(orderedMentions);
  return {
    primaryContext: productMentions[0]?.context ?? queryMentions[0]?.context ?? null,
    targets: targets.map((mention) => ({
      contextId: mention.context.contextId,
      productId: mention.context.productId,
      label: mention.context.productNames[0],
      matchedAlias: mention.matchedAlias,
      inputField: mention.inputField,
    })),
    mentions: orderedMentions,
  };
}

function findProductMentions(contexts, value, inputField) {
  const compact = normalizeCompact(value);
  if (!compact) return [];
  const candidates = (contexts ?? []).flatMap((context) => context.productNames.flatMap((name) => {
    const alias = normalizeCompact(name);
    const start = compact.indexOf(alias);
    return start < 0 ? [] : [{ context, matchedAlias: name, inputField, start, end: start + alias.length, aliasLength: alias.length }];
  }));
  const unshadowed = candidates.filter((candidate) => !candidates.some((other) => other.context.contextId !== candidate.context.contextId
    && other.aliasLength > candidate.aliasLength && other.start <= candidate.start && other.end >= candidate.end));
  return uniqueMentionsByContext(unshadowed.sort((left, right) => left.start - right.start || right.aliasLength - left.aliasLength));
}

function uniqueMentionsByContext(mentions) {
  const seen = new Set();
  return mentions.filter((mention) => {
    if (seen.has(mention.context.contextId)) return false;
    seen.add(mention.context.contextId);
    return true;
  });
}

export async function writeInternalAssetHandoff(library, results, selectedSha256s, {
  consumerId,
  outputName,
  contentBrief = null,
  repoRoot = DEFAULT_REPO_ROOT,
  verifyConsumerDestination = verifyGitIgnoredConsumerDestination,
  generatedAt = new Date().toISOString(),
} = {}) {
  const hashes = [...new Set(selectedSha256s ?? [])];
  if (hashes.length === 0) throw new Error('Select at least one sha256');
  if (contentBrief && contentBrief.storyContextProvenance?.sha256 !== library.storyContextMetadata?.sha256) {
    throw new Error('Content brief story context SHA-256 does not match the loaded story context');
  }
  const selected = hashes.map((hash) => {
    const matches = results.filter((entry) => entry.sha256 === hash);
    if (matches.length !== 1) throw new Error(`Selected sha256 is not uniquely present in current results: ${hash}`);
    return matches[0];
  }).sort((left, right) => compareHandoffEntries(left, right, contentBrief?.requestScope));
  const consumer = library.consumers.find((entry) => entry.consumerId === consumerId);
  if (!consumer) throw new Error(`Unknown registered consumer: ${consumerId ?? 'missing'}`);
  if (!outputName || outputName.includes('..') || /[\\/]/u.test(outputName)) {
    throw new Error('Registered consumer selection requires one safe outputName');
  }
  const approvedRoot = resolve(consumer.privateRoot);
  const destination = resolve(approvedRoot, outputName);
  if (!isContained(approvedRoot, destination) || destination === approvedRoot) throw new Error('Handoff destination escapes consumer root');
  if (isContained(repoRoot, destination) || isContained(destination, repoRoot)) throw new Error('Public Git/repository output is prohibited');
  await assertRealDirectory(approvedRoot, 'Consumer private root');
  if (consumer.requireGitIgnored) await verifyConsumerDestination(approvedRoot, destination);
  await assertNoSymlinkSegments(approvedRoot, dirname(destination), 'Handoff destination');
  try {
    await lstat(destination);
    throw new Error('Handoff destination already exists');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const entry of selected) {
    const bytes = await readFile(entry.originalPath);
    assertDigest(bytes, entry.sha256, `Selected original ${entry.sha256}`);
  }

  const handoff = {
    schema: 'munjanggun.assetInternalLibraryHandoff.v1',
    version: '1.0',
    generatedAt,
    libraryId: library.config.libraryId,
    mode: 'primary_reviewed_internal_only',
    authorityStatus: 'non_authority',
    authorityHashes: {
      configSha256: library.configSha256,
      activePointerSha256: library.pointerSha256,
      primaryCandidateSha256: library.candidateSha256,
      primaryAttestationSha256: library.pointer.primaryAttestation.sha256,
      pixelEvidenceIndexSha256: library.pointer.pixelEvidenceIndex.sha256,
      storyContextSha256: library.storyContextMetadata?.sha256 ?? null,
    },
    storyContext: contentBrief?.storyContextProvenance ?? null,
    consumer: { consumerId: consumer.consumerId, channel: consumer.channel },
    selectionCount: selected.length,
    containsBinaryCopies: false,
    contentBrief,
    selected,
    usageNotice: {
      internalSearchPreview: 'allowed_primary_reviewed',
      externalPublication: 'blocked_selected_asset_review_required',
      publicGit: 'blocked',
      instruction: '게시할 자산만 원본 문구, 최신 claim, 개인정보를 확인한 뒤 외부 발행 절차로 넘긴다.',
    },
  };
  const partial = resolve(approvedRoot, `.${outputName}.partial-${process.pid}-${Date.now()}`);
  await mkdir(partial, { recursive: false });
  try {
    await writeFile(resolve(partial, 'asset-handoff.json'), `${JSON.stringify(handoff, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await writeFile(resolve(partial, 'preview.html'), renderPreviewHtml(handoff), { encoding: 'utf8', flag: 'wx' });
    await rename(partial, destination);
  } catch (error) {
    await rm(partial, { recursive: true, force: true });
    throw error;
  }
  return {
    outputRoot: destination,
    handoffPath: resolve(destination, 'asset-handoff.json'),
    previewPath: resolve(destination, 'preview.html'),
    selectionCount: selected.length,
    containsBinaryCopies: false,
  };
}

function validateConfig(config) {
  if (config?.schema !== 'munjanggun.assetInternalLibraryConfig.v1' || config.version !== '1.0'
    || config.mode !== 'primary_reviewed_internal_only'
    || config.externalPublicationPolicy !== 'selected_asset_review_required'
    || config.publicGitStorage !== false
    || !config.libraryId || !isHash(config.activePointerSha256) || !isHash(config.reviewerTrustSha256)) {
    throw new Error('Internal library config is invalid');
  }
}

function validatePointer(pointer) {
  if (pointer?.schema !== 'munjanggun.assetPrimaryReviewActivePointer.v1' || pointer.version !== '1.0'
    || pointer.authorityStatus !== 'non_authority_primary_attested_pixel_evidence_verified_secondary_pending'
    || pointer.promotionEligible !== false || !Array.isArray(pointer.remainingAuthorityNeeds)
    || REQUIRED_REMAINING_GATES.some((gate) => !pointer.remainingAuthorityNeeds.includes(gate))) {
    throw new Error('Primary review pointer safety state is invalid');
  }
}

function validateBindings({ pointer, candidate, evidence, attestation, signer }) {
  if (candidate?.authorityStatus !== 'non_authority' || candidate.promotionEligible !== false
    || candidate.records?.length !== pointer.coverage?.assetCount
    || candidate.coverage?.uniqueAssetCount !== pointer.coverage.assetCount
    || candidate.coverage?.unresolvedObservationCount !== 0
    || evidence?.promotionEligible !== false
    || evidence.sourceCandidate?.sha256 !== pointer.primaryCandidate.sha256
    || evidence.coverage?.assetCount !== pointer.coverage.assetCount
    || evidence.coverage.staticUniqueCropCount + evidence.coverage.gifUniqueFrameCount !== pointer.coverage.verifiedEvidenceFileCount
    || attestation.rawTranscriptSha256 !== pointer.primaryCandidate.sha256
    || attestation.reviewerPrincipalId !== pointer.primaryAttestation.reviewerPrincipalId
    || signer.fingerprint !== pointer.primaryAttestation.keyFingerprint) {
    throw new Error('Primary review evidence binding is invalid');
  }
}

async function validateRecords(records, trustedRoots, { verifyOriginals }) {
  const hashes = new Set();
  const validated = [];
  for (const record of records ?? []) {
    const hash = String(record?.sourceObjectSha256 ?? '').toLowerCase();
    if (!isHash(hash) || hashes.has(hash)) throw new Error(`Primary candidate has an invalid or duplicate SHA: ${hash}`);
    if (!['static', 'gif'].includes(record.mediaKind) || !Array.isArray(record.sourceRefs)
      || !Array.isArray(record.claimSignals) || !Array.isArray(record.privacySignals)
      || !Array.isArray(record.acceptedObservations) || !Array.isArray(record.unresolvedObservations)
      || record.unresolvedObservations.length !== 0) {
      throw new Error(`Primary candidate record is invalid: ${hash}`);
    }
    const originalPath = await assertTrustedFile(record.originalPath, trustedRoots, `Original ${hash}`);
    if (verifyOriginals) assertDigest(await readFile(originalPath), hash, `Original ${hash}`);
    hashes.add(hash);
    validated.push({ ...record, sourceObjectSha256: hash, originalPath });
  }
  return validated;
}

function compactCriteria(criteria) {
  return Object.fromEntries(Object.entries(criteria ?? {})
    .map(([key, value]) => [key, String(value ?? '').trim()])
    .filter(([, value]) => value));
}

function matchDimensions(record, criteria, storyContext, requestScope) {
  const result = {};
  for (const [key, value] of Object.entries(criteria)) {
    if (storyContext && requestScope?.kind === 'whole_product' && ['query', 'product'].includes(key)) {
      if (matchesStoryIntent(record, storyContext, requestScope)) result[key] = value;
      continue;
    }
    const haystack = key === 'query' ? allSearchText(record, storyContext) : dimensionText(record, key, storyContext);
    const terms = normalize(value).split(/\s+/u).filter(Boolean);
    const directMatch = !(key === 'query' && (requestScope?.unresolvedProductTerms?.length ?? 0) > 0)
      && terms.every((term) => haystack.includes(term));
    const storyFallbackAllowed = storyContext && ['query', 'color', 'design'].includes(key)
      && (requestScope?.unresolvedTerms?.length ?? 0) === 0;
    if (directMatch || (storyFallbackAllowed && matchesStoryIntent(record, storyContext, requestScope))) result[key] = value;
  }
  return result;
}

function matchesStoryIntent(record, context, requestScope) {
  if (!requestScope || ['comparison_requires_split', 'conflicting_options_requires_clarification'].includes(requestScope.kind)) return false;
  const placements = narrativePlacements(record, context);
  if (placements.length === 0) return false;
  if (requestScope.kind === 'whole_product') return true;
  const optionKeys = new Set((requestScope?.matchedOptions ?? []).map((option) => `${option.optionSetId}:${option.optionId}`));
  const sectionIds = new Set((requestScope?.matchedSections ?? []).map((section) => section.sectionId));
  if (optionKeys.size > 0 && ![...optionKeys].every((key) => placements.some((placement) => placement.optionMemberships
    .some((option) => key === `${option.optionSetId}:${option.optionId}`)))) return false;
  if (sectionIds.size > 0 && !placements.some((placement) => sectionIds.has(placement.sectionId))) return false;
  return optionKeys.size > 0 || sectionIds.size > 0;
}

function dimensionText(record, key, storyContext) {
  const map = {
    product: record.proposedSearchTags?.productTypes,
    scene: record.proposedSearchTags?.scenes,
    color: record.proposedSearchTags?.colors,
    design: record.proposedSearchTags?.designs,
    topic: record.proposedSearchTags?.topics,
  };
  const placements = storyContext ? narrativePlacements(record, storyContext) : [];
  const optionSetForDimension = { color: 'color_groups', design: 'collections' }[key];
  const storyTerms = storyContext && optionSetForDimension
    ? storyContext.optionSets.filter((optionSet) => optionSet.optionSetId === optionSetForDimension)
      .flatMap((optionSet) => optionSet.options
        .filter((option) => placements.some((placement) => placement.optionMemberships
          .some((membership) => membership.optionSetId === optionSet.optionSetId && membership.optionId === option.optionId)))
        .flatMap((option) => [option.label, ...option.aliases]))
    : [];
  const productTerms = storyContext && key === 'product' && placements.length > 0 ? storyContext.productNames : [];
  return normalize([...(map[key] ?? []), ...storyTerms, ...productTerms].join(' '));
}

function allSearchText(record, storyContext) {
  return normalize([
    record.observedSummary, record.contentType, ...(record.useCases ?? []),
    ...Object.values(record.proposedSearchTags ?? {}).flat(),
    ...(record.acceptedObservations ?? []).flatMap((item) => [item.text, item.recognizedText]),
    ...(record.sourceRefs ?? []).flatMap((item) => [item.sourceId, item.sourceRelativePath]),
    ...storyTermsForRecord(record, storyContext),
  ].join(' '));
}

function scoreRecord(record, criteria, storyContext) {
  const text = allSearchText(record, storyContext);
  return Object.values(criteria).flatMap((value) => normalize(value).split(/\s+/u)).filter(Boolean)
    .reduce((score, term) => score + (text.includes(term) ? 10 : 0), 0)
    + (record.claimSignals.length === 0 ? 2 : 0) + (record.privacySignals.length === 0 ? 2 : 0);
}

function summarizeRecord(record, matchedDimensions, score, storyContext, requestScope) {
  const claimNeedsReview = record.claimSignals.length > 0;
  const privacyNeedsReview = record.privacySignals.length > 0;
  const placements = storyContext ? narrativePlacements(record, storyContext) : [];
  const storyPlacement = selectStoryPlacement(placements, requestScope);
  const storyEvidenceMatch = classifyStoryEvidence(record, placements, storyContext, requestScope);
  const storyPaths = new Map(placements.map((placement, index) => [placement.sourcePath, index]));
  const sourceRefs = storyContext ? [...record.sourceRefs].sort((left, right) => {
    const leftOrder = storyPaths.get(normalizeSourcePath(left.sourceRelativePath)) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = storyPaths.get(normalizeSourcePath(right.sourceRelativePath)) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  }) : record.sourceRefs;
  return {
    rank: 0,
    score,
    contentId: `sha256:${record.sourceObjectSha256}`,
    sha256: record.sourceObjectSha256,
    mediaType: mediaTypeFor(record),
    semanticSummary: record.observedSummary,
    contentType: record.contentType,
    useCases: record.useCases ?? [],
    searchTags: record.proposedSearchTags,
    visibleText: [...new Set(record.acceptedObservations.map((item) => item.text).filter(Boolean))],
    matchedDimensions,
    sourceRefs,
    storyPlacement,
    storySourcePath: storyPlacement?.sourcePath ?? null,
    storySourceId: storyPlacement?.sourceId ?? null,
    storyEvidenceMatch,
    narrativePlacements: placements,
    originalPath: record.originalPath,
    previewUrl: pathToFileURL(record.originalPath).href,
    reviewFlags: {
      claimSignals: record.claimSignals,
      privacySignals: record.privacySignals,
      releaseConstraints: record.releaseConstraints ?? [],
    },
    usageStatus: {
      internalSearchPreview: { status: 'usable', label: '내부 검색·미리보기 가능' },
      externalPublication: {
        status: 'blocked_selected_asset_review_required',
        label: '게시 선택 후 원본·최신성·개인정보 확인 필요',
        blockers: [
          'primary_review_is_non_authority',
          ...(claimNeedsReview ? ['claim_review_on_selection'] : []),
          ...(privacyNeedsReview ? ['privacy_review_on_selection'] : []),
        ],
      },
      publicGit: { status: 'blocked', label: '공개 Git 저장 금지' },
    },
  };
}

function storyTermsForRecord(record, context) {
  if (!context) return [];
  const placements = narrativePlacements(record, context);
  if (placements.length === 0) return [];
  const memberships = placements.flatMap((placement) => placement.optionMemberships);
  const keys = new Set(memberships.map((membership) => `${membership.optionSetId}:${membership.optionId}`));
  return [
    ...context.productNames,
    ...context.optionSets.flatMap((optionSet) => optionSet.options
      .filter((option) => keys.has(`${optionSet.optionSetId}:${option.optionId}`))
      .flatMap((option) => [option.label, ...option.aliases])),
  ];
}

function compareSearchResults(left, right, storyContext, requestScope) {
  if ((requestScope?.matchedOptions ?? []).some((option) => option.detail)) {
    const leftEvidenceRank = storyEvidenceRank(left.storyEvidenceMatch);
    const rightEvidenceRank = storyEvidenceRank(right.storyEvidenceMatch);
    if (leftEvidenceRank !== rightEvidenceRank) return leftEvidenceRank - rightEvidenceRank;
  }
  const focusedOptions = new Set((requestScope?.matchedOptions ?? [])
    .map((option) => `${option.optionSetId}:${option.optionId}`));
  if (focusedOptions.size > 0) {
    const leftFocused = resultMatchesFocusedOption(left, focusedOptions);
    const rightFocused = resultMatchesFocusedOption(right, focusedOptions);
    if (leftFocused !== rightFocused) return leftFocused ? -1 : 1;
  }
  const focusedSections = new Set((requestScope?.matchedSections ?? []).map((section) => section.sectionId));
  if (focusedSections.size > 0) {
    const leftFocused = (left.narrativePlacements ?? []).some((placement) => focusedSections.has(placement.sectionId));
    const rightFocused = (right.narrativePlacements ?? []).some((placement) => focusedSections.has(placement.sectionId));
    if (leftFocused !== rightFocused) return leftFocused ? -1 : 1;
  }
  if (requestScope?.detailsRequested && focusedOptions.size > 0) {
    const leftEvidence = resultMatchesRequiredEvidence(left, storyContext, focusedOptions);
    const rightEvidence = resultMatchesRequiredEvidence(right, storyContext, focusedOptions);
    if (leftEvidence !== rightEvidence) return leftEvidence ? -1 : 1;
  }
  if (storyContext && (focusedOptions.size > 0 || focusedSections.size > 0)) {
    const leftKey = storySortKey(left, requestScope);
    const rightKey = storySortKey(right, requestScope);
    if (leftKey !== rightKey) return leftKey - rightKey;
  }
  if (storyContext && requestScope?.kind === 'whole_product') {
    const leftKey = storySortKey(left, requestScope);
    const rightKey = storySortKey(right, requestScope);
    if (leftKey !== rightKey) return leftKey - rightKey;
  }
  if (left.score !== right.score) return right.score - left.score;
  if (storyContext) {
    const leftKey = storySortKey(left, requestScope);
    const rightKey = storySortKey(right, requestScope);
    if (leftKey !== rightKey) return leftKey - rightKey;
  }
  return left.sha256.localeCompare(right.sha256);
}

function storyEvidenceRank(match) {
  if (match?.kind === 'exact_detail_evidence' && match.isCatalogEvidence) return 0;
  if (match?.kind === 'exact_detail_evidence') return 1;
  if (match?.kind === 'direct_query_evidence') return 2;
  if (match?.kind === 'option_group_context') return 3;
  return 4;
}

function classifyStoryEvidence(record, placements, context, requestScope) {
  if (!context || !requestScope) return null;
  const requestedDetails = (requestScope.matchedOptions ?? []).filter((option) => option.detail);
  const evidenceText = recordEvidenceText(record);
  const matchedDetailIds = requestedDetails.filter((option) => detailEvidenceTerms(option.detail)
    .some((term) => evidenceText.includes(normalize(term)))).map((option) => option.detail.detailId);
  const requestedOptionKeys = new Set((requestScope.matchedOptions ?? [])
    .map((option) => `${option.optionSetId}:${option.optionId}`));
  const matchingRoles = context.optionSets.flatMap((optionSet) => optionSet.options
    .filter((option) => requestedOptionKeys.has(`${optionSet.optionSetId}:${option.optionId}`))
    .flatMap((option) => (option.evidenceRoles ?? []).filter((role) => placements
      .some((placement) => role.selectors.some((selector) => selectorMatchesPath(selector, placement.sourcePath))))
      .map((role) => ({ roleId: role.roleId, label: role.label, required: role.required === true }))));
  const exactDetail = requestedDetails.length > 0 && matchedDetailIds.length === requestedDetails.length;
  const directUnresolvedEvidence = (requestScope.unresolvedTerms ?? []).length > 0
    && requestScope.unresolvedTerms.every((term) => evidenceText.includes(normalize(term)));
  const optionContext = requestedOptionKeys.size > 0 && placements.some((placement) => placement.optionMemberships
    .some((option) => requestedOptionKeys.has(`${option.optionSetId}:${option.optionId}`)));
  const kind = exactDetail ? 'exact_detail_evidence'
    : directUnresolvedEvidence ? 'direct_query_evidence'
      : optionContext ? 'option_group_context'
        : requestScope.matchedSections?.length > 0 ? 'section_context' : 'story_context';
  return {
    kind,
    supportLevel: ['exact_detail_evidence', 'direct_query_evidence'].includes(kind) ? 'exact' : 'context',
    requestedDetailIds: requestedDetails.map((option) => option.detail.detailId),
    matchedDetailIds,
    evidenceRoles: matchingRoles,
    isCatalogEvidence: matchingRoles.some((role) => ['option_catalog', 'catalog_and_examples'].includes(role.roleId)),
    unresolvedTerms: requestScope.unresolvedTerms ?? [],
  };
}

function detailEvidenceTerms(detail) {
  return [detail.label, ...(detail.aliases ?? []), detail.code].filter(Boolean);
}

function recordEvidenceText(record) {
  return normalize([
    record.observedSummary, record.contentType, ...(record.useCases ?? []),
    ...Object.values(record.proposedSearchTags ?? {}).flat(),
    ...(record.acceptedObservations ?? []).flatMap((item) => [item.text, item.recognizedText]),
    ...(record.sourceRefs ?? []).flatMap((item) => [item.sourceId, item.sourceRelativePath]),
  ].join(' '));
}

function resultMatchesRequiredEvidence(entry, context, focusedOptions) {
  return context.optionSets.some((optionSet) => optionSet.options.some((option) => focusedOptions.has(`${optionSet.optionSetId}:${option.optionId}`)
    && (option.evidenceRoles ?? []).some((role) => role.required && (entry.narrativePlacements ?? [])
      .some((placement) => role.selectors.some((selector) => selectorMatchesPath(selector, placement.sourcePath))))));
}

function compareHandoffEntries(left, right, requestScope = null) {
  if ((requestScope?.matchedOptions ?? []).some((option) => option.detail)) {
    const leftEvidenceRank = storyEvidenceRank(left.storyEvidenceMatch);
    const rightEvidenceRank = storyEvidenceRank(right.storyEvidenceMatch);
    if (leftEvidenceRank !== rightEvidenceRank) return leftEvidenceRank - rightEvidenceRank;
  }
  const leftKey = storySortKey(left, requestScope);
  const rightKey = storySortKey(right, requestScope);
  if (leftKey !== rightKey) return leftKey - rightKey;
  return left.sha256.localeCompare(right.sha256);
}

function resultMatchesFocusedOption(entry, focusedOptions) {
  return (entry.narrativePlacements ?? []).some((placement) => (placement.optionMemberships ?? [])
    .some((option) => focusedOptions.has(`${option.optionSetId}:${option.optionId}`)));
}

function storySortKey(entry, requestScope = null) {
  if (!entry.narrativePlacements?.length) return Number.MAX_SAFE_INTEGER;
  const placement = selectStoryPlacement(entry.narrativePlacements, requestScope);
  return placement.sectionOrder * 1000000 + placement.sourceGroupOrder * 10000 + placement.sourceSequence;
}

function selectStoryPlacement(placements, requestScope = null) {
  if (!placements?.length) return null;
  const optionKeys = new Set((requestScope?.matchedOptions ?? []).map((option) => `${option.optionSetId}:${option.optionId}`));
  const sectionIds = new Set((requestScope?.matchedSections ?? []).map((section) => section.sectionId));
  return placements.find((candidate) => (sectionIds.size === 0 || sectionIds.has(candidate.sectionId))
    && (optionKeys.size === 0 || candidate.optionMemberships.some((option) => optionKeys.has(`${option.optionSetId}:${option.optionId}`))))
    ?? placements[0];
}

function narrativePlacements(record, context) {
  const placements = [];
  for (const sourceRef of record.sourceRefs ?? []) {
    if (!context.sourceIds.includes(sourceRef.sourceId)) continue;
    const sourcePath = normalizeSourcePath(sourceRef.sourceRelativePath);
    for (const section of context.sections) {
      const sourceGroupOrder = section.selectors.findIndex((selector) => selectorMatchesPath(selector, sourcePath));
      if (sourceGroupOrder < 0) continue;
      const matchedSectionSelector = section.selectors[sourceGroupOrder];
      const optionMemberships = context.optionSets.flatMap((optionSet) => optionSet.options
        .filter((option) => option.selectors.some((selector) => selectorMatchesPath(selector, sourcePath)))
        .map((option) => ({ optionSetId: optionSet.optionSetId, optionId: option.optionId, label: option.label })));
      placements.push({
        contextId: context.contextId,
        sectionId: section.sectionId,
        sectionLabel: section.label,
        sectionOrder: section.order,
        sourceId: sourceRef.sourceId,
        sourcePath,
        sourceGroupOrder,
        assetRole: matchedSectionSelector.role ?? 'body',
        sourceSequence: sequenceFromPath(sourcePath) ?? 9999,
        optionMemberships,
      });
    }
  }
  return placements.sort((left, right) => left.sectionOrder - right.sectionOrder
    || left.sourceGroupOrder - right.sourceGroupOrder || left.sourceSequence - right.sourceSequence
    || left.sourcePath.localeCompare(right.sourcePath, 'ko'));
}

function determineRequestScope(context, criteria, productRequest = analyzeProductRequest([context], criteria)) {
  const intentText = normalize([criteria?.query, criteria?.color, criteria?.design, criteria?.topic, criteria?.scene]
    .filter(Boolean).join(' '));
  const optionCandidates = context.optionSets.flatMap((optionSet) => optionSet.options.flatMap((option) => {
    const terms = [
      { value: option.label, detail: null },
      ...option.aliases.map((value) => ({ value, detail: null })),
      ...(option.details ?? []).flatMap((detail) => detailEvidenceTerms(detail).map((value) => ({ value, detail }))),
    ].map((item) => ({ ...item, normalized: normalize(item.value) }))
      .filter((item) => item.normalized && intentText.includes(item.normalized));
    if (terms.length === 0) return [];
    const best = terms.sort((left, right) => right.normalized.length - left.normalized.length
      || intentText.indexOf(left.normalized) - intentText.indexOf(right.normalized))[0];
    return [{ optionSetId: optionSet.optionSetId, optionId: option.optionId, label: option.label,
      matchedAlias: best.normalized, matchedIndex: intentText.indexOf(best.normalized),
      detail: best.detail ? {
        detailId: best.detail.detailId, label: best.detail.label, aliases: best.detail.aliases ?? [], code: best.detail.code ?? null,
      } : null }];
  }));
  const matchedOptions = optionCandidates.filter((candidate) => !optionCandidates.some((other) => other.optionSetId === candidate.optionSetId
    && other.optionId !== candidate.optionId && other.matchedAlias.length > candidate.matchedAlias.length
    && other.matchedAlias.includes(candidate.matchedAlias)))
    .sort((left, right) => left.matchedIndex - right.matchedIndex);
  const matchedSections = context.sections.flatMap((section) => {
    const matches = [section.label, ...(section.aliases ?? []), ...defaultSectionAliases(section.sectionId)]
      .map((term) => normalize(term)).filter((term) => term && intentText.includes(term))
      .sort((left, right) => right.length - left.length);
    return matches.length > 0 ? [{ sectionId: section.sectionId, label: section.label, matchedAlias: matches[0] }] : [];
  });
  const comparisonIntent = ['비교', '차이', '대비', 'vs'].some((term) => intentText.includes(term));
  const optionSetsWithMultipleTargets = [...new Set(matchedOptions.map((option) => option.optionSetId))]
    .filter((optionSetId) => matchedOptions.filter((option) => option.optionSetId === optionSetId).length > 1);
  const multiProduct = (productRequest.targets?.length ?? 0) > 1;
  const optionComparison = comparisonIntent && optionSetsWithMultipleTargets.length > 0;
  const conflictingOptions = !comparisonIntent && optionSetsWithMultipleTargets.length > 0;
  const comparisonTargets = multiProduct
    ? productRequest.targets.map((target) => ({ targetType: 'product', ...target }))
    : optionComparison || conflictingOptions
      ? matchedOptions.filter((option) => optionSetsWithMultipleTargets.includes(option.optionSetId))
        .map((option) => ({ targetType: 'option', optionSetId: option.optionSetId, optionId: option.optionId, label: option.label }))
      : [];
  const unresolvedConditions = unresolvedCriteriaTerms(criteria, productRequest, matchedOptions, matchedSections);
  const unresolvedTerms = [...new Set(unresolvedConditions.map((condition) => condition.term))];
  const productOnly = Boolean(criteria?.query) && unresolvedTerms.length === 0 && matchedOptions.length === 0
    && matchedSections.length === 0 && !comparisonIntent && (productRequest.targets?.length ?? 0) === 1;
  const hasExplicitFilters = [criteria?.color, criteria?.design, criteria?.topic, criteria?.scene].some(Boolean);
  const isSubset = hasExplicitFilters || matchedOptions.length > 0 || matchedSections.length > 0;
  const unresolvedTopic = unresolvedTerms.length > 0 || (!isSubset && Boolean(criteria?.query) && !productOnly);
  const productLabel = context.productNames[0];
  const kind = multiProduct || optionComparison ? 'comparison_requires_split'
    : conflictingOptions ? 'conflicting_options_requires_clarification'
      : unresolvedTopic && isSubset ? 'product_subset_unresolved'
        : isSubset ? 'product_subset' : unresolvedTopic ? 'product_topic_unresolved' : 'whole_product';
  return {
    kind,
    label: kind === 'comparison_requires_split' ? '비교 대상별 검색 분리 필요'
      : kind === 'conflicting_options_requires_clarification' ? `${productLabel} 같은 선택 축의 복수 조건 확인 필요`
        : kind === 'product_subset_unresolved' ? `${productLabel} 일부 선택 축과 추가 조건 확인 필요`
          : kind === 'product_subset' ? `${productLabel}의 일부 선택 축`
            : kind === 'product_topic_unresolved' ? `${productLabel} 추가 주제 확인 필요` : `${productLabel} 전체 상품`,
    matchedOptions,
    matchedSections,
    productTargets: productRequest.targets ?? [],
    comparisonTargets,
    unresolvedTerms,
    unresolvedConditions,
    unresolvedProductTerms: unresolvedTerms.filter((term) => /(?:중문|도어)$/u.test(term)),
    detailsRequested: ['종류', '색상표', '코드', '옵션표', '선택지'].some((term) => intentText.includes(term)),
    explicitFilters: Object.fromEntries(Object.entries(criteria ?? {}).filter(([key, value]) => key !== 'product' && value)),
    instruction: kind === 'comparison_requires_split'
      ? '단일 상품 검색 결과로 비교 대상을 합치지 않는다. 표시된 대상을 각각 별도 검색한 뒤 공통 비교 기준으로 대조한다.'
      : kind === 'conflicting_options_requires_clarification'
        ? '같은 선택 축의 복수 조건을 한 자산의 교집합으로 처리하지 않는다. 비교인지 대안 선택인지 먼저 확인한다.'
        : unresolvedTopic
          ? '해석되지 않은 추가 조건을 그룹 문맥으로 대체하지 않는다. 조건 근거를 확인하거나 더 구체적인 필터를 사용한다.'
          : isSubset ? context.subsetRule : context.wholeProductRule,
  };
}

function unresolvedCriteriaTerms(criteria, productRequest, matchedOptions, matchedSections) {
  const sharedRecognized = [
    ...matchedOptions.flatMap((option) => [option.matchedAlias, ...(option.detail ? detailEvidenceTerms(option.detail) : [])]),
    ...matchedSections.map((section) => section.matchedAlias),
    '비교', '차이', '대비', 'vs', '종류', '색상표', '코드', '옵션표', '선택지', '소개', '정보', '전체', '상품',
  ].map(normalize).filter(Boolean);
  const unresolved = [];
  for (const field of ['query', 'color', 'design', 'topic', 'scene']) {
    let remaining = normalize(criteria?.[field]);
    if (!remaining) continue;
    const recognized = [
      ...(productRequest.mentions ?? []).filter((mention) => mention.inputField === field)
        .map((mention) => mention.matchedAlias),
      ...sharedRecognized,
    ].sort((left, right) => normalizeCompact(right).length - normalizeCompact(left).length);
    for (const term of recognized) remaining = removeRecognizedPhrase(remaining, term);
    for (const term of normalize(remaining).split(/\s+/u)) {
      if (term && !['와', '과', '랑', '이랑', '및', '또는'].includes(term)) unresolved.push({ field, term });
    }
  }
  return unresolved.filter((condition, index) => unresolved.findIndex((candidate) => candidate.field === condition.field
    && candidate.term === condition.term) === index);
}

function removeRecognizedPhrase(value, phrase) {
  let output = normalize(value);
  const normalizedPhrase = normalize(phrase);
  if (!output || !normalizedPhrase) return output;
  if (output.includes(normalizedPhrase)) return normalize(output.replaceAll(normalizedPhrase, ' '));
  const compactPhrase = normalizeCompact(normalizedPhrase);
  while (compactPhrase) {
    const chars = [...output];
    const originalIndexes = [];
    let compact = '';
    for (let index = 0; index < chars.length; index += 1) {
      if (chars[index] === ' ') continue;
      originalIndexes.push(index);
      compact += chars[index];
    }
    const compactStart = compact.indexOf(compactPhrase);
    if (compactStart < 0) break;
    const originalStart = originalIndexes[compactStart];
    const originalEnd = originalIndexes[compactStart + compactPhrase.length - 1] + 1;
    output = normalize(`${output.slice(0, originalStart)} ${output.slice(originalEnd)}`);
  }
  return output;
}

function defaultSectionAliases(sectionId) {
  const aliases = {
    color_options: ['컬러', '색상'], glass_options: ['유리', '글라스'], event_and_notice: ['행사', '이벤트', '공지'],
    fit_and_consultation: ['시공', '상담', '실측'], region_faq_cta: ['지역', 'faq', '문의'],
    proof_and_performance: ['후기', '리뷰', '성능'], collection_details: ['컬렉션', '디자인'], package_details: ['패키지'],
  };
  return aliases[sectionId] ?? [];
}

function buildRequestResolution(requestScope, results) {
  const exactDetailEvidenceCount = results.filter((result) => result.storyEvidenceMatch?.kind === 'exact_detail_evidence').length;
  const groupContextCount = results.filter((result) => result.storyEvidenceMatch?.kind === 'option_group_context').length;
  const unresolvedConditions = (requestScope.unresolvedConditions
    ?? (requestScope.unresolvedTerms ?? []).map((term) => ({ field: 'query', term }))).map(({ field, term }) => ({
    field,
    term,
    status: results.some((result) => recordSummaryText(result).includes(normalize(term)))
      ? 'text_match_unmodeled_condition' : 'no_matching_evidence',
  }));
  const status = requestScope.kind === 'comparison_requires_split' ? 'comparison_requires_separate_searches'
    : requestScope.kind === 'conflicting_options_requires_clarification' ? 'clarification_required'
      : (requestScope.unresolvedProductTerms?.length ?? 0) > 0 ? 'unresolved_product_term_requires_clarification'
      : unresolvedConditions.some((condition) => condition.status === 'no_matching_evidence') ? 'unresolved_condition_no_evidence'
        : exactDetailEvidenceCount > 0 ? 'exact_detail_evidence_available'
          : results.length > 0 ? 'context_results_available' : 'no_results';
  return {
    status,
    comparisonTargets: requestScope.comparisonTargets ?? [],
    unresolvedConditions,
    exactDetailEvidenceCount,
    groupContextCount,
    instruction: requestScope.instruction,
  };
}

function recordSummaryText(result) {
  return normalize([
    result.semanticSummary, result.contentType, ...(result.useCases ?? []),
    ...Object.values(result.searchTags ?? {}).flat(), ...(result.visibleText ?? []),
  ].join(' '));
}

function buildCompletionAssessment(context, requestScope, coverage, requestResolution) {
  const detailRequested = (requestScope.matchedOptions ?? []).some((option) => option.detail);
  return {
    configuredEvidenceContractComplete: coverage.wholeProductExplanationEvidenceComplete,
    readerQuestionAnswerComplete: false,
    readerQuestionAnswerStatus: 'editorial_review_required',
    distinction: '설정된 근거 역할 충족은 독자의 질문에 답하는 글이 완성됐다는 보증이 아니다.',
    readerQuestions: [
      { questionId: 'selection_axes', status: context.optionSets.length > 0 ? 'context_available' : 'not_configured' },
      { questionId: 'exact_detail_evidence', status: !detailRequested ? 'not_requested'
        : requestResolution.exactDetailEvidenceCount > 0 ? 'supported' : 'missing' },
      { questionId: 'combination_constraints', status: (context.constraints ?? []).length > 0 ? 'preserved_in_context' : 'none_registered' },
      { questionId: 'comparison_targets', status: requestScope.kind === 'comparison_requires_split' ? 'requires_separate_searches' : 'not_requested' },
      { questionId: 'field_fit', status: 'field_judgment_rules_required', authorityDocument: 'FIELD_JUDGMENT_RULES.md' },
    ],
  };
}

function applicableConstraints(context, requestScope) {
  if (requestScope?.kind === 'whole_product') return context.constraints ?? [];
  const keys = new Set((requestScope?.matchedOptions ?? []).map((option) => `${option.optionSetId}:${option.optionId}`));
  return (context.constraints ?? []).filter((constraint) => constraint.whenAll
    .every((condition) => keys.has(`${condition.optionSetId}:${condition.optionId}`)));
}

function buildStoryCoverage(context, results) {
  const sectionIds = new Set(results.flatMap((result) => result.narrativePlacements ?? []).map((item) => item.sectionId));
  const optionIdsBySet = new Map(context.optionSets.map((optionSet) => [optionSet.optionSetId, new Set()]));
  for (const membership of results.flatMap((result) => result.narrativePlacements ?? [])
    .flatMap((placement) => placement.optionMemberships ?? [])) {
    optionIdsBySet.get(membership.optionSetId)?.add(membership.optionId);
  }
  const optionSetCoverage = context.optionSets.map((optionSet) => {
    const present = optionIdsBySet.get(optionSet.optionSetId) ?? new Set();
    const optionEvidenceCoverage = optionSet.options.map((option) => {
      const roles = (option.evidenceRoles ?? []).map((role) => ({
        roleId: role.roleId,
        label: role.label,
        required: role.required === true,
        present: results.some((result) => (result.narrativePlacements ?? []).some((placement) => placement.optionMemberships
          .some((membership) => membership.optionSetId === optionSet.optionSetId && membership.optionId === option.optionId)
          && role.selectors.some((selector) => selectorMatchesPath(selector, placement.sourcePath)))),
      }));
      return {
        optionId: option.optionId,
        label: option.label,
        knownDetails: (option.details ?? []).map((detail) => ({ detailId: detail.detailId, label: detail.label, code: detail.code ?? null })),
        evidenceRoles: roles,
        missingRequiredEvidenceRoles: roles.filter((role) => role.required && !role.present).map((role) => role.label),
      };
    });
    return {
      optionSetId: optionSet.optionSetId,
      label: optionSet.label,
      presentOptions: optionSet.options.filter((option) => present.has(option.optionId)).map((option) => option.label),
      missingOptions: optionSet.options.filter((option) => !present.has(option.optionId)).map((option) => option.label),
      missingRequiredOptions: optionSet.options.filter((option) => option.requiredForWholeProduct !== false && !present.has(option.optionId)).map((option) => option.label),
      optionEvidenceCoverage,
    };
  });
  const missingRequiredSections = context.requiredSectionsForWholeProduct
    .filter((sectionId) => !sectionIds.has(sectionId));
  const sectionEvidenceCoverage = context.sections.map((section) => ({
    sectionId: section.sectionId,
    label: section.label,
    evidenceRoles: (section.evidenceRoles ?? []).map((role) => ({
      roleId: role.roleId, label: role.label, required: role.required === true,
      present: results.some((result) => (result.narrativePlacements ?? []).some((placement) => placement.sectionId === section.sectionId
        && role.selectors.some((selector) => selectorMatchesPath(selector, placement.sourcePath)))),
    })),
  }));
  const missingRequiredSectionEvidence = sectionEvidenceCoverage
    .filter((section) => context.requiredSectionsForWholeProduct.includes(section.sectionId))
    .flatMap((section) => section.evidenceRoles.filter((role) => role.required && !role.present)
      .map((role) => ({ sectionId: section.sectionId, section: section.label, role: role.label })));
  const incompleteRequiredOptionSets = optionSetCoverage
    .filter((entry) => context.requiredOptionSetsForWholeProduct.includes(entry.optionSetId) && entry.missingRequiredOptions.length > 0)
    .map((entry) => ({ optionSetId: entry.optionSetId, missingOptions: entry.missingRequiredOptions }));
  const missingRequiredEvidence = optionSetCoverage
    .filter((entry) => context.requiredOptionSetsForWholeProduct.includes(entry.optionSetId))
    .flatMap((entry) => entry.optionEvidenceCoverage.flatMap((option) => option.missingRequiredEvidenceRoles
      .map((role) => ({ optionSetId: entry.optionSetId, optionId: option.optionId, option: option.label, role }))));
  const explanationComplete = missingRequiredSections.length === 0
    && incompleteRequiredOptionSets.length === 0 && missingRequiredEvidence.length === 0
    && missingRequiredSectionEvidence.length === 0;
  return {
    resultCount: results.length,
    presentSections: context.sections.filter((section) => sectionIds.has(section.sectionId)).map((section) => section.sectionId),
    missingRequiredSections,
    sectionEvidenceCoverage,
    missingRequiredSectionEvidence,
    optionSetCoverage,
    incompleteRequiredOptionSets,
    missingRequiredEvidence,
    wholeProductExplanationEvidenceComplete: explanationComplete,
    wholeProductAssetSelectionComplete: explanationComplete,
    notice: '완료는 필수 절·선택 그룹뿐 아니라 설정된 세부 선택지 설명 근거 역할까지 현재 결과에 포함됐다는 뜻이다. 모든 글에 모든 이미지를 넣으라는 할당량은 아니다.',
  };
}

function validateStoryContexts(value) {
  if (value?.schema !== 'munjanggun.productStoryContexts.v1' || value.version !== '1.0'
    || value.authorityStatus !== 'curated_non_authority_context' || !Array.isArray(value.contexts)) {
    throw new Error('Product story contexts are invalid');
  }
  const ids = new Set();
  const detailCatalogs = new Map((value.detailCatalogs ?? []).map((catalog) => [catalog.detailCatalogId, catalog.details]));
  if ((value.detailCatalogs ?? []).some((catalog) => !catalog.detailCatalogId || !Array.isArray(catalog.details)
    || catalog.details.some((detail) => !detail.detailId || !detail.label)) || detailCatalogs.size !== (value.detailCatalogs ?? []).length) {
    throw new Error('Product story detail catalogs are invalid');
  }
  for (const context of value.contexts) {
    if (!context?.contextId || ids.has(context.contextId) || !context.productId
      || !Array.isArray(context.productNames) || context.productNames.length === 0
      || !context.summary || !context.wholeProductRule || !context.subsetRule
      || !Array.isArray(context.optionSets) || !Array.isArray(context.sections)
      || !Array.isArray(context.requiredOptionSetsForWholeProduct)
      || !Array.isArray(context.requiredSectionsForWholeProduct)
      || !Array.isArray(context.writingGuardrails)
      || !Array.isArray(context.sourceIds) || context.sourceIds.length === 0
      || (context.constraints !== undefined && !Array.isArray(context.constraints))
      || (context.sourceWarnings !== undefined && !Array.isArray(context.sourceWarnings))) {
      throw new Error('Product story context entry is invalid');
    }
    const sectionIds = new Set();
    const orders = new Set();
    for (const section of context.sections) {
      if (!section.sectionId || sectionIds.has(section.sectionId) || !Number.isInteger(section.order)
        || orders.has(section.order) || !section.label || !section.summary || !validSelectors(section.selectors)) {
        throw new Error(`Product story section is invalid: ${context.contextId}`);
      }
      if (section.evidenceRoles !== undefined && (!Array.isArray(section.evidenceRoles)
        || section.evidenceRoles.some((role) => !role.roleId || !role.label || typeof role.required !== 'boolean' || !validSelectors(role.selectors)))) {
        throw new Error(`Product story section evidence role is invalid: ${context.contextId}`);
      }
      sectionIds.add(section.sectionId);
      orders.add(section.order);
    }
    const optionSetIds = new Set();
    for (const optionSet of context.optionSets) {
      if (!optionSet.optionSetId || optionSetIds.has(optionSet.optionSetId) || !optionSet.label
        || !optionSet.relationship || !Array.isArray(optionSet.options) || optionSet.options.length === 0) {
        throw new Error(`Product story option set is invalid: ${context.contextId}`);
      }
      optionSetIds.add(optionSet.optionSetId);
      const optionIds = new Set();
      for (const option of optionSet.options) {
        if (option.detailCatalogId) {
          if (!detailCatalogs.has(option.detailCatalogId) || option.details) throw new Error(`Product story detail catalog reference is invalid: ${context.contextId}`);
          option.details = detailCatalogs.get(option.detailCatalogId);
        }
        if (!option.optionId || optionIds.has(option.optionId) || !option.label || !option.summary
          || !Array.isArray(option.aliases) || option.aliases.length === 0 || !validSelectors(option.selectors)) {
          throw new Error(`Product story option is invalid: ${context.contextId}`);
        }
        if ((option.details !== undefined && (!Array.isArray(option.details) || option.details.some((detail) => !detail.detailId || !detail.label)))
          || (option.evidenceRoles !== undefined && (!Array.isArray(option.evidenceRoles)
            || option.evidenceRoles.some((role) => !role.roleId || !role.label || typeof role.required !== 'boolean' || !validSelectors(role.selectors))))) {
          throw new Error(`Product story option detail/evidence role is invalid: ${context.contextId}`);
        }
        optionIds.add(option.optionId);
      }
    }
    if (context.requiredSectionsForWholeProduct.some((id) => !sectionIds.has(id))
      || context.requiredOptionSetsForWholeProduct.some((id) => !optionSetIds.has(id))) {
      throw new Error(`Product story requirements reference unknown ids: ${context.contextId}`);
    }
    context.authorityStatus = value.authorityStatus;
    ids.add(context.contextId);
  }
  return value.contexts;
}

function validateStoryContextBindings(contexts, records) {
  for (const context of contexts) {
    const eligibleRefs = records.flatMap((record) => record.sourceRefs ?? [])
      .filter((sourceRef) => context.sourceIds.includes(sourceRef.sourceId));
    if (eligibleRefs.length === 0) throw new Error(`Product story context has no records for its sourceIds: ${context.contextId}`);
    const selectors = [
      ...context.sections.flatMap((section) => section.selectors),
      ...context.sections.flatMap((section) => (section.evidenceRoles ?? []).flatMap((role) => role.selectors)),
      ...context.optionSets.flatMap((optionSet) => [
        ...(optionSet.overviewSelectors ?? []),
        ...optionSet.options.flatMap((option) => [
          ...option.selectors,
          ...(option.evidenceRoles ?? []).flatMap((role) => role.selectors),
        ]),
      ]),
    ];
    for (const selector of selectors) {
      if (!eligibleRefs.some((sourceRef) => selectorMatchesPath(selector, normalizeSourcePath(sourceRef.sourceRelativePath)))) {
        throw new Error(`Product story selector has no source-bound record: ${context.contextId} ${selector.pathPrefix}`);
      }
    }
  }
}

function validSelectors(selectors) {
  return Array.isArray(selectors) && selectors.length > 0 && selectors.every((selector) => {
    const prefix = normalizeSourcePath(selector?.pathPrefix);
    return prefix && !prefix.startsWith('/') && !prefix.split('/').includes('..')
      && (selector.sequenceFrom === undefined || Number.isInteger(selector.sequenceFrom))
      && (selector.sequenceTo === undefined || Number.isInteger(selector.sequenceTo))
      && (selector.directChildrenOnly === undefined || typeof selector.directChildrenOnly === 'boolean')
      && (selector.role === undefined || ['body', 'thumbnail', 'overview', 'catalog', 'example'].includes(selector.role))
      && (selector.sequenceFrom === undefined || selector.sequenceTo === undefined || selector.sequenceFrom <= selector.sequenceTo);
  });
}

function selectorMatchesPath(selector, sourcePath) {
  const prefix = normalizeSourcePath(selector.pathPrefix);
  if (!sourcePath.startsWith(prefix)) return false;
  if (selector.directChildrenOnly && sourcePath.slice(prefix.length).includes('/')) return false;
  if (selector.sequenceFrom === undefined && selector.sequenceTo === undefined) return true;
  const sequence = sequenceFromPath(sourcePath);
  if (sequence === null) return false;
  return (selector.sequenceFrom === undefined || sequence >= selector.sequenceFrom)
    && (selector.sequenceTo === undefined || sequence <= selector.sequenceTo);
}

function sequenceFromPath(path) {
  const fileName = normalizeSourcePath(path).split('/').at(-1) ?? '';
  const match = /^(\d+)/u.exec(fileName);
  return match ? Number(match[1]) : null;
}

function normalizeSourcePath(path) {
  return String(path ?? '').normalize('NFKC').replaceAll('\\', '/');
}

function mediaTypeFor(record) {
  return record.mediaKind === 'gif' ? 'image/gif' : mediaTypeFromPath(record.originalPath);
}

function mediaTypeFromPath(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, ' ').trim();
}

function normalizeCompact(value) {
  return normalize(value).replaceAll(' ', '');
}

function validateConsumers(consumers) {
  if (!Array.isArray(consumers) || consumers.length === 0) throw new Error('Consumer policy must be a non-empty array');
  const ids = new Set();
  const roots = [];
  for (const item of consumers) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(item?.consumerId ?? '') || ids.has(item.consumerId)
      || !['private_codex', 'blog', 'sns'].includes(item.channel)
      || !isAbsolute(item.privateRoot ?? '') || typeof item.requireGitIgnored !== 'boolean') {
      throw new Error('Consumer policy is invalid or duplicated');
    }
    const root = resolve(item.privateRoot);
    if (roots.some((prior) => isContained(prior, root) || isContained(root, prior))) throw new Error('Consumer private roots must not overlap');
    ids.add(item.consumerId);
    roots.push(root);
  }
}

async function verifyGitCommittedJson(filePath, repoRoot) {
  const relativePath = relative(resolve(repoRoot), resolve(filePath)).replaceAll('\\', '/');
  if (!relativePath || relativePath.startsWith('../')) throw new Error('Internal library config is outside the current repository');
  try {
    await execFileAsync('git', ['-C', repoRoot, 'ls-files', '--error-unmatch', '--', relativePath], { windowsHide: true });
    const { stdout } = await execFileAsync('git', ['-C', repoRoot, 'show', `HEAD:${relativePath}`], { encoding: 'utf8', windowsHide: true });
    const head = JSON.parse(stdout);
    const current = JSON.parse(await readFile(filePath, 'utf8'));
    if (canonicalJson(head) !== canonicalJson(current)) throw new Error('Internal library config has uncommitted canonical content changes');
  } catch (error) {
    if (/outside the current repository|uncommitted canonical content changes/u.test(error.message)) throw error;
    throw new Error('Internal library config must be tracked in HEAD');
  }
}

async function assertRepositoryFile(path, repoRoot, label) {
  const file = resolve(path);
  if (!isContained(repoRoot, file)) throw new Error(`${label} is outside the current repository`);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a regular file`);
  return file;
}

async function assertTrustedFile(path, roots, label) {
  if (!isAbsolute(path ?? '') || String(path).split(/[\\/]/u).includes('..')) throw new Error(`${label} path is unsafe`);
  const file = resolve(path);
  const root = roots.map((value) => resolve(value)).find((candidate) => isContained(candidate, file));
  if (!root) throw new Error(`${label} is outside trusted private roots`);
  await assertNoSymlinkSegments(root, file, label);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file`);
  if (!isContained(await realpath(root), await realpath(file))) throw new Error(`${label} escapes trusted root`);
  return file;
}

async function assertRealDirectory(path, label) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
}

async function assertNoSymlinkSegments(root, target, label) {
  let cursor = parse(resolve(root)).root;
  for (const segment of relative(cursor, resolve(target)).split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    const info = await lstat(cursor);
    if (info.isSymbolicLink()) throw new Error(`${label} path must not contain symbolic links`);
  }
}

function isContained(root, child) {
  const relation = relative(resolve(root), resolve(child));
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
}

function assertDigest(bytes, expected, label) {
  if (!isHash(expected) || digest(bytes) !== expected) throw new Error(`${label} SHA-256 mismatch`);
}

function isHash(value) {
  return /^[a-f0-9]{64}$/u.test(value ?? '');
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function renderPreviewHtml(handoff) {
  const cards = handoff.selected.map((entry) => {
    const placement = entry.storyPlacement ?? entry.narrativePlacements?.[0];
    const allPlacements = (entry.narrativePlacements ?? []).map((item) => `<li>${escapeHtml(`${item.sectionLabel} · ${item.sourcePath} · ${item.sourceId}`)}</li>`).join('');
    const evidence = entry.storyEvidenceMatch
      ? `<p><strong>요청 근거 유형:</strong> ${escapeHtml(entry.storyEvidenceMatch.kind)}${entry.storyEvidenceMatch.evidenceRoles?.length ? ` · ${escapeHtml(entry.storyEvidenceMatch.evidenceRoles.map((role) => role.label).join(', '))}` : ''}</p>` : '';
    return `<article><h2>${escapeHtml(entry.semanticSummary || entry.contentId)}</h2><img src="${escapeHtml(entry.previewUrl)}" alt="${escapeHtml(entry.semanticSummary || entry.contentId)}"><p><strong>기본 스토리 위치:</strong> ${escapeHtml(placement ? `${placement.sectionLabel} · ${placement.sourcePath}` : '연결 없음')}</p>${evidence}${allPlacements ? `<details><summary>같은 자산의 모든 스토리 위치</summary><ul>${allPlacements}</ul></details>` : ''}<p><strong>내부 검색·미리보기 가능</strong></p><p>외부 게시 전 선택 자산 확인 필요</p><p class="path"><strong>검토 원본 저장 위치:</strong> ${escapeHtml(entry.originalPath)}</p></article>`;
  }).join('');
  const brief = renderContentBriefHtml(handoff.contentBrief);
  return `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>문장군 내부 자산 미리보기</title><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 20px;color:#202124}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article,.brief{border:1px solid #ddd;border-radius:12px;padding:16px}.brief{margin:20px 0;background:#f8fafc}.warning{border-left:4px solid #b45309;padding-left:12px}img{display:block;width:100%;height:320px;object-fit:contain;background:#f4f4f4}.path{word-break:break-all;color:#666;font-size:12px}h1{font-size:26px}h2{font-size:17px}h3{font-size:15px;margin-top:18px}li{margin:5px 0}</style></head><body><h1>문장군 내부 자산 미리보기</h1><p>원본을 복사하지 않습니다. 외부 게시 전 선택 자산만 원본·최신성·개인정보를 확인하세요.</p>${brief}<main>${cards}</main></body></html>\n`;
}

function renderContentBriefHtml(brief) {
  if (!brief) return '';
  const optionSets = brief.optionSets.map((optionSet) => `<li><strong>${escapeHtml(optionSet.label)}</strong>: ${optionSet.options.map((option) => escapeHtml(option.label)).join(' · ')}</li>`).join('');
  const guardrails = brief.writingGuardrails.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const warnings = (brief.sourceWarnings ?? []).map((warning) => `<li>${escapeHtml(warning.reason)} ${escapeHtml(warning.instruction)}</li>`).join('');
  const outline = (brief.storyOutline ?? []).map((section) => `<li>${escapeHtml(`${section.order}. ${section.label}`)}</li>`).join('');
  const constraints = (brief.applicableConstraints ?? []).map((constraint) => `<li>${escapeHtml(constraint.statement)} (${escapeHtml(constraint.status)})</li>`).join('');
  const comparisonTargets = (brief.requestResolution?.comparisonTargets ?? []).map((target) => `<li>${escapeHtml(`${target.targetType}: ${target.label}`)}</li>`).join('');
  const unresolved = (brief.requestResolution?.unresolvedConditions ?? [])
    .map((condition) => `<li>${escapeHtml(`${condition.field} · ${condition.term}: ${condition.status}`)}</li>`).join('');
  const readerQuestions = (brief.completionAssessment?.readerQuestions ?? []).map((question) => `<li>${escapeHtml(`${question.questionId}: ${question.status}${question.authorityDocument ? ` · ${question.authorityDocument}` : ''}`)}</li>`).join('');
  const coverageComplete = brief.resultCoverage.wholeProductExplanationEvidenceComplete
    ?? brief.resultCoverage.wholeProductAssetSelectionComplete;
  const coverage = coverageComplete
    ? '설정된 필수 절·선택지·세부 근거 역할 충족'
    : `선택 보완 필요: ${[
      ...brief.resultCoverage.missingRequiredSections,
      ...brief.resultCoverage.incompleteRequiredOptionSets.flatMap((item) => item.missingOptions),
      ...(brief.resultCoverage.missingRequiredEvidence ?? []).map((item) => `${item.option}: ${item.role}`),
      ...(brief.resultCoverage.missingRequiredSectionEvidence ?? []).map((item) => `${item.section}: ${item.role}`),
    ].map(escapeHtml).join(', ')}`;
  return `<section class="brief"><h2>상품 전체 문맥</h2><p><strong>요청 범위:</strong> ${escapeHtml(brief.requestScope.label)} (${escapeHtml(brief.requestScope.kind)})</p><p><strong>요청 처리 상태:</strong> ${escapeHtml(brief.requestResolution?.status)}</p><p>${escapeHtml(brief.productSummary)}</p><p><strong>스토리 설정:</strong> ${escapeHtml(brief.storyContextProvenance?.version)} · ${escapeHtml(brief.storyContextProvenance?.sha256)}</p><p><strong>근거 계약:</strong> ${coverage}</p><p><strong>독자 질문 답변 완성:</strong> ${escapeHtml(brief.completionAssessment?.readerQuestionAnswerStatus)} — ${escapeHtml(brief.completionAssessment?.distinction)}</p>${readerQuestions ? `<h3>독자 질문 검수</h3><ul>${readerQuestions}</ul>` : ''}${comparisonTargets ? `<div class="warning"><h3>비교 대상</h3><ul>${comparisonTargets}</ul></div>` : ''}${unresolved ? `<div class="warning"><h3>해석되지 않은 조건</h3><ul>${unresolved}</ul></div>` : ''}<h3>상품 목차</h3><ol>${outline}</ol><h3>전체 선택 축</h3><ul>${optionSets}</ul>${constraints ? `<div class="warning"><h3>선택 조합 제한</h3><ul>${constraints}</ul></div>` : ''}<h3>집필 안전선</h3><ul>${guardrails}</ul>${warnings ? `<div class="warning"><h3>원본 범위 확인</h3><ul>${warnings}</ul></div>` : ''}</section>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
