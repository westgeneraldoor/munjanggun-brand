#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256File } from './lib/asset-inventory.mjs';
import { resolveContainedPath } from './lib/asset-paths.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const catalogPath = resolve(requiredArg('--catalog'));
const outputPath = resolve(requiredArg('--output'));
const receiptPath = resolve(requiredArg('--receipt-output'));
const draftPath = getArg('--draft') ? resolve(getArg('--draft')) : null;
if (!draftPath && !process.argv.includes('--initialize-empty')) throw new Error('Provide --draft or --initialize-empty');
const [catalog, draft, registrySchema, receiptSchema] = await Promise.all([
  readJson(catalogPath), draftPath ? readJson(draftPath) : { entries: [] },
  readJson(fileURLToPath(new URL('../schemas/asset-use-evidence-registry.schema.json', import.meta.url))),
  readJson(fileURLToPath(new URL('../schemas/asset-use-evidence-receipt.schema.json', import.meta.url))),
]);
const sealedAt = new Date().toISOString();
const entries = [];
const receiptEntries = [];
for (const item of draft.entries ?? []) {
  const artifactPath = resolveContainedPath(dirname(receiptPath), item.artifactRef, 'use evidence artifact');
  const info = await stat(artifactPath);
  if (!info.isFile() || info.size < 1) throw new Error(`Evidence artifact missing or empty: ${item.artifactRef}`);
  const sha256 = await sha256File(artifactPath);
  entries.push({ ...item, artifactByteSize: info.size, artifactSha256: sha256 });
  receiptEntries.push({ evidenceId: item.evidenceId, relativePath: item.artifactRef, byteSize: info.size, sha256 });
}
const catalogSha256 = await sha256File(catalogPath);
const registry = { schema: 'munjanggun.assetUseEvidenceRegistry.v1', version: '1.0', intakeId: catalog.intakeId, catalogSha256, sealedAt, entryCount: entries.length, entries };
assertSchema(registry, registrySchema, 'use evidence registry');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(registry, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
const receipt = {
  schema: 'munjanggun.assetUseEvidenceReceipt.v1', version: '1.0', intakeId: catalog.intakeId, sealedAt, catalogSha256,
  registryRef: relative(dirname(receiptPath), outputPath).replaceAll('\\', '/'), registrySha256: await sha256File(outputPath),
  fileCount: receiptEntries.length, treeHash: hashEntries(receiptEntries), entries: receiptEntries,
  signature: null,
};
assertSchema(receipt, receiptSchema, 'use evidence receipt');
await mkdir(dirname(receiptPath), { recursive: true });
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`Sealed use evidence: ${entries.length} registered artifacts.`);

function hashEntries(items) { const hash = createHash('sha256'); for (const item of items) hash.update(`${item.evidenceId}\0${item.relativePath}\0${item.byteSize}\0${item.sha256}\n`, 'utf8'); return hash.digest('hex'); }
function assertSchema(value, schema, label) { const result = validateAgainstSchema(value, schema); if (!result.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`); }
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
function getArg(name) { const index = process.argv.indexOf(name); return index === -1 ? undefined : process.argv[index + 1]; }
function requiredArg(name) { const value = getArg(name); if (!value) throw new Error(`Missing required argument ${name}`); return value; }
