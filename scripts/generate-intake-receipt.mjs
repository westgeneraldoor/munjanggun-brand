#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inventoryTree, compareInventories } from './lib/asset-inventory.mjs';
import { validateAgainstSchema, formatSchemaErrors } from './lib/schema-validation.mjs';

const sourceRoot = resolve(requiredValue('--source'));
const recoveryRoot = resolve(requiredValue('--recovery'));
const outputPath = resolve(requiredValue('--output'));
const intakeId = requiredValue('--intake-id');
const schemaPath = fileURLToPath(new URL('../schemas/asset-intake-receipt.schema.json', import.meta.url));

const source = await inventoryTree(sourceRoot);
const recovery = await inventoryTree(recoveryRoot);
const recoveryVerification = compareInventories(source.entries, recovery.entries);
const receipt = {
  schema: 'munjanggun.assetIntakeReceipt.v2',
  version: '2.0',
  intakeId,
  generatedAt: new Date().toISOString(),
  sourceLabel: getArg('--source-label') ?? 'local-intake-source',
  recoveryLabel: getArg('--recovery-label') ?? 'private-recovery-copy',
  counts: source.counts,
  sourceTreeHash: source.treeHash,
  recoveryTreeHash: recovery.treeHash,
  recoveryVerification,
  entries: source.entries,
};

const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const result = validateAgainstSchema(receipt, schema);
if (!result.valid) {
  for (const message of formatSchemaErrors(result.errors)) console.error(message);
  process.exit(1);
}
if (recoveryVerification.status !== 'verified' || source.treeHash !== recovery.treeHash) {
  console.error('Recovery copy does not match the source tree.');
  process.exit(1);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`Receipt written: ${outputPath}`);
console.log(`Verified ${receipt.counts.all} files / ${receipt.counts.allBytes} bytes / tree ${receipt.sourceTreeHash}`);

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredValue(name) {
  const value = getArg(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
