#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  computeSemanticCoverage,
  findMarkdownTable,
  readJson,
  validateContentReferences,
  validateManifest,
  validateRegistryStatuses,
} from './lib/brand-validation-core.mjs';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { findAuthoritativeManifestPaths } from './lib/manifest-discovery.mjs';

const rootDir = getArg('--root') ?? process.cwd();
const findings = [];

await checkManifests();
await checkRegistries();
await checkSemanticCoverage();

const errors = findings.filter((finding) => finding.severity === 'error');
const warnings = findings.filter((finding) => finding.severity === 'warning');

for (const finding of findings) {
  console.log(`[${finding.severity}] ${finding.location}: ${finding.message}`);
}

if (errors.length > 0) {
  console.log(`Brand docs validation failed: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
  process.exitCode = 1;
} else {
  console.log(`Brand docs validation passed: 0 errors, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
}

async function checkManifests() {
  const manifestPaths = await findAuthoritativeManifestPaths(rootDir);
  if (manifestPaths.length === 0) {
    findings.push({ severity: 'warning', location: 'asset-manifest.json', message: 'no product asset manifests found' });
    return;
  }

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
}

async function checkRegistries() {
  const evidenceText = await readRequiredText('EVIDENCE_REGISTER.md');
  const openQuestionText = await readRequiredText('OPEN_QUESTIONS_REGISTER.md');
  const sourceText = await readRequiredText('SOURCE_REGISTRY.md');
  const evidenceRows = findMarkdownTable(evidenceText, ['Claim', '상태']);
  const openQuestionRows = findMarkdownTable(openQuestionText, ['id', '상태']);
  const sourceRows = findMarkdownTable(sourceText, ['source_id', 'index_status', 'review_status']);

  requireRows(evidenceRows, 'EVIDENCE_REGISTER.md', 'required evidence table not found');
  requireRows(openQuestionRows, 'OPEN_QUESTIONS_REGISTER.md', 'required open question table not found');
  requireRows(sourceRows, 'SOURCE_REGISTRY.md', 'required source registry table not found');

  findings.push(...validateRegistryStatuses({
    evidenceRows,
    openQuestionRows,
    sourceRows,
  }));
  findings.push(...validateContentReferences({
    evidenceRows,
    openQuestionRows,
    sourceRows,
    documents: await readReusableDocuments(),
  }));
}

async function checkSemanticCoverage() {
  const text = await readRequiredText('ASSET_SEMANTIC_INDEX.md');
  const rows = findMarkdownTable(text, ['product_id']).map((row) => ({
    productId: clean(row.product_id),
    totalAssets: readNumber(row['전체 자산'] ?? row.totalAssets),
    taggedAssets: readNumber(row['대표 의미 태깅'] ?? row['태깅 자산'] ?? row.taggedAssets),
  })).filter((row) => row.productId && Number.isFinite(row.totalAssets) && Number.isFinite(row.taggedAssets));

  const coverage = computeSemanticCoverage(rows);
  findings.push({
    severity: coverage.severity,
    location: 'ASSET_SEMANTIC_INDEX.md',
    message: `semantic coverage ${coverage.taggedAssets}/${coverage.totalAssets} (${coverage.coveragePercent}%)`,
  });
}

async function readRequiredText(path) {
  try {
    return await readFile(join(rootDir, path), 'utf8');
  } catch {
    findings.push({ severity: 'error', location: path, message: 'required file is missing or unreadable' });
    return '';
  }
}

async function readReusableDocuments() {
  const paths = [
    'README.md',
    'PROMPTS.md',
    'OPERATING_INDEX.md',
    'BRAND_MATERIAL_INDEX.md',
    'CUSTOMER_SEGMENTS.md',
    'PRODUCT_SELECTION_GUIDE.md',
    'FIELD_STORY_BANK.md',
    'REVIEW_PROOF_BANK.md',
    'FAQ_OBJECTION_BANK.md',
    'COPY_ASSET_BANK.md',
  ];
  const documents = [];
  for (const path of paths) {
    try {
      documents.push({ path, text: await readFile(join(rootDir, path), 'utf8') });
    } catch {
      // Optional reusable-doc scans should not fail minimal fixtures or partial forks.
    }
  }
  return documents;
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function clean(value) {
  return String(value ?? '').replace(/^`|`$/g, '').trim();
}

function readNumber(value) {
  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
  return cleaned ? Number(cleaned) : Number.NaN;
}

function requireRows(rows, location, message) {
  if (rows.length === 0) {
    findings.push({ severity: 'error', location, message });
  }
}
