#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGifSecondaryActiveCandidate } from './lib/gif-secondary-active-candidate.mjs';
import { one, parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function runValidateGifSecondaryActiveCandidate(argv, { emit = console.log } = {}) {
  const args = parseStrictArgs(argv, { valueFlags: ['--active-candidate'] });
  const result = await validateGifSecondaryActiveCandidate({
    activeCandidatePath: resolve(required(args, '--active-candidate')),
  });
  emit(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runValidateGifSecondaryActiveCandidate(process.argv.slice(2));
}
