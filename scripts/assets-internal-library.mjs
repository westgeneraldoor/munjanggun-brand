#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadInternalAssetLibrary, searchInternalAssetLibrary, writeInternalAssetHandoff } from './lib/asset-internal-library.mjs';
import { many, one, parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function runInternalAssetLibrary(argv, {
  emit = console.log, loadOptions = {}, handoffOptions = {}, defaultConfigPath,
} = {}) {
  const args = parseStrictArgs(argv, {
    valueFlags: [
      '--config', '--query', '--product', '--scene', '--installation-scene', '--color', '--design', '--topic', '--consultation-topic',
      '--media-type', '--limit', '--select-sha256', '--consumer', '--output-name',
    ],
    multipleFlags: ['--select-sha256'],
  });
  const configPath = resolve(one(args, '--config') ?? defaultConfigPath ?? fileURLToPath(new URL('../config/asset-internal-library.json', import.meta.url)));
  const library = await loadInternalAssetLibrary(configPath, loadOptions);
  const criteria = {
    query: one(args, '--query'),
    product: one(args, '--product'),
    scene: exclusiveAlias(args, '--scene', '--installation-scene'),
    color: one(args, '--color'),
    design: one(args, '--design'),
    topic: exclusiveAlias(args, '--topic', '--consultation-topic'),
  };
  const results = searchInternalAssetLibrary(library, criteria, {
    mediaType: one(args, '--media-type'),
    limit: Number(one(args, '--limit') ?? 20),
  });
  const selected = [...new Set(many(args, '--select-sha256'))];
  const consumer = one(args, '--consumer');
  const outputName = one(args, '--output-name');
  if (selected.length === 0 && (consumer || outputName)) throw new Error('handoff options require --select-sha256');
  if (selected.length > 0 && (!consumer || !outputName)) throw new Error('selection requires --consumer and --output-name');
  const handoff = selected.length > 0 ? await writeInternalAssetHandoff(library, results, selected, {
    consumerId: required(args, '--consumer'), outputName: required(args, '--output-name'), ...handoffOptions,
  }) : null;
  const output = {
    workflow: 'primary_reviewed_internal_asset_library',
    libraryId: library.config.libraryId,
    mode: library.config.mode,
    authorityStatus: 'non_authority',
    assetCount: library.records.length,
    criteria: Object.fromEntries(Object.entries(criteria).filter(([, value]) => value)),
    resultCount: results.length,
    results,
    handoff,
    externalPublication: 'blocked_selected_asset_review_required',
    publicGitStorage: 'blocked',
  };
  emit(JSON.stringify(output, null, 2));
  return output;
}

function exclusiveAlias(args, first, second) {
  const left = one(args, first);
  const right = one(args, second);
  if (left && right) throw new Error(`Use only one of ${first} or ${second}`);
  return left ?? right;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runInternalAssetLibrary(process.argv.slice(2));
}
