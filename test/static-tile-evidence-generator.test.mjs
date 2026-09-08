import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { generateStaticTileEvidence } from '../scripts/lib/static-tile-evidence-generator.mjs';
import { computeStaticTileCoverageDigest } from '../scripts/lib/asset-content-revalidation.mjs';
import { encodeRgbaPng, readCropPngPixels, staticPixelDigest } from '../scripts/lib/static-image-region-pixels.mjs';

const execFileAsync = promisify(execFile);

test('generates deterministic canonical native-resolution tiles and a contract-compatible manifest', async (t) => {
  const fixture = await makeFixture(t, { width: 5, height: 3 });
  const outputRoot = resolve(fixture.root, 'evidence-output');
  const result = await generateStaticTileEvidence({
    queuePath: fixture.queuePath, sha256: fixture.sha256, outputRoot, maxTileSize: 2,
    allowedEvidenceBase: fixture.root,
  });
  assert.equal(result.entries[0].tileCount, 6);
  const manifestBytes = await readFile(result.entries[0].manifestRef);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  assert.equal(manifest.coverageDigest, computeStaticTileCoverageDigest(manifest));
  assert.equal(manifest.sourcePixelSha256, staticPixelDigest(5, 3, fixture.rgba));
  assert.deepEqual(manifest.tiles.map((tile) => tile.pixelRegion), [
    { left: 0, top: 0, width: 2, height: 2 },
    { left: 2, top: 0, width: 2, height: 2 },
    { left: 4, top: 0, width: 1, height: 2 },
    { left: 0, top: 2, width: 2, height: 1 },
    { left: 2, top: 2, width: 2, height: 1 },
    { left: 4, top: 2, width: 1, height: 1 },
  ]);
  for (const tile of manifest.tiles) {
    const bytes = await readFile(tile.path);
    assert.equal(digest(bytes), tile.sha256);
    const decoded = readCropPngPixels(bytes);
    assert.equal(decoded.pixelSha256, tile.pixelSha256);
    assert.ok(tile.width <= 2 && tile.height <= 2);
  }
  assert.equal(JSON.parse(await readFile(resolve(outputRoot, 'index.json'), 'utf8')).outputWritten, true);
});

test('dry-run rehashes and decodes but writes nothing; inventory only enumerates', async (t) => {
  const fixture = await makeFixture(t);
  const dryRoot = resolve(fixture.root, 'dry-output');
  const dry = await generateStaticTileEvidence({
    queuePath: fixture.queuePath, allStatic: true, outputRoot: dryRoot, mode: 'dry-run',
    allowedEvidenceBase: fixture.root,
  });
  assert.equal(dry.sourceVerificationPerformed, true);
  await assert.rejects(stat(dryRoot), { code: 'ENOENT' });
  const inventory = await generateStaticTileEvidence({ queuePath: fixture.queuePath, allStatic: true, mode: 'inventory' });
  assert.equal(inventory.selectedCount, 1);
  assert.equal(inventory.sourceVerificationPerformed, false);
  assert.equal(inventory.outputWritten, false);
});

test('requires an explicit single SHA or all-static selection', async (t) => {
  const fixture = await makeFixture(t);
  await assert.rejects(generateStaticTileEvidence({ queuePath: fixture.queuePath, mode: 'inventory' }), /exactly one/u);
  await assert.rejects(generateStaticTileEvidence({ queuePath: fixture.queuePath, sha256: fixture.sha256, allStatic: true, mode: 'inventory' }), /exactly one/u);
});

test('refuses overwrite and rejects a changed original before output', async (t) => {
  const fixture = await makeFixture(t);
  const outputRoot = resolve(fixture.root, 'evidence-output');
  await mkdir(outputRoot);
  await assert.rejects(generateStaticTileEvidence({
    queuePath: fixture.queuePath, sha256: fixture.sha256, outputRoot, allowedEvidenceBase: fixture.root,
  }), /already exists/u);
  await writeFile(fixture.originalPath, Buffer.from('changed'));
  await assert.rejects(generateStaticTileEvidence({
    queuePath: fixture.queuePath, sha256: fixture.sha256, outputRoot: resolve(fixture.root, 'other-output'),
    allowedEvidenceBase: fixture.root,
  }), /SHA-256 or size mismatch/u);
});

test('operational output defaults to Z drive and repository output is always rejected', async (t) => {
  const fixture = await makeFixture(t);
  await assert.rejects(generateStaticTileEvidence({
    queuePath: fixture.queuePath, sha256: fixture.sha256, outputRoot: resolve(fixture.root, 'outside-z'),
  }), /allowed Z:/u);
  await assert.rejects(generateStaticTileEvidence({
    queuePath: fixture.queuePath, sha256: fixture.sha256, outputRoot: resolve(fixture.root, 'repo', 'evidence'),
    repoRoot: resolve(fixture.root, 'repo'), allowedEvidenceBase: fixture.root,
  }), /outside the public repository/u);
});

test('rejects an output whose intermediate junction resolves outside the allowed evidence base', async (t) => {
  const fixture = await makeFixture(t);
  const outside = await mkdtemp(resolve(tmpdir(), 'static-tile-outside-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(outside, { recursive: true, force: true });
  });
  await mkdir(resolve(outside, 'parent'));
  const junction = resolve(fixture.root, 'junction');
  try {
    await symlink(outside, junction, 'junction');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('Junction creation is unavailable on this Windows host');
    throw error;
  }
  await assert.rejects(generateStaticTileEvidence({
    queuePath: fixture.queuePath,
    sha256: fixture.sha256,
    outputRoot: resolve(junction, 'parent', 'evidence-output'),
    allowedEvidenceBase: fixture.root,
  }), /allowed Z:/u);
});

test('CLI inventory reports the bounded selection without requiring or writing an output root', async (t) => {
  const fixture = await makeFixture(t);
  const { stdout } = await execFileAsync(process.execPath, [
    resolve('scripts/generate-static-tile-evidence.mjs'),
    '--queue', fixture.queuePath,
    '--sha256', fixture.sha256,
    '--inventory',
  ], { cwd: resolve('.') });
  const report = JSON.parse(stdout);
  assert.equal(report.mode, 'inventory');
  assert.equal(report.selectedCount, 1);
  assert.deepEqual(report.selectedSha256, [fixture.sha256]);
  assert.equal(report.outputWritten, false);
});

test('rejects symlink source paths instead of following them', async (t) => {
  const fixture = await makeFixture(t);
  const linkPath = resolve(fixture.rawRoot, 'linked.png');
  try {
    await symlink(fixture.originalPath, linkPath, 'file');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('Symlink creation is unavailable on this Windows host');
    throw error;
  }
  const queue = JSON.parse(await readFile(fixture.queuePath, 'utf8'));
  queue.entries[0].origins[0].sourceRelativePath = 'linked.png';
  queue.entries[0].origins[0].originalPath = linkPath;
  queue.entries[0].primaryOriginalPath = linkPath;
  queue.entrySetSha256 = digest(Buffer.from(JSON.stringify(queue.entries), 'utf8'));
  await writeFile(fixture.queuePath, jsonBytes(queue));
  await assert.rejects(generateStaticTileEvidence({
    queuePath: fixture.queuePath, sha256: fixture.sha256, outputRoot: resolve(fixture.root, 'evidence-output'),
    allowedEvidenceBase: fixture.root,
  }), /non-symlink/u);
});

async function makeFixture(t, { width = 3, height = 2 } = {}) {
  const root = await mkdtemp(resolve(tmpdir(), 'static-tile-evidence-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(root, { recursive: true, force: true });
  });
  const rawRoot = resolve(root, 'raw');
  const repo = resolve(root, 'repo');
  await mkdir(rawRoot);
  await mkdir(repo);
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    rgba.set([index * 7 % 256, index * 13 % 256, index * 17 % 256, 255], index * 4);
  }
  const originalBytes = encodeRgbaPng({ width, height, data: rgba });
  const sha256 = digest(originalBytes);
  const originalPath = resolve(rawRoot, 'image.png');
  await writeFile(originalPath, originalBytes);
  const entries = [{
    sha256, mediaType: 'image/png', byteSize: originalBytes.length, reviewMediaKind: 'static',
    primaryOriginalPath: originalPath, intakeIds: ['TEST-INTAKE'],
    origins: [{
      intakeId: 'TEST-INTAKE', catalogSha256: 'a'.repeat(64), sourceId: 'src',
      sourceRelativePath: 'image.png', originalPath,
    }],
  }];
  const queue = {
    schema: 'munjanggun.assetVisualReviewQueue.v1', version: '1.0', generatedAt: new Date().toISOString(),
    status: 'review_queue_only_not_authority',
    catalogs: [{ intakeId: 'TEST-INTAKE', catalogPath: resolve(root, 'catalog.json'), catalogSha256: 'a'.repeat(64), rawRoot, entryCount: 1 }],
    counts: { catalogCount: 1, logicalPathCount: 1, uniqueVisualCount: 1, staticCount: 1, gifCount: 0, crossIntakeDuplicateCount: 0 },
    entries, entrySetSha256: digest(Buffer.from(JSON.stringify(entries), 'utf8')),
  };
  const queuePath = resolve(root, 'review-queue.json');
  await writeFile(queuePath, jsonBytes(queue));
  return { root, rawRoot, repo, rgba, originalPath, queuePath, sha256 };
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
