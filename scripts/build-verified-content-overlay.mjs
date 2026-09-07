#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVerifiedContentAuthority } from './lib/asset-content-revalidation.mjs';

export async function runBuildVerifiedContentOverlay(argv, options = {}) {
  const result = await buildVerifiedContentAuthority({
    catalogPath: required(argv, '--catalog'),
    profilePath: required(argv, '--profile'),
    objectRoot: required(argv, '--object-root'),
    rawRoot: required(argv, '--raw-root'),
    reviewFiles: repeated(argv, '--review-file'),
    outputRoot: required(argv, '--output-root'),
    ...options,
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function required(argv, name) {
  const index = argv.indexOf(name);
  const value = index === -1 ? null : argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}`);
  return value;
}

function repeated(argv, name) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === name) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
      values.push(value);
    }
  }
  if (!values.length) throw new Error(`Provide at least one ${name}`);
  return values;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runBuildVerifiedContentOverlay(process.argv.slice(2));
}
