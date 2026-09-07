#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFiles } from './lib/brand-validation-core.mjs';
import { sha256File } from './lib/asset-inventory.mjs';
import { loadIntakeProfile } from './lib/asset-intake-profile.mjs';
import { validateIntakeAuditContract } from './lib/asset-intake-audit-contract.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const profilePath = resolve(requiredArg('--profile'));
const contractPath = resolve(requiredArg('--contract'));
const candidateRoot = resolve(requiredArg('--candidate-root'));
const [contract, receipt, catalog, combinedInventory, similarityMap, urlReview, contractSchema] = await Promise.all([
  readJson(contractPath), readJson(resolve(requiredArg('--receipt'))), readJson(resolve(requiredArg('--catalog'))),
  readJson(resolve(requiredArg('--combined-inventory'))), readJson(resolve(requiredArg('--similarity-map'))), readJson(resolve(requiredArg('--url-review'))),
  readJson(fileURLToPath(new URL('../schemas/asset-intake-audit-contract.schema.json', import.meta.url))),
]);
const schemaResult = validateAgainstSchema(contract, contractSchema);
if (!schemaResult.valid) throw new Error(`Audit contract schema failed:\n${formatSchemaErrors(schemaResult.errors).join('\n')}`);
if (resolve(dirname(contractPath), contract.profileRef) !== profilePath) {
  throw new Error('Audit contract profileRef does not resolve to --profile');
}
const { profile } = await loadIntakeProfile(profilePath, contract.intakeId);
const manifestPaths = await findFiles(resolve(candidateRoot, 'manifests'), (path) => path.endsWith('asset-manifest.json'));
const manifests = await Promise.all(manifestPaths.sort().map(readJson));
const result = validateIntakeAuditContract({
  contract, profileSha256: await sha256File(profilePath), profile, receipt, manifests, manifestPaths: manifestPaths.sort(), catalog, combinedInventory, similarityMap, urlReview,
});
if (!result.passed) throw new Error(`Intake audit contract failed:\n${result.errors.join('\n')}`);
console.log(JSON.stringify({ result: 'passed', intakeId: contract.intakeId, observed: result.observed }, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function requiredArg(name) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}`);
  return value;
}
