#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGifAdjudicationActiveCandidate } from './lib/gif-adjudication-active-candidate.mjs';
import { one, parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function runValidateGifAdjudicationActiveCandidate(argv, { emit = console.log } = {}) {
  const args = parseStrictArgs(argv, { valueFlags: ['--active-candidate'], booleanFlags: [] });
  required(args, '--active-candidate');
  const activeCandidatePath = resolve(one(args, '--active-candidate'));
  const result = await validateGifAdjudicationActiveCandidate({ activeCandidatePath });
  emit(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runValidateGifAdjudicationActiveCandidate(process.argv.slice(2));
}
