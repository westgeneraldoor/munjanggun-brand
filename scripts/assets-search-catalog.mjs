#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function runAssetSearchCatalog(argv, { emit = console.log } = {}) {
  const catalogPath = resolve(requiredArg(argv, '--catalog'));
  const query = requiredArg(argv, '--query').trim();
  const limit = Number(getArg(argv, '--limit') ?? 20);
  const mediaType = getArg(argv, '--media-type');
  const product = getArg(argv, '--product');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const results = searchCatalogEntries(catalog, { query, limit, mediaType, product });
  const output = { query, resultCount: results.length, results };
  emit(JSON.stringify(output, null, 2));
  return output;
}

export function searchCatalogEntries(catalog, { query, limit = 20, mediaType, product } = {}) {
  const normalizedQuery = String(query ?? '').trim();
  if (!normalizedQuery) throw new Error('Search query must not be empty');
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('--limit must be an integer from 1 to 500');
  if (!Array.isArray(catalog?.entries)) throw new Error('Catalog entries must be an array');
  return rankCatalogEntries(catalog, { query: normalizedQuery, mediaType, product }).slice(0, limit);
}

export function rankCatalogEntries(catalog, { query, mediaType, product } = {}) {
  const normalizedQuery = String(query ?? '').trim();
  if (!normalizedQuery) throw new Error('Search query must not be empty');
  if (!Array.isArray(catalog?.entries)) throw new Error('Catalog entries must be an array');
  const terms = normalizedQuery.toLocaleLowerCase('ko').split(/\s+/u).filter(Boolean);
  const productNeedle = normalizeSearchText(product);

  return catalog.entries
    .filter((entry) => !mediaType || entry.mediaType === mediaType)
    .filter((entry) => !productNeedle || normalizeSearchText(
      entry.sourceRefs?.map((ref) => ref.sourceRelativePath).join(' '),
    ).includes(productNeedle))
    .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.sha256.localeCompare(right.entry.sha256))
    .map(({ entry, score }) => ({
      score,
      contentId: entry.contentId,
      sha256: entry.sha256,
      mediaType: entry.mediaType,
      semanticSummary: entry.semanticSummary,
      ocrText: entry.ocrText,
      semanticGroupId: entry.semanticGroupId ?? null,
      visualGroupId: entry.visualGroupId ?? null,
      humanReviewStatus: entry.humanReviewStatus,
      claimSignals: entry.claimSignals,
      privacySignals: entry.privacySignals,
      rightsSignals: entry.rightsSignals,
      rightsStatus: entry.rightsStatus,
      rightsScope: entry.rightsScope,
      rightsEvidenceRef: entry.rightsEvidenceRef,
      privacyStatus: entry.privacyStatus,
      claimReviewStatus: entry.claimReviewStatus,
      claimEvidenceRef: entry.claimEvidenceRef,
      publishStatus: entry.publishStatus,
      publicRepoEligibility: entry.publicRepoEligibility,
      reviewEvidenceRefs: entry.reviewEvidenceRefs ?? [],
      sourceRefs: entry.sourceRefs,
    }));
}

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

function normalizeSearchText(value) {
  return String(value ?? '').toLocaleLowerCase('ko').replace(/[\s_-]+/gu, '');
}

function getArg(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

function requiredArg(argv, name) {
  const value = getArg(argv, name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runAssetSearchCatalog(process.argv.slice(2));
}
