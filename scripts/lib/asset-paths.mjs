import { isAbsolute, relative, resolve, sep } from 'node:path';

export function toPosixPath(value) {
  return String(value).split(sep).join('/');
}

export function assertSafeRelativePath(value, label = 'path') {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (value.includes('\\') || value.includes('\0') || isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.startsWith('//')) {
    throw new Error(`${label} must be a POSIX repository-relative path: ${value}`);
  }
  const segments = value.split('/');
  if (segments.some((segment) => segment === '..' || segment === '')) {
    throw new Error(`${label} contains an unsafe segment: ${value}`);
  }
  return value;
}

export function resolveContainedPath(rootDir, relativePath, label = 'path') {
  assertSafeRelativePath(relativePath, label);
  const root = resolve(rootDir);
  const target = resolve(root, ...relativePath.split('/'));
  const relation = relative(root, target);
  if (relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    throw new Error(`${label} escapes root: ${relativePath}`);
  }
  return target;
}
