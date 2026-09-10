#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function validateAssetEvidenceReviewPackage({ reportPath } = {}) {
  const reportFile = requireAbsolute(reportPath, 'Package report');
  const reportBytes = await readFile(reportFile);
  const report = JSON.parse(reportBytes.toString('utf8'));
  if (report?.schema !== 'munjanggun.assetEvidenceReviewPackage.v1' || report?.version !== '1.0'
    || report?.status !== 'non_authority_review_package' || !report.files || !report.coverage) {
    throw new Error('Evidence review package contract is invalid');
  }
  const root = dirname(reportFile);
  const files = {};
  for (const [name, spec] of Object.entries(report.files)) {
    const path = requireAbsolute(spec.path, `Package ${name}`);
    if (dirname(path) !== root) throw new Error(`Package ${name} escapes the package root`);
    const bytes = await readFile(path);
    if (digest(bytes) !== spec.sha256) throw new Error(`Package ${name} SHA-256 mismatch`);
    files[name] = { path, bytes };
  }
  const entriesDoc = JSON.parse(files.entries.bytes.toString('utf8'));
  const queueDoc = JSON.parse(files.queue.bytes.toString('utf8'));
  if (!Array.isArray(entriesDoc.entries) || !Array.isArray(queueDoc.queue)) throw new Error('Package entries or queue is missing');
  const entries = entriesDoc.entries;
  const queue = queueDoc.queue;
  const unique = new Set(entries.map((entry) => entry.sourceObjectSha256));
  if (unique.size !== entries.length || entries.some((entry) => !/^[a-f0-9]{64}$/u.test(entry.sourceObjectSha256 ?? ''))) {
    throw new Error('Package entries contain invalid or duplicate SHA-256 values');
  }
  for (const entry of entries) assertPackageEntryPixelGate(entry);
  const expectedQueue = entries.filter((entry) => entry.textReviewQueue.length || entry.sourceUncertainties.length || entry.claimSignals.length || entry.privacySignals.length);
  const queueSet = new Set(queue.map((entry) => entry.sourceObjectSha256));
  if (queueSet.size !== queue.length || expectedQueue.length !== queue.length || expectedQueue.some((entry) => !queueSet.has(entry.sourceObjectSha256))) {
    throw new Error('Package direct-review queue coverage mismatch');
  }
  const actual = {
    uniqueAssetCount: entries.length,
    staticAssetCount: entries.filter((entry) => entry.mediaKind === 'static').length,
    gifAssetCount: entries.filter((entry) => entry.mediaKind === 'gif').length,
    machinePixelReadyCount: entries.filter((entry) => entry.gates.pixelRegions === 'machine_ready_non_authority').length,
    directPixelReviewAssetCount: entries.filter((entry) => entry.gates.pixelRegions === 'direct_review_required').length,
    queuedAssetCount: queue.length,
    queuedTextItemCount: queue.reduce((total, entry) => total + entry.textReviewQueue.length, 0),
    claimAssetCount: entries.filter((entry) => entry.claimSignals.length).length,
    privacyAssetCount: entries.filter((entry) => entry.privacySignals.length).length,
    promotionEligibleCount: entries.filter((entry) => entry.promotionEligible === true).length,
  };
  if (JSON.stringify(actual) !== JSON.stringify(report.coverage)) throw new Error('Package reported coverage does not match its entries');
  if (actual.promotionEligibleCount !== 0 || entries.some((entry) => entry.promotionEligible !== false)) {
    throw new Error('Non-authority review package must not mark assets promotion eligible');
  }
  for (const source of Object.values(report.sources ?? {})) {
    const bytes = await readFile(requireAbsolute(source.path, 'Package source'));
    if (digest(bytes) !== source.sha256) throw new Error('Package source SHA-256 mismatch');
  }
  return { result: 'passed', reportPath: reportFile, reportSha256: digest(reportBytes), ...actual };
}

export function assertPackageEntryPixelGate(entry) {
  const queue = entry?.textReviewQueue ?? [];
  const summary = entry?.pixelMatchSummary ?? {};
  const reviewStatusCount = (summary.weak ?? 0) + (summary.critical_mismatch ?? 0) + (summary.unmatched ?? 0);
  if (queue.some((item) => !['weak', 'critical_mismatch', 'unmatched'].includes(item.status))) {
    throw new Error(`Package text review queue contains a passing status: ${entry?.sourceObjectSha256 ?? 'unknown'}`);
  }
  if (queue.length !== reviewStatusCount) {
    throw new Error(`Package text review queue count mismatch: ${entry?.sourceObjectSha256 ?? 'unknown'}`);
  }
  const mustReview = entry?.textPresence === 'uncertain'
    || (entry?.textPresence === 'observed' && (entry.visibleText?.length ?? 0) === 0)
    || reviewStatusCount > 0;
  const expected = mustReview ? 'direct_review_required' : 'machine_ready_non_authority';
  if (entry?.gates?.pixelRegions !== expected) {
    throw new Error(`Package pixel gate contradicts text evidence: ${entry?.sourceObjectSha256 ?? 'unknown'}`);
  }
  if (entry?.textPresence === 'none_observed' && (entry.visibleText?.length ?? 0) !== 0) {
    throw new Error(`Package no-text entry contains visible text: ${entry?.sourceObjectSha256 ?? 'unknown'}`);
  }
}

function requireAbsolute(value, label) {
  if (!isAbsolute(value ?? '')) throw new Error(`${label} path must be absolute`);
  return resolve(value);
}
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

export async function runValidateAssetEvidenceReviewPackage(argv) {
  const args = parseStrictArgs(argv, { valueFlags: ['--report'] });
  const result = await validateAssetEvidenceReviewPackage({ reportPath: required(args, '--report') });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runValidateAssetEvidenceReviewPackage(process.argv.slice(2));
