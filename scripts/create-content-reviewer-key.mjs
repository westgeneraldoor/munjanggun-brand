#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContentReviewerKeyPair } from './lib/asset-content-review-signing.mjs';
import { parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function runCreateContentReviewerKey(argv, { emit = console.log, ...options } = {}) {
  const args = parseStrictArgs(argv, {
    valueFlags: ['--output-dir', '--principal-id', '--key-id'],
  });
  const result = await createContentReviewerKeyPair({
    outputDir: resolve(required(args, '--output-dir')),
    principalId: required(args, '--principal-id'),
    keyId: required(args, '--key-id'),
    ...options,
  });
  emit(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCreateContentReviewerKey(process.argv.slice(2));
}
