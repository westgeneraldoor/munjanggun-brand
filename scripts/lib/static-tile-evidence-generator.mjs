import { createHash } from 'node:crypto';
import {
  lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodeStaticImagePixels,
  encodeRgbaPng,
  extractStaticPixelRegion,
  staticPixelDigest,
  STATIC_PIXEL_DECODER_VERSION,
  STATIC_PNG_ENCODER_VERSION,
} from './static-image-region-pixels.mjs';
import { computeStaticTileCoverageDigest } from './asset-content-revalidation.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './schema-validation.mjs';

const SHA256 = /^[a-f0-9]{64}$/u;
const STATIC_MEDIA = new Set(['image/jpeg', 'image/png']);

export async function generateStaticTileEvidence({
  queuePath,
  sha256 = null,
  allStatic = false,
  outputRoot = null,
  maxTileSize = 1024,
  mode = 'build',
  expectedQueueSha256 = null,
  repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url))),
  allowedEvidenceBase = null,
} = {}) {
  if (!['build', 'dry-run', 'inventory'].includes(mode)) throw new Error(`Unsupported mode: ${mode}`);
  const queue = await readAndValidateQueue(queuePath, expectedQueueSha256);
  const selection = selectStaticEntries(queue, { sha256, allStatic });
  const tileSize = positiveInteger(maxTileSize, 'maxTileSize');

  if (mode === 'inventory') {
    return {
      mode,
      queuePath: resolve(queuePath),
      queueSha256: queue.queueSha256,
      selectedCount: selection.length,
      selectedSha256: selection.map((entry) => entry.sha256),
      maxTileSize: tileSize,
      sourceVerificationPerformed: false,
      outputWritten: false,
    };
  }

  if (!outputRoot || !isAbsolute(String(outputRoot))) throw new Error('outputRoot must be an absolute path for build and dry-run');
  const destination = resolve(String(outputRoot));
  await assertSafeOutputRoot(destination, { repoRoot, allowedEvidenceBase });
  await assertMissing(destination, 'Output root');
  const manifestSchema = JSON.parse(await readFile(new URL('../../schemas/static-tile-coverage-manifest.schema.json', import.meta.url), 'utf8'));

  const prepared = [];
  for (const entry of selection) prepared.push(await prepareStaticEntry(entry, queue, destination, tileSize, manifestSchema));
  const summary = {
    mode,
    queuePath: resolve(queuePath),
    queueSha256: queue.queueSha256,
    outputRoot: destination,
    selectedCount: prepared.length,
    maxTileSize: tileSize,
    sourceVerificationPerformed: true,
    outputWritten: mode === 'build',
    entries: prepared.map(({ manifest, manifestBytes, destinationDir }) => ({
      sourceObjectSha256: manifest.sourceObjectSha256,
      sourceWidth: manifest.sourceWidth,
      sourceHeight: manifest.sourceHeight,
      tileCount: manifest.tileCount,
      manifestRef: resolve(destinationDir, 'manifest.json'),
      manifestSha256: digest(manifestBytes),
      coverageDigest: manifest.coverageDigest,
    })),
  };
  if (mode === 'dry-run') return summary;

  const parent = dirname(destination);
  const partial = await mkdtemp(resolve(parent, `.${basename(destination)}.partial-`));
  try {
    for (const item of prepared) await writePreparedEntry(item, partial, destination);
    await writeFile(resolve(partial, 'index.json'), jsonBytes(summary), { flag: 'wx' });
    await rename(partial, destination);
  } catch (error) {
    await rm(partial, { recursive: true, force: true });
    throw error;
  }
  return summary;
}

async function readAndValidateQueue(queuePath, expectedQueueSha256) {
  if (!queuePath || !isAbsolute(String(queuePath))) throw new Error('queuePath must be an absolute path');
  const path = resolve(String(queuePath));
  await assertRegularNonSymlink(path, 'Review queue');
  const bytes = await readFile(path);
  const queueSha256 = digest(bytes);
  if (expectedQueueSha256 && queueSha256 !== String(expectedQueueSha256).toLowerCase()) {
    throw new Error('Review queue SHA-256 mismatch');
  }
  const queue = JSON.parse(bytes.toString('utf8'));
  if (queue.schema !== 'munjanggun.assetVisualReviewQueue.v1' || queue.version !== '1.0'
    || !Array.isArray(queue.catalogs) || queue.catalogs.length < 1 || !Array.isArray(queue.entries)) {
    throw new Error('Review queue contract is invalid');
  }
  if (!SHA256.test(String(queue.entrySetSha256 ?? '')) || digest(Buffer.from(JSON.stringify(queue.entries), 'utf8')) !== queue.entrySetSha256) {
    throw new Error('Review queue entry-set digest mismatch');
  }
  const staticCount = queue.entries.filter((entry) => entry.reviewMediaKind === 'static').length;
  if (queue.counts?.uniqueVisualCount !== queue.entries.length || queue.counts?.staticCount !== staticCount) {
    throw new Error('Review queue counts are inconsistent');
  }
  return { ...queue, queueSha256 };
}

function selectStaticEntries(queue, { sha256, allStatic }) {
  const normalizedSha = sha256 ? String(sha256).toLowerCase() : null;
  if (Boolean(normalizedSha) === Boolean(allStatic)) throw new Error('Select exactly one of sha256 or allStatic');
  const staticEntries = queue.entries.filter((entry) => entry.reviewMediaKind === 'static');
  const seen = new Set();
  for (const entry of staticEntries) {
    if (!SHA256.test(String(entry.sha256 ?? '')) || !STATIC_MEDIA.has(entry.mediaType)
      || !Number.isSafeInteger(entry.byteSize) || entry.byteSize < 1 || seen.has(entry.sha256)) {
      throw new Error('Review queue contains an invalid or duplicate static entry');
    }
    seen.add(entry.sha256);
  }
  if (allStatic) return staticEntries.slice().sort((left, right) => left.sha256.localeCompare(right.sha256));
  if (!SHA256.test(normalizedSha)) throw new Error('sha256 must be a lowercase SHA-256 value');
  const selected = staticEntries.find((entry) => entry.sha256 === normalizedSha);
  if (!selected) throw new Error(`Static SHA is not present in the review queue: ${normalizedSha}`);
  return [selected];
}

async function prepareStaticEntry(entry, queue, outputRoot, maxTileSize, manifestSchema) {
  const originalPaths = await verifyEntryOrigins(entry, queue.catalogs);
  const primary = resolve(String(entry.primaryOriginalPath ?? ''));
  if (!originalPaths.some((path) => samePath(path, primary))) throw new Error(`Primary original is not a verified origin for ${entry.sha256}`);
  const sourceBytes = await readFile(primary);
  const decoded = decodeStaticImagePixels(sourceBytes);
  const sourcePixelSha256 = staticPixelDigest(decoded.width, decoded.height, decoded.data);
  const relativeDir = join(entry.sha256.slice(0, 2), entry.sha256);
  const destinationDir = resolve(outputRoot, relativeDir);
  const tiles = [];
  const tileBytes = [];
  let index = 0;
  for (let top = 0; top < decoded.height; top += maxTileSize) {
    for (let left = 0; left < decoded.width; left += maxTileSize) {
      const region = {
        left,
        top,
        width: Math.min(maxTileSize, decoded.width - left),
        height: Math.min(maxTileSize, decoded.height - top),
      };
      const pixels = extractStaticPixelRegion(decoded, region);
      const bytes = encodeRgbaPng(pixels);
      const filename = `tile-${String(index).padStart(6, '0')}.png`;
      tiles.push({
        index,
        path: resolve(destinationDir, 'tiles', filename),
        sha256: digest(bytes),
        pixelSha256: pixels.pixelSha256,
        width: pixels.width,
        height: pixels.height,
        pixelRegion: pixels.pixelRegion,
        sourceObjectSha256: entry.sha256,
      });
      tileBytes.push({ filename, bytes });
      index += 1;
    }
  }
  const manifest = {
    schema: 'munjanggun.staticTileCoverage.v1',
    version: '1.0',
    sourceObjectSha256: entry.sha256,
    sourceWidth: decoded.width,
    sourceHeight: decoded.height,
    sourcePixelSha256,
    decoderVersion: STATIC_PIXEL_DECODER_VERSION,
    encoderVersion: STATIC_PNG_ENCODER_VERSION,
    coverageMode: 'native_resolution_non_overlapping_full_partition',
    tileCount: tiles.length,
    tiles,
  };
  manifest.coverageDigest = computeStaticTileCoverageDigest(manifest);
  const validation = validateAgainstSchema(manifest, manifestSchema);
  if (!validation.valid) throw new Error(`Generated static tile manifest schema failed:\n${formatSchemaErrors(validation.errors).join('\n')}`);
  return { manifest, manifestBytes: jsonBytes(manifest), tileBytes, destinationDir, relativeDir };
}

async function verifyEntryOrigins(entry, catalogs) {
  if (!Array.isArray(entry.origins) || entry.origins.length < 1) throw new Error(`Static entry has no origins: ${entry.sha256}`);
  const bindings = new Map(catalogs.map((catalog) => [`${catalog.intakeId}\0${catalog.catalogSha256}`, catalog]));
  const verified = [];
  for (const origin of entry.origins) {
    const catalog = bindings.get(`${origin.intakeId}\0${origin.catalogSha256}`);
    if (!catalog || !isAbsolute(String(catalog.rawRoot ?? '')) || !isAbsolute(String(origin.originalPath ?? ''))) {
      throw new Error(`Static origin has no matching catalog binding for ${entry.sha256}`);
    }
    const rawRoot = resolve(catalog.rawRoot);
    const expected = resolve(rawRoot, ...String(origin.sourceRelativePath ?? '').split(/[\\/]+/u));
    const original = resolve(origin.originalPath);
    if (!isContained(rawRoot, expected) || !samePath(expected, original)) throw new Error(`Static origin escapes its raw root for ${entry.sha256}`);
    await assertRegularNonSymlink(original, `Static original ${entry.sha256}`);
    const [realRoot, realOriginal] = await Promise.all([realpath(rawRoot), realpath(original)]);
    if (!isContained(realRoot, realOriginal)) throw new Error(`Static origin real path escapes its raw root for ${entry.sha256}`);
    const bytes = await readFile(original);
    if (bytes.length !== entry.byteSize || digest(bytes) !== entry.sha256) throw new Error(`Static original SHA-256 or size mismatch for ${entry.sha256}`);
    verified.push(original);
  }
  return verified;
}

async function assertSafeOutputRoot(destination, { repoRoot, allowedEvidenceBase }) {
  const repository = resolve(repoRoot);
  if (isContained(repository, destination)) throw new Error('Static tile evidence must be stored outside the public repository');
  if (!allowedEvidenceBase && process.platform !== 'win32') {
    throw new Error('Operating output must remain inside the allowed Z: evidence base');
  }
  const parent = dirname(destination);
  const parentInfo = await lstat(parent);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) throw new Error('Output parent must be a regular non-symlink directory');
  const realParent = await realpath(parent);
  const realDestination = resolve(realParent, basename(destination));
  const base = allowedEvidenceBase ? resolve(allowedEvidenceBase) : resolve('Z:\\');
  const baseInfo = await lstat(base);
  if (!baseInfo.isDirectory() || baseInfo.isSymbolicLink()) throw new Error('Allowed evidence base must be a regular non-symlink directory');
  const realBase = await realpath(base);
  if (!isContained(base, destination) || !isContained(realBase, realDestination)) {
    throw new Error('Operating output must remain inside the allowed Z: evidence base');
  }
  let realRepository = repository;
  try { realRepository = await realpath(repository); } catch { /* repository existence is checked by callers */ }
  if (isContained(realRepository, realDestination)) throw new Error('Static tile evidence real path must remain outside the public repository');
}

async function writePreparedEntry(item, partialRoot, finalRoot) {
  const partialDir = resolve(partialRoot, item.relativeDir);
  await mkdir(resolve(partialDir, 'tiles'), { recursive: true });
  for (const tile of item.tileBytes) await writeFile(resolve(partialDir, 'tiles', tile.filename), tile.bytes, { flag: 'wx' });
  // The manifest was prepared with final absolute paths, never temporary transaction paths.
  await writeFile(resolve(partialDir, 'manifest.json'), item.manifestBytes, { flag: 'wx' });
  if (!isContained(finalRoot, item.destinationDir)) throw new Error('Prepared destination escapes output root');
}

async function assertRegularNonSymlink(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file`);
}

async function assertMissing(path, label) {
  try {
    await stat(path);
    throw new Error(`${label} already exists: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} must be a positive integer`);
  return number;
}

function isContained(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function samePath(left, right) {
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
