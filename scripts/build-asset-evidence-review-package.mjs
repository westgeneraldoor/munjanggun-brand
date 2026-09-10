#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseStrictArgs, required } from './lib/strict-cli-args.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TAG_KEYS = Object.freeze(['productTypes', 'scenes', 'colors', 'designs', 'topics']);
const PRODUCT_FOLDERS = new Map([
  ['3연동 자동중문', '3연동 자동중문'],
  ['3연동ㄱ자', '3연동 ㄱ자중문'],
  ['3연동중문', '3연동중문'],
  ['ABS도어 문틀리폼 필름시공', 'ABS도어 문틀리폼'],
  ['ABS도어 방문교체', 'ABS도어 방문교체'],
  ['ABS도어 슬라이딩도어', 'ABS도어 슬라이딩도어'],
  ['몰딩', '몰딩'],
  ['스윙중문', '스윙중문'],
  ['양개형중문 미서기', '양개형중문 미서기'],
  ['원슬라이딩중문', '원슬라이딩중문'],
]);
const EXACT_TERM_TAGS = Object.freeze({
  colors: ['화이트', '블랙', '골드', '그레이', '회색', '남색', '네이비', '녹색', '그린', '베이지', '브라운', '우드', '오크', '메이플', '월넛', '핑크'],
  designs: ['풀 윈도우', '클래식 고시', '모던 디바이드', '시그니처 간살', '포인트 라인', '포인트 고시', '격자', '간살', '디바이드'],
  scenes: ['현관', '거실', '침실', '주방', '욕실', '드레스룸', '사무실', '설치 현장', '시공 현장', '실내'],
});
const CLAIM_TOPIC = Object.freeze({
  price: '가격',
  event: '행사·프로모션',
  schedule: '일정',
  after_sales_service: 'A/S',
  specification: '제품 사양',
  review: '고객 후기',
  durability_or_absolute_claim: '내구성·절대 표현',
});

export async function buildAssetEvidenceReviewPackage({ worksetPath, analysisPath, outputRoot, generatedAt = new Date().toISOString() } = {}) {
  const worksetFile = requireAbsolute(worksetPath, 'Workset');
  const analysisFile = requireAbsolute(analysisPath, 'Analysis');
  const destination = requirePrivateOutput(outputRoot);
  const [worksetBytes, analysisBytes] = await Promise.all([readFile(worksetFile), readFile(analysisFile)]);
  const workset = JSON.parse(worksetBytes.toString('utf8'));
  const analysis = JSON.parse(analysisBytes.toString('utf8'));
  if (workset?.schema !== 'munjanggun.assetPixelEvidenceWorkset.v1' || !Array.isArray(workset.records)) throw new Error('Workset contract is invalid');
  if (analysis?.schema !== 'munjanggun.assetPixelEvidenceAnalysis.v1' || !Array.isArray(analysis.assets)) throw new Error('Analysis contract is invalid');
  if (resolve(analysis.workset?.path ?? '') !== worksetFile || analysis.workset?.sha256 !== digest(worksetBytes)) {
    throw new Error('Analysis is not bound to the selected workset');
  }
  const draftReportPath = requireAbsolute(workset.sourceDraftReport?.path, 'Draft report');
  const reportBytes = await readFile(draftReportPath);
  if (digest(reportBytes) !== workset.sourceDraftReport?.sha256) throw new Error('Draft report SHA-256 mismatch');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const drafts = await loadDraftEntries(report);
  const worksetBySha = uniqueBySha(workset.records, 'workset');
  const analysisBySha = uniqueBySha(analysis.assets, 'analysis');
  const entries = [];
  for (const [sha256, record] of worksetBySha) {
    const pixel = analysisBySha.get(sha256);
    const draft = drafts.get(sha256);
    if (!pixel || !draft) throw new Error(`Evidence input is missing SHA: ${sha256}`);
    const proposedSearchTags = proposeSearchTags(draft);
    const weakOrMissing = (pixel.textMatches ?? []).filter((item) => !['exact', 'strong'].includes(item.status));
    const sourceUncertainties = (draft.uncertainties ?? []).filter((value) => !isMechanicalMissingNeed(value));
    const gates = {
      pixelRegions: record.textPresence === 'none_observed' || weakOrMissing.length === 0 ? 'machine_ready_non_authority' : 'direct_review_required',
      searchTags: 'machine_proposed_non_authority',
      semanticAuthority: 'existing_signed_adjudication_requires_projection_validation',
      sensitiveClaims: draft.claimSignals?.length ? 'independent_evidence_binding_required' : 'not_applicable',
      privacy: draft.privacySignals?.length ? 'independent_disposition_required' : 'not_applicable',
      sourceUncertainties: sourceUncertainties.length ? 'resolution_required' : 'none',
    };
    const blockingReasons = Object.entries(gates)
      .filter(([, value]) => !['machine_ready_non_authority', 'not_applicable', 'none'].includes(value))
      .map(([key, value]) => `${key}:${value}`);
    entries.push({
      sourceObjectSha256: sha256,
      mediaKind: record.mediaKind,
      originalPath: record.originalPath,
      sourceRefs: record.sourceRefs,
      observedSummary: draft.observedSummary,
      contentType: draft.contentType,
      useCases: draft.useCases,
      textPresence: record.textPresence,
      visibleText: record.visibleText,
      proposedSearchTags,
      tagProposalMethod: 'exact_top_level_product_folder_and_controlled_visible_terms_v1',
      pixelMatchSummary: countStatuses(pixel.textMatches ?? []),
      textReviewQueue: weakOrMissing,
      claimSignals: draft.claimSignals ?? [],
      privacySignals: draft.privacySignals ?? [],
      sourceUncertainties,
      gates,
      promotionEligible: false,
      blockingReasons,
    });
  }
  if (entries.length !== workset.uniqueAssetCount || entries.length !== analysis.coverage?.uniqueAssetCount) throw new Error('Review package coverage mismatch');
  const queue = entries.filter((entry) => entry.textReviewQueue.length || entry.sourceUncertainties.length || entry.claimSignals.length || entry.privacySignals.length);
  queue.sort(compareQueuePriority);
  const summary = {
    schema: 'munjanggun.assetEvidenceReviewPackage.v1',
    version: '1.0',
    status: 'non_authority_review_package',
    generatedAt: new Date(generatedAt).toISOString(),
    sources: {
      workset: { path: worksetFile, sha256: digest(worksetBytes) },
      analysis: { path: analysisFile, sha256: digest(analysisBytes) },
      draftReport: { path: draftReportPath, sha256: digest(reportBytes) },
    },
    coverage: {
      uniqueAssetCount: entries.length,
      staticAssetCount: entries.filter((entry) => entry.mediaKind === 'static').length,
      gifAssetCount: entries.filter((entry) => entry.mediaKind === 'gif').length,
      machinePixelReadyCount: entries.filter((entry) => entry.gates.pixelRegions === 'machine_ready_non_authority').length,
      directPixelReviewAssetCount: entries.filter((entry) => entry.gates.pixelRegions === 'direct_review_required').length,
      queuedAssetCount: queue.length,
      queuedTextItemCount: sum(queue, (entry) => entry.textReviewQueue.length),
      claimAssetCount: entries.filter((entry) => entry.claimSignals.length).length,
      privacyAssetCount: entries.filter((entry) => entry.privacySignals.length).length,
      promotionEligibleCount: 0,
    },
    guard: 'This package accelerates direct review but grants no content authority. Machine OCR, tags, and pixel regions cannot be used as reviewer signatures or publication approval.',
  };
  await mkdir(destination, { recursive: false });
  const entriesPath = resolve(destination, 'asset-evidence-entries.json');
  const queuePath = resolve(destination, 'direct-review-queue.json');
  const summaryPath = resolve(destination, 'package-report.json');
  const htmlPath = resolve(destination, 'review-dashboard.html');
  const entriesBytes = jsonBytes({ ...summary, entries });
  const queueBytes = jsonBytes({ ...summary, queue });
  const completed = {
    ...summary,
    files: {
      entries: { path: entriesPath, sha256: digest(entriesBytes) },
      queue: { path: queuePath, sha256: digest(queueBytes) },
      dashboard: { path: htmlPath },
    },
  };
  const htmlBytes = Buffer.from(renderDashboard(completed, queue), 'utf8');
  completed.files.dashboard.sha256 = digest(htmlBytes);
  const summaryBytes = jsonBytes(completed);
  await Promise.all([
    writeFile(entriesPath, entriesBytes, { flag: 'wx' }),
    writeFile(queuePath, queueBytes, { flag: 'wx' }),
    writeFile(htmlPath, htmlBytes, { flag: 'wx' }),
    writeFile(summaryPath, summaryBytes, { flag: 'wx' }),
  ]);
  return { outputRoot: destination, summaryPath, summarySha256: digest(summaryBytes), ...summary.coverage };
}

export function proposeSearchTags(entry) {
  const tags = Object.fromEntries(TAG_KEYS.map((key) => [key, []]));
  for (const source of entry.sourceRefs ?? []) {
    const folder = String(source.sourceRelativePath ?? '').replaceAll('\\', '/').split('/')[0];
    const product = PRODUCT_FOLDERS.get(folder);
    if (product) tags.productTypes.push(product);
  }
  const corpus = [entry.observedSummary, ...(entry.visibleText ?? [])].join('\n').normalize('NFKC');
  for (const [key, terms] of Object.entries(EXACT_TERM_TAGS)) {
    for (const term of terms) if (containsControlledTerm(corpus, term)) tags[key].push(term);
  }
  for (const signal of entry.claimSignals ?? []) {
    if (CLAIM_TOPIC[signal]) tags.topics.push(CLAIM_TOPIC[signal]);
  }
  return Object.fromEntries(TAG_KEYS.map((key) => [key, [...new Set(tags[key])].sort((a, b) => a.localeCompare(b, 'ko-KR'))]));
}

function containsControlledTerm(corpus, term) {
  if (/^[A-Za-z0-9]+$/u.test(term)) return new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegExp(term)}(?:$|[^A-Za-z0-9])`, 'iu').test(corpus);
  return corpus.includes(term);
}

async function loadDraftEntries(report) {
  if (report?.schema !== 'munjanggun.assetContentReviewDraftSet.v1' || !Array.isArray(report.documentFiles)) throw new Error('Draft report contract is invalid');
  const result = new Map();
  for (const spec of report.documentFiles) {
    const path = requireAbsolute(spec.path, 'Draft document');
    const bytes = await readFile(path);
    if (digest(bytes) !== spec.sha256) throw new Error(`Draft document SHA-256 mismatch: ${path}`);
    const document = JSON.parse(bytes.toString('utf8'));
    for (const entry of document.entries ?? []) {
      const prior = result.get(entry.sha256);
      if (!prior) result.set(entry.sha256, structuredClone(entry));
      else mergeDuplicateDraft(prior, entry);
    }
  }
  return result;
}

function mergeDuplicateDraft(target, source) {
  for (const field of ['observedSummary', 'contentType', 'textPresence']) {
    if (target[field] !== source[field]) throw new Error(`Cross-intake draft mismatch for ${target.sha256}: ${field}`);
  }
  for (const field of ['visibleText', 'useCases', 'claimSignals', 'privacySignals', 'uncertainties']) {
    target[field] = [...new Set([...(target[field] ?? []), ...(source[field] ?? [])])];
  }
  target.sourceRefs = uniqueSourceRefs([...(target.sourceRefs ?? []), ...(source.sourceRefs ?? [])]);
}

function isMechanicalMissingNeed(value) {
  return /^(claim_pixel_evidence_missing|gif_sample_frame_pixel_evidence_missing|gif_semantic_fields_require_primary_structuring|gif_visible_text_atomic_transcription_and_regions_missing|search_tags_review_missing|secondary_semantic_verdict_receipt_missing|sensitive_visible_text_second_review_missing|visible_text_normalized_regions_missing|visible_text_static_crop_pixels_missing)$/u.test(value);
}

function compareQueuePriority(left, right) {
  const score = (entry) => entry.privacySignals.length * 10000 + entry.claimSignals.length * 1000 + entry.sourceUncertainties.length * 100 + entry.textReviewQueue.length;
  return score(right) - score(left) || left.sourceObjectSha256.localeCompare(right.sourceObjectSha256);
}

function countStatuses(values) {
  const result = { exact: 0, strong: 0, weak: 0, unmatched: 0 };
  for (const value of values) result[value.status] = (result[value.status] ?? 0) + 1;
  return result;
}

function uniqueBySha(values, label) {
  const result = new Map();
  for (const value of values) {
    const sha = value.sourceObjectSha256;
    if (!/^[a-f0-9]{64}$/u.test(sha ?? '') || result.has(sha)) throw new Error(`Invalid or duplicate ${label} SHA: ${sha}`);
    result.set(sha, value);
  }
  return result;
}

function uniqueSourceRefs(values) {
  const seen = new Set();
  return values.filter((entry) => {
    const key = `${entry.sourceId}\0${entry.sourceRelativePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderDashboard(report, queue) {
  const rows = queue.map((entry) => `<article><div class="media"><img loading="lazy" src="${html(fileUrl(entry.originalPath))}" alt=""></div><div><code>${html(entry.sourceObjectSha256.slice(0, 12))}</code><h2>${html(entry.observedSummary)}</h2><p>${html(entry.sourceRefs.map((item) => item.sourceRelativePath).join(' · '))}</p><p><b>태그 제안</b> ${html(Object.values(entry.proposedSearchTags).flat().join(', ') || '없음')}</p><p><b>재확인 문구</b> ${html(entry.textReviewQueue.map((item) => `${item.text} [${item.status}]`).join(' / ') || '없음')}</p><p><b>Claim</b> ${html(entry.claimSignals.join(', ') || '없음')} · <b>Privacy</b> ${html(entry.privacySignals.join(', ') || '없음')}</p><p class="block">${html(entry.blockingReasons.join(' · '))}</p></div></article>`).join('\n');
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>문장군 자산 직접 검토 큐</title><style>body{font-family:system-ui,sans-serif;margin:24px;background:#f5f5f2;color:#171717}header{position:sticky;top:0;background:#f5f5f2;padding:12px 0;border-bottom:2px solid #111;z-index:2}article{display:grid;grid-template-columns:280px 1fr;gap:20px;background:white;margin:16px 0;padding:16px;border:1px solid #ddd}.media{height:240px;display:flex;align-items:center;justify-content:center;background:#eee}.media img{max-width:100%;max-height:100%}h2{font-size:18px;margin:8px 0}p{margin:6px 0}.block{color:#9b1c1c;font-weight:700}code{font-size:12px}@media(max-width:700px){article{grid-template-columns:1fr}}</style><header><h1>문장군 자산 직접 검토 큐</h1><p>총 ${report.coverage.uniqueAssetCount}개 · 직접 확인 큐 ${report.coverage.queuedAssetCount}개 · 승격 0개(차단 유지)</p></header>${rows}</html>`;
}

function fileUrl(path) {
  return pathToFileURL(resolve(path)).href;
}

function html(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'); }
function sum(values, getter) { return values.reduce((total, value) => total + getter(value), 0); }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function jsonBytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function requireAbsolute(value, label) { if (!isAbsolute(value ?? '')) throw new Error(`${label} path must be absolute`); return resolve(value); }
function requirePrivateOutput(value) {
  const destination = requireAbsolute(value, 'Output root');
  const relation = relative(REPO_ROOT, destination);
  if (relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))) throw new Error('Output root must be outside the public repository');
  return destination;
}

export async function runBuildAssetEvidenceReviewPackage(argv) {
  const args = parseStrictArgs(argv, { valueFlags: ['--workset', '--analysis', '--output-root'] });
  const result = await buildAssetEvidenceReviewPackage({
    worksetPath: required(args, '--workset'),
    analysisPath: required(args, '--analysis'),
    outputRoot: required(args, '--output-root'),
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runBuildAssetEvidenceReviewPackage(process.argv.slice(2));
