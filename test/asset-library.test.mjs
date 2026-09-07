import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { runAssetLibrary } from '../scripts/assets-library.mjs';
import { searchAssetLibrary, searchAssetLibraryIndex, verifyGitCommittedConsumerPolicy } from '../scripts/lib/asset-library.mjs';

const execFileAsync = promisify(execFile);

test('private library searches any-size fixture and reports object and separate usage states', async () => {
  const fixture = await makeFixture(3);
  try {
    const output = await run(fixture, [
      '--query', '현관', '--product', '3연동 중문', '--scene', '현관 설치',
      '--color', '베이지', '--design', '모던', '--topic', '좁은 공간',
    ]);
    assert.equal(output.resultCount, 2);
    assert(output.results.every((item) => resolve(item.objectPath).startsWith(resolve(fixture.objectRoot))));
    assert(output.results.every((item) => item.usageStatus.privateCodexSource.label === '내부 사용 가능'));
    assert(output.results.every((item) => item.usageStatus.externalPublication.status === 'blocked'));
    assert(output.results.every((item) => item.usageStatus.publicGit.status === 'blocked'));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('library applies every detailed criterion before ranking and limit beyond 500 entries', async () => {
  const root = join(tmpdir(), `mg-asset-search-large-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const objectRoot = join(root, 'objects');
  await mkdir(objectRoot, { recursive: true });
  try {
    const distractors = Array.from({ length: 501 }, (_, index) => {
      const sha256 = digest(`distractor-${index}`);
      return catalogEntry({
        contentId: `DISTRACTOR-${index}`, sha256,
        semanticSummary: '공통 일반', ocrText: '공통', semanticGroupId: '공통', visualGroupId: '공통',
        sourceRelativePath: `공통/일반/${index}.jpg`,
      });
    });
    const body = Buffer.from('qualified-rare-asset');
    const sha256 = digest(body);
    const objectRef = `sha256/${sha256.slice(0, 2)}/${sha256}.jpg`;
    const objectPath = join(objectRoot, ...objectRef.split('/'));
    await mkdir(join(objectPath, '..'), { recursive: true });
    await writeFile(objectPath, body);
    const qualified = catalogEntry({
      contentId: 'QUALIFIED', sha256, objectRef, byteSize: body.length,
      semanticSummary: '공통 희귀', sourceRelativePath: '제품/희귀/qualified.jpg',
    });
    const library = {
      catalog: { entries: [...distractors, qualified] }, objectRoot,
      rightsState: { effectiveAccess: { privateCodexSource: 'allowed', blogSnsPublication: 'blocked', publicGit: 'blocked' } },
    };
    const results = await searchAssetLibrary(library, { query: '공통', color: '희귀' }, { limit: 1 });
    assert.deepEqual(results.map((entry) => entry.contentId), ['QUALIFIED']);
    assert.deepEqual(Object.keys(results[0].matchedDimensions).sort(), ['color', 'query']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('library index searches two intakes together and deduplicates one binary with every origin retained', async () => {
  const root = join(tmpdir(), `mg-asset-index-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    const sharedBody = Buffer.from('shared-binary');
    const sharedSha = digest(sharedBody);
    const first = await makeIndexedLibrary(root, 'POINTER-A', 'INTAKE-A', [
      { body: sharedBody, entry: catalogEntry({ contentId: 'A-SHARED', sha256: sharedSha, byteSize: sharedBody.length, semanticSummary: '현관 공용', sourceRelativePath: 'A/shared.jpg' }) },
      { body: Buffer.from('first-only'), entry: null, contentId: 'A-ONLY', summary: '현관 첫번째', path: 'A/only.jpg' },
    ]);
    const second = await makeIndexedLibrary(root, 'POINTER-B', 'INTAKE-B', [
      { body: sharedBody, entry: catalogEntry({ contentId: 'B-SHARED', sha256: sharedSha, byteSize: sharedBody.length, semanticSummary: '현관 공용', sourceRelativePath: 'B/shared.jpg' }) },
      { body: Buffer.from('second-only'), entry: null, contentId: 'B-ONLY', summary: '현관 두번째', path: 'B/only.jpg' },
    ]);
    const results = await searchAssetLibraryIndex({ libraries: [first, second] }, { query: '현관' }, { limit: 10 });
    assert.equal(results.length, 3);
    const shared = results.find((entry) => entry.sha256 === sharedSha);
    assert.deepEqual(shared.origins.map((origin) => origin.pointerId).sort(), ['POINTER-A', 'POINTER-B']);
    assert(results.some((entry) => entry.contentId === 'A-ONLY'));
    assert(results.some((entry) => entry.contentId === 'B-ONLY'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('consumer policy verification accepts checkout EOL conversion but rejects canonical content changes', async () => {
  const root = join(tmpdir(), `mg-policy-git-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const policyPath = join(root, 'policy.json');
  await mkdir(root, { recursive: true });
  try {
    await execFileAsync('git', ['init'], { cwd: root, windowsHide: true });
    await execFileAsync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root, windowsHide: true });
    await execFileAsync('git', ['config', 'user.name', 'Asset Test'], { cwd: root, windowsHide: true });
    await execFileAsync('git', ['config', 'core.autocrlf', 'true'], { cwd: root, windowsHide: true });
    await writeFile(join(root, '.gitattributes'), 'policy.json text\n');
    const policy = '[\n  {"consumerId":"one"}\n]\n';
    await writeFile(policyPath, policy);
    await execFileAsync('git', ['add', '.gitattributes', 'policy.json'], { cwd: root, windowsHide: true });
    await execFileAsync('git', ['commit', '-m', 'fixture'], { cwd: root, windowsHide: true });
    await writeFile(policyPath, policy.replaceAll('\n', '\r\n'));
    await verifyGitCommittedConsumerPolicy(policyPath, root);
    await writeFile(policyPath, policy.replace('"one"', '"two"').replaceAll('\n', '\r\n'));
    await assert.rejects(verifyGitCommittedConsumerPolicy(policyPath, root), /Consumer policy working tree/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('selection atomically writes only JSON handoff and HTML preview without copying binaries', async () => {
  const fixture = await makeFixture(2);
  try {
    const outputRoot = join(fixture.outputParent, 'selection-001');
    let destinationChecks = 0;
    const output = await run(fixture, [
      '--query', '현관', '--select-content-id', 'CONTENT-0', '--output-root', outputRoot,
      '--approved-private-root', fixture.root,
    ], { verifyConsumerDestination: async () => { destinationChecks += 1; } });
    assert.equal(output.handoff.containsBinaryCopies, false);
    assert.deepEqual((await readdir(outputRoot)).sort(), ['asset-handoff.json', 'preview.html']);
    const handoff = JSON.parse(await readFile(join(outputRoot, 'asset-handoff.json'), 'utf8'));
    assert.equal(handoff.selectionCount, 1);
    assert.equal(handoff.containsBinaryCopies, false);
    assert.equal(handoff.selected[0].contentId, 'CONTENT-0');
    assert.match(await readFile(join(outputRoot, 'preview.html'), 'utf8'), /file:\/\//u);
    assert.equal(destinationChecks, 1);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('consumer policy rejects duplicate destination roots', async () => {
  const fixture = await makeFixture(1);
  try {
    await assert.rejects(runAssetLibrary(['--pointer', fixture.pointerPath, '--query', '현관'], {
      emit: () => {},
      libraryOptions: {
        trustedPrivateRoots: [fixture.root], repoRoot: fixture.root, verifyCommittedAnchor: async () => {},
        consumerPolicy: [
          { consumerId: 'first', channel: 'blog', privateRoot: fixture.root, requireGitIgnored: true },
          { consumerId: 'second', channel: 'sns', privateRoot: fixture.root, requireGitIgnored: true },
        ],
      },
    }), /Duplicate consumer privateRoot/u);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('consumer policy rejects parent and child destination roots', async () => {
  const fixture = await makeFixture(1);
  try {
    await assert.rejects(runAssetLibrary(['--pointer', fixture.pointerPath, '--query', '현관'], {
      emit: () => {},
      libraryOptions: {
        trustedPrivateRoots: [fixture.root], repoRoot: fixture.root, verifyCommittedAnchor: async () => {},
        consumerPolicy: [
          { consumerId: 'parent', channel: 'blog', privateRoot: fixture.root, requireGitIgnored: true },
          { consumerId: 'child', channel: 'sns', privateRoot: join(fixture.root, 'nested'), requireGitIgnored: true },
        ],
      },
    }), /must not overlap/u);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('registered consumer creates a handoff by project name without exposing storage paths', async () => {
  const fixture = await makeFixture(1);
  try {
    const output = await run(fixture, [
      '--query', '현관', '--select-content-id', 'CONTENT-0', '--consumer', 'fixture-consumer', '--output-name', 'selection-by-project',
    ]);
    assert.equal(output.handoff.outputRoot, join(fixture.root, 'selection-by-project'));
    assert.equal(output.handoff.containsBinaryCopies, false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('pointer integrity, traversal, symlink, and public repository output fail closed', async (t) => {
  const fixture = await makeFixture(1);
  try {
    const pointer = JSON.parse(await readFile(fixture.pointerPath, 'utf8'));
    pointer.current.rightsStateRef = '../rights-state.json';
    await writeFile(fixture.pointerPath, `${JSON.stringify(pointer)}\n`);
    await assert.rejects(run(fixture, ['--query', '현관']), /schema failed|unsafe|traversal/u);

    await writePointer(fixture);
    await writeFile(fixture.anchorPath, `${fixture.anchorText}tampered`);
    await assert.rejects(run(fixture, ['--query', '현관']), /anchor SHA-256 mismatch/u);
    await writeFile(fixture.anchorPath, fixture.anchorText);
    const publicRepo = join(fixture.root, 'public-repo');
    await mkdir(publicRepo);
    await assert.rejects(run(fixture, [
      '--query', '현관', '--select-content-id', 'CONTENT-0', '--output-root', join(publicRepo, 'out'),
      '--approved-private-root', fixture.root,
    ], { repoRoot: publicRepo }), /Public Git\/repository output is prohibited/u);

    const nestedGit = join(fixture.root, 'nested-git');
    await mkdir(join(nestedGit, '.git'), { recursive: true });
    await assert.rejects(run(fixture, [
      '--query', '현관', '--select-content-id', 'CONTENT-0', '--output-root', join(nestedGit, 'out'),
      '--approved-private-root', fixture.root,
    ]), /Public Git\/repository output is prohibited/u);

    const realOutputParent = join(fixture.root, 'real-output-parent');
    const linkedOutputParent = join(fixture.root, 'linked-output-parent');
    await mkdir(realOutputParent);
    try {
      await symlink(realOutputParent, linkedOutputParent, 'junction');
    } catch (error) {
      if (['EPERM', 'EACCES', 'UNKNOWN'].includes(error.code)) {
        t.diagnostic(`symlink assertion skipped: ${error.code}`);
        return;
      }
      throw error;
    }
    await assert.rejects(run(fixture, [
      '--query', '현관', '--select-content-id', 'CONTENT-0', '--output-root', join(linkedOutputParent, 'out'),
      '--approved-private-root', fixture.root,
    ]), /symbolic links/u);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

async function run(fixture, extra, handoffOptions = {}) {
  return runAssetLibrary(['--pointer', fixture.pointerPath, ...extra], {
    emit: () => {},
    libraryOptions: {
      trustedPrivateRoots: [fixture.root], repoRoot: fixture.root, verifyCommittedAnchor: async () => {},
      consumerPolicy: [{ consumerId: 'fixture-consumer', channel: 'blog', privateRoot: fixture.root, requireGitIgnored: true }],
    },
    handoffOptions: { trustedPrivateRoots: [fixture.root], repoRoot: fixture.repoRoot, verifyConsumerDestination: async () => {}, ...handoffOptions },
  });
}

async function makeFixture(count) {
  const root = join(tmpdir(), `mg-asset-library-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const catalogPath = join(root, 'catalog.json');
  const objectRoot = join(root, 'objects');
  const rightsBundleRoot = join(root, 'rights');
  const outputParent = join(root, 'output');
  const repoRoot = join(root, 'not-the-repo');
  const pointerPath = join(root, 'CURRENT.json');
  const anchorPath = join(root, 'owner-order-anchor.json');
  await mkdir(root, { recursive: true });
  await Promise.all([mkdir(objectRoot, { recursive: true }), mkdir(rightsBundleRoot), mkdir(outputParent), mkdir(repoRoot)]);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const body = Buffer.from(`asset-${index}`);
    const sha256 = digest(body);
    const objectRef = `sha256/${sha256.slice(0, 2)}/${sha256}.jpg`;
    const objectPath = join(objectRoot, ...objectRef.split('/'));
    await mkdir(join(objectPath, '..'), { recursive: true });
    await writeFile(objectPath, body);
    entries.push({
      contentId: `CONTENT-${index}`,
      sha256,
      objectRef,
      byteSize: body.length,
      mediaType: 'image/jpeg',
      semanticSummary: index < 2 ? '3연동 중문 현관 설치 베이지 모던 좁은 공간' : '스윙 중문 거실 화이트 클래식 넓은 공간',
      ocrText: '', semanticGroupId: null, visualGroupId: null,
      humanReviewStatus: 'reviewed', claimSignals: [], privacySignals: [], rightsSignals: [],
      rightsStatus: 'pending', rightsScope: ['private_codex_source', 'external_reuse'], rightsEvidenceRef: ['RIGHTS-EV-TEST'],
      privacyStatus: 'cleared', claimReviewStatus: 'not_applicable', claimEvidenceRef: [],
      publishStatus: 'blocked', publicRepoEligibility: 'not_reviewed',
      sourceRefs: [{ sourceId: 'SRC-FIXTURE', sourceRelativePath: index < 2 ? `3연동중문/현관/베이지/모던/${index}.jpg` : `스윙중문/거실/${index}.jpg` }],
    });
  }
  const catalog = { schema: 'fixture', version: '1', intakeId: 'INTAKE-20990101-01', reviewEvidenceReceiptRef: 'review-evidence-receipt.json', entries };
  const catalogText = `${JSON.stringify(catalog, null, 2)}\n`;
  await writeFile(catalogPath, catalogText);
  const rightsState = {
    schema: 'fixture', version: '1', intakeId: catalog.intakeId, catalogSha256: digest(catalogText),
    effectiveAccess: {
      privateCodexSource: 'allowed_by_recorded_owner_order',
      blogSnsPublication: 'blocked_pending_signature_claim_privacy_and_human_review',
      publicGit: 'blocked_owner_pending',
    },
  };
  const rightsStateText = `${JSON.stringify(rightsState, null, 2)}\n`;
  await writeFile(join(rightsBundleRoot, 'rights-state.json'), rightsStateText);
  const chainText = '{}\n';
  await Promise.all([
    'owner-rights-attestation.json', 'owner-attestation-mapping.json', 'use-evidence-registry.json',
    'use-evidence-receipt.json', 'owner-decisions.json', 'owner-decisions-receipt.json',
  ].map((name) => writeFile(join(rightsBundleRoot, name), chainText)));
  await writeFile(join(root, 'review-evidence-receipt.json'), chainText);
  const anchor = {
    schema: 'munjanggun.assetOwnerOrderAnchor.v1', version: '1.0', intakeId: catalog.intakeId,
    recordedAt: '2099-01-01T00:00:00.000Z', authorityStatus: 'owner_approved_recorded',
    allowedChannels: ['private_codex', 'blog', 'sns'], publicGitStorage: false,
    hashes: {
      ownerAttestation: digest(chainText), workerMapping: digest(chainText), catalog: digest(catalogText),
      reviewEvidenceReceipt: digest(chainText), useEvidenceRegistry: digest(chainText), useEvidenceReceipt: digest(chainText),
      ownerDecisions: digest(chainText), ownerDecisionsReceipt: digest(chainText), rightsState: digest(rightsStateText),
    },
  };
  const anchorText = `${JSON.stringify(anchor, null, 2)}\n`;
  await writeFile(anchorPath, anchorText);
  const fixture = { root, catalogPath, objectRoot, rightsBundleRoot, outputParent, repoRoot, pointerPath, anchorPath, anchorText, catalogText, rightsStateText };
  await writePointer(fixture);
  return fixture;
}

async function writePointer(fixture) {
  const pointer = {
    schema: 'munjanggun.assetLibraryPointer.v1', version: '1.0', libraryId: 'fixture-library', updatedAt: '2099-01-01T00:00:00.000Z',
    current: {
      catalogPath: fixture.catalogPath, catalogSha256: digest(fixture.catalogText), objectRoot: fixture.objectRoot,
      rightsBundleRoot: fixture.rightsBundleRoot, rightsStateRef: 'rights-state.json', rightsStateSha256: digest(fixture.rightsStateText),
      anchorPath: fixture.anchorPath, anchorSha256: digest(fixture.anchorText),
    },
  };
  await writeFile(fixture.pointerPath, `${JSON.stringify(pointer, null, 2)}\n`);
}

function catalogEntry({
  contentId, sha256, objectRef = `sha256/${sha256.slice(0, 2)}/${sha256}.jpg`, byteSize = 1,
  semanticSummary = '', ocrText = '', semanticGroupId = null, visualGroupId = null, sourceRelativePath,
}) {
  return {
    contentId, sha256, objectRef, byteSize, mediaType: 'image/jpeg', semanticSummary, ocrText, semanticGroupId, visualGroupId,
    humanReviewStatus: 'reviewed', claimSignals: [], privacySignals: [], rightsSignals: [],
    rightsStatus: 'owner_approved_recorded', rightsScope: ['private_codex_source'], rightsEvidenceRef: ['RIGHTS-EV-TEST'],
    privacyStatus: 'cleared', claimReviewStatus: 'not_applicable', claimEvidenceRef: [],
    publishStatus: 'blocked', publicRepoEligibility: 'prohibited',
    sourceRefs: [{ sourceId: 'SRC-FIXTURE', sourceRelativePath }],
  };
}

async function makeIndexedLibrary(root, pointerId, intakeId, specs) {
  const objectRoot = join(root, pointerId, 'objects');
  await mkdir(objectRoot, { recursive: true });
  const entries = [];
  for (const spec of specs) {
    const sha256 = digest(spec.body);
    const entry = spec.entry ?? catalogEntry({
      contentId: spec.contentId,
      sha256,
      byteSize: spec.body.length,
      semanticSummary: spec.summary,
      sourceRelativePath: spec.path,
    });
    const objectPath = join(objectRoot, ...entry.objectRef.split('/'));
    await mkdir(join(objectPath, '..'), { recursive: true });
    await writeFile(objectPath, spec.body);
    entries.push(entry);
  }
  return {
    pointerId,
    pointerSha256: digest(pointerId),
    library: {
      pointerPath: join(root, pointerId, 'pointer.json'),
      pointer: {
        current: {
          anchorSha256: digest(`${pointerId}-anchor`),
          catalogSha256: digest(`${pointerId}-catalog`),
          rightsStateSha256: digest(`${pointerId}-rights`),
        },
      },
      catalog: { intakeId, entries },
      objectRoot,
      rightsState: { effectiveAccess: { privateCodexSource: 'allowed', blogSnsPublication: 'blocked', publicGit: 'blocked' } },
    },
  };
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}
