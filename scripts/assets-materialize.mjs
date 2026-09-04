#!/usr/bin/env node
import { constants } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { resolveContainedPath } from './lib/asset-paths.mjs';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { resolveAssetObject } from './lib/asset-resolver.mjs';

const manifestPaths = getArgs('--manifest').map((value) => resolve(value));
if (manifestPaths.length === 0) throw new Error('At least one --manifest is required.');
const objectRoot = resolve(requiredArg('--object-root'));
const outputRoot = resolve(requiredArg('--output-root'));
await requireEmptyOutput(outputRoot);
const assets = [];
for (const manifestPath of manifestPaths) {
  const { manifest, findings } = await readAndValidateManifestV2(manifestPath);
  if (findings.length > 0) throw new Error(`${manifestPath}: ${findings.map((finding) => finding.message).join('\n')}`);
  assets.push(...manifest.assets);
}
const logicalPaths = new Set();
for (const asset of assets) {
  if (logicalPaths.has(asset.logicalPath)) throw new Error(`Duplicate logicalPath across manifests: ${asset.logicalPath}`);
  logicalPaths.add(asset.logicalPath);
}

for (const asset of [...assets].sort((a, b) => a.logicalPath.localeCompare(b.logicalPath, 'ko', { numeric: true }))) {
  const sourcePath = await resolveAssetObject(objectRoot, asset);
  const targetPath = resolveContainedPath(outputRoot, asset.logicalPath, 'logicalPath');
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
}
console.log(`Materialized ${assets.length} logical paths under ${outputRoot}`);

async function requireEmptyOutput(path) {
  await mkdir(path, { recursive: true });
  const entries = await readdir(path);
  if (entries.length > 0) throw new Error(`Output root must be empty: ${path}`);
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function getArgs(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function requiredArg(name) {
  const value = getArg(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
