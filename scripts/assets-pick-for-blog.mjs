#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchCatalogEntries } from './assets-search-catalog.mjs';
import { assertCatalogContentUsable, sha256 } from './lib/asset-content-quality.mjs';
import { one, parseStrictArgs, required } from './lib/strict-cli-args.mjs';

const DIMENSION_FIELDS = Object.freeze({
  query: ['semanticSummary', 'ocrText', 'semanticGroupId', 'visualGroupId', 'claimSignals', 'sourceRefs'],
  product: ['sourceRefs', 'semanticSummary'],
  installationScene: ['semanticSummary', 'ocrText', 'sourceRefs'],
  color: ['semanticSummary', 'ocrText', 'sourceRefs'],
  design: ['semanticSummary', 'ocrText', 'semanticGroupId', 'sourceRefs'],
  consultationTopic: ['semanticSummary', 'ocrText', 'claimSignals', 'sourceRefs'],
});

export async function runBlogAssetPicker(argv, {
  emit = console.log, qualityOptions = {}, verifyContentQuality = assertCatalogContentUsable,
} = {}) {
  const args = parseStrictArgs(argv, {
    valueFlags: [
      '--catalog', '--query', '--product', '--installation-scene', '--color', '--design',
      '--consultation-topic', '--media-type', '--limit', '--select-content-id',
    ],
  });
  const catalogPath = resolve(required(args, '--catalog'));
  const criteria = compactObject({
    query: one(args, '--query'),
    product: one(args, '--product'),
    installationScene: one(args, '--installation-scene'),
    color: one(args, '--color'),
    design: one(args, '--design'),
    consultationTopic: one(args, '--consultation-topic'),
  });
  if (Object.keys(criteria).length === 0) {
    throw new Error('Provide at least one search criterion: --query, --product, --installation-scene, --color, --design, or --consultation-topic');
  }
  const limit = Number(one(args, '--limit') ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('--limit must be an integer from 1 to 100');
  const catalogBytes = await readFile(catalogPath);
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  await verifyContentQuality({ intakeId: catalog.intakeId, catalogSha256: sha256(catalogBytes) }, qualityOptions);
  const query = Object.values(criteria).join(' ');
  const searched = searchCatalogEntries(catalog, {
    query,
    limit: 500,
    mediaType: one(args, '--media-type'),
    product: criteria.product,
  });
  const candidates = searched
    .map((entry) => ({ entry, matchedDimensions: matchDimensions(entry, criteria) }))
    .filter(({ matchedDimensions }) => Object.keys(matchedDimensions).length === Object.keys(criteria).length)
    .slice(0, limit)
    .map(({ entry, matchedDimensions }, index) => summarizeCandidate(entry, matchedDimensions, index + 1));

  const selectContentId = one(args, '--select-content-id');
  const selection = selectContentId ? buildSelection(selectContentId, candidates, catalogPath) : null;
  const output = {
    workflow: 'blog_asset_candidate_selection',
    criteria,
    mediaType: one(args, '--media-type') ?? null,
    candidateCount: candidates.length,
    candidates,
    selection,
    safety: {
      searchChangesState: false,
      selectionChangesState: false,
      extractionTool: 'assets:extract-content',
      note: 'Catalog metadata is only a preview. The extraction tool independently revalidates sealed review evidence, owner approval, use evidence, rights, privacy, claims, and publication status.',
    },
  };
  emit(JSON.stringify(output, null, 2));
  return output;
}

function matchDimensions(entry, criteria) {
  const matches = {};
  for (const [dimension, criterion] of Object.entries(criteria)) {
    const fields = DIMENSION_FIELDS[dimension];
    const matchedFields = fields.filter((field) => criterionMatches(criterion, searchableValue(entry, field)));
    if (matchedFields.length > 0) matches[dimension] = matchedFields;
  }
  return matches;
}

function criterionMatches(criterion, value) {
  const haystack = normalizeSearchText(value);
  const phrase = normalizeSearchText(criterion);
  if (!phrase) return false;
  if (haystack.includes(phrase)) return true;
  return String(criterion).toLocaleLowerCase('ko').split(/\s+/u).filter(Boolean)
    .every((term) => haystack.includes(normalizeSearchText(term)));
}

function searchableValue(entry, field) {
  if (field === 'sourceRefs') return entry.sourceRefs?.map((ref) => ref.sourceRelativePath).join(' ') ?? '';
  if (Array.isArray(entry[field])) return entry[field].join(' ');
  return entry[field] ?? '';
}

function summarizeCandidate(entry, matchedDimensions, rank) {
  const blockers = catalogMetadataBlockers(entry);
  return {
    rank,
    score: entry.score,
    contentId: entry.contentId,
    sha256: entry.sha256,
    mediaType: entry.mediaType,
    semanticSummary: entry.semanticSummary,
    ocrText: entry.ocrText,
    matchedDimensions,
    sourceRefs: entry.sourceRefs,
    catalogMetadataStatus: blockers.length === 0 ? 'ready_for_guarded_extraction_request' : 'review_only',
    externalExtractionBlockers: blockers,
  };
}

function catalogMetadataBlockers(entry) {
  const blockers = [];
  if (entry.humanReviewStatus !== 'reviewed') blockers.push(`humanReviewStatus=${entry.humanReviewStatus ?? 'missing'}`);
  if (entry.rightsStatus !== 'verified') blockers.push(`rightsStatus=${entry.rightsStatus ?? 'missing'}`);
  if (!entry.rightsScope?.includes('external_reuse')) blockers.push('rightsScope.external_reuse=absent');
  if (!entry.rightsEvidenceRef?.length) blockers.push('rightsEvidenceRef=0');
  if (entry.privacyStatus !== 'cleared') blockers.push(`privacyStatus=${entry.privacyStatus ?? 'missing'}`);
  if (!['verified', 'not_applicable'].includes(entry.claimReviewStatus)) {
    blockers.push(`claimReviewStatus=${entry.claimReviewStatus ?? 'missing'}`);
  }
  if (entry.claimReviewStatus === 'not_applicable' && entry.claimSignals?.length > 0) {
    blockers.push('claimSignalsConsistency=invalid');
  }
  if ((entry.claimReviewStatus === 'verified' || entry.claimSignals?.length > 0) && !entry.claimEvidenceRef?.length) {
    blockers.push('claimEvidenceRef=0');
  }
  if (!['eligible', 'published'].includes(entry.publishStatus)) blockers.push(`publishStatus=${entry.publishStatus ?? 'missing'}`);
  if (!entry.reviewEvidenceRefs?.length) blockers.push('reviewEvidenceRefs=0');
  return blockers;
}

function buildSelection(contentId, candidates, catalogPath) {
  const candidate = candidates.find((item) => item.contentId === contentId);
  if (!candidate) throw new Error(`Selected contentId is not in the current candidate results: ${contentId}`);
  const blocked = candidate.externalExtractionBlockers.length > 0;
  return {
    contentId,
    rank: candidate.rank,
    planningSelectionAllowed: true,
    externalExtractionRequestStatus: blocked
      ? 'blocked_by_catalog_metadata'
      : 'requires_assets_extract_content_revalidation',
    blockers: candidate.externalExtractionBlockers,
    nextStep: blocked ? null : {
      command: 'npm run assets:extract-content',
      fixedArguments: [
        '--', '--catalog', catalogPath, '--channel', 'blog', '--content-id', contentId,
        '--purpose', 'external-publication', '--destination-class', 'local-publication-staging',
      ],
      requiredArguments: [
        '--evidence-receipt', '--approval-ledger', '--approval-receipt', '--use-evidence-registry',
        '--use-evidence-receipt', '--object-root', '--output-root',
      ],
      guarantee: 'none_until_extractor_succeeds',
    },
  };
}

function normalizeSearchText(value) {
  return String(value ?? '').toLocaleLowerCase('ko').replace(/[\s_-]+/gu, '');
}

function compactObject(input) {
  return Object.fromEntries(Object.entries(input)
    .map(([key, value]) => [key, String(value ?? '').trim()])
    .filter(([, value]) => value));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runBlogAssetPicker(process.argv.slice(2));
}
