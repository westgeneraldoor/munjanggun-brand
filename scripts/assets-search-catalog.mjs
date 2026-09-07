#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyContentAuthority, assertCatalogContentUsable, sha256 } from './lib/asset-content-quality.mjs';

export async function runAssetSearchCatalog(argv, {
  emit = console.log, qualityOptions = {}, verifyContentQuality = assertCatalogContentUsable,
} = {}) {
  const catalogPath = resolve(requiredArg(argv, '--catalog'));
  const query = requiredArg(argv, '--query').trim();
  const limit = Number(getArg(argv, '--limit') ?? 20);
  const mediaType = getArg(argv, '--media-type');
  const product = getArg(argv, '--product');
  const catalogBytes = await readFile(catalogPath);
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const authority = await verifyContentQuality({ intakeId: catalog.intakeId, catalogSha256: sha256(catalogBytes) }, qualityOptions);
  const searchableCatalog = authority?.overlay ? applyContentAuthority(catalog, authority) : catalog;
  const results = searchCatalogEntries(searchableCatalog, { query, limit, mediaType, product });
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
    .filter((entry) => sensitiveQueryTopics(terms).every((topic) => entry.claimEvidence?.some((item) => item.topic === topic)))
    .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.sha256.localeCompare(right.entry.sha256))
    .map(({ entry, score }) => ({
      score,
      contentId: entry.contentId,
      sha256: entry.sha256,
      mediaType: entry.mediaType,
      semanticSummary: entry.semanticSummary,
      assetType: entry.assetType,
      useCases: entry.useCases ?? [],
      searchTags: entry.searchTags ?? { productTypes: [], scenes: [], colors: [], designs: [], topics: [] },
      visibleText: entry.visibleText ?? [],
      unverifiedOcrText: entry.ocrText,
      claimEvidence: entry.claimEvidence ?? [],
      contentDecisionHash: entry.contentDecisionHash,
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
    [entry.assetType, 6],
    [(entry.useCases ?? []).join(' '), 5],
    [Object.values(entry.searchTags ?? {}).flat().join(' '), 7],
    [(entry.visibleText ?? []).join(' '), 5],
    [entry.semanticGroupId, 4],
    [entry.visualGroupId, 2],
    [(entry.claimSignals ?? []).join(' '), 3],
    [(entry.privacySignals ?? []).join(' '), 2],
    [(entry.rightsSignals ?? []).join(' '), 1],
  ];
  return terms.reduce((total, term) => total + weighted.reduce((sum, [value, weight]) => {
    const haystack = String(value ?? '').toLocaleLowerCase('ko');
    return sum + (matchesSearchTerm(haystack, term) ? weight : 0);
  }, 0), 0);
}

function matchesSearchTerm(haystack, term) {
  if (/^[a-z0-9]{1,3}$/iu.test(term)) {
    return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(term)}(?:$|[^a-z0-9])`, 'iu').test(haystack);
  }
  if (/^a\s*\/\s*s$/iu.test(term)) return /(?:^|[^a-z])a\s*\/\s*s(?:$|[^a-z])/iu.test(haystack);
  return haystack.includes(term);
}

function sensitiveQueryTopics(terms) {
  const topics = new Set();
  for (const term of terms) {
    if (/^(?:as|a\s*\/\s*s|에이에스|보증)$/iu.test(term)) topics.add('after_sales_service');
    if (/^(?:price|pricing|가격|금액|할인)$/iu.test(term)) topics.add('price');
    if (/^(?:event|promotion|이벤트|행사|프로모션)$/iu.test(term)) topics.add('event');
  }
  return [...topics];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
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
