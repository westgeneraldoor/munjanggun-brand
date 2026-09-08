#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContentReviewerTrust } from './lib/asset-content-review-signing.mjs';
import { many, parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function runBuildContentReviewerTrust(argv, { emit = console.log, ...options } = {}) {
  const args = parseStrictArgs(argv, {
    valueFlags: ['--entry', '--output'],
    multipleFlags: ['--entry'],
  });
  const result = await buildContentReviewerTrust({
    entryPaths: many(args, '--entry').map((value) => resolve(value)),
    outputPath: resolve(required(args, '--output')),
    ...options,
  });
  emit(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runBuildContentReviewerTrust(process.argv.slice(2));
}
