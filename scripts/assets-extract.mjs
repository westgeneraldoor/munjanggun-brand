#!/usr/bin/env node
import { constants } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { resolveAssetObject, selectAsset } from './lib/asset-resolver.mjs';

const manifestPath = resolve(requiredArg('--manifest'));
const objectRoot = resolve(requiredArg('--object-root'));
const outputPath = resolve(requiredArg('--output'));
const { manifest, findings } = await readAndValidateManifestV2(manifestPath);
if (findings.length > 0) throw new Error(findings.map((finding) => finding.message).join('\n'));
const asset = selectAsset(manifest, selectorArgs());
const objectPath = await resolveAssetObject(objectRoot, asset);
await mkdir(dirname(outputPath), { recursive: true });
await copyFile(objectPath, outputPath, constants.COPYFILE_EXCL);
console.log(`Extracted ${asset.assetInstanceId} to ${outputPath}`);

function selectorArgs() {
  return {
    assetId: getArg('--asset-id'),
    logicalPath: getArg('--logical-path'),
    sourceId: getArg('--source-id'),
    sourceRelativePath: getArg('--source-relative-path'),
  };
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
