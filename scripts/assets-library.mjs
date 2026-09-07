#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAssetLibrary, searchAssetLibrary, writeAssetLibraryHandoff } from './lib/asset-library.mjs';
import { many, one, parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function runAssetLibrary(argv, {
  emit = console.log, libraryOptions = {}, searchOptions = {}, handoffOptions = {},
} = {}) {
  const args = parseStrictArgs(argv, {
    valueFlags: [
      '--pointer', '--query', '--product', '--scene', '--installation-scene', '--color', '--design', '--topic', '--consultation-topic',
      '--media-type', '--limit', '--select-content-id', '--output-root', '--approved-private-root',
      '--consumer', '--output-name',
    ],
    multipleFlags: ['--select-content-id'],
  });
  const library = await loadAssetLibrary(resolve(required(args, '--pointer')), libraryOptions);
  const criteria = {
    query: one(args, '--query'),
    product: one(args, '--product'),
    scene: exclusiveAlias(args, '--scene', '--installation-scene'),
    color: one(args, '--color'),
    design: one(args, '--design'),
    topic: exclusiveAlias(args, '--topic', '--consultation-topic'),
  };
  const limit = Number(one(args, '--limit') ?? 20);
  const results = await searchAssetLibrary(library, criteria, {
    mediaType: one(args, '--media-type'),
    limit,
    ...searchOptions,
  });
  const selectedIds = many(args, '--select-content-id');
  const consumerId = one(args, '--consumer');
  if (consumerId && (one(args, '--output-root') || one(args, '--approved-private-root'))) {
    throw new Error('Use registered --consumer/--output-name or explicit output paths, not both');
  }
  const handoff = selectedIds.length > 0
    ? await writeAssetLibraryHandoff(library, results, selectedIds, {
      outputRoot: consumerId ? undefined : resolve(required(args, '--output-root')),
      approvedPrivateRoot: consumerId ? undefined : resolve(required(args, '--approved-private-root')),
      consumerId,
      outputName: one(args, '--output-name'),
      ...handoffOptions,
    })
    : null;
  if (selectedIds.length === 0 && (one(args, '--output-root') || one(args, '--approved-private-root') || one(args, '--consumer') || one(args, '--output-name'))) {
    throw new Error('handoff output options require --select-content-id');
  }
  const output = {
    workflow: 'private_asset_library',
    libraryId: library.pointer.libraryId,
    pointerUpdatedAt: library.pointer.updatedAt,
    criteria: Object.fromEntries(Object.entries(criteria).filter(([, value]) => value)),
    resultCount: results.length,
    results,
    handoff,
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
  await runAssetLibrary(process.argv.slice(2));
}
