#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareInventories, computeTreeHash, inventoryTree, summarizeEntries } from './lib/asset-inventory.mjs';
import { validateAgainstSchema, formatSchemaErrors } from './lib/schema-validation.mjs';

const receiptPath = resolve(requiredArg('--receipt'));
const sourceRoot = resolve(requiredArg('--source'));
const recoveryRoot = resolve(requiredArg('--recovery'));
const schemaPath = fileURLToPath(new URL('../schemas/asset-intake-receipt.schema.json', import.meta.url));
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const schemaResult = validateAgainstSchema(receipt, schema);
const errors = formatSchemaErrors(schemaResult.errors);

const source = await inventoryTree(sourceRoot);
const recovery = await inventoryTree(recoveryRoot);
const comparison = compareInventories(source.entries, recovery.entries);
const receiptVsSource = compareInventories(receipt.entries, source.entries);

if (JSON.stringify(receipt.counts) !== JSON.stringify(summarizeEntries(receipt.entries))) {
  errors.push('/counts: declared counts do not match receipt entries');
}
if (receipt.sourceTreeHash !== computeTreeHash(receipt.entries)) {
  errors.push('/sourceTreeHash: does not match receipt entries');
}
if (receipt.sourceTreeHash !== source.treeHash) errors.push('/sourceTreeHash: does not match live source');
if (receipt.recoveryTreeHash !== recovery.treeHash) errors.push('/recoveryTreeHash: does not match live recovery copy');
if (comparison.status !== 'verified') errors.push('/recoveryVerification: source and recovery copy differ');
if (receiptVsSource.status !== 'verified') errors.push('/entries: receipt and live source differ');
if (new Set(receipt.entries.map((entry) => entry.sourceRelativePath)).size !== receipt.entries.length) {
  errors.push('/entries: duplicate sourceRelativePath');
}

if (errors.length > 0) {
  for (const message of errors) console.error(message);
  console.error(`Intake receipt validation failed: ${errors.length} error(s).`);
  process.exit(1);
}

console.log(`Intake receipt validation passed: ${receipt.counts.all} files, ${receipt.counts.managed} managed, ${receipt.counts.ignoredSystemCache} ignored system cache.`);

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredArg(name) {
  const value = getArg(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
