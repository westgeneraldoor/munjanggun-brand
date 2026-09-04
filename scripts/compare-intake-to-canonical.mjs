#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inventoryTree } from './lib/asset-inventory.mjs';

const receiptPath = resolve(requiredArg('--receipt'));
const canonicalRoot = resolve(requiredArg('--canonical-root'));
const outputPath = resolve(requiredArg('--output'));
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
const incoming = receipt.entries.filter((entry) => entry.disposition === 'managed' && entry.kind === 'visual');

const canonicalDirs = (await readdir(canonicalRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name !== '신규')
  .map((entry) => entry.name);
const canonicalProductSet = new Set(canonicalDirs);
const canonical = [];
for (const folder of canonicalDirs) {
  const inventory = await inventoryTree(join(canonicalRoot, folder));
  for (const entry of inventory.entries.filter((item) => item.disposition === 'managed' && item.kind === 'visual')) {
    canonical.push({ ...entry, canonicalRelativePath: `${folder}/${entry.sourceRelativePath}` });
  }
}

const byPath = new Map(canonical.map((entry) => [entry.canonicalRelativePath, entry]));
const byHash = new Map();
for (const entry of canonical) {
  const paths = byHash.get(entry.sha256) ?? [];
  paths.push(entry.canonicalRelativePath);
  byHash.set(entry.sha256, paths);
}

const entries = incoming.map((entry) => {
  const productFolder = entry.sourceRelativePath.split('/')[0];
  const samePath = byPath.get(entry.sourceRelativePath);
  let classification;
  if (!canonicalProductSet.has(productFolder)) classification = 'new_product_bundle';
  else if (samePath?.sha256 === entry.sha256) classification = 'same_path_unchanged';
  else if (samePath) classification = 'same_path_replacement';
  else if (byHash.has(entry.sha256)) classification = 'new_path_exact_duplicate';
  else classification = 'substantive_new_path_existing_product';
  return {
    sourceRelativePath: entry.sourceRelativePath,
    sha256: entry.sha256,
    classification,
    priorSamePathSha256: samePath?.sha256 ?? null,
    existingExactDuplicatePaths: byHash.get(entry.sha256) ?? [],
  };
});

const counts = Object.fromEntries([
  'same_path_unchanged',
  'same_path_replacement',
  'new_path_exact_duplicate',
  'substantive_new_path_existing_product',
  'new_product_bundle',
].map((key) => [key, entries.filter((entry) => entry.classification === key).length]));
const output = {
  schema: 'munjanggun.canonicalComparison.v1',
  version: '1.0',
  intakeId: receipt.intakeId,
  generatedAt: new Date().toISOString(),
  incomingVisualPaths: incoming.length,
  canonicalVisualPaths: canonical.length,
  counts,
  entries,
};
if (Object.values(counts).reduce((sum, count) => sum + count, 0) !== incoming.length) {
  throw new Error('Classification counts do not cover all incoming visual paths');
}
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify(counts, null, 2));

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredArg(name) {
  const value = getArg(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
