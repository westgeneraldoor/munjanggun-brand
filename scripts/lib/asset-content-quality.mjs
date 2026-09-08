import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  CONTENT_AUTHORITY_CONTRACT_VERSION,
  assertKnownRegressionCases,
  assertContentEntryEvidence,
  assertGifReviewEvidence,
  assertProductIdentity,
  buildProductIdentity,
  computeContentDecisionHash,
  normalizeReviewShard,
} from './asset-content-revalidation.mjs';
import { normalizeReviewerPrincipal, parseContentReviewerTrust, verifyTrustedContentReviewerSignature } from './asset-content-reviewer-trust.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './schema-validation.mjs';

const execFileAsync = promisify(execFile);
const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DEFAULT_POLICY_PATH = resolve(fileURLToPath(new URL('../../config/asset-content-quality.json', import.meta.url)));
const DEFAULT_TRUSTED_ROOTS = [
  'C:/Users/hjh/안티그래비티/문장군_브랜드_private',
  'Z:/문장군_브랜드_원본보관',
].map((value) => resolve(value));

export async function assertCatalogContentUsable({ intakeId, catalogSha256 }, {
  repoRoot = DEFAULT_REPO_ROOT,
  policyPath = DEFAULT_POLICY_PATH,
  policy = null,
  verifyCommittedPolicy = verifyGitCommittedQualityPolicy,
  trustedRoots = DEFAULT_TRUSTED_ROOTS,
  loadVerifiedAuthority = loadAndVerifyAuthority,
} = {}) {
  const loadedPolicy = policy ?? await loadPolicy(policyPath, repoRoot, verifyCommittedPolicy);
  validatePolicy(loadedPolicy);
  const record = loadedPolicy.records.find((entry) => entry.intakeId === intakeId && entry.catalogSha256 === catalogSha256);
  if (!record) throw new Error(`Catalog content accuracy is not registered as visually verified: ${intakeId ?? 'missing-intake'}`);
  if (record?.status === 'blocked_pending_visual_revalidation') {
    throw new Error(`Catalog content accuracy is blocked pending visual revalidation: ${intakeId} (${record.reason})`);
  }
  return loadVerifiedAuthority(record, { intakeId, catalogSha256, trustedRoots });
}

export function applyContentAuthority(catalog, authority) {
  if (!authority?.overlay) throw new Error('Verified content overlay is missing from content authority');
  const bySha = new Map();
  for (const entry of authority.overlay.entries) {
    if (bySha.has(entry.sha256)) throw new Error(`Duplicate content overlay SHA: ${entry.sha256}`);
    bySha.set(entry.sha256, entry);
  }
  if (bySha.size !== catalog.entries.length || authority.overlay.entryCount !== catalog.entries.length) {
    throw new Error('Verified content overlay does not cover the catalog exactly');
  }
  return {
    ...catalog,
    entries: catalog.entries.map((entry) => {
      const overlay = bySha.get(entry.sha256);
      if (!overlay) throw new Error(`Verified content overlay is missing SHA: ${entry.sha256}`);
      return {
        ...entry,
        semanticSummary: overlay.semanticSummary,
        assetType: overlay.assetType,
        useCases: overlay.useCases,
        searchTags: overlay.searchTags,
        textPresence: overlay.textPresence,
        visibleText: overlay.visibleText,
        visibleTextObservations: overlay.visibleTextObservations,
        ocrText: overlay.ocrText,
        sourceContext: overlay.sourceContext,
        inferredText: overlay.inferredText,
        claimSignals: overlay.claimSignals,
        claimEvidence: overlay.claimEvidence,
        privacySignals: overlay.privacySignals,
        humanReviewStatus: 'reviewed',
        comparisonMethod: [...new Set([
          ...(entry.comparisonMethod ?? []).filter((value) => value !== 'human_visual_review'),
          'sha256_exact', overlay.annotationMethod,
        ])],
        reviewEvidenceRefs: overlay.reviewEvidenceRefs,
        contentDecisionHash: overlay.decisionHash,
        reviewNotes: `시각 내용 재검증 완료; decisionHash=${overlay.decisionHash}`,
        ...(overlay.gifMetadata ? { gifMetadata: {
          frameCount: overlay.gifMetadata.decodedFrameCount,
          durationMs: overlay.gifMetadata.decodedDurationMs,
          loopCount: overlay.gifMetadata.decodedLoopCount ?? entry.gifMetadata?.loopCount ?? 0,
          loopBehavior: overlay.gifMetadata.loopBehavior,
          decodedFrameCount: overlay.gifMetadata.decodedFrameCount,
          decodedDurationMs: overlay.gifMetadata.decodedDurationMs,
          decodedLoopCount: overlay.gifMetadata.decodedLoopCount,
          sampledFrameCount: overlay.gifMetadata.sampledFrameCount,
          sampledFrameIndices: overlay.gifMetadata.sampledFrameIndices,
          fullPlaybackObservation: overlay.gifMetadata.fullPlaybackObservation,
        } } : {}),
      };
    }),
    contentAuthority: {
      overlaySha256: authority.record.overlaySha256,
      receiptSha256: authority.record.receiptSha256,
      profileSha256: authority.record.profileSha256,
      verifiedAt: authority.record.verifiedAt,
      authorityContractVersion: authority.record.authorityContractVersion,
    },
  };
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function loadPolicy(policyPath, repoRoot, verifyCommittedPolicy) {
  const path = resolve(policyPath);
  const bytes = await readFile(path);
  await verifyCommittedPolicy(path, repoRoot);
  return JSON.parse(bytes.toString('utf8'));
}

async function verifyGitCommittedQualityPolicy(policyPath, repoRoot) {
  const relativePath = relative(resolve(repoRoot), policyPath).replaceAll('\\', '/');
  if (!relativePath || relativePath.startsWith('../')) throw new Error('Asset content quality policy is outside the current repository');
  try {
    await execFileAsync('git', ['-C', repoRoot, 'ls-files', '--error-unmatch', '--', relativePath], { windowsHide: true });
    const [{ stdout: headObject }, { stdout: worktreeObject }] = await Promise.all([
      execFileAsync('git', ['-C', repoRoot, 'rev-parse', `HEAD:${relativePath}`], { encoding: 'utf8', windowsHide: true }),
      execFileAsync('git', ['-C', repoRoot, 'hash-object', `--path=${relativePath}`, '--', policyPath], { encoding: 'utf8', windowsHide: true }),
    ]);
    if (headObject.trim() !== worktreeObject.trim()) throw new Error('Asset content quality policy has uncommitted canonical content changes');
  } catch (error) {
    if (/outside the current repository|uncommitted canonical content changes/u.test(error.message)) throw error;
    throw new Error('Asset content quality policy must be tracked in HEAD');
  }
}

function validatePolicy(policy) {
  if (policy?.schema !== 'munjanggun.assetContentQualityPolicy.v1' || policy?.version !== '1.0' || !Array.isArray(policy.records)) {
    throw new Error('Asset content quality policy is invalid');
  }
  const keys = new Set();
  for (const record of policy.records) {
    const key = `${record?.intakeId}:${record?.catalogSha256}`;
    if (!record?.intakeId || !/^[a-f0-9]{64}$/u.test(record?.catalogSha256 ?? '')
      || !['blocked_pending_visual_revalidation', 'visually_verified'].includes(record?.status)
      || typeof record?.reason !== 'string' || !record.reason.trim()) {
      throw new Error('Asset content quality policy record is invalid');
    }
    if (keys.has(key)) throw new Error(`Duplicate asset content quality policy record: ${key}`);
    if (record.status === 'visually_verified' && (
      !isAbsolute(record.overlayPath ?? '') || !/^[a-f0-9]{64}$/u.test(record.overlaySha256 ?? '')
      || !isAbsolute(record.receiptPath ?? '') || !/^[a-f0-9]{64}$/u.test(record.receiptSha256 ?? '')
      || !/^[a-f0-9]{64}$/u.test(record.profileSha256 ?? '')
      || !/^[a-f0-9]{64}$/u.test(record.reviewerTrustSha256 ?? '')
      || record.authorityContractVersion !== CONTENT_AUTHORITY_CONTRACT_VERSION
      || Number.isNaN(new Date(record.verifiedAt).valueOf())
    )) throw new Error('Visually verified content quality record is missing sealed authority fields');
    keys.add(key);
  }
}

async function loadAndVerifyAuthority(record, { intakeId, catalogSha256, trustedRoots }) {
  const [overlayPath, receiptPath] = await Promise.all([
    assertTrustedFile(record.overlayPath, trustedRoots, 'Content overlay'),
    assertTrustedFile(record.receiptPath, trustedRoots, 'Content revalidation receipt'),
  ]);
  const [overlayBytes, receiptBytes, overlaySchema, receiptSchema, reviewSchema, reviewInputSchema] = await Promise.all([
    readFile(overlayPath), readFile(receiptPath),
    readJson(new URL('../../schemas/asset-content-overlay.schema.json', import.meta.url)),
    readJson(new URL('../../schemas/asset-content-revalidation-receipt.schema.json', import.meta.url)),
    readJson(new URL('../../schemas/asset-content-review-shard.schema.json', import.meta.url)),
    readJson(new URL('../../schemas/asset-content-review-input.schema.json', import.meta.url)),
  ]);
  assertDigest(overlayBytes, record.overlaySha256, 'Content overlay');
  assertDigest(receiptBytes, record.receiptSha256, 'Content revalidation receipt');
  const overlay = JSON.parse(overlayBytes.toString('utf8'));
  const receipt = JSON.parse(receiptBytes.toString('utf8'));
  assertSchema(overlay, overlaySchema, 'Content overlay');
  assertSchema(receipt, receiptSchema, 'Content revalidation receipt');
  const sealedAt = dateValue(receipt.sealedAt, 'Content receipt sealedAt');
  const verifiedAt = dateValue(record.verifiedAt, 'Content quality policy verifiedAt');
  if (sealedAt > Date.now() + 5 * 60 * 1000 || verifiedAt > Date.now() + 5 * 60 * 1000) {
    throw new Error('Content authority chronology is in the future');
  }
  const [baseCatalogPath, profilePath, reviewerTrustPath] = await Promise.all([
    assertTrustedFile(receipt.baseCatalogPath, trustedRoots, 'Content base catalog snapshot'),
    assertTrustedFile(receipt.profilePath, trustedRoots, 'Content intake profile snapshot'),
    assertTrustedFile(receipt.reviewerTrustPath, trustedRoots, 'Content reviewer trust snapshot'),
  ]);
  const rawRootPath = await assertTrustedDirectory(receipt.rawRootPath, trustedRoots, 'Content raw root');
  const [baseCatalogBytes, profileBytes, reviewerTrustBytes] = await Promise.all([readFile(baseCatalogPath), readFile(profilePath), readFile(reviewerTrustPath)]);
  assertDigest(baseCatalogBytes, receipt.baseCatalogSha256, 'Content base catalog snapshot');
  assertDigest(profileBytes, receipt.profileSha256, 'Content intake profile snapshot');
  assertDigest(reviewerTrustBytes, receipt.reviewerTrustSha256, 'Content reviewer trust snapshot');
  const baseCatalog = JSON.parse(baseCatalogBytes.toString('utf8'));
  const profile = JSON.parse(profileBytes.toString('utf8'));
  const productIdentity = buildProductIdentity(profile, intakeId);
  const reviewerTrust = parseContentReviewerTrust(reviewerTrustBytes);
  const baselineBySha = new Map((baseCatalog.entries ?? []).map((entry) => [entry.sha256, entry]));
  const gifOverlayEntries = overlay.entries.filter((entry) => entry.gifMetadata);
  if (overlay.intakeId !== intakeId || receipt.intakeId !== intakeId
    || overlay.baseCatalogSha256 !== catalogSha256 || receipt.baseCatalogSha256 !== catalogSha256
    || record.authorityContractVersion !== CONTENT_AUTHORITY_CONTRACT_VERSION
    || overlay.authorityContractVersion !== CONTENT_AUTHORITY_CONTRACT_VERSION
    || receipt.authorityContractVersion !== CONTENT_AUTHORITY_CONTRACT_VERSION
    || receipt.profileSha256 !== record.profileSha256
    || receipt.reviewerTrustSha256 !== record.reviewerTrustSha256
    || receipt.overlaySha256 !== record.overlaySha256
    || overlay.generatedAt !== receipt.sealedAt || verifiedAt < sealedAt
    || baseCatalog.intakeId !== intakeId || baseCatalog.binaryGroupCount !== baseCatalog.entries?.length
    || baselineBySha.size !== baseCatalog.entries.length || baseCatalog.entries.length !== receipt.entryCount
    || overlay.entryCount !== receipt.entryCount || receipt.verifiedCount !== receipt.entryCount
    || receipt.needsEscalationCount !== 0 || receipt.gifCount !== gifOverlayEntries.length
    || receipt.staticCount !== overlay.entries.length - gifOverlayEntries.length
    || receipt.fullPlaybackObservedGifCount !== gifOverlayEntries.filter((entry) => entry.gifMetadata.fullPlaybackObservation.observed === true).length
    || receipt.gifCount !== receipt.fullPlaybackObservedGifCount
    || receipt.decodedGifFrameCount !== sum(gifOverlayEntries, (entry) => entry.gifMetadata.decodedFrameCount)
    || receipt.sampledGifFrameCount !== sum(gifOverlayEntries, (entry) => entry.gifMetadata.sampledFrameCount)
    || receipt.visibleTextObservationCount !== sum(overlay.entries, (entry) => entry.visibleTextObservations.length)
    || receipt.verifiedCropCount !== sum(overlay.entries.filter((entry) => !entry.gifMetadata), (entry) => entry.visibleTextObservations.filter((item) => item.cropEvidence).length)
    || receipt.sensitiveClaimObservationCount !== sum(overlay.entries, (entry) => sensitiveObservationIndices(entry).size)
    || receipt.secondReviewedSensitiveObservationCount !== sum(overlay.entries, (entry) => [...sensitiveObservationIndices(entry)].filter((index) => entry.visibleTextObservations[index]?.secondReview).length)
    || receipt.sensitiveClaimObservationCount !== receipt.secondReviewedSensitiveObservationCount
    || receipt.claimSignalAssetCount !== overlay.entries.filter((entry) => entry.claimSignals.length > 0).length
    || receipt.sensitiveClaimEvidenceAssetCount !== overlay.entries.filter((entry) => entry.claimEvidence.some((item) => item.topic !== 'other')).length
    || receipt.priceClaimAssetCount !== overlay.entries.filter((entry) => entry.claimEvidence.some((item) => item.topic === 'price')).length
    || receipt.privacySignalAssetCount !== overlay.entries.filter((entry) => entry.privacySignals.length > 0).length
    || receipt.staticTileCoverageCount !== overlay.entries.filter((entry) => entry.staticTileCoverage).length
    || receipt.staticTileCoverageCount !== receipt.staticCount
    || receipt.secondarySemanticVerdictCount !== overlay.entries.filter((entry) => entry.secondarySemanticVerdict).length
    || receipt.secondarySemanticVerdictCount !== receipt.entryCount) {
    throw new Error('Content revalidation authority binding is invalid');
  }
  const overlayBySha = new Map(overlay.entries.map((entry) => [entry.sha256, entry]));
  const treeLines = [
    `${record.overlaySha256}  content-overlay.json`,
    `${receipt.baseCatalogSha256}  base-catalog.json`,
    `${receipt.profileSha256}  intake-profile.json`,
    `${receipt.reviewerTrustSha256}  reviewer-trust.json`,
  ];
  let reviewEntryCount = 0;
  const reviewedShas = new Set();
  const reviewedByShaForRegression = new Map();
  const reviewPaths = new Set();
  const rawReviewPaths = new Set();
  for (const item of receipt.reviewFiles) {
    const path = await assertTrustedFile(item.path, trustedRoots, 'Content review shard');
    const rawPath = await assertTrustedFile(item.rawPath, trustedRoots, 'Signed primary review input');
    if (reviewPaths.has(path.toLowerCase())) throw new Error(`Duplicate content review shard path: ${path}`);
    if (rawReviewPaths.has(rawPath.toLowerCase())) throw new Error(`Duplicate primary review input path: ${rawPath}`);
    reviewPaths.add(path.toLowerCase());
    rawReviewPaths.add(rawPath.toLowerCase());
    const [bytes, rawBytes] = await Promise.all([readFile(path), readFile(rawPath)]);
    assertDigest(bytes, item.sha256, 'Content review shard');
    assertDigest(rawBytes, item.rawSha256, 'Signed primary review input');
    const shard = JSON.parse(bytes.toString('utf8'));
    const rawReview = JSON.parse(rawBytes.toString('utf8'));
    assertSchema(shard, reviewSchema, 'Content review shard');
    assertSchema(rawReview, reviewInputSchema, 'Signed primary review input');
    const primarySigner = verifyTrustedContentReviewerSignature(rawReview, rawReview.reviewer, reviewerTrust, `Primary review ${rawPath}`);
    const shardReviewedAt = dateValue(shard.reviewedAt, 'Content review shard reviewedAt');
    if (shard.intakeId !== intakeId || shard.entries.length !== item.entryCount
      || shard.authorityContractVersion !== CONTENT_AUTHORITY_CONTRACT_VERSION || shardReviewedAt > sealedAt
      || shard.rawReviewSha256 !== item.rawSha256 || rawReview.intakeId !== intakeId
      || rawReview.entries.length !== item.entryCount || rawReview.mediaKind !== shard.mediaKind
      || normalizeReviewerPrincipal(rawReview.reviewer) !== normalizeReviewerPrincipal(shard.reviewer)) {
      throw new Error('Content review shard receipt binding is invalid');
    }
    const rawShas = [...rawReview.entries].map((entry) => String(entry.sha256 ?? entry.sourceObjectSha256 ?? '').toLowerCase()).sort();
    const shardShas = [...shard.entries].map((entry) => entry.sourceObjectSha256).sort();
    if (canonicalJson(rawShas) !== canonicalJson(shardShas)) throw new Error('Primary review input does not match sealed review shard');
    const rebuiltShard = await normalizeReviewShard(
      rawReview, rawPath, rawBytes, baseCatalog, baselineBySha, rawRootPath,
      productIdentity, receipt.sealedAt, reviewerTrust, primarySigner,
    );
    if (canonicalJson(rebuiltShard) !== canonicalJson(shard)) {
      throw new Error('Sealed review shard does not match its signed primary review input');
    }
    reviewEntryCount += shard.entries.length;
    for (const entry of shard.entries) {
      const baseline = baselineBySha.get(entry.sourceObjectSha256);
      const expectedMediaKind = baseline?.mediaType === 'image/gif' ? 'gif' : 'static';
      if (!baseline || entry.mediaType !== baseline.mediaType || shard.mediaKind !== expectedMediaKind
        || canonicalJson(normalizeSourceRefs(entry.sourceRefs)) !== canonicalJson(normalizeSourceRefs(baseline.sourceRefs))) {
        throw new Error(`Content review entry does not match base catalog: ${entry.sourceObjectSha256}`);
      }
      if (reviewedShas.has(entry.sourceObjectSha256)) throw new Error(`Duplicate content review SHA: ${entry.sourceObjectSha256}`);
      reviewedShas.add(entry.sourceObjectSha256);
      const entryReviewedAt = dateValue(entry.reviewedAt, `Content review entry reviewedAt ${entry.sourceObjectSha256}`);
      const primaryReviewedAt = dateValue(entry.primaryReviewedAt, `Content primary review reviewedAt ${entry.sourceObjectSha256}`);
      if (primaryReviewedAt > entryReviewedAt || entryReviewedAt > shardReviewedAt || entryReviewedAt > sealedAt) {
        throw new Error(`Content review chronology is invalid: ${entry.sourceObjectSha256}`);
      }
      if (entry.humanReviewStatus !== 'verified') {
        throw new Error(`Content review entry is not verified: ${entry.sourceObjectSha256}`);
      }
      const originalPath = await assertTrustedFile(entry.originalPath, trustedRoots, 'Content original evidence');
      const originalBytes = await readFile(originalPath);
      if (sha256(originalBytes) !== entry.sourceObjectSha256) {
        throw new Error(`Content original evidence SHA-256 mismatch: ${entry.sourceObjectSha256}`);
      }
      await assertContentEntryEvidence(entry, shard.mediaKind, { evidenceRoots: trustedRoots, reviewerTrust, primarySigner });
      assertProductIdentity(entry, productIdentity);
      if (entry.gifReview) {
        await assertGifReviewEvidence(entry, { evidenceRoots: trustedRoots });
        const playbackReviewedAt = dateValue(entry.gifReview.fullPlaybackObservation.reviewedAt,
          `GIF playback reviewedAt ${entry.sourceObjectSha256}`);
        if (playbackReviewedAt > entryReviewedAt || playbackReviewedAt > sealedAt) {
          throw new Error(`GIF playback chronology is invalid: ${entry.sourceObjectSha256}`);
        }
      }
      if (computeContentDecisionHash(entry) !== entry.decisionHash) throw new Error(`Content review decision hash mismatch: ${entry.sourceObjectSha256}`);
      const overlayEntry = overlayBySha.get(entry.sourceObjectSha256);
      if (overlayEntry?.decisionHash !== entry.decisionHash) {
        throw new Error(`Content overlay decision hash mismatch: ${entry.sourceObjectSha256}`);
      }
      const expectedOverlayEntry = toExpectedOverlayEntry(entry, [
        `${path}#sha256=${entry.sourceObjectSha256}`,
        entry.originalPath,
        ...(entry.evidenceRefs ?? []),
      ].filter((value, index, values) => values.indexOf(value) === index));
      if (canonicalJson(overlayEntry) !== canonicalJson(expectedOverlayEntry)) {
        throw new Error(`Content overlay does not match sealed review shard: ${entry.sourceObjectSha256}`);
      }
      reviewedByShaForRegression.set(entry.sourceObjectSha256, { entry });
    }
    treeLines.push(`${item.sha256}  ${item.path}`);
    treeLines.push(`${item.rawSha256}  ${item.rawPath}`);
  }
  if (reviewEntryCount !== receipt.entryCount || overlayBySha.size !== receipt.entryCount
    || reviewedShas.size !== receipt.entryCount
    || [...overlayBySha.keys()].some((sha256) => !reviewedShas.has(sha256))) {
    throw new Error('Content revalidation receipt coverage is invalid');
  }
  assertKnownRegressionCases(reviewedByShaForRegression);
  const treeHash = sha256(Buffer.from(`${treeLines.sort().join('\n')}\n`, 'utf8'));
  if (treeHash !== receipt.treeHash) throw new Error('Content revalidation tree hash mismatch');
  return { record, overlay, receipt };
}

async function assertTrustedFile(path, trustedRoots, label) {
  const resolved = resolve(path);
  const allowed = trustedRoots.map((root) => resolve(root)).some((root) => isContained(root, resolved) && root !== resolved);
  if (!allowed) throw new Error(`${label} is outside trusted private roots`);
  const info = await lstat(resolved);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file`);
  const real = await realpath(resolved);
  const realAllowed = await Promise.all(trustedRoots.map(async (root) => {
    try { return isContained(await realpath(resolve(root)), real); } catch { return false; }
  }));
  if (!realAllowed.some(Boolean)) throw new Error(`${label} real path escapes trusted private roots`);
  return resolved;
}

function assertDigest(bytes, expected, label) {
  if (sha256(bytes) !== expected) throw new Error(`${label} SHA-256 mismatch`);
}

function assertSchema(value, schema, label) {
  const validation = validateAgainstSchema(value, schema);
  if (!validation.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(validation.errors).join('\n')}`);
}

async function assertTrustedDirectory(path, trustedRoots, label) {
  const resolved = resolve(path);
  const allowed = trustedRoots.map((root) => resolve(root)).some((root) => isContained(root, resolved) && root !== resolved);
  if (!allowed) throw new Error(`${label} is outside trusted private roots`);
  const info = await lstat(resolved);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink directory`);
  const real = await realpath(resolved);
  const realAllowed = await Promise.all(trustedRoots.map(async (root) => {
    try { return isContained(await realpath(resolve(root)), real); } catch { return false; }
  }));
  if (!realAllowed.some(Boolean)) throw new Error(`${label} real path escapes trusted private roots`);
  return resolved;
}

function sensitiveObservationIndices(entry) {
  return new Set((entry.claimEvidence ?? [])
    .filter((item) => item.topic !== 'other')
    .flatMap((item) => item.visibleTextIndices ?? []));
}

function dateValue(value, label) {
  const result = new Date(value).valueOf();
  if (Number.isNaN(result)) throw new Error(`${label} is invalid`);
  return result;
}

function sum(values, getter) {
  return values.reduce((total, value) => total + getter(value), 0);
}

function toExpectedOverlayEntry(entry, reviewEvidenceRefs) {
  return {
    sha256: entry.sourceObjectSha256,
    semanticSummary: entry.semanticSummary,
    assetType: entry.assetType,
    useCases: entry.useCases,
    searchTags: entry.searchTags,
    textPresence: entry.textPresence,
    visibleText: entry.visibleText,
    visibleTextObservations: entry.visibleTextObservations,
    ocrText: entry.ocrText,
    sourceContext: entry.sourceContext,
    inferredText: entry.inferredText,
    claimSignals: entry.claimSignals,
    claimEvidence: entry.claimEvidence,
    privacySignals: entry.privacySignals,
    uncertainties: entry.uncertainties,
    humanReviewStatus: 'verified',
    reviewer: entry.reviewer,
    primaryReviewedAt: entry.primaryReviewedAt,
    reviewedAt: entry.reviewedAt,
    annotationMethod: entry.annotationMethod,
    reviewEvidenceRefs,
    decisionHash: entry.decisionHash,
    gifMetadata: entry.gifReview ?? null,
    ...(entry.staticTileCoverage ? { staticTileCoverage: entry.staticTileCoverage } : {}),
    secondarySemanticVerdict: entry.secondarySemanticVerdict,
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeSourceRefs(refs = []) {
  return refs.map((entry) => ({
    sourceId: String(entry?.sourceId ?? ''),
    sourceRelativePath: String(entry?.sourceRelativePath ?? ''),
  })).sort((left, right) => `${left.sourceId}\0${left.sourceRelativePath}`.localeCompare(`${right.sourceId}\0${right.sourceRelativePath}`));
}

function isContained(root, candidate) {
  const value = relative(root, candidate);
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
}

async function readJson(url) {
  return JSON.parse(await readFile(fileURLToPath(url), 'utf8'));
}
