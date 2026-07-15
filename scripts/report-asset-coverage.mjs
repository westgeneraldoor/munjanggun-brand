#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  computeSemanticCoverage,
  parseMarkdownTable,
} from './lib/brand-validation-core.mjs';

const rootDir = getArg('--root') ?? process.cwd();
const asJson = process.argv.includes('--json');
const text = await readFile(join(rootDir, 'ASSET_SEMANTIC_INDEX.md'), 'utf8');
const rows = parseMarkdownTable(text)
  .filter((row) => row.product_id && row['전체 자산'] && row['대표 의미 태깅'])
  .map((row) => ({
    productId: clean(row.product_id),
    productName: row['상품'],
    totalAssets: Number(row['전체 자산'].replace(/[^0-9]/g, '')),
    taggedAssets: Number(row['대표 의미 태깅'].replace(/[^0-9]/g, '')),
  }))
  .map((row) => ({
    ...row,
    coveragePercent: row.totalAssets === 0 ? 0 : Math.round((row.taggedAssets / row.totalAssets) * 1000) / 10,
  }));

const summary = {
  ...computeSemanticCoverage(rows),
  products: rows,
};

if (asJson) {
  console.log(JSON.stringify(summary));
} else {
  console.log(`Semantic coverage: ${summary.taggedAssets}/${summary.totalAssets} (${summary.coveragePercent}%) [${summary.severity}]`);
  for (const row of rows) {
    console.log(`- ${row.productName}: ${row.taggedAssets}/${row.totalAssets} (${row.coveragePercent}%)`);
  }
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function clean(value) {
  return value.replace(/^`|`$/g, '');
}
