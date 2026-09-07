import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { computeContentDecisionHash } from './asset-content-revalidation.mjs';
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
        ocrText: overlay.ocrText,
        claimSignals: overlay.claimSignals,
        privacySignals: overlay.privacySignals,
        humanReviewStatus: 'reviewed',
        comparisonMethod: [...new Set([
          ...(entry.comparisonMethod ?? []).filter((value) => value !== 'human_visual_review'),
          'sha256_exact', overlay.annotationMethod,
        ])],
        reviewEvidenceRefs: overlay.reviewEvidenceRefs,
        reviewNotes: `시각 내용 재검증 완료; decisionHash=${overlay.decisionHash}`,
        ...(overlay.gifMetadata ? { gifMetadata: {
          frameCount: overlay.gifMetadata.frameCount,
          durationMs: overlay.gifMetadata.durationMs,
          loopCount: entry.gifMetadata?.loopCount ?? 0,
          loopBehavior: overlay.gifMetadata.loopBehavior,
        } } : {}),
      };
    }),
    contentAuthority: {
      overlaySha256: authority.record.overlaySha256,
      receiptSha256: authority.record.receiptSha256,
      verifiedAt: authority.record.verifiedAt,
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
  const [overlayBytes, receiptBytes, overlaySchema, receiptSchema, reviewSchema] = await Promise.all([
    readFile(overlayPath), readFile(receiptPath),
    readJson(new URL('../../schemas/asset-content-overlay.schema.json', import.meta.url)),
    readJson(new URL('../../schemas/asset-content-revalidation-receipt.schema.json', import.meta.url)),
    readJson(new URL('../../schemas/asset-content-review-shard.schema.json', import.meta.url)),
  ]);
  assertDigest(overlayBytes, record.overlaySha256, 'Content overlay');
  assertDigest(receiptBytes, record.receiptSha256, 'Content revalidation receipt');
  const overlay = JSON.parse(overlayBytes.toString('utf8'));
  const receipt = JSON.parse(receiptBytes.toString('utf8'));
  assertSchema(overlay, overlaySchema, 'Content overlay');
  assertSchema(receipt, receiptSchema, 'Content revalidation receipt');
  if (overlay.intakeId !== intakeId || receipt.intakeId !== intakeId
    || overlay.baseCatalogSha256 !== catalogSha256 || receipt.baseCatalogSha256 !== catalogSha256
    || receipt.overlaySha256 !== record.overlaySha256
    || overlay.entryCount !== receipt.entryCount || receipt.verifiedCount !== receipt.entryCount
    || receipt.needsEscalationCount !== 0 || receipt.gifCount !== receipt.fullLoopGifCount) {
    throw new Error('Content revalidation authority binding is invalid');
  }
  const overlayBySha = new Map(overlay.entries.map((entry) => [entry.sha256, entry]));
  const treeLines = [`${record.overlaySha256}  content-overlay.json`];
  let reviewEntryCount = 0;
  const reviewedShas = new Set();
  const reviewPaths = new Set();
  for (const item of receipt.reviewFiles) {
    const path = await assertTrustedFile(item.path, trustedRoots, 'Content review shard');
    if (reviewPaths.has(path.toLowerCase())) throw new Error(`Duplicate content review shard path: ${path}`);
    reviewPaths.add(path.toLowerCase());
    const bytes = await readFile(path);
    assertDigest(bytes, item.sha256, 'Content review shard');
    const shard = JSON.parse(bytes.toString('utf8'));
    assertSchema(shard, reviewSchema, 'Content review shard');
    if (shard.intakeId !== intakeId || shard.entries.length !== item.entryCount) throw new Error('Content review shard receipt binding is invalid');
    reviewEntryCount += shard.entries.length;
    for (const entry of shard.entries) {
      if (reviewedShas.has(entry.sourceObjectSha256)) throw new Error(`Duplicate content review SHA: ${entry.sourceObjectSha256}`);
      reviewedShas.add(entry.sourceObjectSha256);
      if (computeContentDecisionHash(entry) !== entry.decisionHash) throw new Error(`Content review decision hash mismatch: ${entry.sourceObjectSha256}`);
      if (overlayBySha.get(entry.sourceObjectSha256)?.decisionHash !== entry.decisionHash) {
        throw new Error(`Content overlay decision hash mismatch: ${entry.sourceObjectSha256}`);
      }
    }
    treeLines.push(`${item.sha256}  ${item.path}`);
  }
  if (reviewEntryCount !== receipt.entryCount || overlayBySha.size !== receipt.entryCount
    || reviewedShas.size !== receipt.entryCount
    || [...overlayBySha.keys()].some((sha256) => !reviewedShas.has(sha256))) {
    throw new Error('Content revalidation receipt coverage is invalid');
  }
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

function isContained(root, candidate) {
  const value = relative(root, candidate);
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
}

async function readJson(url) {
  return JSON.parse(await readFile(fileURLToPath(url), 'utf8'));
}
