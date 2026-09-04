#!/usr/bin/env node
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { sha256File } from './lib/asset-inventory.mjs';
import { resolveContainedPath } from './lib/asset-paths.mjs';

const catalogPath = resolve(requiredArg('--catalog'));
const objectRoot = resolve(requiredArg('--object-root'));
const outputRoot = resolve(requiredArg('--output-root'));
const shaArg = getArg('--sha');
const contentIdArg = getArg('--content-id');
if (Boolean(shaArg) === Boolean(contentIdArg)) throw new Error('Provide exactly one of --sha or --content-id');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const entry = catalog.entries.find((item) => shaArg ? item.sha256 === shaArg : item.contentId === contentIdArg);
if (!entry) throw new Error('Catalog entry not found');
if (!/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Catalog SHA is invalid');

const bucket = resolveContainedPath(objectRoot, `sha256/${entry.sha256.slice(0, 2)}`, 'object bucket');
const matches = (await readdir(bucket)).filter((name) => name.startsWith(`${entry.sha256}.`));
if (matches.length !== 1) throw new Error(`Expected exactly one object for ${entry.sha256}, found ${matches.length}`);
const objectPath = resolveContainedPath(bucket, matches[0], 'object file');
const objectStat = await stat(objectPath);
if (!objectStat.isFile() || objectStat.size !== entry.byteSize) throw new Error('Object byteSize mismatch');
if (await sha256File(objectPath) !== entry.sha256) throw new Error('Object SHA mismatch');

await mkdir(outputRoot, { recursive: true });
const sourceName = basename(entry.sourceRefs[0]?.sourceRelativePath ?? `asset${extname(matches[0])}`);
const safeStem = basename(sourceName, extname(sourceName)).replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 80) || 'asset';
const outputName = `${entry.contentId}-${safeStem}${extname(matches[0]).toLowerCase()}`;
const outputPath = resolveContainedPath(outputRoot, outputName, 'output file');
await copyFile(objectPath, outputPath, constants.COPYFILE_EXCL);
console.log(JSON.stringify({ contentId: entry.contentId, sha256: entry.sha256, outputPath }, null, 2));

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredArg(name) {
  const value = getArg(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
