#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildWorkerReviewQueue } from './lib/asset-worker-review-queue.mjs';

const catalog = JSON.parse(await readFile(resolve(requiredArg('--catalog')), 'utf8'));
if (!Array.isArray(catalog.entries)) throw new Error('Catalog entries must be an array');
const outputPath = resolve(requiredArg('--output'));
const queue = buildWorkerReviewQueue(catalog);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(queue, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify(queue.counts, null, 2));

function requiredArg(name) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}`);
  return value;
}
