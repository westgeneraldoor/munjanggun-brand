#!/usr/bin/env node
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { resolveContainedPath } from './lib/asset-paths.mjs';
import { sha256File } from './lib/asset-inventory.mjs';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';

const sourceRoot = resolve(requiredArg('--source-root'));
const objectRoot = resolve(requiredArg('--object-root'));
const manifestPaths = getArgs('--manifest').map((value) => resolve(value));
if (manifestPaths.length === 0) throw new Error('At least one --manifest is required.');

await mkdir(objectRoot, { recursive: true });
const objects = new Map();
for (const manifestPath of manifestPaths) {
  const raw = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (raw.schema !== 'munjanggun.productDetailAssets.v2') throw new Error(`Only v2 manifests are accepted: ${manifestPath}`);
  const { manifest, findings } = await readAndValidateManifestV2(manifestPath);
  if (findings.length > 0) throw new Error(`${manifestPath}: ${findings.map((finding) => finding.message).join('; ')}`);
  for (const asset of manifest.assets) {
    const prior = objects.get(asset.objectRef);
    if (prior && (prior.sha256 !== asset.sha256 || prior.byteSize !== asset.byteSize)) {
      throw new Error(`Conflicting objectRef ${asset.objectRef}`);
    }
    if (!prior) objects.set(asset.objectRef, asset);
  }
}

let copied = 0;
let reused = 0;
for (const [objectRef, asset] of [...objects.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  const sourcePath = resolveContainedPath(sourceRoot, asset.sourceRelativePath, 'sourceRelativePath');
  const targetPath = resolveContainedPath(objectRoot, objectRef, 'objectRef');
  const sourceStat = await stat(sourcePath);
  if (sourceStat.size !== asset.byteSize) throw new Error(`Source byteSize mismatch: ${asset.sourceRelativePath}`);
  const sourceHash = await sha256File(sourcePath);
  if (sourceHash !== asset.sha256) throw new Error(`Source sha256 mismatch: ${asset.sourceRelativePath}`);
  await mkdir(dirname(targetPath), { recursive: true });
  try {
    await copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
    copied += 1;
  } catch (copyError) {
    if (copyError.code !== 'EEXIST') throw copyError;
    const targetStat = await stat(targetPath);
    const targetHash = await sha256File(targetPath);
    if (targetStat.size !== asset.byteSize || targetHash !== asset.sha256) {
      throw new Error(`Existing object conflicts with ${objectRef}`);
    }
    reused += 1;
  }
}

console.log(`Object store build passed: ${objects.size} objects (${copied} copied, ${reused} reused).`);

function getArgs(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function requiredArg(name) {
  const values = getArgs(name);
  if (values.length !== 1) throw new Error(`Expected exactly one ${name}`);
  return values[0];
}
