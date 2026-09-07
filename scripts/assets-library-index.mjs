#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAssetLibraryIndex, searchAssetLibraryIndex, writeAssetLibraryHandoff } from './lib/asset-library.mjs';
import { many, one, parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function runAssetLibraryIndex(argv, {
  emit = console.log, indexOptions = {}, searchOptions = {}, handoffOptions = {},
} = {}) {
  const args = parseStrictArgs(argv, {
    valueFlags: [
      '--index', '--query', '--product', '--scene', '--installation-scene', '--color', '--design', '--topic', '--consultation-topic',
      '--media-type', '--limit', '--select-sha256', '--output-root', '--approved-private-root', '--consumer', '--output-name',
    ],
    multipleFlags: ['--select-sha256'],
  });
  const libraryIndex = await loadAssetLibraryIndex(resolve(required(args, '--index')), indexOptions);
  const criteria = {
    query: one(args, '--query'),
    product: one(args, '--product'),
    scene: exclusiveAlias(args, '--scene', '--installation-scene'),
    color: one(args, '--color'),
    design: one(args, '--design'),
    topic: exclusiveAlias(args, '--topic', '--consultation-topic'),
  };
  const limit = Number(one(args, '--limit') ?? 20);
  const results = await searchAssetLibraryIndex(libraryIndex, criteria, {
    mediaType: one(args, '--media-type'),
    limit,
    ...searchOptions,
  });
  const selectedHashes = [...new Set(many(args, '--select-sha256'))];
  const consumerId = one(args, '--consumer');
  if (consumerId && (one(args, '--output-root') || one(args, '--approved-private-root'))) {
    throw new Error('Use registered --consumer/--output-name or explicit output paths, not both');
  }
  if (selectedHashes.length === 0 && (one(args, '--output-root') || one(args, '--approved-private-root') || consumerId || one(args, '--output-name'))) {
    throw new Error('handoff output options require --select-sha256');
  }

  let handoff = null;
  if (selectedHashes.length > 0) {
    const selected = selectedHashes.map((sha256) => {
      const matches = results.filter((entry) => entry.sha256 === sha256);
      if (matches.length !== 1) throw new Error(`Selected sha256 is not uniquely present in current results: ${sha256}`);
      return matches[0];
    });
    const pointerIds = new Set(selected.map((entry) => entry.originPointerId));
    if (pointerIds.size !== 1) throw new Error('One handoff may select assets from only one source pointer; create separate handoffs for other source pointers');
    const pointerId = [...pointerIds][0];
    const indexed = libraryIndex.libraries.find((entry) => entry.pointerId === pointerId);
    if (!indexed) throw new Error(`Selected source pointer is missing from loaded index: ${pointerId}`);
    handoff = await writeAssetLibraryHandoff(indexed.library, selected, selected.map((entry) => entry.contentId), {
      outputRoot: consumerId ? undefined : resolve(required(args, '--output-root')),
      approvedPrivateRoot: consumerId ? undefined : resolve(required(args, '--approved-private-root')),
      consumerId,
      outputName: one(args, '--output-name'),
      libraryIndexAuthority: {
        path: libraryIndex.indexPath,
        canonicalSha256: libraryIndex.indexCanonicalSha256,
        updatedAt: libraryIndex.index.updatedAt,
        pointerId,
      },
      ...handoffOptions,
    });
  }

  const output = {
    workflow: 'private_asset_library_index',
    libraryId: libraryIndex.index.libraryId,
    indexUpdatedAt: libraryIndex.index.updatedAt,
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
  await runAssetLibraryIndex(process.argv.slice(2));
}
