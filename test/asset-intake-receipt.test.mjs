import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { compareInventories, inventoryTree } from '../scripts/lib/asset-inventory.mjs';
import { assertSafeRelativePath, resolveContainedPath } from '../scripts/lib/asset-paths.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = resolve('.');

test('inventory records managed files and ignored system cache separately', async () => {
  const root = await makeTempDir('inventory');
  await mkdir(join(root, '상품'), { recursive: true });
  await writeFile(join(root, '상품', '001.jpg'), 'image');
  await writeFile(join(root, '상품', 'product.url'), '[InternetShortcut]');
  await writeFile(join(root, '상품', 'asset-manifest.json'), '{}');
  await writeFile(join(root, '상품', 'Thumbs.db'), 'cache');

  const inventory = await inventoryTree(root);

  assert.deepEqual(inventory.counts, {
    all: 4,
    managed: 3,
    visual: 1,
    url: 1,
    manifest: 1,
    ignoredSystemCache: 1,
    allBytes: 30,
    managedBytes: 25,
  });
  assert.equal(inventory.entries.find((entry) => entry.sourceRelativePath.endsWith('Thumbs.db')).disposition, 'ignored_system_cache');
  assert.match(inventory.treeHash, /^[a-f0-9]{64}$/);
});

test('inventory comparison catches missing, extra, size, and hash mismatches', () => {
  const source = [
    entry('a.jpg', 1, 'a'),
    entry('b.jpg', 2, 'b'),
    entry('c.jpg', 3, 'c'),
  ];
  const recovery = [
    entry('a.jpg', 1, 'z'),
    entry('b.jpg', 9, 'b'),
    entry('d.jpg', 4, 'd'),
  ];

  assert.deepEqual(compareInventories(source, recovery), {
    missing: ['c.jpg'],
    extra: ['d.jpg'],
    sizeMismatch: ['b.jpg'],
    hashMismatch: ['a.jpg'],
    status: 'failed',
  });
});

test('safe relative paths reject traversal and Windows absolute paths', () => {
  assert.equal(assertSafeRelativePath('문장군상품/테스트/001.jpg'), '문장군상품/테스트/001.jpg');
  for (const unsafe of ['../secret.jpg', 'a/../secret.jpg', 'C:/secret.jpg', '\\\\server\\share\\x.jpg', 'a\\b.jpg', '/root.jpg']) {
    assert.throws(() => assertSafeRelativePath(unsafe));
  }
  assert.throws(() => resolveContainedPath(repoRoot, '../outside.jpg'));
});

test('receipt generator and validator prove a byte-identical recovery copy', async () => {
  const root = await makeTempDir('receipt');
  const source = join(root, 'source');
  const recovery = join(root, 'recovery');
  const receipt = join(root, 'receipt.json');
  await mkdir(join(source, '상품'), { recursive: true });
  await writeFile(join(source, '상품', '001.jpg'), 'image');
  await writeFile(join(source, '상품', 'Thumbs.db'), 'cache');
  await cp(source, recovery, { recursive: true });

  const generated = await execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/generate-intake-receipt.mjs'),
    '--source', source,
    '--recovery', recovery,
    '--output', receipt,
    '--intake-id', 'INTAKE-20260904-01',
  ]);
  assert.match(generated.stdout, /Verified 2 files/);

  const checked = await execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/check-intake-receipt.mjs'),
    '--receipt', receipt,
    '--source', source,
    '--recovery', recovery,
  ]);
  assert.match(checked.stdout, /validation passed/);

  const parsed = JSON.parse(await readFile(receipt, 'utf8'));
  assert.equal(parsed.counts.all, 2);
  assert.equal(parsed.counts.managed, 1);
  assert.equal(parsed.counts.ignoredSystemCache, 1);
  assert.equal(parsed.sourceTreeHash, parsed.recoveryTreeHash);
});

test('receipt validator rejects a recovery copy changed after sealing', async () => {
  const root = await makeTempDir('tamper');
  const source = join(root, 'source');
  const recovery = join(root, 'recovery');
  const receipt = join(root, 'receipt.json');
  await mkdir(source, { recursive: true });
  await mkdir(recovery, { recursive: true });
  await writeFile(join(source, '001.jpg'), 'before');
  await writeFile(join(recovery, '001.jpg'), 'before');
  await execFileAsync(process.execPath, [
    join(repoRoot, 'scripts/generate-intake-receipt.mjs'),
    '--source', source,
    '--recovery', recovery,
    '--output', receipt,
    '--intake-id', 'INTAKE-20260904-01',
  ]);
  await writeFile(join(recovery, '001.jpg'), 'after');

  await assert.rejects(
    execFileAsync(process.execPath, [
      join(repoRoot, 'scripts/check-intake-receipt.mjs'),
      '--receipt', receipt,
      '--source', source,
      '--recovery', recovery,
    ]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /source and recovery copy differ/);
      return true;
    },
  );
});

async function makeTempDir(label) {
  const root = join(tmpdir(), `mg-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  return root;
}

function entry(path, byteSize, marker) {
  return {
    sourceRelativePath: path,
    byteSize,
    sha256: marker.repeat(64),
  };
}
