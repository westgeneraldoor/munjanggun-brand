#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';
import { loadIntakeProfile } from './lib/asset-intake-profile.mjs';

const catalogPath = resolve(requiredArg('--catalog'));
const reviewRoot = resolve(requiredArg('--review-root'));
const { profile } = await loadIntakeProfile(resolve(requiredArg('--profile')));
const reportSpecs = profile.review.catalogReports.map((spec) => ({ ...spec, path: resolve(reviewRoot, ...spec.file.split('/')) }));
const auditSpec = profile.review.catalogAuditReport;
const auditPath = resolve(reviewRoot, ...auditSpec.file.split('/'));
const outputPath = resolve(requiredArg('--output'));

const catalog = await readJson(catalogPath);
if (profile.intakeId !== catalog.intakeId) throw new Error(`Intake profile ${profile.intakeId} does not match catalog ${catalog.intakeId}`);
const reports = await Promise.all(reportSpecs.map(async (spec) => ({ spec, report: await readJson(spec.path) })));
const audit = await readJson(auditPath);
const schema = await readJson(fileURLToPath(new URL('../schemas/asset-content-catalog.schema.json', import.meta.url)));
assertSchema(catalog, schema, 'input content catalog');

const baselineByHash = uniqueMap(catalog.entries, 'catalog');
const splitAfterAudit = new Set();
for (const group of [...(audit.visualGroupAudit?.flaggedGroups ?? []), ...(audit.visualGroupAudit?.borderlineGroups ?? [])]) {
  for (const member of group.members ?? []) splitAfterAudit.add(member.sha256);
}
const reviewByHash = new Map();
for (const { spec, report } of reports) {
  const label = spec.id;
  if (report.intakeId !== catalog.intakeId) throw new Error(`${label}: intakeId does not match catalog`);
  const entries = Array.isArray(report.entries) ? report.entries : [];
  for (const entry of entries) {
    if (reviewByHash.has(entry.sha256)) throw new Error(`${label}: duplicate review SHA ${entry.sha256}`);
    if (!baselineByHash.has(entry.sha256)) throw new Error(`${label}: unexpected review SHA ${entry.sha256}`);
    const baselineMediaType = baselineByHash.get(entry.sha256).mediaType;
    if (spec.kind === 'gif' && baselineMediaType !== 'image/gif') throw new Error(`${label}: GIF report contains non-GIF SHA ${entry.sha256}`);
    if (spec.kind === 'static' && baselineMediaType === 'image/gif') throw new Error(`${label}: static report contains GIF SHA ${entry.sha256}`);
    reviewByHash.set(entry.sha256, { spec, entry });
  }
}

const missing = [...baselineByHash.keys()].filter((sha256) => !reviewByHash.has(sha256));
if (missing.length > 0) throw new Error(`Missing review coverage for ${missing.length} SHA(s): ${missing.slice(0, 5).join(', ')}`);
if (reviewByHash.size !== catalog.binaryGroupCount) {
  throw new Error(`Review coverage ${reviewByHash.size} does not match catalog binaryGroupCount ${catalog.binaryGroupCount}`);
}

const reviewedAt = new Date().toISOString();
for (const sha256 of splitAfterAudit) {
  if (!baselineByHash.has(sha256)) throw new Error(`Audit requests split for unknown SHA ${sha256}`);
}
const entries = catalog.entries.map((baseline) => mergeEntry(baseline, reviewByHash.get(baseline.sha256), splitAfterAudit, auditSpec));
const gifEntries = entries.filter((entry) => entry.mediaType === 'image/gif');
const output = {
  ...catalog,
  reviewedAt,
  reviewSummary: {
    reviewedBinaryGroups: entries.filter((entry) => entry.humanReviewStatus === 'reviewed').length,
    needsEscalation: entries.filter((entry) => entry.humanReviewStatus === 'needs_escalation').length,
    sourcePathLinks: sum(entries, (entry) => entry.sourcePathCount),
    uniqueGifFrames: sum(gifEntries, (entry) => entry.gifMetadata.frameCount),
    uniqueGifDurationMs: sum(gifEntries, (entry) => entry.gifMetadata.durationMs),
    linkedGifFrames: sum(gifEntries, (entry) => entry.gifMetadata.frameCount * entry.sourcePathCount),
    linkedGifDurationMs: sum(gifEntries, (entry) => entry.gifMetadata.durationMs * entry.sourcePathCount),
  },
  entries,
};
assertCatalogInvariants(output);
assertSchema(output, schema, 'reviewed content catalog');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`Review merge passed: ${output.binaryGroupCount} binary groups / ${output.reviewSummary.sourcePathLinks} source paths.`);
console.log(`Human review: ${output.reviewSummary.reviewedBinaryGroups} reviewed / ${output.reviewSummary.needsEscalation} needs escalation.`);
console.log(`GIF unique: ${output.reviewSummary.uniqueGifFrames} frames / ${output.reviewSummary.uniqueGifDurationMs}ms.`);
console.log(`GIF linked paths: ${output.reviewSummary.linkedGifFrames} frames / ${output.reviewSummary.linkedGifDurationMs}ms.`);

function mergeEntry(baseline, review, splitHashes, configuredAudit) {
  const { spec, entry } = review;
  const label = spec.id;
  assertIdentity(baseline, entry, label);
  const semanticGroupId = textOrNull(entry.visualGroupCandidate);
  if (!semanticGroupId) throw new Error(`${label}: unresolved visual group for ${baseline.sha256}`);
  const splitAfterAudit = splitHashes.has(baseline.sha256);
  const visualGroupId = splitAfterAudit ? `${semanticGroupId}::sha256-${baseline.sha256.slice(0, 16)}` : semanticGroupId;

  const visibleText = Array.isArray(entry.visibleText) ? entry.visibleText.join('; ') : String(entry.ocrText ?? entry.visibleText ?? '');
  const humanReviewStatus = normalizeHumanStatus(spec.kind, label, entry.humanReviewStatus);
  const comparisonMethod = ['sha256_exact'];
  comparisonMethod.push(...spec.comparisonMethods);
  if (visibleText.trim()) comparisonMethod.push('ocr');
  comparisonMethod.push('human_visual_review');

  const merged = {
    ...baseline,
    visualGroupId,
    semanticGroupId,
    visualGroupDecision: splitAfterAudit ? 'split_after_audit' : 'accepted_candidate',
    comparisonMethod,
    humanReviewStatus,
    semanticSummary: String(entry.semanticSummary ?? entry.sceneSummary ?? '').trim(),
    ocrText: visibleText.trim(),
    gifReviewStatus: spec.kind === 'gif' ? 'reviewed' : 'not_applicable',
    claimSignals: uniqueStrings(entry.claimSignals),
    privacySignals: uniqueStrings(entry.privacySignals),
    rightsSignals: uniqueStrings([...(entry.rightsSignals ?? []), 'source_rights_unverified']),
    reviewEvidenceRefs: [`${spec.file}#sha256=${baseline.sha256}`, configuredAudit.file],
    reviewNotes: [String(entry.reviewNotes ?? ''), splitAfterAudit ? '독립 감사에서 엄격한 시각 유사군을 개별 그룹으로 분리함' : ''].filter(Boolean).join('; '),
    gifMetadata: spec.kind === 'gif' ? {
      frameCount: positiveInteger(entry.frameCount, `${label}.frameCount`, baseline.sha256),
      durationMs: nonnegativeInteger(entry.durationMs, `${label}.durationMs`, baseline.sha256),
      loopCount: nonnegativeInteger(entry.loopCount, `${label}.loopCount`, baseline.sha256),
      loopBehavior: String(entry.loopBehavior ?? '').trim(),
    } : null,
  };
  if (!merged.semanticSummary) throw new Error(`${label}: empty semantic summary for ${baseline.sha256}`);
  if (spec.kind === 'gif' && !merged.gifMetadata.loopBehavior) throw new Error(`${label}: missing loop behavior for ${baseline.sha256}`);
  return merged;
}

function assertIdentity(baseline, entry, label) {
  for (const field of ['binaryGroupId', 'contentId', 'mediaType']) {
    if (entry[field] !== undefined && entry[field] !== baseline[field]) {
      throw new Error(`${label}: ${field} mismatch for ${baseline.sha256}`);
    }
  }
  if (entry.sourcePathCount !== undefined && Number(entry.sourcePathCount) !== baseline.sourcePathCount) {
    throw new Error(`${label}: sourcePathCount mismatch for ${baseline.sha256}`);
  }
  if (entry.sourceRefs !== undefined) {
    const expected = normalizeRefs(baseline.sourceRefs);
    const actual = normalizeRefs(entry.sourceRefs);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`${label}: sourceRefs mismatch for ${baseline.sha256}`);
  }
}

function assertCatalogInvariants(value) {
  if (value.entries.length !== value.binaryGroupCount) throw new Error('Catalog entry count does not match binaryGroupCount');
  uniqueMap(value.entries, 'reviewed catalog');
  if (value.entries.some((entry) => !entry.visualGroupId)) throw new Error('Reviewed catalog contains unresolved visual groups');
  if (value.entries.some((entry) => !['reviewed', 'needs_escalation'].includes(entry.humanReviewStatus))) {
    throw new Error('Reviewed catalog contains unfinished human review status');
  }
  if (value.entries.some((entry) => !entry.rightsSignals.includes('source_rights_unverified'))) {
    throw new Error('Fail-closed rights signal is missing');
  }
}

function uniqueMap(entries, label) {
  const result = new Map();
  for (const entry of entries) {
    if (!/^[a-f0-9]{64}$/.test(entry.sha256 ?? '')) throw new Error(`${label}: invalid SHA ${entry.sha256}`);
    if (result.has(entry.sha256)) throw new Error(`${label}: duplicate SHA ${entry.sha256}`);
    result.set(entry.sha256, entry);
  }
  return result;
}

function normalizeHumanStatus(kind, label, value) {
  if (value === 'reviewed' || value === 'needs_escalation') return value;
  if (kind === 'gif' && value === 'reviewed_full_loop_storyboard') return 'reviewed';
  throw new Error(`${label}: unfinished or unknown humanReviewStatus ${value}`);
}

function normalizeRefs(refs) {
  return refs.map((entry) => `${entry.sourceId}\0${entry.sourceRelativePath}`).sort();
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].sort();
}

function positiveInteger(value, field, sha256) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${field} invalid for ${sha256}`);
  return number;
}

function nonnegativeInteger(value, field, sha256) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${field} invalid for ${sha256}`);
  return number;
}

function sum(entries, getValue) {
  return entries.reduce((total, entry) => total + getValue(entry), 0);
}

function assertSchema(value, schema, label) {
  const result = validateAgainstSchema(value, schema);
  if (!result.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`);
}

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
