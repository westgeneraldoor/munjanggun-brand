#!/usr/bin/env node
import { resolve } from 'node:path';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { resolveAssetObject, selectAsset } from './lib/asset-resolver.mjs';

const manifestPath = resolve(requiredArg('--manifest'));
const objectRoot = resolve(requiredArg('--object-root'));
const { manifest, findings } = await readAndValidateManifestV2(manifestPath);
failFindings(findings);
const asset = selectAsset(manifest, selectorArgs());
const objectPath = await resolveAssetObject(objectRoot, asset);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ assetInstanceId: asset.assetInstanceId, logicalPath: asset.logicalPath, objectPath, sha256: asset.sha256 }));
} else {
  console.log(objectPath);
}

function selectorArgs() {
  return {
    assetId: getArg('--asset-id'),
    logicalPath: getArg('--logical-path'),
    sourceId: getArg('--source-id'),
    sourceRelativePath: getArg('--source-relative-path'),
  };
}

function failFindings(findings) {
  if (findings.length === 0) return;
  for (const finding of findings) console.error(finding.message);
  process.exit(1);
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
