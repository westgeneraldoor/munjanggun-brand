import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { buildVisualReviewQueue } from '../scripts/lib/asset-visual-review-queue.mjs';

test('visual review queue verifies every path and deduplicates a cross-intake GIF', async () => {
  const root = await mkdtemp(join(tmpdir(), 'munjanggun-review-queue-'));
  const shared = Buffer.from('shared gif bytes');
  const still = Buffer.from('still image bytes');
  const first = await fixture(root, 'INTAKE-20260904-01', [
    entry('shared.gif', shared, 'image/gif'),
    entry('still.jpg', still, 'image/jpeg'),
  ]);
  const second = await fixture(root, 'INTAKE-20260907-01', [entry('again.gif', shared, 'image/gif')]);
  const outputPath = resolve(root, 'review-queue.json');
  const result = await buildVisualReviewQueue({ sources: [first, second], generatedAt: '2026-09-08T00:00:00.000Z', outputPath });
  assert.deepEqual(result.counts, {
    catalogCount: 2, logicalPathCount: 3, uniqueVisualCount: 2, staticCount: 1, gifCount: 1, crossIntakeDuplicateCount: 1,
  });
  assert.equal(result.entries.find((item) => item.mediaType === 'image/gif').origins.length, 2);
  assert.equal(JSON.parse(await readFile(outputPath, 'utf8')).entrySetSha256, result.entrySetSha256);
});

test('visual review queue fails closed when a source file no longer matches its catalog hash', async () => {
  const root = await mkdtemp(join(tmpdir(), 'munjanggun-review-queue-'));
  const source = await fixture(root, 'INTAKE-20260904-01', [entry('still.png', Buffer.from('expected'), 'image/png')]);
  await writeFile(resolve(source.rawRoot, 'still.png'), Buffer.from('changed!'));
  await assert.rejects(buildVisualReviewQueue({ sources: [source] }), /SHA-256 mismatch/u);
});

test('visual review queue refuses to write private absolute paths into the public repository', async () => {
  const root = await mkdtemp(join(tmpdir(), 'munjanggun-review-queue-'));
  const source = await fixture(root, 'INTAKE-20260904-01', [entry('still.png', Buffer.from('expected'), 'image/png')]);
  await assert.rejects(
    buildVisualReviewQueue({ sources: [source], outputPath: resolve('review-queue-private.json') }),
    /outside the public repository/u,
  );
  await assert.rejects(
    buildVisualReviewQueue({ sources: [source], outputPath: 'review-queue-private.json' }),
    /absolute private path/u,
  );
});

function entry(path, bytes, mediaType) {
  return { path, bytes, mediaType, sha256: digest(bytes) };
}

async function fixture(root, intakeId, items) {
  const rawRoot = resolve(root, intakeId, 'raw');
  await mkdir(rawRoot, { recursive: true });
  const entries = [];
  for (const item of items) {
    await writeFile(resolve(rawRoot, item.path), item.bytes);
    entries.push({
      sha256: item.sha256,
      byteSize: item.bytes.length,
      mediaType: item.mediaType,
      sourceRefs: [{ sourceId: `${intakeId}-SOURCE`, sourceRelativePath: item.path }],
    });
  }
  const catalogPath = resolve(root, intakeId, 'catalog.json');
  await writeFile(catalogPath, `${JSON.stringify({ intakeId, entries })}\n`);
  return { catalogPath, rawRoot };
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}
