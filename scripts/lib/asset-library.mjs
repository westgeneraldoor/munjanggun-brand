import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { searchCatalogEntries } from '../assets-search-catalog.mjs';
import { resolveAssetObject } from './asset-resolver.mjs';
import { resolveContainedPath } from './asset-paths.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './schema-validation.mjs';

const DEFAULT_TRUSTED_PRIVATE_ROOTS = Object.freeze([
  'C:/Users/hjh/안티그래비티/문장군_브랜드_private',
  'Z:/문장군_브랜드_원본보관',
].map((value) => resolve(value)));

const DIMENSION_FIELDS = Object.freeze({
  query: ['semanticSummary', 'ocrText', 'semanticGroupId', 'visualGroupId', 'claimSignals', 'sourceRefs'],
  product: ['sourceRefs', 'semanticSummary'],
  scene: ['semanticSummary', 'ocrText', 'sourceRefs'],
  color: ['semanticSummary', 'ocrText', 'sourceRefs'],
  design: ['semanticSummary', 'ocrText', 'semanticGroupId', 'sourceRefs'],
  topic: ['semanticSummary', 'ocrText', 'claimSignals', 'sourceRefs'],
});

const PRIVATE_CODEX_ALLOWED = new Set(['allowed_by_recorded_owner_order', 'allowed']);
const execFileAsync = promisify(execFile);

export async function loadAssetLibrary(pointerPath, {
  trustedPrivateRoots = DEFAULT_TRUSTED_PRIVATE_ROOTS,
  repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url))),
  verifyCommittedAnchor = verifyGitCommittedAnchor,
  consumerPolicy = null,
  consumerPolicyPath = resolve(fileURLToPath(new URL('../../config/asset-library-consumers.json', import.meta.url))),
  verifyCommittedConsumerPolicy = verifyGitCommittedAnchor,
} = {}) {
  const pointerFile = await assertTrustedPrivatePath(pointerPath, {
    trustedPrivateRoots, kind: 'file', label: 'Library pointer', rejectSymlinks: true,
  });
  const pointerBytes = await readFile(pointerFile);
  const pointerSha256 = digest(pointerBytes);
  const pointer = JSON.parse(pointerBytes.toString('utf8'));
  const pointerSchema = await readJson(fileURLToPath(new URL('../../schemas/asset-library-pointer.schema.json', import.meta.url)));
  const pointerValidation = validateAgainstSchema(pointer, pointerSchema);
  if (!pointerValidation.valid) {
    throw new Error(`Library pointer schema failed:\n${formatSchemaErrors(pointerValidation.errors).join('\n')}`);
  }

  const catalogPath = await assertTrustedPrivatePath(pointer.current.catalogPath, {
    trustedPrivateRoots, kind: 'file', label: 'Current catalog', rejectSymlinks: true,
  });
  const objectRoot = await assertTrustedPrivatePath(pointer.current.objectRoot, {
    trustedPrivateRoots, kind: 'directory', label: 'Object root', rejectSymlinks: true,
  });
  const rightsBundleRoot = await assertTrustedPrivatePath(pointer.current.rightsBundleRoot, {
    trustedPrivateRoots, kind: 'directory', label: 'Rights bundle root', rejectSymlinks: true,
  });
  const rightsStatePath = resolveContainedPath(rightsBundleRoot, pointer.current.rightsStateRef, 'rightsStateRef');
  await assertTrustedPrivatePath(rightsStatePath, {
    trustedPrivateRoots, kind: 'file', label: 'Rights state', rejectSymlinks: true,
  });

  const [catalogBytes, rightsStateBytes] = await Promise.all([readFile(catalogPath), readFile(rightsStatePath)]);
  assertDigest(catalogBytes, pointer.current.catalogSha256, 'Current catalog');
  assertDigest(rightsStateBytes, pointer.current.rightsStateSha256, 'Rights state');
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const rightsState = JSON.parse(rightsStateBytes.toString('utf8'));
  validateCatalogShape(catalog);
  validateRightsBinding(rightsState, pointer.current.catalogSha256, catalog.intakeId);
  const anchorPath = await assertRepositoryFile(pointer.current.anchorPath, repoRoot, 'Owner order anchor');
  const anchorBytes = await readFile(anchorPath);
  assertDigest(anchorBytes, pointer.current.anchorSha256, 'Owner order anchor');
  await verifyCommittedAnchor(anchorPath, repoRoot, anchorBytes);
  const anchor = JSON.parse(anchorBytes.toString('utf8'));
  const anchorSchema = await readJson(fileURLToPath(new URL('../../schemas/asset-owner-order-anchor.schema.json', import.meta.url)));
  const anchorValidation = validateAgainstSchema(anchor, anchorSchema);
  if (!anchorValidation.valid) throw new Error(`Owner order anchor schema failed:\n${formatSchemaErrors(anchorValidation.errors).join('\n')}`);
  if (anchor.intakeId !== catalog.intakeId || anchor.hashes.catalog !== pointer.current.catalogSha256
    || anchor.hashes.rightsState !== pointer.current.rightsStateSha256 || anchor.publicGitStorage !== false) {
    throw new Error('Owner order anchor does not match current library authority');
  }
  await verifyAnchorChain({ anchor, catalog, catalogPath, rightsBundleRoot, rightsStatePath, trustedPrivateRoots });
  let consumers = consumerPolicy;
  if (!consumers) {
    const policyPath = await assertRepositoryFile(consumerPolicyPath, repoRoot, 'Consumer policy');
    const policyBytes = await readFile(policyPath);
    await verifyCommittedConsumerPolicy(policyPath, repoRoot, policyBytes);
    consumers = JSON.parse(policyBytes.toString('utf8'));
  }
  validateConsumerPolicy(consumers);

  return {
    pointerPath: pointerFile,
    pointerSha256,
    pointer,
    catalogPath,
    catalog,
    objectRoot,
    rightsBundleRoot,
    rightsStatePath,
    rightsState,
    anchorPath,
    anchor,
    consumers,
    trustedPrivateRoots,
  };
}

export async function searchAssetLibrary(library, criteria, {
  mediaType,
  limit = 20,
} = {}) {
  const normalizedCriteria = compactCriteria(criteria);
  if (Object.keys(normalizedCriteria).length === 0) {
    throw new Error('Provide at least one criterion: query, product, scene, color, design, or topic');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('limit must be an integer from 1 to 100');
  const broadQuery = Object.values(normalizedCriteria).join(' ');
  const searched = searchCatalogEntries(library.catalog, {
    query: broadQuery,
    limit: 500,
    mediaType,
    product: normalizedCriteria.product,
  });
  const catalogBySha = new Map(library.catalog.entries.map((entry) => [entry.sha256, entry]));
  const matched = searched
    .map((summary) => ({ entry: catalogBySha.get(summary.sha256), score: summary.score }))
    .filter(({ entry }) => entry)
    .map(({ entry, score }) => ({ entry, score, matchedDimensions: matchDimensions(entry, normalizedCriteria) }))
    .filter(({ matchedDimensions }) => Object.keys(matchedDimensions).length === Object.keys(normalizedCriteria).length)
    .slice(0, limit);

  return Promise.all(matched.map(async ({ entry, score, matchedDimensions }, index) => {
    const objectPath = await resolveAssetObject(library.objectRoot, entry);
    return summarizeResult(library, entry, objectPath, score, matchedDimensions, index + 1);
  }));
}

export async function writeAssetLibraryHandoff(library, results, selectedContentIds, {
  outputRoot,
  approvedPrivateRoot,
  consumerId,
  outputName,
  verifyConsumerDestination = verifyGitIgnoredConsumerDestination,
  repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url))),
  trustedPrivateRoots = library.trustedPrivateRoots ?? DEFAULT_TRUSTED_PRIVATE_ROOTS,
  generatedAt = new Date().toISOString(),
} = {}) {
  const selectedIds = [...new Set(selectedContentIds ?? [])];
  if (selectedIds.length === 0) throw new Error('Select at least one contentId');
  const selected = selectedIds.map((contentId) => {
    const matches = results.filter((entry) => entry.contentId === contentId);
    if (matches.length !== 1) throw new Error(`Selected contentId is not uniquely present in current results: ${contentId}`);
    return matches[0];
  });
  const consumers = library.consumers ?? [];
  const consumer = consumerId ? consumers.find((entry) => entry.consumerId === consumerId) : null;
  if (consumerId && !consumer) throw new Error(`Unknown registered consumer: ${consumerId}`);
  if (consumer) {
    if (!outputName) throw new Error('Registered consumer selection requires outputName');
    if (outputName.includes('..') || outputName.includes('/') || outputName.includes('\\')) throw new Error('outputName must be one safe folder name');
    approvedPrivateRoot = consumer.privateRoot;
    outputRoot = resolve(approvedPrivateRoot, outputName);
  }
  const registeredRoots = consumers.map((entry) => resolve(entry.privateRoot));
  const matchedConsumer = consumers.find((entry) => resolve(entry.privateRoot) === resolve(approvedPrivateRoot));
  if (!matchedConsumer) throw new Error('Approved private root is not registered in the committed consumer policy');
  const approvedRoot = await assertTrustedPrivatePath(approvedPrivateRoot, {
    trustedPrivateRoots: [...trustedPrivateRoots, ...registeredRoots], kind: 'directory', label: 'Approved private root', rejectSymlinks: true,
  });
  const destination = resolveRequiredAbsolute(outputRoot, 'Output root');
  if (!isContained(approvedRoot, destination) || destination === approvedRoot) {
    throw new Error('Output root must be a child of the approved private root');
  }
  if (isContained(repoRoot, destination) || isContained(destination, repoRoot)) {
    throw new Error('Public Git/repository output is prohibited');
  }
  if (isContained(library.objectRoot, destination) || isContained(destination, library.objectRoot)) {
    throw new Error('Handoff output and object root must be separate');
  }
  if (matchedConsumer.requireGitIgnored) await verifyConsumerDestination(approvedRoot, destination);
  await assertNoSymlinkSegments(approvedRoot, destination, 'Output root');
  const parent = dirname(destination);
  const parentInfo = await lstat(parent);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) throw new Error('Output parent must be a real directory');
  const parentReal = await realpath(parent);
  if (!isContained(await realpath(approvedRoot), parentReal)) throw new Error('Output parent escapes approved private root');
  await assertNoGitRepositoryPath(approvedRoot, parentReal);
  try {
    await lstat(destination);
    throw new Error('Output root already exists');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const handoff = {
    schema: 'munjanggun.assetLibraryHandoff.v1',
    version: '1.0',
    libraryId: library.pointer.libraryId,
    generatedAt,
    pointer: { path: library.pointerPath, updatedAt: library.pointer.updatedAt },
    authorityHashes: {
      pointerSha256: library.pointerSha256,
      anchorSha256: library.pointer.current.anchorSha256,
      rightsStateSha256: library.pointer.current.rightsStateSha256,
    },
    catalog: { path: library.catalogPath, sha256: library.pointer.current.catalogSha256 },
    selectionCount: selected.length,
    containsBinaryCopies: false,
    selected,
    usageNotice: {
      privateCodexSource: '내부 사용 가능',
      externalPublication: '각 자산의 externalPublication 상태와 차단 사유를 확인해야 함',
      publicGit: '공개 Git 저장 금지',
      consumer: { consumerId: matchedConsumer.consumerId, channel: matchedConsumer.channel },
    },
  };
  const partial = resolve(parent, `.${destination.split(/[\\/]/u).at(-1)}.partial-${randomUUID()}`);
  if (!isContained(parent, partial)) throw new Error('Partial output escaped output parent');
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

function summarizeResult(library, entry, objectPath, score, matchedDimensions, rank) {
  const privateAllowed = PRIVATE_CODEX_ALLOWED.has(library.rightsState?.effectiveAccess?.privateCodexSource);
  const externalBlockers = externalPublicationBlockers(library.rightsState, entry);
  const publicGitBlocked = library.rightsState?.effectiveAccess?.publicGit !== 'allowed';
  return {
    rank,
    score,
    contentId: entry.contentId,
    sha256: entry.sha256,
    mediaType: entry.mediaType,
    semanticSummary: entry.semanticSummary,
    ocrText: entry.ocrText,
    matchedDimensions,
    sourceRefs: entry.sourceRefs,
    objectPath,
    previewUrl: pathToFileURL(objectPath).href,
    usageStatus: {
      privateCodexSource: {
        status: privateAllowed ? 'usable' : 'blocked',
        label: privateAllowed ? '내부 사용 가능' : '내부 사용 차단',
        authority: `rightsState.effectiveAccess.privateCodexSource=${library.rightsState?.effectiveAccess?.privateCodexSource ?? 'missing'}`,
      },
      externalPublication: {
        status: externalBlockers.length === 0 ? 'eligible_for_guarded_extraction' : 'blocked',
        label: externalBlockers.length === 0 ? '외부 발행 전 추출 검증 필요' : '외부 발행 차단',
        blockers: externalBlockers,
      },
      publicGit: {
        status: publicGitBlocked ? 'blocked' : 'eligible_for_guarded_storage',
        label: publicGitBlocked ? '공개 Git 저장 금지' : '공개 Git 저장 전 검증 필요',
        blockers: publicGitBlocked ? [`rightsState.effectiveAccess.publicGit=${library.rightsState?.effectiveAccess?.publicGit ?? 'missing'}`] : [],
      },
    },
    catalogStatus: {
      rightsStatus: entry.rightsStatus,
      publishStatus: entry.publishStatus,
      humanReviewStatus: entry.humanReviewStatus,
      privacyStatus: entry.privacyStatus,
      claimReviewStatus: entry.claimReviewStatus,
      claimSignals: entry.claimSignals,
      privacySignals: entry.privacySignals,
    },
  };
}

function externalPublicationBlockers(rightsState, entry) {
  const blockers = [];
  const bundleStatus = rightsState?.effectiveAccess?.blogSnsPublication;
  if (!['allowed', 'eligible'].includes(bundleStatus)) blockers.push(`rightsState.blogSnsPublication=${bundleStatus ?? 'missing'}`);
  if (entry.humanReviewStatus !== 'reviewed') blockers.push(`humanReviewStatus=${entry.humanReviewStatus ?? 'missing'}`);
  if (entry.privacyStatus !== 'cleared') blockers.push(`privacyStatus=${entry.privacyStatus ?? 'missing'}`);
  if (!['verified', 'not_applicable'].includes(entry.claimReviewStatus)) blockers.push(`claimReviewStatus=${entry.claimReviewStatus ?? 'missing'}`);
  if (entry.claimReviewStatus === 'not_applicable' && entry.claimSignals?.length > 0) blockers.push('claimSignalsConsistency=invalid');
  if (!['eligible', 'published'].includes(entry.publishStatus)) blockers.push(`publishStatus=${entry.publishStatus ?? 'missing'}`);
  return blockers;
}

function validateCatalogShape(catalog) {
  if (!catalog || !Array.isArray(catalog.entries)) throw new Error('Current catalog entries must be an array');
  const contentIds = new Set();
  const hashes = new Set();
  for (const [index, entry] of catalog.entries.entries()) {
    const label = `Catalog entry ${index}`;
    if (!entry || typeof entry !== 'object') throw new Error(`${label} must be an object`);
    if (!entry.contentId || contentIds.has(entry.contentId)) throw new Error(`${label} has missing or duplicate contentId`);
    if (!/^[a-f0-9]{64}$/u.test(entry.sha256 ?? '') || hashes.has(entry.sha256)) throw new Error(`${label} has invalid or duplicate sha256`);
    if (!entry.objectRef || !Number.isInteger(entry.byteSize) || entry.byteSize < 0) throw new Error(`${label} has invalid object metadata`);
    if (!Array.isArray(entry.sourceRefs)) throw new Error(`${label} sourceRefs must be an array`);
    contentIds.add(entry.contentId);
    hashes.add(entry.sha256);
  }
}

function validateRightsBinding(rightsState, catalogSha256, catalogIntakeId) {
  if (!rightsState || typeof rightsState !== 'object') throw new Error('Rights state must be an object');
  if (rightsState.catalogSha256 !== catalogSha256) throw new Error('Rights state catalog SHA does not match current catalog');
  if (catalogIntakeId && rightsState.intakeId && rightsState.intakeId !== catalogIntakeId) throw new Error('Rights state intakeId does not match current catalog');
  if (!PRIVATE_CODEX_ALLOWED.has(rightsState.effectiveAccess?.privateCodexSource)) {
    throw new Error('Current library is not approved for private Codex source use');
  }
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

function normalizeSearchText(value) {
  return String(value ?? '').toLocaleLowerCase('ko').replace(/[\s_-]+/gu, '');
}

function compactCriteria(criteria) {
  return Object.fromEntries(Object.entries(criteria ?? {})
    .map(([key, value]) => [key, String(value ?? '').trim()])
    .filter(([, value]) => value));
}

async function assertTrustedPrivatePath(inputPath, {
  trustedPrivateRoots, kind, label, rejectSymlinks,
}) {
  const target = resolveRequiredAbsolute(inputPath, label);
  const roots = trustedPrivateRoots.map((item) => resolve(item));
  let trustedRoot = roots.find((root) => isContained(root, target));
  let targetReal;
  if (!trustedRoot) {
    targetReal = await realpath(target);
    for (const root of roots) {
      const rootReal = await realpath(root);
      if (isContained(rootReal, targetReal)) {
        trustedRoot = rootReal;
        break;
      }
    }
  }
  if (!trustedRoot) throw new Error(`${label} is not in the trusted private-root policy`);
  const rootInfo = await lstat(trustedRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('Trusted private root must be a real directory');
  if (rejectSymlinks) await assertNoSymlinkSegments(trustedRoot, target, label);
  const info = await lstat(target);
  if (rejectSymlinks && info.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
  if (kind === 'file' && !info.isFile()) throw new Error(`${label} must be a file`);
  if (kind === 'directory' && !info.isDirectory()) throw new Error(`${label} must be a directory`);
  const rootReal = await realpath(trustedRoot);
  targetReal ??= await realpath(target);
  if (!isContained(rootReal, targetReal)) throw new Error(`${label} real path escapes trusted private root`);
  return targetReal;
}

async function assertRepositoryFile(inputPath, repoRoot, label) {
  const target = resolveRequiredAbsolute(inputPath, label);
  const root = resolve(repoRoot);
  if (!isContained(root, target)) throw new Error(`${label} must be inside the current repository`);
  await assertNoSymlinkSegments(root, target, label);
  const info = await lstat(target);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a real file`);
  const [rootReal, targetReal] = await Promise.all([realpath(root), realpath(target)]);
  if (!isContained(rootReal, targetReal)) throw new Error(`${label} real path escapes the current repository`);
  return targetReal;
}

async function assertNoSymlinkSegments(root, target, label) {
  const relation = relative(resolve(root), resolve(target));
  if (relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) throw new Error(`${label} escapes root`);
  let cursor = resolve(root);
  for (const segment of relation.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) throw new Error(`${label} path must not contain symbolic links`);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }
}

async function assertNoGitRepositoryPath(root, targetParent) {
  const relation = relative(resolve(root), resolve(targetParent));
  let cursor = resolve(root);
  for (const segment of ['', ...relation.split(sep).filter(Boolean)]) {
    if (segment) cursor = resolve(cursor, segment);
    try {
      await lstat(resolve(cursor, '.git'));
      throw new Error('Public Git/repository output is prohibited');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function resolveRequiredAbsolute(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty absolute path`);
  if (!isAbsolute(value)) throw new Error(`${label} must be an absolute path`);
  if (value.includes('\0') || value.split(/[\\/]/u).includes('..')) throw new Error(`${label} contains path traversal`);
  return resolve(value);
}

function isContained(root, child) {
  const relation = relative(resolve(root), resolve(child));
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
}

function assertDigest(bytes, expected, label) {
  const actual = digest(bytes);
  if (actual !== expected) throw new Error(`${label} SHA-256 mismatch`);
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function verifyAnchorChain({ anchor, catalog, catalogPath, rightsBundleRoot, rightsStatePath, trustedPrivateRoots }) {
  const targets = {
    ownerAttestation: resolve(rightsBundleRoot, 'owner-rights-attestation.json'),
    workerMapping: resolve(rightsBundleRoot, 'owner-attestation-mapping.json'),
    catalog: catalogPath,
    reviewEvidenceReceipt: resolve(dirname(catalogPath), catalog.reviewEvidenceReceiptRef),
    useEvidenceRegistry: resolve(rightsBundleRoot, 'use-evidence-registry.json'),
    useEvidenceReceipt: resolve(rightsBundleRoot, 'use-evidence-receipt.json'),
    ownerDecisions: resolve(rightsBundleRoot, 'owner-decisions.json'),
    ownerDecisionsReceipt: resolve(rightsBundleRoot, 'owner-decisions-receipt.json'),
    rightsState: rightsStatePath,
  };
  for (const [key, target] of Object.entries(targets)) {
    const path = await assertTrustedPrivatePath(target, { trustedPrivateRoots, kind: 'file', label: `Anchor ${key}`, rejectSymlinks: true });
    assertDigest(await readFile(path), anchor.hashes[key], `Anchor ${key}`);
  }
}

async function verifyGitCommittedAnchor(anchorPath, repoRoot, anchorBytes) {
  const relativePath = relative(resolve(repoRoot), anchorPath).replaceAll('\\', '/');
  if (!relativePath || relativePath.startsWith('../')) throw new Error('Owner order anchor is outside the current repository');
  try {
    await execFileAsync('git', ['-C', repoRoot, 'ls-files', '--error-unmatch', '--', relativePath], { windowsHide: true });
    const { stdout } = await execFileAsync('git', ['-C', repoRoot, 'show', `HEAD:${relativePath}`], { encoding: 'buffer', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    if (!Buffer.from(stdout).equals(Buffer.from(anchorBytes))) throw new Error('Owner order anchor working copy does not match HEAD');
  } catch (error) {
    if (/does not match HEAD/u.test(error.message)) throw error;
    throw new Error('Owner order anchor must be tracked and unchanged in HEAD');
  }
}

function validateConsumerPolicy(consumers) {
  if (!Array.isArray(consumers)) throw new Error('Consumer policy must be an array');
  const ids = new Set();
  const roots = new Set();
  for (const consumer of consumers) {
    if (!consumer || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(consumer.consumerId ?? '')) throw new Error('Consumer policy has an invalid consumerId');
    if (ids.has(consumer.consumerId)) throw new Error(`Duplicate consumerId: ${consumer.consumerId}`);
    if (!['private_codex', 'blog', 'sns'].includes(consumer.channel)) throw new Error(`Consumer ${consumer.consumerId} has an invalid channel`);
    const normalizedRoot = resolveRequiredAbsolute(consumer.privateRoot, `Consumer ${consumer.consumerId} privateRoot`).toLowerCase();
    if (roots.has(normalizedRoot)) throw new Error(`Duplicate consumer privateRoot: ${consumer.privateRoot}`);
    if (typeof consumer.requireGitIgnored !== 'boolean') throw new Error(`Consumer ${consumer.consumerId} requireGitIgnored must be boolean`);
    ids.add(consumer.consumerId);
    roots.add(normalizedRoot);
  }
}

async function verifyGitIgnoredConsumerDestination(approvedRoot, destination = approvedRoot) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', approvedRoot, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true });
    const gitRoot = stdout.trim();
    const relativeRoot = relative(gitRoot, approvedRoot).replaceAll('\\', '/');
    const relativeDestination = relative(gitRoot, destination).replaceAll('\\', '/');
    if (!relativeRoot || relativeRoot.startsWith('../')) throw new Error('registered private root is outside its Git repository');
    if (!relativeDestination || relativeDestination.startsWith('../')) throw new Error('handoff destination is outside its Git repository');
    await execFileAsync('git', ['-C', gitRoot, 'check-ignore', '--quiet', '--', relativeRoot], { windowsHide: true });
    await execFileAsync('git', ['-C', gitRoot, 'check-ignore', '--quiet', '--', relativeDestination], { windowsHide: true });
    const tracked = await execFileAsync('git', ['-C', gitRoot, 'ls-files', '--', relativeRoot], { encoding: 'utf8', windowsHide: true });
    if (tracked.stdout.trim()) throw new Error('registered private root contains tracked files');
  } catch (error) {
    if (/tracked files|outside its Git repository/u.test(error.message)) throw error;
    throw new Error('Registered consumer root and handoff destination must currently be Git-ignored');
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function renderPreviewHtml(handoff) {
  const cards = handoff.selected.map((entry) => `
    <article>
      <h2>${escapeHtml(entry.semanticSummary || entry.contentId)}</h2>
      <img src="${escapeHtml(entry.previewUrl)}" alt="${escapeHtml(entry.semanticSummary || entry.contentId)}">
      <p><strong>${escapeHtml(entry.usageStatus.privateCodexSource.label)}</strong></p>
      <p>${escapeHtml(entry.usageStatus.externalPublication.label)}</p>
      <p class="path">${escapeHtml(entry.objectPath)}</p>
      ${entry.usageStatus.externalPublication.blockers.length ? `<ul>${entry.usageStatus.externalPublication.blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
    </article>`).join('');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>문장군 공용 자산 미리보기</title><style>
body{font-family:system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 20px;color:#202124}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{border:1px solid #ddd;border-radius:12px;padding:16px}img{display:block;width:100%;height:320px;object-fit:contain;background:#f4f4f4}.path{word-break:break-all;color:#666;font-size:12px}h1{font-size:26px}h2{font-size:17px}</style></head>
<body><h1>문장군 공용 자산 미리보기</h1><p>바이너리 복사 없이 비공개 object를 참조합니다. 공개 Git 저장은 금지됩니다.</p><main>${cards}</main></body></html>\n`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
