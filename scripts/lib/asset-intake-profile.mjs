import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { formatSchemaErrors, validateAgainstSchema } from './schema-validation.mjs';

export async function loadIntakeProfile(profilePath, expectedIntakeId) {
  const [profile, schema] = await Promise.all([
    readJson(profilePath),
    readJson(fileURLToPath(new URL('../../schemas/asset-intake-profile.schema.json', import.meta.url))),
  ]);
  const result = validateAgainstSchema(profile, schema);
  if (!result.valid) throw new Error(`Intake profile schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`);
  if (expectedIntakeId && profile.intakeId !== expectedIntakeId) {
    throw new Error(`Intake profile ${profile.intakeId} does not match ${expectedIntakeId}`);
  }
  const intakeDate = profile.intakeId.slice('INTAKE-'.length, 'INTAKE-'.length + 8);
  if (profile.sourceDate.replaceAll('-', '') !== intakeDate) throw new Error('Intake profile sourceDate does not match intakeId date');
  for (const product of profile.products) {
    if (!product.sourceId.includes(profile.sourceDate)) throw new Error(`Intake profile sourceId does not contain sourceDate: ${product.sourceId}`);
  }
  for (const key of ['folder', 'productId', 'slug', 'sourceId']) assertUnique(profile.products, key);
  const labeledReports = [
    ...profile.review.catalogReports,
    profile.review.catalogAuditReport,
    ...profile.review.similarityReports,
  ];
  assertUnique(labeledReports, 'id');
  const sealReportPaths = [
    ...labeledReports.map((entry) => entry.file),
    ...profile.review.additionalReports,
  ];
  assertUnique(sealReportPaths.map((file) => ({ file })), 'file');
  assertUnique(profile.review.supportingCollections, 'kind');
  assertUnique(profile.review.supportingCollections, 'sourceDir');
  const productByFolder = new Map(profile.products.map((product) => [product.folder, Object.freeze({ ...product })]));
  return { profile: Object.freeze(profile), productByFolder, sealReportPaths: Object.freeze(sealReportPaths) };
}

function assertUnique(entries, key) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry[key])) throw new Error(`Duplicate intake profile ${key}: ${entry[key]}`);
    seen.add(entry[key]);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
