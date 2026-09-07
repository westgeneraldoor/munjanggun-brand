import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DEFAULT_POLICY_PATH = resolve(fileURLToPath(new URL('../../config/asset-content-quality.json', import.meta.url)));

export async function assertCatalogContentUsable({ intakeId, catalogSha256 }, {
  repoRoot = DEFAULT_REPO_ROOT,
  policyPath = DEFAULT_POLICY_PATH,
  policy = null,
  verifyCommittedPolicy = verifyGitCommittedQualityPolicy,
} = {}) {
  const loadedPolicy = policy ?? await loadPolicy(policyPath, repoRoot, verifyCommittedPolicy);
  validatePolicy(loadedPolicy);
  const record = loadedPolicy.records.find((entry) => entry.intakeId === intakeId && entry.catalogSha256 === catalogSha256);
  if (!record) throw new Error(`Catalog content accuracy is not registered as visually verified: ${intakeId ?? 'missing-intake'}`);
  if (record?.status === 'blocked_pending_visual_revalidation') {
    throw new Error(`Catalog content accuracy is blocked pending visual revalidation: ${intakeId} (${record.reason})`);
  }
  return record;
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
    keys.add(key);
  }
}
