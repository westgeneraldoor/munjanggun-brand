import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import { toPosixPath } from './asset-paths.mjs';

const VISUAL_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov']);

export async function inventoryTree(rootDir) {
  const paths = [];
  await walk(rootDir, rootDir, paths);
  paths.sort((left, right) => compareNatural(left.relativePath, right.relativePath));

  const entries = [];
  for (const item of paths) {
    const fileStat = await stat(item.absolutePath);
    const extension = extname(item.relativePath).toLowerCase() || '.none';
    const ignoredSystemCache = basename(item.relativePath).toLowerCase() === 'thumbs.db';
    entries.push({
      sourceRelativePath: item.relativePath,
      byteSize: fileStat.size,
      sha256: await sha256File(item.absolutePath),
      extension,
      kind: classifyKind(item.relativePath, extension, ignoredSystemCache),
      disposition: ignoredSystemCache ? 'ignored_system_cache' : 'managed',
    });
  }

  return {
    entries,
    counts: summarizeEntries(entries),
    treeHash: computeTreeHash(entries),
  };
}

export function compareInventories(sourceEntries, recoveryEntries) {
  const source = new Map(sourceEntries.map((entry) => [entry.sourceRelativePath, entry]));
  const recovery = new Map(recoveryEntries.map((entry) => [entry.sourceRelativePath, entry]));
  const missing = [...source.keys()].filter((path) => !recovery.has(path)).sort(compareNatural);
  const extra = [...recovery.keys()].filter((path) => !source.has(path)).sort(compareNatural);
  const shared = [...source.keys()].filter((path) => recovery.has(path));
  const sizeMismatch = shared.filter((path) => source.get(path).byteSize !== recovery.get(path).byteSize).sort(compareNatural);
  const hashMismatch = shared.filter((path) => source.get(path).sha256 !== recovery.get(path).sha256).sort(compareNatural);
  return {
    missing,
    extra,
    sizeMismatch,
    hashMismatch,
    status: missing.length + extra.length + sizeMismatch.length + hashMismatch.length === 0 ? 'verified' : 'failed',
  };
}

export function summarizeEntries(entries) {
  const managed = entries.filter((entry) => entry.disposition === 'managed');
  return {
    all: entries.length,
    managed: managed.length,
    visual: managed.filter((entry) => entry.kind === 'visual').length,
    url: managed.filter((entry) => entry.kind === 'url').length,
    manifest: managed.filter((entry) => entry.kind === 'manifest').length,
    ignoredSystemCache: entries.filter((entry) => entry.disposition === 'ignored_system_cache').length,
    allBytes: entries.reduce((sum, entry) => sum + entry.byteSize, 0),
    managedBytes: managed.reduce((sum, entry) => sum + entry.byteSize, 0),
  };
}

export function computeTreeHash(entries) {
  const hash = createHash('sha256');
  for (const entry of [...entries].sort((a, b) => compareNatural(a.sourceRelativePath, b.sourceRelativePath))) {
    hash.update(entry.sourceRelativePath, 'utf8');
    hash.update('\0');
    hash.update(String(entry.byteSize));
    hash.update('\0');
    hash.update(entry.sha256);
    hash.update('\n');
  }
  return hash.digest('hex');
}

export async function sha256File(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolvePromise);
  });
  return hash.digest('hex');
}

function classifyKind(relativePath, extension, ignoredSystemCache) {
  if (ignoredSystemCache) return 'system_cache';
  if (VISUAL_EXTENSIONS.has(extension)) return 'visual';
  if (extension === '.url') return 'url';
  if (basename(relativePath).toLowerCase() === 'asset-manifest.json') return 'manifest';
  return 'other';
}

async function walk(rootDir, currentDir, paths) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walk(rootDir, absolutePath, paths);
    } else if (entry.isFile()) {
      paths.push({
        absolutePath,
        relativePath: toPosixPath(relative(rootDir, absolutePath)),
      });
    }
  }
}

function compareNatural(left, right) {
  return left.localeCompare(right, 'ko', { numeric: true, sensitivity: 'base' });
}
