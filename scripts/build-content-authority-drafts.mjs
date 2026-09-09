#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRawReviewAuthorityDrafts } from './lib/asset-content-authority-adapter.mjs';
import { one, parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function runBuildContentAuthorityDrafts(argv, { emit = console.log, ...options } = {}) {
  const args = parseStrictArgs(argv, {
    valueFlags: ['--config', '--output-root'],
    booleanFlags: ['--check-only'],
  });
  const configPath = resolve(required(args, '--config'));
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const allowedConfigKeys = new Set([
    'schema', 'version', 'queuePath', 'staticSegments', 'staticEvidenceIndexPath',
    'gifAdjudicationActiveCandidatePath', 'catalogs', 'generatedAt',
  ]);
  if (config?.schema !== 'munjanggun.assetContentAuthorityDraftAdapterConfig.v1'
    || config.version !== '1.0'
    || Object.keys(config).some((key) => !allowedConfigKeys.has(key))) {
    throw new Error('Adapter config is invalid; GIF semantics must be selected only through gifAdjudicationActiveCandidatePath');
  }
  const checkOnly = args.has('--check-only');
  const outputRoot = one(args, '--output-root');
  if (checkOnly && outputRoot) throw new Error('--check-only must not be combined with --output-root');
  if (!checkOnly && !outputRoot) throw new Error('Provide --output-root unless using --check-only');
  const result = await buildRawReviewAuthorityDrafts({
    ...config,
    outputRoot: outputRoot ? resolve(outputRoot) : null,
    checkOnly,
    ...options,
  });
  const summary = {
    authorityStatus: result.report.authorityStatus,
    promotionReadiness: result.report.promotionReadiness,
    coverage: result.report.coverage,
    conversionIntegrity: result.report.conversionIntegrity,
    documents: result.report.documents,
    evidenceNeedSummary: result.report.evidenceNeedSummary,
    outputRoot: result.outputRoot,
  };
  emit(JSON.stringify(summary, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runBuildContentAuthorityDrafts(process.argv.slice(2));
}
