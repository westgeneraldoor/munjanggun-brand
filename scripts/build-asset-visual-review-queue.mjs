#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVisualReviewQueue } from './lib/asset-visual-review-queue.mjs';

export async function runBuildVisualReviewQueue(argv) {
  const catalogs = repeated(argv, '--catalog');
  const rawRoots = repeated(argv, '--raw-root');
  if (catalogs.length !== rawRoots.length) throw new Error('Provide one --raw-root for each --catalog in the same order');
  const outputPath = required(argv, '--output');
  const result = await buildVisualReviewQueue({
    sources: catalogs.map((catalogPath, index) => ({ catalogPath, rawRoot: rawRoots[index] })),
    outputPath,
  });
  console.log(JSON.stringify({ outputPath: resolve(outputPath), counts: result.counts, entrySetSha256: result.entrySetSha256 }, null, 2));
  return result;
}

function required(argv, name) {
  const index = argv.indexOf(name);
  const value = index === -1 ? null : argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}`);
  return value;
}

function repeated(argv, name) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== name) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
    values.push(value);
  }
  if (!values.length) throw new Error(`Provide at least one ${name}`);
  return values;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runBuildVisualReviewQueue(process.argv.slice(2));
}
