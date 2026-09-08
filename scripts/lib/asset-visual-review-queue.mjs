import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveContainedPath } from './asset-paths.mjs';
import { sha256File } from './asset-inventory.mjs';

const SUPPORTED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/gif']);
const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export async function buildVisualReviewQueue({ sources, generatedAt = new Date().toISOString(), outputPath = null }) {
  if (!Array.isArray(sources) || sources.length < 1) throw new Error('At least one catalog/raw-root source is required');
  const catalogBindings = [];
  const grouped = new Map();
  let logicalPathCount = 0;

  for (const source of sources) {
    const catalogPath = resolve(String(source.catalogPath ?? ''));
    const rawRoot = resolve(String(source.rawRoot ?? ''));
    const catalogBytes = await readFile(catalogPath);
    const catalogSha256 = digest(catalogBytes);
    const catalog = JSON.parse(catalogBytes.toString('utf8'));
    if (!catalog.intakeId || !Array.isArray(catalog.entries)) throw new Error(`Visual review catalog is invalid: ${catalogPath}`);
    catalogBindings.push({ intakeId: catalog.intakeId, catalogPath, catalogSha256, rawRoot, entryCount: catalog.entries.length });

    for (const entry of catalog.entries) {
      const sha256 = String(entry.sha256 ?? entry.sourceObjectSha256 ?? '').toLowerCase();
      const mediaType = String(entry.mediaType ?? '').toLowerCase();
      if (!/^[a-f0-9]{64}$/u.test(sha256) || !SUPPORTED_MEDIA.has(mediaType) || !Number.isSafeInteger(entry.byteSize) || entry.byteSize < 1) {
        throw new Error(`Unsupported or invalid visual catalog entry in ${catalogPath}`);
      }
      if (!Array.isArray(entry.sourceRefs) || entry.sourceRefs.length < 1) throw new Error(`Visual entry has no sourceRefs: ${sha256}`);
      let group = grouped.get(sha256);
      if (!group) {
        group = { sha256, mediaType, byteSize: entry.byteSize, origins: [] };
        grouped.set(sha256, group);
      } else if (group.mediaType !== mediaType || group.byteSize !== entry.byteSize) {
        throw new Error(`Cross-catalog visual facts conflict for ${sha256}`);
      }

      for (const sourceRef of entry.sourceRefs) {
        const originalPath = resolveContainedPath(rawRoot, sourceRef.sourceRelativePath, 'sourceRelativePath');
        const fileStat = await stat(originalPath);
        if (!fileStat.isFile() || fileStat.size !== entry.byteSize) throw new Error(`Visual source size mismatch: ${originalPath}`);
        const actualSha256 = await sha256File(originalPath);
        if (actualSha256 !== sha256) throw new Error(`Visual source SHA-256 mismatch: ${originalPath}`);
        group.origins.push({
          intakeId: catalog.intakeId,
          catalogSha256,
          sourceId: String(sourceRef.sourceId ?? ''),
          sourceRelativePath: sourceRef.sourceRelativePath,
          originalPath,
        });
        logicalPathCount += 1;
      }
    }
  }

  const entries = [...grouped.values()].sort((a, b) => a.sha256.localeCompare(b.sha256));
  for (const entry of entries) {
    entry.origins.sort((a, b) => `${a.intakeId}\0${a.sourceRelativePath}`.localeCompare(`${b.intakeId}\0${b.sourceRelativePath}`, 'ko'));
    entry.reviewMediaKind = entry.mediaType === 'image/gif' ? 'gif' : 'static';
    entry.primaryOriginalPath = entry.origins[0].originalPath;
    entry.intakeIds = [...new Set(entry.origins.map((origin) => origin.intakeId))].sort();
  }
  const staticCount = entries.filter((entry) => entry.reviewMediaKind === 'static').length;
  const gifCount = entries.length - staticCount;
  const crossIntakeDuplicateCount = entries.filter((entry) => entry.intakeIds.length > 1).length;
  const queue = {
    schema: 'munjanggun.assetVisualReviewQueue.v1',
    version: '1.0',
    generatedAt,
    status: 'review_queue_only_not_authority',
    catalogs: catalogBindings,
    counts: {
      catalogCount: catalogBindings.length,
      logicalPathCount,
      uniqueVisualCount: entries.length,
      staticCount,
      gifCount,
      crossIntakeDuplicateCount,
    },
    entries,
    entrySetSha256: digest(Buffer.from(JSON.stringify(entries), 'utf8')),
  };
  if (outputPath) {
    const originalOutput = String(outputPath);
    if (!isAbsolute(originalOutput)) throw new Error('Visual review queue output must be an absolute private path');
    const resolvedOutput = resolve(originalOutput);
    if (isContained(DEFAULT_REPO_ROOT, resolvedOutput)) {
      throw new Error('Visual review queue output must be outside the public repository');
    }
    await writeFile(resolvedOutput, `${JSON.stringify(queue, null, 2)}\n`, { flag: 'wx' });
  }
  return queue;
}

function isContained(root, candidate) {
  const relation = relative(resolve(root), resolve(candidate));
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}
