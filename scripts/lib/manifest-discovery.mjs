import { relative } from 'node:path';
import { findFiles } from './brand-validation-core.mjs';
import { toPosixPath } from './asset-paths.mjs';

export async function findAuthoritativeManifestPaths(rootDir) {
  const paths = await findFiles(rootDir, (path) => path.endsWith('asset-manifest.json'));
  return paths.filter((path) => {
    const repoPath = toPosixPath(relative(rootDir, path));
    return !repoPath.split('/').includes('신규');
  });
}
