#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const observationsPath = resolve(requiredArg('--observations'));
const receiptPath = resolve(requiredArg('--receipt'));
const outputPath = resolve(requiredArg('--output'));
const observations = await readJson(observationsPath);
const receipt = await readJson(receiptPath);
const schema = await readJson(fileURLToPath(new URL('../schemas/asset-url-review.schema.json', import.meta.url)));

if (observations.intakeId !== receipt.intakeId) throw new Error('Observation intakeId does not match receipt');
const receiptUrls = receipt.entries.filter((entry) => entry.disposition === 'managed' && entry.kind === 'url');
const expectedPaths = [...new Set(receiptUrls.map((entry) => entry.sourceRelativePath))].sort();
const actualPaths = [...new Set(observations.entries.map((entry) => entry.sourceRelativePath))].sort();
if (actualPaths.length !== observations.entries.length) throw new Error('Duplicate sourceRelativePath in URL observations');
if (JSON.stringify(expectedPaths) !== JSON.stringify(actualPaths)) throw new Error('URL observations do not exactly cover receipt URL paths');

const output = {
  schema: 'munjanggun.assetUrlReview.v1',
  version: '1.0',
  intakeId: observations.intakeId,
  checkedAt: observations.checkedAt,
  method: observations.method,
  recordCount: observations.entries.length,
  entries: observations.entries.map((entry) => ({
    sourceRelativePath: entry.sourceRelativePath,
    url: entry.url,
    productId: String(entry.productId),
    accessStatus: entry.accessStatus,
    observedTitle: entry.observedTitle,
    productConnectionStatus: entry.productConnectionStatus,
    claimReviewStatus: entry.claimReviewStatus ?? 'not_reviewed',
    notes: entry.notes ?? '접근 및 상품 연결만 확인. 가격·혜택·상세 claim은 승인하지 않음.',
  })),
};
const result = validateAgainstSchema(output, schema);
if (!result.valid) throw new Error(`URL review schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`URL review recorded: ${output.recordCount} records.`);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredArg(name) {
  const value = getArg(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
