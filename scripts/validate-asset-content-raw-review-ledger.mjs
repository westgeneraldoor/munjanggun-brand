#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetContentRawReviewLedger } from './lib/asset-content-raw-review-ledger.mjs';
import { one, parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function runValidateAssetContentRawReviewLedger(argv, { emit = console.log, ...options } = {}) {
  const args = parseStrictArgs(argv, {
    valueFlags: ['--ledger', '--mode', '--reviewer-trust', '--attestation-root', '--adjudication-root'],
  });
  const result = await validateAssetContentRawReviewLedger({
    ledgerIndexPath: resolve(required(args, '--ledger')),
    mode: one(args, '--mode') ?? 'integrity',
    reviewerTrustPath: optionalResolved(args, '--reviewer-trust'),
    attestationRoot: optionalResolved(args, '--attestation-root'),
    adjudicationRoot: optionalResolved(args, '--adjudication-root'),
    ...options,
  });
  emit(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runValidateAssetContentRawReviewLedger(process.argv.slice(2));
}

function optionalResolved(args, name) {
  const value = one(args, name);
  return value ? resolve(value) : null;
}
