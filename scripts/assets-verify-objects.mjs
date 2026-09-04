#!/usr/bin/env node
import { resolve } from 'node:path';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { verifyManifestObjects } from './lib/asset-resolver.mjs';

const manifestPaths = getArgs('--manifest').map((value) => resolve(value));
if (manifestPaths.length === 0) throw new Error('At least one --manifest is required.');
const objectRoot = resolve(requiredArg('--object-root'));
const assets = [];
for (const manifestPath of manifestPaths) {
  const { manifest, findings } = await readAndValidateManifestV2(manifestPath);
  if (findings.length > 0) {
    for (const finding of findings) console.error(`${manifestPath}: ${finding.message}`);
    process.exit(1);
  }
  assets.push(...manifest.assets);
}
const result = await verifyManifestObjects({ assets }, objectRoot);
if (result.errors.length > 0) {
  for (const message of result.errors) console.error(message);
  console.error(`Object verification failed: ${result.errors.length} error(s).`);
  process.exit(1);
}
console.log(`Object verification passed: ${result.verified} unique objects for ${result.referenced} logical paths.`);

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
