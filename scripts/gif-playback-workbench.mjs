#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGifPlaybackWorkbench } from './lib/gif-playback-workbench.mjs';

export async function runGifPlaybackWorkbench(argv) {
  const mapping = Object.fromEntries(repeated(argv, '--evidence-root-for').map((value) => {
    const separator = value.indexOf('=');
    if (separator < 1 || separator === value.length - 1) throw new Error('--evidence-root-for must be INTAKE-ID=Z:\\absolute\\path');
    return [value.slice(0, separator), value.slice(separator + 1)];
  }));
  const workbench = await createGifPlaybackWorkbench({
    queuePath: required(argv, '--queue'),
    reviewer: required(argv, '--reviewer'),
    evidenceRoot: optional(argv, '--evidence-root'),
    evidenceRootsByIntake: mapping,
    host: optional(argv, '--host') ?? '127.0.0.1',
    port: Number(optional(argv, '--port') ?? 0),
    requireZEvidenceRoots: true,
  });
  console.log(`GIF playback workbench: ${workbench.url}`);
  console.log(`Verified GIFs: ${workbench.queue.entries.length}`);
  console.log('표본 프레임은 전체 재생 증거가 아닙니다. complete는 연속 한 주기 관찰 후에만 기록됩니다.');
  return workbench;
}

function required(argv, name) {
  const value = optional(argv, name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}

function optional(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function repeated(argv, name) {
  const result = [];
  for (let index = 0; index < argv.length; index += 1) if (argv[index] === name) {
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
    result.push(value);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runGifPlaybackWorkbench(process.argv.slice(2));
}
