import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { activateAssetLibraryPointer } from '../scripts/lib/asset-library-pointer-updater.mjs';

test('pointer updater requires explicit CAS and preserves the previous bytes in history', async () => {
  const root = await makeRoot();
  const pointerPath = join(root, 'current.json');
  const first = fixturePointer('a');
  const second = fixturePointer('b');
  try {
    const created = await activateAssetLibraryPointer({ pointerPath, pointer: first, expectAbsent: true, validateActivation: async () => {} });
    assert.equal(created.result, 'created');
    const firstBytes = await readFile(pointerPath);
    const firstHash = digest(firstBytes);
    await assert.rejects(
      activateAssetLibraryPointer({ pointerPath, pointer: second, expectedCurrentSha256: '0'.repeat(64), validateActivation: async () => {} }),
      /CAS mismatch/u,
    );
    assert.equal(digest(await readFile(pointerPath)), firstHash);
    const updated = await activateAssetLibraryPointer({
      pointerPath, pointer: second, expectedCurrentSha256: firstHash,
      now: new Date('2099-01-02T03:04:05.000Z'), validateActivation: async () => {},
    });
    assert.equal(updated.result, 'updated');
    assert.deepEqual(await readFile(updated.historyPath), firstBytes);
    assert.equal((await readdir(join(root, 'history', 'activations'))).length, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('pointer updater is idempotent and does not create history for the same target', async () => {
  const root = await makeRoot();
  const pointerPath = join(root, 'current.json');
  const first = fixturePointer('a');
  try {
    await activateAssetLibraryPointer({ pointerPath, pointer: first, expectAbsent: true, validateActivation: async () => {} });
    const currentBytes = await readFile(pointerPath);
    const beforeHistory = (await readdir(join(root, 'history'), { recursive: true })).sort();
    const same = { ...first, updatedAt: '2100-01-01T00:00:00.000Z' };
    let validationCalls = 0;
    const result = await activateAssetLibraryPointer({
      pointerPath, pointer: same, expectedCurrentSha256: digest(currentBytes),
      validateActivation: async () => { validationCalls += 1; },
    });
    assert.equal(result.result, 'no_change');
    assert.equal(validationCalls, 1);
    assert.deepEqual(await readFile(pointerPath), currentBytes);
    assert.deepEqual((await readdir(join(root, 'history'), { recursive: true })).sort(), beforeHistory);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('transition failure restores the previous current pointer byte for byte', async () => {
  const root = await makeRoot();
  const pointerPath = join(root, 'current.json');
  try {
    await activateAssetLibraryPointer({ pointerPath, pointer: fixturePointer('a'), expectAbsent: true, validateActivation: async () => {} });
    const currentBytes = await readFile(pointerPath);
    await assert.rejects(activateAssetLibraryPointer({
      pointerPath, pointer: fixturePointer('b'), expectedCurrentSha256: digest(currentBytes), validateActivation: async () => {},
      transition: async ({ destination, state }) => {
        state.displacedPath = `${destination}.displaced-test`;
        await rename(destination, state.displacedPath);
        throw new Error('candidate rename failed');
      },
    }), /candidate rename failed/u);
    assert.deepEqual(await readFile(pointerPath), currentBytes);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('failure before displacement never removes the existing current pointer', async () => {
  const root = await makeRoot();
  const pointerPath = join(root, 'current.json');
  try {
    await activateAssetLibraryPointer({ pointerPath, pointer: fixturePointer('a'), expectAbsent: true, validateActivation: async () => {} });
    const currentBytes = await readFile(pointerPath);
    await assert.rejects(activateAssetLibraryPointer({
      pointerPath, pointer: fixturePointer('b'), expectedCurrentSha256: digest(currentBytes), validateActivation: async () => {},
      transition: async () => { throw new Error('initial rename failed'); },
    }), /initial rename failed/u);
    assert.deepEqual(await readFile(pointerPath), currentBytes);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('preflight failure leaves current and history unchanged', async () => {
  const root = await makeRoot();
  const pointerPath = join(root, 'current.json');
  const first = fixturePointer('a');
  try {
    await activateAssetLibraryPointer({ pointerPath, pointer: first, expectAbsent: true, validateActivation: async () => {} });
    const currentBytes = await readFile(pointerPath);
    const beforeHistory = (await readdir(join(root, 'history'), { recursive: true })).sort();
    await assert.rejects(activateAssetLibraryPointer({
      pointerPath, pointer: fixturePointer('b'), expectedCurrentSha256: digest(currentBytes),
      validateActivation: async () => { throw new Error('object hash mismatch'); },
    }), /object hash mismatch/u);
    assert.deepEqual(await readFile(pointerPath), currentBytes);
    assert.deepEqual((await readdir(join(root, 'history'), { recursive: true })).sort(), beforeHistory);
  } finally { await rm(root, { recursive: true, force: true }); }
});

async function makeRoot() {
  const root = join(tmpdir(), `mg-pointer-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  return root;
}

function fixturePointer(suffix) {
  return {
    schema: 'munjanggun.assetLibraryPointer.v1', version: '1.0', libraryId: 'fixture',
    updatedAt: `2099-01-0${suffix === 'a' ? '1' : '2'}T00:00:00.000Z`,
    current: {
      catalogPath: `C:\\private\\catalog-${suffix}.json`, catalogSha256: suffix.repeat(64),
      objectRoot: 'C:\\private\\objects', rightsBundleRoot: 'C:\\private\\rights', rightsStateRef: 'rights-state.json',
      rightsStateSha256: suffix.repeat(64), anchorPath: 'C:\\repo\\anchor.json', anchorSha256: suffix.repeat(64),
    },
  };
}

function digest(value) { return createHash('sha256').update(value).digest('hex'); }
