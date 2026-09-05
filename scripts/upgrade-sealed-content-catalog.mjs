#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFiles } from './lib/brand-validation-core.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const inputPath = resolve(requiredArg('--input'));
const manifestsRoot = resolve(requiredArg('--manifests-root'));
const outputPath = resolve(requiredArg('--output'));
const [catalog, schema] = await Promise.all([
  readJson(inputPath),
  readJson(fileURLToPath(new URL('../schemas/asset-content-catalog.schema.json', import.meta.url))),
]);
const manifestPaths = await findFiles(manifestsRoot, (path) => path.endsWith('asset-manifest.json'));
const assetsByHash = new Map();
for (const path of manifestPaths) {
  const manifest = await readJson(path);
  for (const asset of manifest.assets) {
    const group = assetsByHash.get(asset.sha256) ?? [];
    group.push(asset);
    assetsByHash.set(asset.sha256, group);
  }
}
const upgraded = {
  ...catalog,
  entries: catalog.entries.map((entry) => {
    const assets = assetsByHash.get(entry.sha256);
    if (!assets?.length) throw new Error(`No manifest asset for ${entry.sha256}`);
    const objectRefs = [...new Set(assets.map((asset) => asset.objectRef))];
    if (objectRefs.length !== 1) throw new Error(`Conflicting objectRef for ${entry.sha256}`);
    return {
      ...entry,
      objectRef: objectRefs[0],
      rightsEvidenceRef: intersection(assets.map((asset) => asset.rightsEvidenceRef)),
      claimEvidenceRef: intersection(assets.map((asset) => asset.claimEvidenceRef ?? [])),
    };
  }),
};
const result = validateAgainstSchema(upgraded, schema);
if (!result.valid) throw new Error(`Upgraded catalog schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(upgraded, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`Upgraded sealed catalog: ${upgraded.entries.length} binary groups.`);

function intersection(lists) {
  if (lists.length === 0) return [];
  return [...new Set(lists[0])].filter((value) => lists.every((list) => list.includes(value))).sort();
}
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
function requiredArg(name) { const index = process.argv.indexOf(name); const value = index === -1 ? undefined : process.argv[index + 1]; if (!value) throw new Error(`Missing required argument ${name}`); return value; }
