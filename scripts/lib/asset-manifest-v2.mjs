import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { assertSafeRelativePath } from './asset-paths.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './schema-validation.mjs';

const schemaPath = fileURLToPath(new URL('../../schemas/product-detail-asset-manifest.v2.schema.json', import.meta.url));

export async function readAndValidateManifestV2(manifestPath) {
  const [manifestText, schemaText] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(schemaPath, 'utf8'),
  ]);
  const manifest = JSON.parse(stripBom(manifestText));
  const findings = validateManifestV2(manifest, JSON.parse(stripBom(schemaText)));
  return { manifest, findings };
}

export function validateManifestV2(manifest, schema) {
  const schemaResult = validateAgainstSchema(manifest, schema);
  const findings = formatSchemaErrors(schemaResult.errors).map((message) => error(message));
  if (!schemaResult.valid || !Array.isArray(manifest.assets)) return findings;

  if (manifest.assetCount !== manifest.assets.length) {
    findings.push(error(`assetCount ${manifest.assetCount} does not match assets length ${manifest.assets.length}`));
  }

  compareCountList(findings, 'roleCounts', manifest.roleCounts, countBy(manifest.assets, 'folderRole'));
  compareCountList(findings, 'claimRiskCounts', manifest.claimRiskCounts, countBy(manifest.assets, 'claimRisk'));
  compareCountList(findings, 'rightsStatusCounts', manifest.rightsStatusCounts, countBy(manifest.assets, 'rightsStatus'));
  compareCountList(findings, 'publishStatusCounts', manifest.publishStatusCounts, countBy(manifest.assets, 'publishStatus'));

  const seenAssetIds = new Set();
  const seenSourcePaths = new Set();
  const seenLogicalPaths = new Set();
  const seenOrders = new Set();
  for (const [index, asset] of manifest.assets.entries()) {
    const label = `assets[${index}]`;
    unique(findings, seenAssetIds, asset.assetInstanceId, label, 'assetInstanceId');
    unique(findings, seenSourcePaths, `${asset.sourceId}\0${asset.sourceRelativePath}`, label, 'sourceId/sourceRelativePath');
    unique(findings, seenLogicalPaths, asset.logicalPath, label, 'logicalPath');
    unique(findings, seenOrders, `${asset.sourceId}\0${asset.sourceOrder}`, label, 'sourceOrder');

    for (const [field, value] of [['sourceRelativePath', asset.sourceRelativePath], ['logicalPath', asset.logicalPath], ['objectRef', asset.objectRef]]) {
      try {
        assertSafeRelativePath(value, `${label}.${field}`);
      } catch (pathError) {
        findings.push(error(pathError.message));
      }
    }
    if (asset.publicObjectRef !== null) {
      try {
        assertSafeRelativePath(asset.publicObjectRef, `${label}.publicObjectRef`);
      } catch (pathError) {
        findings.push(error(pathError.message));
      }
    }

    if (asset.objectId !== `sha256:${asset.sha256}`) findings.push(error(`${label}.objectId does not match sha256`));
    if (asset.binaryGroupId !== `sha256:${asset.sha256}`) findings.push(error(`${label}.binaryGroupId does not match sha256`));
    if (!asset.comparisonMethod.includes('sha256_exact')) findings.push(error(`${label}.comparisonMethod must include sha256_exact`));
    if (asset.rightsStatus === 'verified' && asset.rightsEvidenceRef.length === 0) {
      findings.push(error(`${label}.rightsStatus verified requires rightsEvidenceRef`));
    }
    if (asset.rightsStatus !== 'verified' && ['eligible', 'published'].includes(asset.publishStatus)) {
      findings.push(error(`${label}.publishStatus cannot be ${asset.publishStatus} while rightsStatus is ${asset.rightsStatus}`));
    }
    if (asset.humanReviewStatus !== 'reviewed' && ['eligible', 'published'].includes(asset.publishStatus)) {
      findings.push(error(`${label}.publishStatus cannot be ${asset.publishStatus} before human review`));
    }
    if (['medium', 'high'].includes(asset.claimRisk)
      && !['verified', 'not_applicable'].includes(asset.claimReviewStatus)
      && ['eligible', 'published'].includes(asset.publishStatus)) {
      findings.push(error(`${label}.claim review blocks publishStatus ${asset.publishStatus}`));
    }
    if (asset.publicRepoEligibility === 'eligible'
      && (asset.rightsStatus !== 'verified' || asset.privacyStatus !== 'cleared' || asset.humanReviewStatus !== 'reviewed')) {
      findings.push(error(`${label}.publicRepoEligibility eligible requires verified rights, cleared privacy, and human review`));
    }
    if (asset.publicSyncStatus === 'synced'
      && (asset.publicRepoEligibility !== 'eligible' || !asset.publicObjectRef)) {
      findings.push(error(`${label}.publicSyncStatus synced requires eligible publicObjectRef`));
    }
  }

  return findings;
}

export function buildCountList(rows, field) {
  return Object.entries(countBy(rows, field))
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([key, count]) => ({ key, count }));
}

function compareCountList(findings, fieldName, declared, actual) {
  const declaredMap = new Map();
  for (const item of declared) {
    if (declaredMap.has(item.key)) findings.push(error(`${fieldName} has duplicate key ${item.key}`));
    declaredMap.set(item.key, item.count);
  }
  const keys = new Set([...declaredMap.keys(), ...Object.keys(actual)]);
  for (const key of keys) {
    if ((declaredMap.get(key) ?? 0) !== (actual[key] ?? 0)) {
      findings.push(error(`${fieldName}.${key} mismatch: manifest ${declaredMap.get(key) ?? 0}, actual ${actual[key] ?? 0}`));
    }
  }
}

function countBy(rows, field) {
  const counts = {};
  for (const row of rows) {
    const key = row[field];
    if (key === undefined || key === null || key === '') continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function unique(findings, seen, value, label, field) {
  if (seen.has(value)) findings.push(error(`${label} duplicates ${field}`));
  seen.add(value);
}

function error(message) {
  return { severity: 'error', message };
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
