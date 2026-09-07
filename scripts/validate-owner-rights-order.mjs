#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveContainedPath } from './lib/asset-paths.mjs';
import { validateOwnerOrderDocuments } from './lib/asset-owner-order.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const root = resolve(requiredArg('--bundle-root'));
const catalog = await readDocument('reviewed-content-catalog.json');
const attestation = await readDocument('owner-rights-attestation.json');
const mapping = await readDocument('owner-attestation-mapping.json');
const registry = await readDocument('use-evidence-registry.json');
const useEvidenceReceipt = await readDocument('use-evidence-receipt.json');
const ledger = await readDocument('owner-decisions.json');
const ownerDecisionReceipt = await readDocument('owner-decisions-receipt.json');
const rightsState = await readDocument('rights-state.json');
const registryById = uniqueMap(registry.document.entries, 'evidenceId', 'registry');
const receiptById = uniqueMap(useEvidenceReceipt.document.entries, 'evidenceId', 'receipt');
const artifacts = [];
for (const mapped of mapping.document.entries) {
  const stored = await readDocument(mapped.artifactRef);
  const registryEntry = registryById.get(mapped.evidenceId);
  const receiptEntry = receiptById.get(mapped.evidenceId);
  const info = await stat(resolveContainedPath(root, mapped.artifactRef, 'owner rights artifact'));
  if (!registryEntry || !receiptEntry || stored.sha256 !== registryEntry.artifactSha256 || stored.sha256 !== receiptEntry.sha256 || info.size !== receiptEntry.byteSize || mapped.artifactRef !== receiptEntry.relativePath) {
    throw new Error(`Owner rights artifact receipt mismatch: ${mapped.evidenceId}`);
  }
  artifacts.push({ evidenceId: mapped.evidenceId, relativePath: mapped.artifactRef, document: stored.document, text: stored.text, byteSize: info.size, sha256: stored.sha256 });
}
const documents = { catalog, attestation, mapping, artifacts, registry, useEvidenceReceipt, ledger, ownerDecisionReceipt, rightsState };
const errors = validateOwnerOrderDocuments(documents);
if (mapping.document.catalogSha256 !== catalog.sha256) errors.push('stored mapping catalog SHA mismatch');
if (mapping.document.ownerAttestationSha256 !== attestation.sha256) errors.push('stored mapping attestation SHA mismatch');
if (useEvidenceReceipt.document.registrySha256 !== registry.sha256) errors.push('stored receipt registry SHA mismatch');
if (useEvidenceReceipt.document.treeHash !== treeHash(useEvidenceReceipt.document.entries)) errors.push('stored receipt treeHash mismatch');
if (ledger.document.catalogSha256 !== catalog.sha256 || ledger.document.useEvidenceReceiptSha256 !== useEvidenceReceipt.sha256) errors.push('stored ledger authority SHA mismatch');
if (ownerDecisionReceipt.document.ledgerSha256 !== ledger.sha256 || ownerDecisionReceipt.document.catalogSha256 !== catalog.sha256 || ownerDecisionReceipt.document.useEvidenceReceiptSha256 !== useEvidenceReceipt.sha256) errors.push('stored owner receipt SHA mismatch');
for (const [name, stored] of [['ownerAttestation', attestation], ['workerMapping', mapping], ['ownerDecisionLedger', ledger]]) {
  if (rightsState.document[name].sha256 !== stored.sha256) errors.push(`stored rights state ${name} SHA mismatch`);
}
await validateSchemas(documents);
if (errors.length > 0) throw new Error(`Owner rights bundle validation failed:\n${errors.join('\n')}`);
console.log(JSON.stringify({
  result: 'passed_recorded_unsigned', bundleRoot: root, assets: mapping.document.assetCount, sourcePaths: mapping.document.sourcePathCount,
  signatures: { ownerAttestation: null, useEvidenceReceipt: null, ownerDecisionReceipt: null },
  effectiveAccess: rightsState.document.effectiveAccess, remainingGates: rightsState.document.remainingGates,
}, null, 2));

async function validateSchemas(value) {
  const cases = [
    ['asset-content-catalog.schema.json', value.catalog.document, 'catalog'],
    ['asset-owner-attestation.schema.json', value.attestation.document, 'attestation'],
    ['asset-owner-attestation-mapping.schema.json', value.mapping.document, 'mapping'],
    ['asset-use-evidence-registry.schema.json', value.registry.document, 'registry'],
    ['asset-use-evidence-receipt.schema.json', value.useEvidenceReceipt.document, 'use evidence receipt'],
    ['asset-owner-decisions.schema.json', value.ledger.document, 'owner decisions'],
    ['asset-owner-decision-receipt.schema.json', value.ownerDecisionReceipt.document, 'owner decision receipt'],
    ['asset-rights-state.schema.json', value.rightsState.document, 'rights state'],
  ];
  for (const [schemaName, document, label] of cases) {
    const schema = JSON.parse(await readFile(fileURLToPath(new URL(`../schemas/${schemaName}`, import.meta.url)), 'utf8'));
    assertSchema(document, schema, label);
  }
  const artifactSchema = JSON.parse(await readFile(fileURLToPath(new URL('../schemas/asset-use-evidence-artifact.schema.json', import.meta.url)), 'utf8'));
  for (const artifact of value.artifacts) assertSchema(artifact.document, artifactSchema, `artifact ${artifact.evidenceId}`);
}

function assertSchema(value, schema, label) {
  const result = validateAgainstSchema(value, schema);
  if (!result.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`);
}

async function readDocument(relativePath) {
  const path = resolveContainedPath(root, relativePath, 'owner rights bundle file');
  const text = await readFile(path, 'utf8');
  return { document: JSON.parse(text), text, sha256: hash(text) };
}

function uniqueMap(entries, key, label) {
  const map = new Map();
  for (const entry of entries) {
    if (map.has(entry[key])) throw new Error(`Duplicate ${label} ${key}: ${entry[key]}`);
    map.set(entry[key], entry);
  }
  return map;
}

function treeHash(entries) {
  const digest = createHash('sha256');
  for (const entry of entries) digest.update(`${entry.evidenceId}\0${entry.relativePath}\0${entry.byteSize}\0${entry.sha256}\n`, 'utf8');
  return digest.digest('hex');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requiredArg(name) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}`);
  return value;
}
