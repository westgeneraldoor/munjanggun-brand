#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256File } from './lib/asset-inventory.mjs';
import { validateOwnerApprovalInputAgainstCatalog } from './lib/asset-owner-approval-input.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const catalogPath = resolve(requiredArg('--catalog'));
const inputPath = resolve(requiredArg('--input'));
const [catalog, input, schema] = await Promise.all([
  readJson(catalogPath),
  readJson(inputPath),
  readJson(fileURLToPath(new URL('../schemas/asset-owner-approval-input.schema.json', import.meta.url))),
]);
const schemaResult = validateAgainstSchema(input, schema);
if (!schemaResult.valid) throw new Error(`Owner approval input schema failed:\n${formatSchemaErrors(schemaResult.errors).join('\n')}`);
const errors = validateOwnerApprovalInputAgainstCatalog(input, catalog, await sha256File(catalogPath));
if (errors.length > 0) throw new Error(`Owner approval input validation failed:\n${errors.join('\n')}`);

console.log(JSON.stringify({
  result: 'passed',
  intakeId: input.intakeId,
  requiredTotals: input.requiredTotals,
  sourceGroupCount: input.sourceGroups.length,
  globalStatuses: Object.fromEntries(Object.entries(input.rightsAxes).map(([axis, decision]) => [axis, decision.status])),
  groupResponseCount: input.groupReviewResponses.length,
  assetExceptionCount: input.assetExceptions.length,
  releaseAuthority: false,
  authorityPolicy: input.authorityPolicy,
}, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function requiredArg(name) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}`);
  return value;
}
