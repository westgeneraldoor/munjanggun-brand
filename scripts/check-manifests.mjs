#!/usr/bin/env node
import { relative } from 'node:path';
import {
  findFiles,
  readJson,
  validateManifest,
} from './lib/brand-validation-core.mjs';

const rootDir = getArg('--root') ?? process.cwd();
const manifestPaths = await findFiles(rootDir, (path) => path.endsWith('asset-manifest.json'));
const findings = [];

for (const manifestPath of manifestPaths) {
  const manifest = await readJson(manifestPath);
  findings.push(...await validateManifest(manifest, {
    rootDir,
    manifestPath: relative(rootDir, manifestPath),
  }));
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.log(`[${finding.severity}] ${finding.location}: ${finding.message}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Manifest check passed (${manifestPaths.length} manifest${manifestPaths.length === 1 ? '' : 's'}).`);
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}
