import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = resolve('.');

test('catalog search finds semantic text and content extraction preserves bytes', async () => {
  const root = join(tmpdir(), `mg-catalog-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const objectRoot = join(root, 'objects');
  const outputRoot = join(root, 'output');
  const body = Buffer.from('asset-body');
  const sha256 = createHash('sha256').update(body).digest('hex');
  const objectPath = join(objectRoot, 'sha256', sha256.slice(0, 2), `${sha256}.jpg`);
  const catalogPath = join(root, 'catalog.json');
  await mkdir(join(objectPath, '..'), { recursive: true });
  await writeFile(objectPath, body);
  await writeFile(catalogPath, JSON.stringify({
    entries: [{
      contentId: 'CONTENT-TEST-SAFETY',
      sha256,
      byteSize: body.length,
      mediaType: 'image/jpeg',
      semanticSummary: '손 끼임 안전 안내',
      ocrText: '안전 커버',
      humanReviewStatus: 'reviewed',
      claimSignals: [],
      privacySignals: [],
      rightsSignals: ['source_rights_unverified'],
      sourceRefs: [{ sourceId: 'SRC-TEST', sourceRelativePath: '상품/안전.jpg' }],
    }],
  }));

  const search = await execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-search-catalog.mjs'),
    '--catalog', catalogPath,
    '--query', '손 끼임',
  ]);
  assert.equal(JSON.parse(search.stdout).results[0].contentId, 'CONTENT-TEST-SAFETY');

  const extracted = await execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/assets-extract-content.mjs'),
    '--catalog', catalogPath,
    '--object-root', objectRoot,
    '--output-root', outputRoot,
    '--content-id', 'CONTENT-TEST-SAFETY',
  ]);
  const outputPath = JSON.parse(extracted.stdout).outputPath;
  assert.deepEqual(await readFile(outputPath), body);
});
