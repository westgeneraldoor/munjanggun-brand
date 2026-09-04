#!/usr/bin/env node
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { resolveContainedPath } from './lib/asset-paths.mjs';
import { sha256File } from './lib/asset-inventory.mjs';

const inventoryPath = resolve(requiredArg('--inventory'));
const canonicalRoot = resolve(requiredArg('--canonical-root'));
const intakeRoot = resolve(requiredArg('--intake-root'));
const objectRoot = resolve(requiredArg('--object-root'));
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
await mkdir(objectRoot, { recursive: true });

let copied = 0;
let reused = 0;
for (const group of inventory.groups) {
  const sourceRoot = group.representative.origin === 'intake' ? intakeRoot : canonicalRoot;
  const sourcePath = resolveContainedPath(sourceRoot, group.representative.sourceRelativePath, 'representative source path');
  const targetPath = resolveContainedPath(objectRoot, group.objectRef, 'objectRef');
  await mkdir(dirname(targetPath), { recursive: true });
  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile() || sourceStat.size !== group.byteSize || await sha256File(sourcePath) !== group.sha256) {
    throw new Error(`Representative source verification failed for ${group.sha256}`);
  }
  try {
    const targetStat = await stat(targetPath);
    if (!targetStat.isFile() || targetStat.size !== group.byteSize || await sha256File(targetPath) !== group.sha256) {
      throw new Error(`Existing object conflicts with ${group.objectRef}`);
    }
    reused += 1;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
    if (await sha256File(targetPath) !== group.sha256) throw new Error(`Copied object hash mismatch for ${group.objectRef}`);
    copied += 1;
  }
}
console.log(`Combined object store passed: ${inventory.groups.length} objects (${copied} copied, ${reused} reused).`);

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredArg(name) {
  const value = getArg(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
