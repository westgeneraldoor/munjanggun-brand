#!/usr/bin/env node
import { constants } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { resolveContainedPath } from './lib/asset-paths.mjs';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { resolveAssetObject } from './lib/asset-resolver.mjs';

const manifestPath = resolve(requiredArg('--manifest'));
const objectRoot = resolve(requiredArg('--object-root'));
const outputRoot = resolve(requiredArg('--output-root'));
await requireEmptyOutput(outputRoot);
const { manifest, findings } = await readAndValidateManifestV2(manifestPath);
if (findings.length > 0) throw new Error(findings.map((finding) => finding.message).join('\n'));

for (const asset of [...manifest.assets].sort((a, b) => a.sourceOrder - b.sourceOrder)) {
  const sourcePath = await resolveAssetObject(objectRoot, asset);
  const targetPath = resolveContainedPath(outputRoot, asset.logicalPath, 'logicalPath');
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
}
console.log(`Materialized ${manifest.assets.length} logical paths under ${outputRoot}`);

async function requireEmptyOutput(path) {
  await mkdir(path, { recursive: true });
  const entries = await readdir(path);
  if (entries.length > 0) throw new Error(`Output root must be empty: ${path}`);
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
