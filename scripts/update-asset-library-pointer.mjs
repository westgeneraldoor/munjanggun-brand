#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256File } from './lib/asset-inventory.mjs';
import { activateAssetLibraryPointer } from './lib/asset-library-pointer-updater.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const parsed = parseArgs(process.argv.slice(2));
const pointerPath = resolve(required(parsed, '--pointer'));
const catalogPath = resolve(required(parsed, '--catalog'));
const objectRoot = resolve(required(parsed, '--object-root'));
const rightsBundleRoot = resolve(required(parsed, '--rights-bundle-root'));
const rightsStateRef = required(parsed, '--rights-state-ref');
const anchorPath = resolve(required(parsed, '--anchor'));
if (rightsStateRef.includes('..') || rightsStateRef.includes('\\') || /^[A-Za-z]:|^\//u.test(rightsStateRef)) throw new Error('rights-state-ref must be a safe forward-slash relative path');
const rightsStatePath = resolve(rightsBundleRoot, ...rightsStateRef.split('/'));
for (const [label, path, kind] of [['catalog', catalogPath, 'file'], ['object root', objectRoot, 'directory'], ['rights bundle root', rightsBundleRoot, 'directory'], ['rights state', rightsStatePath, 'file'], ['anchor', anchorPath, 'file']]) {
  const info = await stat(path);
  if ((kind === 'file' && !info.isFile()) || (kind === 'directory' && !info.isDirectory())) throw new Error(`${label} has the wrong filesystem type`);
}
const [catalogSha256, rightsStateSha256, anchorSha256] = await Promise.all([
  sha256File(catalogPath), sha256File(rightsStatePath), sha256File(anchorPath),
]);
const pointer = {
  schema: 'munjanggun.assetLibraryPointer.v1', version: '1.0', libraryId: required(parsed, '--library-id'),
  updatedAt: new Date().toISOString(),
  current: { catalogPath, catalogSha256, objectRoot, rightsBundleRoot, rightsStateRef, rightsStateSha256, anchorPath, anchorSha256 },
};
const schema = JSON.parse(await readFile(fileURLToPath(new URL('../schemas/asset-library-pointer.schema.json', import.meta.url)), 'utf8'));
const validation = validateAgainstSchema(pointer, schema);
if (!validation.valid) throw new Error(`Library pointer schema failed:\n${formatSchemaErrors(validation.errors).join('\n')}`);
const result = await activateAssetLibraryPointer({
  pointerPath, pointer,
  expectAbsent: parsed.has('--expect-absent'),
  expectedCurrentSha256: parsed.get('--expected-current-sha256'),
});
console.log(JSON.stringify(result, null, 2));

function parseArgs(args) {
  const valueArgs = new Set(['--pointer', '--catalog', '--object-root', '--rights-bundle-root', '--rights-state-ref', '--anchor', '--library-id', '--expected-current-sha256']);
  const flagArgs = new Set(['--expect-absent']);
  const parsed = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (flagArgs.has(name)) { if (parsed.has(name)) throw new Error(`Duplicate argument ${name}`); parsed.set(name, true); continue; }
    if (!valueArgs.has(name)) throw new Error(`Unknown argument ${name}`);
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
    if (parsed.has(name)) throw new Error(`Duplicate argument ${name}`);
    parsed.set(name, value);
  }
  return parsed;
}

function required(args, name) {
  const value = args.get(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
