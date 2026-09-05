#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const catalogPath = resolve(requiredArg('--catalog'));
const query = requiredArg('--query').trim();
const limit = Number(getArg('--limit') ?? 20);
const mediaType = getArg('--media-type');
const product = getArg('--product');
if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('--limit must be an integer from 1 to 500');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const terms = query.toLocaleLowerCase('ko').split(/\s+/u).filter(Boolean);

const results = catalog.entries
  .filter((entry) => !mediaType || entry.mediaType === mediaType)
  .filter((entry) => !product || entry.sourceRefs.some((ref) => ref.sourceRelativePath.includes(product)))
  .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
  .filter((result) => result.score > 0)
  .sort((left, right) => right.score - left.score || left.entry.sha256.localeCompare(right.entry.sha256))
  .slice(0, limit)
  .map(({ entry, score }) => ({
    score,
    contentId: entry.contentId,
    sha256: entry.sha256,
    mediaType: entry.mediaType,
    semanticSummary: entry.semanticSummary,
    ocrText: entry.ocrText,
    humanReviewStatus: entry.humanReviewStatus,
    claimSignals: entry.claimSignals,
    privacySignals: entry.privacySignals,
    rightsSignals: entry.rightsSignals,
    rightsStatus: entry.rightsStatus,
    rightsScope: entry.rightsScope,
    privacyStatus: entry.privacyStatus,
    claimReviewStatus: entry.claimReviewStatus,
    publishStatus: entry.publishStatus,
    publicRepoEligibility: entry.publicRepoEligibility,
    sourceRefs: entry.sourceRefs,
  }));

console.log(JSON.stringify({ query, resultCount: results.length, results }, null, 2));

function scoreEntry(entry, terms) {
  const weighted = [
    [entry.semanticSummary, 8],
    [entry.ocrText, 5],
    [entry.semanticGroupId, 4],
    [entry.visualGroupId, 2],
    [(entry.claimSignals ?? []).join(' '), 3],
    [(entry.privacySignals ?? []).join(' '), 2],
    [(entry.rightsSignals ?? []).join(' '), 1],
    [(entry.sourceRefs ?? []).map((ref) => ref.sourceRelativePath).join(' '), 4],
  ];
  return terms.reduce((total, term) => total + weighted.reduce((sum, [value, weight]) => {
    const haystack = String(value ?? '').toLocaleLowerCase('ko');
    return sum + (haystack.includes(term) ? weight : 0);
  }, 0), 0);
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
