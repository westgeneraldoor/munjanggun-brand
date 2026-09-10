import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  lstat, mkdir, readFile, realpath, rename, rm, writeFile,
} from 'node:fs/promises';
import {
  dirname, isAbsolute, parse, relative, resolve, sep,
} from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { verifyGitCommittedConsumerPolicy, verifyGitIgnoredConsumerDestination } from './asset-library.mjs';
import { parseContentReviewerTrust, verifyTrustedContentReviewerSignature } from './asset-content-reviewer-trust.mjs';

const execFileAsync = promisify(execFile);
const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DEFAULT_CONSUMER_POLICY = resolve(fileURLToPath(new URL('../../config/asset-library-consumers.json', import.meta.url)));
const DEFAULT_TRUSTED_ROOTS = [
  'C:/Users/hjh/안티그래비티/문장군_브랜드_private',
  'Z:/문장군_브랜드_원본보관',
].map((value) => resolve(value));
const REQUIRED_REMAINING_GATES = [
  'independent_secondary_semantic_verdict_for_489_assets_bound_to_final_primary_decisions',
  'continuous_original_playback_or_all_decoded_frames_review_for_80_gifs',
];

export async function loadInternalAssetLibrary(configPath, {
  repoRoot = DEFAULT_REPO_ROOT,
  trustedPrivateRoots = DEFAULT_TRUSTED_ROOTS,
  consumerPolicyPath = DEFAULT_CONSUMER_POLICY,
  consumerPolicy = null,
  verifyCommittedConfig = verifyGitCommittedJson,
  verifyCommittedConsumers = verifyGitCommittedConsumerPolicy,
  verifyOriginals = true,
} = {}) {
  const configFile = await assertRepositoryFile(configPath, repoRoot, 'Internal library config');
  const configBytes = await readFile(configFile);
  await verifyCommittedConfig(configFile, repoRoot);
  const config = JSON.parse(configBytes.toString('utf8'));
  validateConfig(config);

  const pointerPath = await assertTrustedFile(config.activePointerPath, trustedPrivateRoots, 'Primary review pointer');
  const pointerBytes = await readFile(pointerPath);
  assertDigest(pointerBytes, config.activePointerSha256, 'Primary review pointer');
  const pointer = JSON.parse(pointerBytes.toString('utf8'));
  validatePointer(pointer);

  const refs = {
    directReviewReceipt: pointer.directReviewReceipt,
    structuredLedger: pointer.structuredLedger,
    primaryCandidate: pointer.primaryCandidate,
    pixelEvidenceIndex: pointer.pixelEvidenceIndex,
    primaryAttestation: pointer.primaryAttestation,
  };
  const loaded = {};
  for (const [name, ref] of Object.entries(refs)) {
    const path = await assertTrustedFile(ref?.path, trustedPrivateRoots, name);
    const bytes = await readFile(path);
    assertDigest(bytes, ref.sha256, name);
    loaded[name] = { path, bytes, value: JSON.parse(bytes.toString('utf8')) };
  }

  const trustPath = await assertTrustedFile(config.reviewerTrustPath, trustedPrivateRoots, 'Primary reviewer trust');
  const trustBytes = await readFile(trustPath);
  assertDigest(trustBytes, config.reviewerTrustSha256, 'Primary reviewer trust');
  const trust = parseContentReviewerTrust(trustBytes);
  const candidate = loaded.primaryCandidate.value;
  const evidence = loaded.pixelEvidenceIndex.value;
  const attestation = loaded.primaryAttestation.value;
  const signer = verifyTrustedContentReviewerSignature(
    attestation, attestation.reviewerPrincipalId, trust, 'Primary review attestation',
  );
  validateBindings({ pointer, candidate, evidence, attestation, signer });

  const records = await validateRecords(candidate.records, trustedPrivateRoots, { verifyOriginals });
  let consumers = consumerPolicy;
  if (!consumers) {
    const policyPath = await assertRepositoryFile(consumerPolicyPath, repoRoot, 'Consumer policy');
    await verifyCommittedConsumers(policyPath, repoRoot);
    consumers = JSON.parse(await readFile(policyPath, 'utf8'));
  }
  validateConsumers(consumers);

  return {
    configPath: configFile,
    configSha256: digest(configBytes),
    config,
    pointerPath,
    pointerSha256: digest(pointerBytes),
    pointer,
    candidatePath: loaded.primaryCandidate.path,
    candidateSha256: pointer.primaryCandidate.sha256,
    candidate,
    signer,
    records,
    consumers,
    trustedPrivateRoots,
  };
}

export function searchInternalAssetLibrary(library, criteria, { mediaType, limit = 20 } = {}) {
  const normalized = compactCriteria(criteria);
  if (Object.keys(normalized).length === 0) {
    throw new Error('Provide at least one criterion: query, product, scene, color, design, or topic');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('limit must be an integer from 1 to 500');
  const matches = library.records
    .filter((record) => !mediaType || mediaTypeFor(record) === mediaType)
    .map((record) => ({ record, dimensions: matchDimensions(record, normalized) }))
    .filter(({ dimensions }) => Object.keys(dimensions).length === Object.keys(normalized).length)
    .map(({ record, dimensions }) => summarizeRecord(record, dimensions, scoreRecord(record, normalized)))
    .sort((left, right) => right.score - left.score || left.sha256.localeCompare(right.sha256))
    .slice(0, limit);
  return matches.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function writeInternalAssetHandoff(library, results, selectedSha256s, {
  consumerId,
  outputName,
  repoRoot = DEFAULT_REPO_ROOT,
  verifyConsumerDestination = verifyGitIgnoredConsumerDestination,
  generatedAt = new Date().toISOString(),
} = {}) {
  const hashes = [...new Set(selectedSha256s ?? [])];
  if (hashes.length === 0) throw new Error('Select at least one sha256');
  const selected = hashes.map((hash) => {
    const matches = results.filter((entry) => entry.sha256 === hash);
    if (matches.length !== 1) throw new Error(`Selected sha256 is not uniquely present in current results: ${hash}`);
    return matches[0];
  });
  const consumer = library.consumers.find((entry) => entry.consumerId === consumerId);
  if (!consumer) throw new Error(`Unknown registered consumer: ${consumerId ?? 'missing'}`);
  if (!outputName || outputName.includes('..') || /[\\/]/u.test(outputName)) {
    throw new Error('Registered consumer selection requires one safe outputName');
  }
  const approvedRoot = resolve(consumer.privateRoot);
  const destination = resolve(approvedRoot, outputName);
  if (!isContained(approvedRoot, destination) || destination === approvedRoot) throw new Error('Handoff destination escapes consumer root');
  if (isContained(repoRoot, destination) || isContained(destination, repoRoot)) throw new Error('Public Git/repository output is prohibited');
  await assertRealDirectory(approvedRoot, 'Consumer private root');
  if (consumer.requireGitIgnored) await verifyConsumerDestination(approvedRoot, destination);
  await assertNoSymlinkSegments(approvedRoot, dirname(destination), 'Handoff destination');
  try {
    await lstat(destination);
    throw new Error('Handoff destination already exists');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const entry of selected) {
    const bytes = await readFile(entry.originalPath);
    assertDigest(bytes, entry.sha256, `Selected original ${entry.sha256}`);
  }

  const handoff = {
    schema: 'munjanggun.assetInternalLibraryHandoff.v1',
    version: '1.0',
    generatedAt,
    libraryId: library.config.libraryId,
    mode: 'primary_reviewed_internal_only',
    authorityStatus: 'non_authority',
    authorityHashes: {
      configSha256: library.configSha256,
      activePointerSha256: library.pointerSha256,
      primaryCandidateSha256: library.candidateSha256,
      primaryAttestationSha256: library.pointer.primaryAttestation.sha256,
      pixelEvidenceIndexSha256: library.pointer.pixelEvidenceIndex.sha256,
    },
    consumer: { consumerId: consumer.consumerId, channel: consumer.channel },
    selectionCount: selected.length,
    containsBinaryCopies: false,
    selected,
    usageNotice: {
      internalSearchPreview: 'allowed_primary_reviewed',
      externalPublication: 'blocked_selected_asset_review_required',
      publicGit: 'blocked',
      instruction: '게시할 자산만 원본 문구, 최신 claim, 개인정보를 확인한 뒤 외부 발행 절차로 넘긴다.',
    },
  };
  const partial = resolve(approvedRoot, `.${outputName}.partial-${process.pid}-${Date.now()}`);
  await mkdir(partial, { recursive: false });
  try {
    await writeFile(resolve(partial, 'asset-handoff.json'), `${JSON.stringify(handoff, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await writeFile(resolve(partial, 'preview.html'), renderPreviewHtml(handoff), { encoding: 'utf8', flag: 'wx' });
    await rename(partial, destination);
  } catch (error) {
    await rm(partial, { recursive: true, force: true });
    throw error;
  }
  return {
    outputRoot: destination,
    handoffPath: resolve(destination, 'asset-handoff.json'),
    previewPath: resolve(destination, 'preview.html'),
    selectionCount: selected.length,
    containsBinaryCopies: false,
  };
}

function validateConfig(config) {
  if (config?.schema !== 'munjanggun.assetInternalLibraryConfig.v1' || config.version !== '1.0'
    || config.mode !== 'primary_reviewed_internal_only'
    || config.externalPublicationPolicy !== 'selected_asset_review_required'
    || config.publicGitStorage !== false
    || !config.libraryId || !isHash(config.activePointerSha256) || !isHash(config.reviewerTrustSha256)) {
    throw new Error('Internal library config is invalid');
  }
}

function validatePointer(pointer) {
  if (pointer?.schema !== 'munjanggun.assetPrimaryReviewActivePointer.v1' || pointer.version !== '1.0'
    || pointer.authorityStatus !== 'non_authority_primary_attested_pixel_evidence_verified_secondary_pending'
    || pointer.promotionEligible !== false || !Array.isArray(pointer.remainingAuthorityNeeds)
    || REQUIRED_REMAINING_GATES.some((gate) => !pointer.remainingAuthorityNeeds.includes(gate))) {
    throw new Error('Primary review pointer safety state is invalid');
  }
}

function validateBindings({ pointer, candidate, evidence, attestation, signer }) {
  if (candidate?.authorityStatus !== 'non_authority' || candidate.promotionEligible !== false
    || candidate.records?.length !== pointer.coverage?.assetCount
    || candidate.coverage?.uniqueAssetCount !== pointer.coverage.assetCount
    || candidate.coverage?.unresolvedObservationCount !== 0
    || evidence?.promotionEligible !== false
    || evidence.sourceCandidate?.sha256 !== pointer.primaryCandidate.sha256
    || evidence.coverage?.assetCount !== pointer.coverage.assetCount
    || evidence.coverage.staticUniqueCropCount + evidence.coverage.gifUniqueFrameCount !== pointer.coverage.verifiedEvidenceFileCount
    || attestation.rawTranscriptSha256 !== pointer.primaryCandidate.sha256
    || attestation.reviewerPrincipalId !== pointer.primaryAttestation.reviewerPrincipalId
    || signer.fingerprint !== pointer.primaryAttestation.keyFingerprint) {
    throw new Error('Primary review evidence binding is invalid');
  }
}

async function validateRecords(records, trustedRoots, { verifyOriginals }) {
  const hashes = new Set();
  const validated = [];
  for (const record of records ?? []) {
    const hash = String(record?.sourceObjectSha256 ?? '').toLowerCase();
    if (!isHash(hash) || hashes.has(hash)) throw new Error(`Primary candidate has an invalid or duplicate SHA: ${hash}`);
    if (!['static', 'gif'].includes(record.mediaKind) || !Array.isArray(record.sourceRefs)
      || !Array.isArray(record.claimSignals) || !Array.isArray(record.privacySignals)
      || !Array.isArray(record.acceptedObservations) || !Array.isArray(record.unresolvedObservations)
      || record.unresolvedObservations.length !== 0) {
      throw new Error(`Primary candidate record is invalid: ${hash}`);
    }
    const originalPath = await assertTrustedFile(record.originalPath, trustedRoots, `Original ${hash}`);
    if (verifyOriginals) assertDigest(await readFile(originalPath), hash, `Original ${hash}`);
    hashes.add(hash);
    validated.push({ ...record, sourceObjectSha256: hash, originalPath });
  }
  return validated;
}

function compactCriteria(criteria) {
  return Object.fromEntries(Object.entries(criteria ?? {})
    .map(([key, value]) => [key, String(value ?? '').trim()])
    .filter(([, value]) => value));
}

function matchDimensions(record, criteria) {
  const result = {};
  for (const [key, value] of Object.entries(criteria)) {
    const haystack = key === 'query' ? allSearchText(record) : dimensionText(record, key);
    const terms = normalize(value).split(/\s+/u).filter(Boolean);
    if (terms.every((term) => haystack.includes(term))) result[key] = value;
  }
  return result;
}

function dimensionText(record, key) {
  const map = {
    product: record.proposedSearchTags?.productTypes,
    scene: record.proposedSearchTags?.scenes,
    color: record.proposedSearchTags?.colors,
    design: record.proposedSearchTags?.designs,
    topic: record.proposedSearchTags?.topics,
  };
  return normalize((map[key] ?? []).join(' '));
}

function allSearchText(record) {
  return normalize([
    record.observedSummary, record.contentType, ...(record.useCases ?? []),
    ...Object.values(record.proposedSearchTags ?? {}).flat(),
    ...(record.acceptedObservations ?? []).flatMap((item) => [item.text, item.recognizedText]),
    ...(record.sourceRefs ?? []).flatMap((item) => [item.sourceId, item.sourceRelativePath]),
  ].join(' '));
}

function scoreRecord(record, criteria) {
  const text = allSearchText(record);
  return Object.values(criteria).flatMap((value) => normalize(value).split(/\s+/u)).filter(Boolean)
    .reduce((score, term) => score + (text.includes(term) ? 10 : 0), 0)
    + (record.claimSignals.length === 0 ? 2 : 0) + (record.privacySignals.length === 0 ? 2 : 0);
}

function summarizeRecord(record, matchedDimensions, score) {
  const claimNeedsReview = record.claimSignals.length > 0;
  const privacyNeedsReview = record.privacySignals.length > 0;
  return {
    rank: 0,
    score,
    contentId: `sha256:${record.sourceObjectSha256}`,
    sha256: record.sourceObjectSha256,
    mediaType: mediaTypeFor(record),
    semanticSummary: record.observedSummary,
    contentType: record.contentType,
    useCases: record.useCases ?? [],
    searchTags: record.proposedSearchTags,
    visibleText: [...new Set(record.acceptedObservations.map((item) => item.text).filter(Boolean))],
    matchedDimensions,
    sourceRefs: record.sourceRefs,
    originalPath: record.originalPath,
    previewUrl: pathToFileURL(record.originalPath).href,
    reviewFlags: {
      claimSignals: record.claimSignals,
      privacySignals: record.privacySignals,
      releaseConstraints: record.releaseConstraints ?? [],
    },
    usageStatus: {
      internalSearchPreview: { status: 'usable', label: '내부 검색·미리보기 가능' },
      externalPublication: {
        status: 'blocked_selected_asset_review_required',
        label: '게시 선택 후 원본·최신성·개인정보 확인 필요',
        blockers: [
          'primary_review_is_non_authority',
          ...(claimNeedsReview ? ['claim_review_on_selection'] : []),
          ...(privacyNeedsReview ? ['privacy_review_on_selection'] : []),
        ],
      },
      publicGit: { status: 'blocked', label: '공개 Git 저장 금지' },
    },
  };
}

function mediaTypeFor(record) {
  return record.mediaKind === 'gif' ? 'image/gif' : mediaTypeFromPath(record.originalPath);
}

function mediaTypeFromPath(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]+/gu, ' ').trim();
}

function validateConsumers(consumers) {
  if (!Array.isArray(consumers) || consumers.length === 0) throw new Error('Consumer policy must be a non-empty array');
  const ids = new Set();
  const roots = [];
  for (const item of consumers) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(item?.consumerId ?? '') || ids.has(item.consumerId)
      || !['private_codex', 'blog', 'sns'].includes(item.channel)
      || !isAbsolute(item.privateRoot ?? '') || typeof item.requireGitIgnored !== 'boolean') {
      throw new Error('Consumer policy is invalid or duplicated');
    }
    const root = resolve(item.privateRoot);
    if (roots.some((prior) => isContained(prior, root) || isContained(root, prior))) throw new Error('Consumer private roots must not overlap');
    ids.add(item.consumerId);
    roots.push(root);
  }
}

async function verifyGitCommittedJson(filePath, repoRoot) {
  const relativePath = relative(resolve(repoRoot), resolve(filePath)).replaceAll('\\', '/');
  if (!relativePath || relativePath.startsWith('../')) throw new Error('Internal library config is outside the current repository');
  try {
    await execFileAsync('git', ['-C', repoRoot, 'ls-files', '--error-unmatch', '--', relativePath], { windowsHide: true });
    const { stdout } = await execFileAsync('git', ['-C', repoRoot, 'show', `HEAD:${relativePath}`], { encoding: 'utf8', windowsHide: true });
    const head = JSON.parse(stdout);
    const current = JSON.parse(await readFile(filePath, 'utf8'));
    if (canonicalJson(head) !== canonicalJson(current)) throw new Error('Internal library config has uncommitted canonical content changes');
  } catch (error) {
    if (/outside the current repository|uncommitted canonical content changes/u.test(error.message)) throw error;
    throw new Error('Internal library config must be tracked in HEAD');
  }
}

async function assertRepositoryFile(path, repoRoot, label) {
  const file = resolve(path);
  if (!isContained(repoRoot, file)) throw new Error(`${label} is outside the current repository`);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a regular file`);
  return file;
}

async function assertTrustedFile(path, roots, label) {
  if (!isAbsolute(path ?? '') || String(path).split(/[\\/]/u).includes('..')) throw new Error(`${label} path is unsafe`);
  const file = resolve(path);
  const root = roots.map((value) => resolve(value)).find((candidate) => isContained(candidate, file));
  if (!root) throw new Error(`${label} is outside trusted private roots`);
  await assertNoSymlinkSegments(root, file, label);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file`);
  if (!isContained(await realpath(root), await realpath(file))) throw new Error(`${label} escapes trusted root`);
  return file;
}

async function assertRealDirectory(path, label) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
}

async function assertNoSymlinkSegments(root, target, label) {
  let cursor = parse(resolve(root)).root;
  for (const segment of relative(cursor, resolve(target)).split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    const info = await lstat(cursor);
    if (info.isSymbolicLink()) throw new Error(`${label} path must not contain symbolic links`);
  }
}

function isContained(root, child) {
  const relation = relative(resolve(root), resolve(child));
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
}

function assertDigest(bytes, expected, label) {
  if (!isHash(expected) || digest(bytes) !== expected) throw new Error(`${label} SHA-256 mismatch`);
}

function isHash(value) {
  return /^[a-f0-9]{64}$/u.test(value ?? '');
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function renderPreviewHtml(handoff) {
  const cards = handoff.selected.map((entry) => `<article><h2>${escapeHtml(entry.semanticSummary || entry.contentId)}</h2><img src="${escapeHtml(entry.previewUrl)}" alt="${escapeHtml(entry.semanticSummary || entry.contentId)}"><p><strong>내부 검색·미리보기 가능</strong></p><p>외부 게시 전 선택 자산 확인 필요</p><p class="path">${escapeHtml(entry.originalPath)}</p></article>`).join('');
  return `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>문장군 내부 자산 미리보기</title><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 20px;color:#202124}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{border:1px solid #ddd;border-radius:12px;padding:16px}img{display:block;width:100%;height:320px;object-fit:contain;background:#f4f4f4}.path{word-break:break-all;color:#666;font-size:12px}h1{font-size:26px}h2{font-size:17px}</style></head><body><h1>문장군 내부 자산 미리보기</h1><p>원본을 복사하지 않습니다. 외부 게시 전 선택 자산만 원본·최신성·개인정보를 확인하세요.</p><main>${cards}</main></body></html>\n`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
