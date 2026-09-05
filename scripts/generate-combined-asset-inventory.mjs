#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inventoryTree } from './lib/asset-inventory.mjs';
import { findFiles } from './lib/brand-validation-core.mjs';
import { canonicalExtensionForMediaType, inspectMedia } from './lib/media-metadata.mjs';

const receiptPath = resolve(requiredArg('--receipt'));
const canonicalRoot = resolve(requiredArg('--canonical-root'));
const candidateRoot = resolve(requiredArg('--candidate-root'));
const outputPath = resolve(requiredArg('--output'));
const receipt = await readJson(receiptPath);

const manifestPaths = await findFiles(resolve(candidateRoot, 'manifests'), (path) => path.endsWith('asset-manifest.json'));
const candidateAssets = (await Promise.all(manifestPaths.map(readJson))).flatMap((manifest) => manifest.assets);
const candidateByHash = new Map(candidateAssets.map((asset) => [asset.sha256, asset]));

const paths = [];
for (const entry of receipt.entries.filter((item) => item.disposition === 'managed' && item.kind === 'visual')) {
  const asset = candidateByHash.get(entry.sha256);
  if (!asset) throw new Error(`Candidate manifest missing receipt SHA ${entry.sha256}`);
  paths.push({
    logicalInstancePath: `intake/${entry.sourceRelativePath}`,
    origin: 'intake',
    sourceRelativePath: entry.sourceRelativePath,
    sha256: entry.sha256,
    byteSize: entry.byteSize,
    mediaType: asset.mediaType,
    objectRef: asset.objectRef,
  });
}

const canonicalDirs = (await readdir(canonicalRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name !== '신규')
  .map((entry) => entry.name)
  .sort(natural);
for (const folder of canonicalDirs) {
  const folderRoot = join(canonicalRoot, folder);
  const inventory = await inventoryTree(folderRoot);
  for (const entry of inventory.entries.filter((item) => item.disposition === 'managed' && item.kind === 'visual')) {
    const sourceRelativePath = `${folder}/${entry.sourceRelativePath}`;
    const candidate = candidateByHash.get(entry.sha256);
    let mediaType = candidate?.mediaType;
    let objectRef = candidate?.objectRef;
    if (!candidate) {
      const metadata = await inspectMedia(join(canonicalRoot, ...sourceRelativePath.split('/')));
      mediaType = metadata.mediaType;
      const extension = canonicalExtensionForMediaType(mediaType);
      objectRef = `sha256/${entry.sha256.slice(0, 2)}/${entry.sha256}${extension}`;
    }
    paths.push({
      logicalInstancePath: `canonical/문장군상품/${sourceRelativePath}`,
      origin: 'canonical',
      sourceRelativePath,
      sha256: entry.sha256,
      byteSize: entry.byteSize,
      mediaType,
      objectRef,
    });
  }
}

paths.sort((left, right) => natural(left.logicalInstancePath, right.logicalInstancePath));
if (new Set(paths.map((entry) => entry.logicalInstancePath)).size !== paths.length) throw new Error('Duplicate logical instance path');
const grouped = new Map();
for (const entry of paths) {
  const group = grouped.get(entry.sha256) ?? [];
  group.push(entry);
  grouped.set(entry.sha256, group);
}
const groups = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([sha256, members]) => {
  const first = members[0];
  if (members.some((entry) => entry.byteSize !== first.byteSize)) throw new Error(`Conflicting byteSize for ${sha256}`);
  if (new Set(members.map((entry) => entry.objectRef)).size !== 1) throw new Error(`Conflicting objectRef for ${sha256}`);
  const intakeCount = members.filter((entry) => entry.origin === 'intake').length;
  const canonicalCount = members.filter((entry) => entry.origin === 'canonical').length;
  const representative = members.find((entry) => entry.origin === 'intake') ?? first;
  return {
    binaryGroupId: `sha256:${sha256}`,
    sha256,
    byteSize: first.byteSize,
    mediaType: first.mediaType,
    objectRef: first.objectRef,
    canonicalPathCount: canonicalCount,
    intakePathCount: intakeCount,
    representative: { origin: representative.origin, sourceRelativePath: representative.sourceRelativePath },
    logicalInstancePaths: members.map((entry) => entry.logicalInstancePath),
  };
});

const counts = {
  canonicalVisualPaths: paths.filter((entry) => entry.origin === 'canonical').length,
  intakeVisualPaths: paths.filter((entry) => entry.origin === 'intake').length,
  logicalVisualPaths: paths.length,
  binaryGroups: groups.length,
  sharedBinaryGroups: groups.filter((entry) => entry.canonicalPathCount > 0 && entry.intakePathCount > 0).length,
  canonicalOnlyBinaryGroups: groups.filter((entry) => entry.canonicalPathCount > 0 && entry.intakePathCount === 0).length,
  intakeOnlyBinaryGroups: groups.filter((entry) => entry.canonicalPathCount === 0 && entry.intakePathCount > 0).length,
  gifBinaryGroups: groups.filter((entry) => entry.mediaType === 'image/gif').length,
};
const expected = {
  canonicalVisualPaths: 879,
  intakeVisualPaths: 1134,
  logicalVisualPaths: 2013,
  binaryGroups: 450,
  sharedBinaryGroups: 297,
  canonicalOnlyBinaryGroups: 43,
  intakeOnlyBinaryGroups: 110,
  gifBinaryGroups: 75,
};
for (const [key, value] of Object.entries(expected)) {
  if (counts[key] !== value) throw new Error(`${key}: expected ${value}, got ${counts[key]}`);
}
const output = {
  schema: 'munjanggun.combinedAssetInventory.v1',
  version: '1.0',
  intakeId: receipt.intakeId,
  generatedAt: new Date().toISOString(),
  comparisonScope: 'canonical_and_intake_namespaced',
  counts,
  paths,
  groups,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify(counts, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function natural(left, right) {
  return left.localeCompare(right, 'ko', { numeric: true, sensitivity: 'base' });
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredArg(name) {
  const value = getArg(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
