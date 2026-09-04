import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = resolve('.');
const pixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=', 'base64');

test('candidate generator creates metadata only and a deduplicated object store', async () => {
  const root = join(tmpdir(), `mg-candidate-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const source = join(root, 'source');
  const recovery = join(root, 'recovery');
  const receipt = join(root, 'receipt.json');
  const candidate = join(root, 'candidate');
  const objects = join(root, 'objects');
  await mkdir(join(source, '3연동중문', '컬렉션'), { recursive: true });
  await writeFile(join(source, '3연동중문', '001.png'), pixelPng);
  await writeFile(join(source, '3연동중문', '컬렉션', '001.png'), pixelPng);
  await cp(source, recovery, { recursive: true });

  await run('scripts/generate-intake-receipt.mjs', [
    '--source', source, '--recovery', recovery, '--output', receipt, '--intake-id', 'INTAKE-20260904-01',
  ]);
  const generated = await run('scripts/generate-candidate-manifests.mjs', [
    '--source', source, '--receipt', receipt, '--output-root', candidate, '--intake-id', 'INTAKE-20260904-01',
  ]);
  assert.match(generated.stdout, /2 visual paths, 1 binary groups/);

  const manifestPath = join(candidate, 'manifests', '3연동중문', 'asset-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.assets.length, 2);
  assert.equal(manifest.assets[0].objectRef, manifest.assets[1].objectRef);
  assert(manifest.assets.every((asset) => asset.publishStatus === 'blocked'));
  assert(manifest.assets.every((asset) => asset.publicRepoEligibility === 'not_reviewed'));

  const built = await run('scripts/assets-build-object-store.mjs', [
    '--source-root', source, '--object-root', objects, '--manifest', manifestPath,
  ]);
  assert.match(built.stdout, /1 objects \(1 copied, 0 reused\)/);
  const verified = await run('scripts/assets-verify-objects.mjs', [
    '--object-root', objects, '--manifest', manifestPath,
  ]);
  assert.match(verified.stdout, /1 unique objects for 2 logical paths/);
});

async function run(script, args) {
  return execFileAsync(process.execPath, [join(repoRoot, script), ...args]);
}
