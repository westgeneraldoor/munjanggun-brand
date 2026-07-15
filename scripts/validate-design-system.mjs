#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const findings = [];
const required = [
  'DESIGN.md', 'DESIGN_QUICKSTART.md', 'BRAND_GUIDELINE.html', 'tokens/brand.tokens.json', 'tokens/brand.css',
  'design-system/components/ArticleCard.jsx', 'design-system/components/BrandLockup.jsx', 'design-system/components/Button.jsx',
  'design-system/components/Chip.jsx', 'design-system/components/Field.jsx', 'design-system/components/GlassNav.jsx',
  'design-system/components/SectionHeading.jsx', 'design-system/components/StatusText.jsx',
  'design-system/playground/index.html', 'design-system/playground/main.js', 'design-system/playground/styles.css',
  'design-system/assets/fonts/TmoneyRoundWindExtraBold.ttf',
];

for (const path of required) {
  try { await access(join(root, path)); } catch { error(path, 'required design-system file is missing'); }
}

const retiredPreviews = [
  'legacy-preview-v3.html',
  '브랜드가이드라인_시안/index.html',
  '브랜드가이드라인_시안/concept-a-warm-wood.html',
  '브랜드가이드라인_시안/concept-b-blueprint.html',
  '브랜드가이드라인_시안/concept-c-neighborhood.html',
];
for (const path of retiredPreviews) {
  try {
    await access(join(root, path));
    error(path, 'retired visual preview must not compete with the canonical guide');
  } catch (caught) {
    if (caught?.code !== 'ENOENT') error(path, `could not verify retired preview state: ${caught?.message ?? caught}`);
  }
}

const retiredProductFlow = [
  'design-system/demo',
  'design-system/demo/BlogHome.jsx',
  'design-system/demo/ArticleDetail.jsx',
  'design-system/demo/ConsultForm.jsx',
];
for (const path of retiredProductFlow) {
  try {
    await access(join(root, path));
    error(path, 'product-flow demo must not live in the central design system');
  } catch (caught) {
    if (caught?.code !== 'ENOENT') error(path, `could not verify product-flow retirement: ${caught?.message ?? caught}`);
  }
}

const tokens = await json('tokens/brand.tokens.json');
const css = await text('tokens/brand.css');
const runtimePaths = [
  'BRAND_GUIDELINE.html', 'index.html', 'design-system/playground/index.html', 'design-system/playground/main.js',
  'design-system/components/ArticleCard.jsx', 'design-system/components/GlassNav.jsx',
];
const runtime = (await Promise.all(runtimePaths.map(text))).join('\n');
const activeDocPaths = ['DESIGN.md', 'DESIGN_QUICKSTART.md', 'AGENTS.md', 'ANTI_PATTERNS.md', 'PHOTO_TREATMENT.md', 'README.md', 'PROMPTS.md', 'index.html'];
const activeDocs = (await Promise.all(activeDocPaths.map(text))).join('\n');

if (tokens.meta?.concept !== 'Editorial Showroom') error('tokens/brand.tokens.json', 'concept must be Editorial Showroom');
if (tokens.meta?.primary !== 'Ink' || tokens.meta?.secondary !== 'Forest') error('tokens/brand.tokens.json', 'Ink/Forest roles are missing');
if (JSON.stringify(tokens.meta?.layers) !== JSON.stringify(['primitive', 'semantic', 'component'])) error('tokens/brand.tokens.json', 'token layers must be primitive -> semantic -> component');
if (JSON.stringify(tokens.meta?.themes) !== JSON.stringify(['light', 'dark'])) error('tokens/brand.tokens.json', 'theme manifest must list light and dark');

for (const pattern of [/\[data-mg-theme="light"\]/, /\[data-mg-theme="dark"\]/, /--mg-bg:\s*var\(--mg-/, /background:\s*var\(--mg-bg\)/, /prefers-reduced-motion/, /:focus-visible/, /--mg-control-size-min:\s*44px/]) {
  if (!pattern.test(css)) error('tokens/brand.css', `missing contract ${pattern}`);
}
if (/--mg-(clay|sage|ochre)|동네 온기|Neighborhood Warmth/i.test(activeDocs)) error('active design docs', 'retired v4 design language remains active');

const banned = /도어\s*업계\s*1위|대한민국\s*No\.1|고객만족\s*100%|최저가\s*보장|영업일\s*기준\s*1일|절대\s*추가금\s*없음|무조건\s*가능/;
if (banned.test(runtime)) error('runtime copy', `unsupported brand claim remains: ${runtime.match(banned)?.[0]}`);
if (/href=["']#["']/.test(runtime)) error('runtime links', 'empty href remains');

for (const path of ['BRAND_GUIDELINE.html', 'index.html']) checkHtmlAnchors(path, await text(path));
checkCombinedJsxAnchors(runtime);

const componentSource = await text('design-system/components/ArticleCard.jsx');
if (!/\.\.\.rest/.test(componentSource) || !/rest\.onClick/.test(componentSource)) error('ArticleCard.jsx', 'root attribute/onClick forwarding is incomplete');
const navSource = await text('design-system/components/GlassNav.jsx');
if (!/aria-expanded/.test(navSource) || !/aria-controls/.test(navSource) || !/Escape/.test(navSource)) error('GlassNav.jsx', 'mobile navigation accessibility contract is incomplete');
if (/블로그|방문실측|상담/.test(navSource)) error('GlassNav.jsx', 'common navigation must not hardcode a downstream product journey');

const playgroundSource = await text('design-system/playground/index.html');
if (/BlogHome|ArticleDetail|ConsultForm|<form\b|type=["']tel["']|전화번호|방문 주소|개인정보|상담 신청|라우팅/.test(playgroundSource)) error('design-system/playground', 'playground contains a downstream product flow or customer-information form');
for (const pattern of [/BrandLockup/, /Button/, /Chip/, /Field/, /StatusText/, /SectionHeading/, /ArticleCard/, /aria-busy="true"/, /aria-invalid="true"/]) {
  if (!pattern.test(playgroundSource)) error('design-system/playground/index.html', `missing component-state contract ${pattern}`);
}

const authorityPaths = ['DESIGN.md', 'README.md', 'AGENTS.md', 'DESIGN_QUICKSTART.md', 'PROMPTS.md'];
const authoritySources = await Promise.all(authorityPaths.map(text));
for (const [index, source] of authoritySources.entries()) {
  if (!/실제 화면, URL, 메뉴, 정보구조, 고객 여정, CTA 연결은 하위 프로젝트 권한이다/.test(source)) error(authorityPaths[index], 'downstream product authority boundary is missing');
}
const authority = authoritySources.join('\n');
for (const pattern of [/중앙 브랜드는 시각·브랜드·공통 컴포넌트 계약만 관리한다/, /플레이그라운드는 제품 시안이나 구현 오더가 아니다/, /서비스 프로젝트는 플레이그라운드 화면을 복사하지 않고 토큰과 공통 컴포넌트 계약만 적용한다/]) {
  if (!pattern.test(authority)) error('authority docs', `missing authority contract ${pattern}`);
}

const designFiles = await walk(join(root, 'design-system'));
for (const path of designFiles.filter((value) => /\.(css|jsx|js|html)$/.test(value))) {
  const source = await readFile(path, 'utf8');
  if (/#[0-9a-f]{3,8}\b|rgba?\(/i.test(source)) error(relative(path), 'raw color value must live in tokens/brand.css');
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (/\b\d+px\b/.test(line) && !/@media/.test(line)) error(`${relative(path)}:${index + 1}`, 'raw px value must use a token (media-query breakpoints are the documented exception)');
  }
}

const forbiddenArtifacts = designFiles.filter((path) => /_ds_bundle|_ds_manifest|_adherence|\.thumbnail$|\.prompt\.md$|core\.card\.html$/i.test(path));
for (const path of forbiddenArtifacts) error(relative(path), 'Fable generator artifact must not be integrated');

const fontFiles = designFiles.filter((path) => /TmoneyRoundWind.*\.(ttf|otf)$/i.test(path));
if (fontFiles.length !== 1) error('design-system/assets/fonts', `expected one Tmoney font, found ${fontFiles.length}`);
if (fontFiles[0]) {
  const bytes = await readFile(fontFiles[0]);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== '6a7c0fd1d71a3b78584bf337a6608137071eeff337087025948678a144415edc') error(relative(fontFiles[0]), 'font hash does not match official distribution');
}

if (findings.length) {
  for (const finding of findings) console.error(`[error] ${finding.location}: ${finding.message}`);
  process.exitCode = 1;
} else {
  console.log('Design-system validation passed: 0 errors, 0 warnings.');
}

async function text(path) { return readFile(join(root, path), 'utf8'); }
async function json(path) { return JSON.parse(await text(path)); }
function error(location, message) { findings.push({ location, message }); }
function relative(path) { return path.slice(root.length + 1).replaceAll('\\', '/'); }

function checkHtmlAnchors(path, source) {
  const ids = new Set([...source.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]));
  for (const match of source.matchAll(/href=["']#([^"']+)["']/g)) {
    if (!ids.has(match[1])) error(path, `broken anchor #${match[1]}`);
  }
}

function checkCombinedJsxAnchors(source) {
  const ids = new Set([...source.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]));
  for (const match of source.matchAll(/href=["']#([^"']+)["']/g)) {
    if (!ids.has(match[1])) error('design-system JSX', `broken anchor #${match[1]}`);
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else paths.push(path);
  }
  return paths;
}
