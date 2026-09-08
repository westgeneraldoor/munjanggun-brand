#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signContentReviewDocument } from './lib/asset-content-review-signing.mjs';
import { parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function runSignContentReviewDocument(argv, { emit = console.log, ...options } = {}) {
  const args = parseStrictArgs(argv, {
    valueFlags: ['--input', '--private-key', '--key-id', '--output'],
  });
  const result = await signContentReviewDocument({
    inputPath: resolve(required(args, '--input')),
    privateKeyPath: resolve(required(args, '--private-key')),
    keyId: required(args, '--key-id'),
    outputPath: resolve(required(args, '--output')),
    ...options,
  });
  emit(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runSignContentReviewDocument(process.argv.slice(2));
}
