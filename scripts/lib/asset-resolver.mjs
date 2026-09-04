import { lstat, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { resolveContainedPath } from './asset-paths.mjs';
import { sha256File } from './asset-inventory.mjs';

export function selectAsset(manifest, criteria) {
  const selectors = [criteria.assetId, criteria.logicalPath, criteria.sourceRelativePath].filter(Boolean);
  if (selectors.length !== 1) throw new Error('Specify exactly one asset selector.');
  const matches = manifest.assets.filter((asset) => {
    if (criteria.assetId) return asset.assetInstanceId === criteria.assetId;
    if (criteria.logicalPath) return asset.logicalPath === criteria.logicalPath;
    return asset.sourceId === criteria.sourceId && asset.sourceRelativePath === criteria.sourceRelativePath;
  });
  if (matches.length === 0) throw new Error('No asset matched the selector.');
  if (matches.length > 1) throw new Error('Asset selector is ambiguous.');
  return matches[0];
}

export async function resolveAssetObject(objectRoot, asset, { verifyHash = true } = {}) {
  const objectPath = resolveContainedPath(objectRoot, asset.objectRef, 'objectRef');
  const rootReal = await realpath(objectRoot);
  const objectLstat = await lstat(objectPath);
  if (objectLstat.isSymbolicLink()) throw new Error(`Object must not be a symbolic link: ${asset.objectRef}`);
  const objectReal = await realpath(objectPath);
  const relation = relative(rootReal, objectReal);
  if (relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    throw new Error(`Resolved object escapes object root: ${asset.objectRef}`);
  }
  const objectStat = await stat(objectReal);
  if (!objectStat.isFile()) throw new Error(`Object is not a file: ${asset.objectRef}`);
  if (objectStat.size !== asset.byteSize) throw new Error(`Object byteSize mismatch: ${asset.objectRef}`);
  if (verifyHash) {
    const actualHash = await sha256File(objectReal);
    if (actualHash !== asset.sha256) throw new Error(`Object sha256 mismatch: ${asset.objectRef}`);
  }
  return objectReal;
}

export async function verifyManifestObjects(manifest, objectRoot) {
  const verified = new Map();
  const errors = [];
  for (const asset of manifest.assets) {
    const prior = verified.get(asset.objectRef);
    if (prior) {
      if (prior.sha256 !== asset.sha256 || prior.byteSize !== asset.byteSize) {
        errors.push(`${asset.objectRef}: conflicting hash or byteSize across manifest entries`);
      }
      continue;
    }
    try {
      const path = await resolveAssetObject(objectRoot, asset);
      verified.set(asset.objectRef, { path, sha256: asset.sha256, byteSize: asset.byteSize });
    } catch (objectError) {
      errors.push(objectError.message);
    }
  }
  return { verified: verified.size, referenced: manifest.assets.length, errors };
}
