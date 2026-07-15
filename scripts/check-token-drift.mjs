#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  compareTokenSources,
  extractFrontMatter,
  parseCssVariables,
  readJson,
} from './lib/brand-validation-core.mjs';

const rootDir = getArg('--root') ?? process.cwd();

const designText = await readFile(join(rootDir, 'DESIGN.md'), 'utf8');
const design = extractFrontMatter(designText);
const json = await readJson(join(rootDir, 'tokens', 'brand.tokens.json'));
const css = await readFile(join(rootDir, 'tokens', 'brand.css'), 'utf8');
const cssVars = parseCssVariables(css);

const findings = compareTokenSources({ design, json, cssVars });
if (findings.length > 0) {
  for (const finding of findings) {
    console.log(`[${finding.severity}] ${finding.location}: ${finding.message}`);
  }
  process.exitCode = 1;
} else {
  console.log('Token drift check passed.');
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}
