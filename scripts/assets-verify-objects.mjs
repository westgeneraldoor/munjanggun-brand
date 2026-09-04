#!/usr/bin/env node
import { resolve } from 'node:path';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { verifyManifestObjects } from './lib/asset-resolver.mjs';

const manifestPath = resolve(requiredArg('--manifest'));
const objectRoot = resolve(requiredArg('--object-root'));
const { manifest, findings } = await readAndValidateManifestV2(manifestPath);
if (findings.length > 0) {
  for (const finding of findings) console.error(finding.message);
  process.exit(1);
}
const result = await verifyManifestObjects(manifest, objectRoot);
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

function requiredArg(name) {
  const value = getArg(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
