import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { loadAssetLibrary } from './asset-library.mjs';
import { resolveAssetObject } from './asset-resolver.mjs';

export async function activateAssetLibraryPointer({
  pointerPath,
  pointer,
  expectAbsent = false,
  expectedCurrentSha256,
  now = new Date(),
  validateActivation = validateFullActivation,
  transition = defaultTransition,
} = {}) {
  const destination = resolve(pointerPath);
  if (expectAbsent === Boolean(expectedCurrentSha256)) {
    throw new Error('Choose exactly one CAS mode: expectAbsent or expectedCurrentSha256');
  }
  if (expectedCurrentSha256 && !/^[a-f0-9]{64}$/u.test(expectedCurrentSha256)) throw new Error('expectedCurrentSha256 must be a lowercase SHA-256');
  await mkdir(dirname(destination), { recursive: true });
  const lockPath = `${destination}.lock`;
  await writeFile(lockPath, `${process.pid}\n`, { encoding: 'utf8', flag: 'wx' });
  let partialPath;
  try {
    const previousBytes = await readOptional(destination);
    const previousSha256 = previousBytes ? digest(previousBytes) : null;
    if (expectAbsent && previousBytes) throw new Error('Current pointer already exists');
    if (!expectAbsent && !previousBytes) throw new Error('Current pointer is absent');
    if (expectedCurrentSha256 && previousSha256 !== expectedCurrentSha256) throw new Error('Current pointer CAS mismatch');

    if (previousBytes && sameTarget(JSON.parse(previousBytes.toString('utf8')), pointer)) {
      return { result: 'no_change', pointerPath: destination, previousSha256, currentSha256: previousSha256 };
    }
    const nextBytes = Buffer.from(`${JSON.stringify(pointer, null, 2)}\n`, 'utf8');
    const nextSha256 = digest(nextBytes);
    if (previousSha256 === nextSha256) {
      return { result: 'no_change', pointerPath: destination, previousSha256, currentSha256: nextSha256 };
    }

    partialPath = resolve(dirname(destination), `.${basename(destination)}.candidate-${randomUUID()}`);
    await writeFile(partialPath, nextBytes, { flag: 'wx' });
    await validateActivation(partialPath);

    const timestamp = now.toISOString().replace(/[:.]/gu, '-');
    const historyRoot = resolve(dirname(destination), 'history');
    let historyPath = null;
    if (previousBytes) {
      await mkdir(historyRoot, { recursive: true });
      historyPath = resolve(historyRoot, `${timestamp}-${previousSha256}.json`);
      await writeFile(historyPath, previousBytes, { flag: 'wx' });
      if (digest(await readFile(historyPath)) !== previousSha256) throw new Error('Pointer history verification failed');
    }

    let displacedPath = null;
    try {
      displacedPath = await transition({ destination, partialPath, previousBytes });
      partialPath = null;
      await validateActivation(destination);
      const receipt = {
        schema: 'munjanggun.assetLibraryActivationReceipt.v1', version: '1.0', activatedAt: now.toISOString(),
        pointerPath: destination, previousSha256, currentSha256: nextSha256,
        catalogSha256: pointer.current.catalogSha256, anchorSha256: pointer.current.anchorSha256,
      };
      await mkdir(resolve(historyRoot, 'activations'), { recursive: true });
      const receiptPath = resolve(historyRoot, 'activations', `${timestamp}-${nextSha256}.json`);
      await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      if (displacedPath) await rm(displacedPath, { force: true });
      return { result: previousBytes ? 'updated' : 'created', pointerPath: destination, historyPath, receiptPath, previousSha256, currentSha256: nextSha256 };
    } catch (error) {
      await rollbackTransition({ destination, displacedPath, previousBytes });
      if (historyPath) await rm(historyPath, { force: true });
      throw error;
    }
  } finally {
    if (partialPath) await rm(partialPath, { force: true });
    await rm(lockPath, { force: true });
  }
}

export async function validateFullActivation(pointerPath) {
  const library = await loadAssetLibrary(pointerPath);
  for (const entry of library.catalog.entries) await resolveAssetObject(library.objectRoot, entry);
  return library;
}

async function defaultTransition({ destination, partialPath, previousBytes }) {
  let displacedPath = null;
  if (previousBytes) {
    displacedPath = `${destination}.displaced-${randomUUID()}`;
    await rename(destination, displacedPath);
  }
  try {
    await rename(partialPath, destination);
    return displacedPath;
  } catch (error) {
    if (displacedPath) await rename(displacedPath, destination);
    throw error;
  }
}

async function rollbackTransition({ destination, displacedPath, previousBytes }) {
  await rm(destination, { force: true });
  if (previousBytes && displacedPath) await rename(displacedPath, destination);
}

async function readOptional(path) {
  try { return await readFile(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sameTarget(previous, next) {
  return previous?.schema === next?.schema
    && previous?.version === next?.version
    && previous?.libraryId === next?.libraryId
    && JSON.stringify(previous?.current) === JSON.stringify(next?.current);
}
