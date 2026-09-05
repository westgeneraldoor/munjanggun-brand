#!/usr/bin/env node
import { relative } from 'node:path';
import {
  readJson,
  validateManifest,
} from './lib/brand-validation-core.mjs';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { findAuthoritativeManifestPaths } from './lib/manifest-discovery.mjs';

const rootDir = getArg('--root') ?? process.cwd();
const manifestPaths = await findAuthoritativeManifestPaths(rootDir);
const findings = [];

for (const manifestPath of manifestPaths) {
  const manifest = await readJson(manifestPath);
  const manifestLabel = relative(rootDir, manifestPath);
  if (manifest.schema === 'munjanggun.productDetailAssets.v2') {
    const result = await readAndValidateManifestV2(manifestPath);
    findings.push(...result.findings.map((finding) => ({ ...finding, location: manifestLabel })));
  } else {
    findings.push(...await validateManifest(manifest, {
      rootDir,
      manifestPath: manifestLabel,
    }));
  }
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
