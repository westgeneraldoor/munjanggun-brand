import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const VALID_USAGE_STATUSES = new Set([
  'candidate',
  'needs_confirmation',
  'vetted',
  'publishable',
  'restricted',
  'expired',
  'retired',
]);

export const VALID_PRIVACY_STATUSES = new Set([
  'official_reviewed',
  'not_verified',
  'checked',
  'restricted',
]);

export const VALID_CLAIM_RISKS = new Set(['low', 'medium', 'high']);

export const VALID_EVIDENCE_STATUSES = new Set([
  'publishable',
  'vetted',
  'candidate',
  'needs_confirmation',
  'restricted',
  'expired',
]);

export const VALID_OPEN_QUESTION_STATUSES = new Set([
  'open',
  'in_review',
  'resolved',
  'deferred',
]);

export const VALID_SOURCE_INDEX_STATUSES = new Set([
  'registered',
  'indexed',
  'semantic_indexed',
  'needs_review',
  'retired',
  'superseded',
]);

export const VALID_SOURCE_REVIEW_STATUSES = new Set([
  'not_reviewed',
  'reviewed_candidate',
  'needs_review',
  'approved_public',
  'restricted',
]);

export function parseCssVariables(cssText) {
  const vars = {};
  const pattern = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match;
  while ((match = pattern.exec(cssText)) !== null) {
    if (!(match[1] in vars)) vars[match[1]] = match[2].trim();
  }
  return vars;
}

export function compareTokenSources({ design, json, cssVars }) {
  if (Array.isArray(json.meta?.layers)) {
    return compareLayeredTokenSources({ design, json, cssVars });
  }
  const findings = [];
  compareTokenGroup(findings, 'colors', design.colors ?? {}, json.colors ?? {}, cssVars, cssNameForColor);
  compareTokenGroup(findings, 'rounded', design.rounded ?? {}, json.radius ?? {}, cssVars, (name) => `mg-radius-${name}`);
  compareTokenGroup(findings, 'spacing', design.spacing ?? {}, json.spacing ?? {}, cssVars, (name) => `mg-space-${name}`);
  compareTypography(findings, design.typography ?? {}, json.typography ?? {}, cssVars);
  checkDeprecatedTokens(findings, json, cssVars);
  return findings;
}

function compareLayeredTokenSources({ design, json, cssVars }) {
  const findings = [];
  const structuredCssNames = new Set();
  for (const field of ['concept', 'primary', 'secondary']) {
    if (design[field] && normalizeTokenValue(design[field]) !== normalizeTokenValue(json.meta?.[field])) {
      findings.push(error('tokens', `${field} mismatch between DESIGN.md and brand.tokens.json`));
    }
  }

  for (const layer of ['primitive', 'semantic', 'component']) {
    if (!json[layer] || typeof json[layer] !== 'object') {
      findings.push(error('tokens', `${layer} layer missing from brand.tokens.json`));
      continue;
    }
    for (const entry of collectLayerEntries(json[layer], layer)) {
      if (!entry.css || !entry.css.startsWith('--mg-')) {
        findings.push(error('tokens', `${entry.path} is missing a valid css name`));
        continue;
      }
      structuredCssNames.add(entry.css.slice(2));
      if (/^semantic\.(light|dark)\./.test(entry.path)) continue;
      const cssName = entry.css.slice(2);
      const cssValue = cssVars[cssName];
      if (cssValue === undefined) {
        findings.push(error('tokens', `${entry.path} missing from brand.css (${entry.css})`));
        continue;
      }
      const expected = referenceToCssValue(entry.value, json) ?? entry.value;
      const normalize = cssName.includes('font-') ? normalizeFont : normalizeTokenValue;
      if (normalize(expected) !== normalize(cssValue)) {
        findings.push(error('tokens', `${entry.path} mismatch between brand.tokens.json and brand.css (${expected} != ${cssValue})`));
      }
    }
  }

  for (const cssName of Object.keys(cssVars)) {
    if (cssName.startsWith('mg-') && !structuredCssNames.has(cssName)) {
      findings.push(error('tokens', `${cssName} exists in brand.css but is missing from brand.tokens.json`));
    }
  }

  checkDeprecatedTokens(findings, json, cssVars);
  return findings;
}

function collectLayerEntries(node, prefix) {
  const entries = [];
  for (const [key, value] of Object.entries(node ?? {})) {
    const path = `${prefix}.${key}`;
    if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
      entries.push({ path, ...value });
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...collectLayerEntries(value, path));
    }
  }
  return entries;
}

function referenceToCssValue(value, json) {
  const match = String(value).match(/^\{([^}]+)\}$/);
  if (!match) return undefined;
  const target = match[1].split('.').reduce((node, key) => node?.[key], json);
  return target?.css ? `var(${target.css})` : undefined;
}

export function parseMarkdownTable(markdownText) {
  return parseTableBlock(firstMarkdownTableBlock(markdownText));
}

export function parseMarkdownTables(markdownText) {
  return markdownTableBlocks(markdownText)
    .map(parseTableBlock)
    .filter((rows) => rows.length > 0);
}

export function findMarkdownTable(markdownText, requiredHeaders) {
  return parseMarkdownTables(markdownText).find((rows) => {
    const headers = new Set(Object.keys(rows[0] ?? {}));
    return requiredHeaders.every((header) => headers.has(header));
  }) ?? [];
}

export function validateRegistryStatuses({ evidenceRows = [], openQuestionRows = [], sourceRows = [] }) {
  const findings = [];

  for (const [index, row] of evidenceRows.entries()) {
    const status = cleanStatus(statusFromRow(row));
    if (!status) {
      findings.push(error(`EVIDENCE_REGISTER.md#row-${index + 1}`, 'missing evidence status'));
    } else if (!VALID_EVIDENCE_STATUSES.has(status)) {
      findings.push(error(`EVIDENCE_REGISTER.md#row-${index + 1}`, `unknown evidence status ${status}`));
    }
    if (['needs_confirmation', 'candidate', 'restricted', 'expired'].includes(status)) {
      findings.push(warning(`EVIDENCE_REGISTER.md#row-${index + 1}`, `evidence claim is not directly publishable (${status})`));
    }
  }

  for (const [index, row] of openQuestionRows.entries()) {
    const id = cleanStatus(row.id ?? row.ID ?? '');
    const status = cleanStatus(statusFromRow(row));
    const label = `OPEN_QUESTIONS_REGISTER.md#row-${index + 1}`;
    if (id && !/^oq-\d{3,}$/i.test(id)) {
      findings.push(error(label, `invalid open question id ${id}`));
    }
    if (!status) {
      findings.push(error(label, 'missing open question status'));
    } else if (!VALID_OPEN_QUESTION_STATUSES.has(status)) {
      findings.push(error(label, `unknown open question status ${status}`));
    } else if (status !== 'resolved') {
      findings.push(warning(label, `open question remains ${id || '(no id)'} (${status})`));
    }
  }

  for (const [index, row] of sourceRows.entries()) {
    const label = `SOURCE_REGISTRY.md#row-${index + 1}`;
    const indexStatus = cleanStatus(row.index_status ?? row.indexStatus ?? '');
    const reviewStatus = cleanStatus(row.review_status ?? row.reviewStatus ?? '');
    if (!indexStatus) {
      findings.push(error(label, 'missing source index_status'));
    } else if (!VALID_SOURCE_INDEX_STATUSES.has(indexStatus)) {
      findings.push(error(label, `unknown source index_status ${indexStatus}`));
    }
    if (!reviewStatus) {
      findings.push(error(label, 'missing source review_status'));
    } else if (!VALID_SOURCE_REVIEW_STATUSES.has(reviewStatus)) {
      findings.push(error(label, `unknown source review_status ${reviewStatus}`));
    }
    if (reviewStatus && reviewStatus !== 'approved_public') {
      findings.push(warning(label, `source is not public-approved (${reviewStatus})`));
    }
  }

  return findings;
}

export function validateContentReferences({ evidenceRows = [], openQuestionRows = [], sourceRows = [], documents = [] }) {
  const findings = [];
  const riskyClaims = evidenceRows
    .filter((row) => ['needs_confirmation', 'restricted', 'expired'].includes(cleanStatus(statusFromRow(row))))
    .map((row) => cleanCell(row.Claim ?? row.claim ?? ''))
    .filter(Boolean);
  const unresolvedOpenQuestions = openQuestionRows
    .filter((row) => !['resolved', 'deferred'].includes(cleanStatus(statusFromRow(row))))
    .map((row) => cleanStatus(row.id ?? row.ID ?? ''))
    .filter(Boolean);
  const retiredSources = sourceRows
    .filter((row) => ['retired', 'superseded'].includes(cleanStatus(row.index_status ?? row.indexStatus ?? '')))
    .map((row) => cleanCell(row.source_id ?? row.sourceId ?? ''))
    .filter(Boolean);

  for (const document of documents) {
    for (const claim of riskyClaims) {
      if (document.text.includes(claim)) {
        findings.push(warning(document.path, `risky evidence claim reference requires gate review: ${claim}`));
      }
    }
    for (const id of unresolvedOpenQuestions) {
      if (new RegExp(`\\b${escapeRegExp(id)}\\b`, 'i').test(document.text)) {
        findings.push(warning(document.path, `unresolved open question reference requires gate review: ${id}`));
      }
    }
    for (const sourceId of retiredSources) {
      if (document.text.includes(sourceId)) {
        findings.push(warning(document.path, `retired or superseded source reference requires gate review: ${sourceId}`));
      }
    }
  }

  return findings;
}

export async function validateManifest(manifest, { rootDir, manifestPath }) {
  const findings = [];
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  const manifestLabel = manifestPath ?? 'asset-manifest.json';

  for (const field of requiredManifestFields()) {
    if (!hasMeaningfulValue(manifest[field])) {
      findings.push(error(manifestLabel, `missing required manifest field ${field}`));
    }
  }

  if (manifest.schema && manifest.schema !== 'munjanggun.productDetailAssets.v1') {
    findings.push(error(manifestLabel, `invalid manifest schema ${manifest.schema}`));
  }

  if (!Array.isArray(manifest.assets)) {
    findings.push(error(manifestLabel, 'manifest.assets must be an array'));
    return findings;
  }

  if (typeof manifest.assetCount === 'number' && manifest.assetCount !== assets.length) {
    findings.push(error(manifestLabel, `assetCount ${manifest.assetCount} does not match assets length ${assets.length}`));
  }
  compareCountMap(findings, manifestLabel, 'roleCounts', manifest.roleCounts, countBy(assets, 'folderRole'));
  compareCountMap(findings, manifestLabel, 'collectionCounts', manifest.collectionCounts, countBy(assets, 'collection'));
  compareCountMap(findings, manifestLabel, 'claimRiskCounts', manifest.claimRiskCounts, countBy(assets, 'claimRisk'));
  compareCountMap(findings, manifestLabel, 'privacyStatusCounts', manifest.privacyStatusCounts, countBy(assets, 'privacyStatus'));
  const duplicateGroupCount = new Set(assets.map((asset) => asset.duplicateGroup).filter(hasMeaningfulValue)).size;
  if (typeof manifest.duplicateGroupCount === 'number' && manifest.duplicateGroupCount !== duplicateGroupCount) {
    findings.push(error(manifestLabel, `duplicateGroupCount ${manifest.duplicateGroupCount} does not match assets (${duplicateGroupCount})`));
  }

  const seenIds = new Set();
  for (const [index, asset] of assets.entries()) {
    const label = `${manifestLabel}#assets[${index}]`;
    for (const field of requiredAssetFields()) {
      if (isMissingRequiredAssetField(asset, field)) {
        findings.push(error(label, `missing required field ${field}`));
      }
    }

    if (asset.assetId) {
      if (seenIds.has(asset.assetId)) {
        findings.push(error(label, `duplicate assetId ${asset.assetId}`));
      }
      seenIds.add(asset.assetId);
    }

    checkAllowed(findings, label, 'usageStatus', asset.usageStatus, VALID_USAGE_STATUSES);
    checkAllowed(findings, label, 'privacyStatus', asset.privacyStatus, VALID_PRIVACY_STATUSES);
    checkAllowed(findings, label, 'claimRisk', asset.claimRisk, VALID_CLAIM_RISKS);

    if (asset.relativePath || asset.repositoryPath) {
      await checkFileFacts(findings, rootDir, label, asset);
    }
  }

  return findings;
}

export function computeSemanticCoverage(rows) {
  const totalAssets = rows.reduce((sum, row) => sum + Number(row.totalAssets ?? 0), 0);
  const taggedAssets = rows.reduce((sum, row) => sum + Number(row.taggedAssets ?? 0), 0);
  const coveragePercent = totalAssets === 0 ? 0 : round1((taggedAssets / totalAssets) * 100);
  return {
    totalAssets,
    taggedAssets,
    coveragePercent,
    severity: 'info',
  };
}

export async function readJson(path) {
  return JSON.parse(stripBom(await readFile(path, 'utf8')));
}

export async function findFiles(rootDir, predicate) {
  const results = [];
  await walk(rootDir, results, predicate);
  return results;
}

export async function sha256File(path) {
  const content = await readFile(path);
  return createHash('sha256').update(content).digest('hex');
}

export function extractFrontMatter(markdownText) {
  if (!markdownText.startsWith('---')) return {};
  const end = markdownText.indexOf('\n---', 3);
  if (end === -1) return {};
  return parseSimpleYaml(markdownText.slice(3, end).trim());
}

export function parseSimpleYaml(yamlText) {
  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (const rawLine of yamlText.split(/\r?\n/)) {
    const withoutComment = stripInlineComment(rawLine);
    if (!withoutComment.trim()) continue;

    const indent = withoutComment.match(/^\s*/)[0].length;
    const trimmed = withoutComment.trim();
    const keyValue = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (!keyValue) continue;

    const key = keyValue[1].trim();
    const rawValue = keyValue[2].trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].value;

    if (rawValue === '') {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
    } else {
      parent[key] = unquote(rawValue);
    }
  }

  return root;
}

function compareTokenGroup(findings, groupName, designGroup, jsonGroup, cssVars, cssNameFactory) {
  for (const name of Object.keys(jsonGroup)) {
    if (!(name in designGroup) && isDeprecatedTokenName(name)) {
      findings.push(error('tokens', `${groupName}.${name} is not declared in DESIGN.md`));
    }
  }

  for (const [name, designValue] of Object.entries(designGroup)) {
    const jsonValue = tokenValue(jsonGroup, name);
    const cssName = cssNameFactory(name);
    const cssValue = cssVars[cssName];
    if (jsonValue === undefined) {
      findings.push(error('tokens', `${groupName}.${name} missing from brand.tokens.json`));
    } else if (normalizeTokenValue(designValue) !== normalizeTokenValue(jsonValue)) {
      findings.push(error('tokens', `${groupName}.${name} mismatch between DESIGN.md and brand.tokens.json (${designValue} != ${jsonValue})`));
    }
    if (cssValue === undefined) {
      findings.push(error('tokens', `${groupName}.${name} missing from brand.css`));
    } else if (normalizeTokenValue(designValue) !== normalizeTokenValue(cssValue)) {
      findings.push(error('tokens', `${groupName}.${name} mismatch between DESIGN.md and brand.css (${designValue} != ${cssValue})`));
    }
  }
}

function tokenValue(group, name) {
  const entry = group[name] ?? group[camel(name)];
  return entry?.value ?? entry;
}

function checkDeprecatedTokens(findings, json, cssVars) {
  checkDeprecatedJsonNode(findings, json, '');

  for (const name of Object.keys(cssVars)) {
    if (isDeprecatedTokenName(name)) {
      findings.push(error('tokens', `deprecated token ${name} remains in brand.css`));
    }
  }
}

function checkDeprecatedJsonNode(findings, node, path) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  for (const [name, value] of Object.entries(node)) {
    const current = path ? `${path}.${name}` : name;
    if (isDeprecatedTokenName(name)) findings.push(error('tokens', `deprecated token ${current} remains in brand.tokens.json`));
    checkDeprecatedJsonNode(findings, value, current);
  }
}

function isDeprecatedTokenName(name) {
  return /(verified[-_]?navy|navy|cocoa|oak|terracotta)/i.test(name);
}

function compareTypography(findings, designTypography, jsonTypography, cssVars) {
  const rootFont = designTypography['font-family'];
  if (rootFont && jsonTypography.hero?.fontFamily && normalizeFont(rootFont) !== normalizeFont(jsonTypography.hero.fontFamily)) {
    findings.push(error('tokens', 'typography font family mismatch between DESIGN.md and brand.tokens.json'));
  }

  for (const [style, designSpec] of Object.entries(designTypography)) {
    if (typeof designSpec !== 'object' || designSpec === null) continue;
    const jsonSpec = jsonTypography[style] ?? {};
    const cssPrefix = `mg-font-size-${kebab(style)}`;
    compareTypographyField(findings, style, 'fontSize', designSpec.fontSize, jsonSpec.fontSize, cssVars[cssPrefix]);
    compareTypographyField(findings, style, 'mobileFontSize', designSpec.mobileFontSize, jsonSpec.mobileFontSize, cssVars[`${cssPrefix}-mobile`]);
    compareTypographyField(findings, style, 'lineHeight', designSpec.lineHeight, jsonSpec.lineHeight, cssVars[`mg-line-height-${kebab(style)}`]);
  }
}

function compareTypographyField(findings, style, field, designValue, jsonValue, cssValue) {
  if (designValue === undefined) return;
  if (jsonValue === undefined) {
    findings.push(error('tokens', `typography.${style}.${field} missing from brand.tokens.json`));
  } else if (normalizeTokenValue(designValue) !== normalizeTokenValue(jsonValue)) {
    findings.push(error('tokens', `typography.${style}.${field} mismatch between DESIGN.md and brand.tokens.json`));
  }
  if (cssValue === undefined) {
    findings.push(error('tokens', `typography.${style}.${field} missing from brand.css`));
  } else if (normalizeTokenValue(designValue) !== normalizeTokenValue(cssValue)) {
    findings.push(error('tokens', `typography.${style}.${field} mismatch between DESIGN.md and brand.css`));
  }
}

function cssNameForColor(name) {
  return `mg-${kebab(name)}`;
}

function kebab(name) {
  return String(name).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '');
}

function camel(name) {
  return String(name).replace(/-([a-z0-9])/g, (_match, letter) => letter.toUpperCase());
}

function normalizeTokenValue(value) {
  return String(value).trim().replace(/^["']|["']$/g, '');
}

function normalizeFont(value) {
  return normalizeTokenValue(value).replace(/["']/g, '').replace(/\s+/g, ' ').replace(/,\s*/g, ',');
}

function splitTableLine(line) {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function firstMarkdownTableBlock(markdownText) {
  return markdownTableBlocks(markdownText)[0] ?? [];
}

function markdownTableBlocks(markdownText) {
  const lines = stripBom(markdownText).split(/\r?\n/).map((line) => line.trim());
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (line.startsWith('|') && line.endsWith('|')) {
      current.push(line);
      continue;
    }
    if (current.length >= 2) blocks.push(current);
    current = [];
  }
  if (current.length >= 2) blocks.push(current);
  return blocks;
}

function parseTableBlock(lines) {
  if (lines.length < 2) return [];

  const header = splitTableLine(lines[0]);
  const separatorIndex = lines.findIndex((line, index) => index > 0 && splitTableLine(line).every((cell) => /^:?-{3,}:?$/.test(cell)));
  if (separatorIndex === -1) return [];

  return lines.slice(separatorIndex + 1).map((line) => {
    const cells = splitTableLine(line);
    return Object.fromEntries(header.map((key, index) => [key, cells[index] ?? '']));
  });
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function requiredAssetFields() {
  return [
    'assetId',
    'productId',
    'sourceId',
    'proofId',
    'product',
    'relativePath',
    'repositoryPath',
    'fileName',
    'extension',
    'sequence',
    'folderRole',
    'collection',
    'byteSize',
    'width',
    'height',
    'gifFrameCount',
    'sha256',
    'duplicateGroup',
    'usageStatus',
    'privacyStatus',
    'claimRisk',
    'externalPublish',
    'notes',
  ];
}

function requiredManifestFields() {
  return [
    'schema',
    'version',
    'generatedAt',
    'updatedAt',
    'productId',
    'product',
    'slug',
    'sourceId',
    'proofId',
    'sourceFolder',
    'sourceType',
    'sourcePolicy',
    'consumerRule',
    'assetCount',
    'roleCounts',
    'collectionCounts',
    'claimRiskCounts',
    'privacyStatusCounts',
    'duplicateGroupCount',
    'assets',
  ];
}

function hasMeaningfulValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function isMissingRequiredAssetField(asset, field) {
  if (emptyAllowedRequiredAssetFields().has(field)) {
    return asset[field] === undefined;
  }
  if (nullableRequiredAssetFields().has(field)) {
    return asset[field] === undefined;
  }
  return !hasMeaningfulValue(asset[field]);
}

function nullableRequiredAssetFields() {
  return new Set(['collection', 'gifFrameCount', 'duplicateGroup']);
}

function emptyAllowedRequiredAssetFields() {
  return new Set(['notes']);
}

function checkAllowed(findings, label, field, value, allowed) {
  if (value !== undefined && value !== null && value !== '' && !allowed.has(value)) {
    findings.push(error(label, `invalid ${field} ${value}`));
  }
}

function compareCountMap(findings, label, fieldName, declared, actual) {
  if (typeof declared !== 'object' || declared === null || Array.isArray(declared)) return;
  const keys = new Set([...Object.keys(declared), ...Object.keys(actual)]);
  for (const key of keys) {
    const declaredValue = Number(declared[key] ?? 0);
    const actualValue = Number(actual[key] ?? 0);
    if (declaredValue !== actualValue) {
      findings.push(error(label, `${fieldName}.${key} mismatch: manifest ${declaredValue}, actual ${actualValue}`));
    }
  }
}

function countBy(rows, field) {
  const counts = {};
  for (const row of rows) {
    const key = row[field];
    if (!hasMeaningfulValue(key)) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

async function checkFileFacts(findings, rootDir, label, asset) {
  const repoPath = asset.repositoryPath || asset.relativePath;
  const filePath = join(rootDir, repoPath);
  try {
    const fileStat = await stat(filePath);
    if (Number(asset.byteSize) !== fileStat.size) {
      findings.push(error(label, `byteSize mismatch for ${repoPath}: manifest ${asset.byteSize}, actual ${fileStat.size}`));
    }
    if (asset.sha256) {
      const actualHash = await sha256File(filePath);
      if (asset.sha256 !== actualHash) {
        findings.push(error(label, `sha256 mismatch for ${repoPath}`));
      }
    }
  } catch {
    findings.push(error(label, `asset file not found: ${repoPath}`));
  }
}

function error(location, message) {
  return { severity: 'error', location, message };
}

function warning(location, message) {
  return { severity: 'warning', location, message };
}

function statusFromRow(row) {
  if (row.status !== undefined) return row.status;
  if (row.Status !== undefined) return row.Status;
  if (row['상태'] !== undefined) return row['상태'];

  const statusKey = Object.keys(row).find((key) => key.includes('상태'));
  if (statusKey) return row[statusKey];

  return Object.values(row).find((value) => {
    const cleaned = cleanStatus(value);
    return VALID_EVIDENCE_STATUSES.has(cleaned) || VALID_OPEN_QUESTION_STATUSES.has(cleaned);
  }) ?? '';
}

function cleanStatus(value) {
  return cleanCell(value)
    .toLowerCase();
}

function cleanCell(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*]/g, '')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function walk(dir, results, predicate) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path, results, predicate);
    } else if (predicate(path, entry)) {
      results.push(path);
    }
  }
}

function stripInlineComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === '"' || char === "'") && line[index - 1] !== '\\') {
      quote = quote === char ? null : quote ?? char;
    }
    if (char === '#' && quote === null) {
      return line.slice(0, index);
    }
  }
  return line;
}

function unquote(value) {
  const cleaned = value.replace(/\s+#.*$/, '').trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    return cleaned.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  return cleaned;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}
