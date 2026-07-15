import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

async function text(path) {
  return readFile(join(root, path), 'utf8');
}

test('official tokens use primitive, semantic, and component layers with Ink and Forest', async () => {
  const tokens = JSON.parse(await text('tokens/brand.tokens.json'));
  assert.equal(tokens.meta.concept, 'Editorial Showroom');
  assert.equal(tokens.meta.primary, 'Ink');
  assert.equal(tokens.meta.secondary, 'Forest');
  assert.deepEqual(tokens.meta.layers, ['primitive', 'semantic', 'component']);
  assert(tokens.primitive?.color?.ink);
  assert(tokens.semantic?.light?.background);
  assert(tokens.semantic?.dark?.background);
  assert(tokens.component?.button);
});

test('structured token source covers every official CSS custom property', async () => {
  const tokens = JSON.parse(await text('tokens/brand.tokens.json'));
  const css = await text('tokens/brand.css');
  const jsonNames = new Set();

  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.css === 'string') jsonNames.add(value.css);
    for (const child of Object.values(value)) collect(child);
  }

  collect(tokens);
  const cssNames = new Set([...css.matchAll(/(--mg-[a-z0-9-]+)\s*:/gi)].map((match) => match[1]));

  assert.deepEqual([...jsonNames].sort(), [...cssNames].sort());
});

test('structured source preserves media ratios, minimum sizes, and safe areas', async () => {
  const tokens = JSON.parse(await text('tokens/brand.tokens.json'));

  assert.equal(tokens.media?.heroImage?.aspectRatio, '16 / 10');
  assert.equal(tokens.media?.heroImage?.mobileAspectRatio, '4 / 5');
  assert.equal(tokens.media?.heroImage?.minWidth, '1600px');
  assert.equal(tokens.media?.heroImage?.minHeight, '1000px');
  assert.match(tokens.media?.heroImage?.safeTextArea ?? '', /42%|35%/);
  assert.equal(tokens.media?.caseCardImage?.aspectRatio, '4 / 3');
  assert.equal(tokens.media?.blogThumbnail?.aspectRatio, '16 / 9');
  assert.match(tokens.media?.blogThumbnail?.safeTextArea ?? '', /12%/);
});

test('official CSS consumes real theme aliases and has no active v4 palette tokens', async () => {
  const css = await text('tokens/brand.css');
  assert.match(css, /\[data-mg-theme="light"\]/);
  assert.match(css, /\[data-mg-theme="dark"\]/);
  assert.match(css, /--mg-bg:\s*var\(--mg-/);
  assert.match(css, /background:\s*var\(--mg-bg\)/);
  assert.doesNotMatch(css, /--mg-(clay|sage|ochre)/i);
});

test('canonical docs expose only the new active design system', async () => {
  const paths = [
    'DESIGN.md',
    'DESIGN_QUICKSTART.md',
    'AGENTS.md',
    'ANTI_PATTERNS.md',
    'PHOTO_TREATMENT.md',
    'README.md',
    'PROMPTS.md',
    'index.html',
  ];
  const active = (await Promise.all(paths.map(text))).join('\n');
  assert.match(active, /Editorial Showroom/);
  assert.doesNotMatch(active, /동네 온기|Neighborhood Warmth|--mg-clay|--mg-sage|--mg-ochre/);
});

test('retired visual previews are absent instead of competing with the canonical guide', async () => {
  const retired = [
    'legacy-preview-v3.html',
    '브랜드가이드라인_시안/index.html',
    '브랜드가이드라인_시안/concept-a-warm-wood.html',
    '브랜드가이드라인_시안/concept-b-blueprint.html',
    '브랜드가이드라인_시안/concept-c-neighborhood.html',
  ];
  for (const path of retired) {
    await assert.rejects(access(join(root, path)), { code: 'ENOENT' });
  }
});

test('central design system contains no blog, article-detail, or consultation product flow', async () => {
  const retiredProductFlow = [
    'design-system/demo',
    'design-system/demo/BlogHome.jsx',
    'design-system/demo/ArticleDetail.jsx',
    'design-system/demo/ConsultForm.jsx',
  ];
  for (const path of retiredProductFlow) {
    await assert.rejects(access(join(root, path)), { code: 'ENOENT' });
  }
});

test('component playground has no product routing or customer-information form', async () => {
  const paths = [
    'design-system/playground/index.html',
    'design-system/playground/main.js',
    'design-system/playground/styles.css',
  ];
  const playground = (await Promise.all(paths.map(text))).join('\n');
  assert.match(playground, /BrandLockup/);
  assert.match(playground, /ArticleCard/);
  assert.match(playground, /StatusText/);
  assert.match(playground, /data-mg-theme|setAttribute\(['"]data-mg-theme/);
  assert.doesNotMatch(playground, /BlogHome|ArticleDetail|ConsultForm|<form\b|type=["']tel["']|전화번호|방문 주소|개인정보|상담 신청|라우팅/);
});

test('design playground dev server keeps the repository root for shared token assets', async () => {
  const packageJson = JSON.parse(await text('package.json'));
  const command = packageJson.scripts?.['dev:design'] ?? '';

  assert.match(command, /^vite\s+--host\s+127\.0\.0\.1$/);
  assert.doesNotMatch(command, /vite\s+design-system\/playground/);
});

test('React UI kit keeps generic card, navigation, theme, and state contracts', async () => {
  const articleCard = await text('design-system/components/ArticleCard.jsx');
  const glassNav = await text('design-system/components/GlassNav.jsx');
  const playground = await text('design-system/playground/index.html');

  assert.match(articleCard, /\.\.\.rest/);
  assert.match(articleCard, /href/);
  assert.match(glassNav, /aria-expanded/);
  assert.match(glassNav, /Escape/);
  assert.doesNotMatch(glassNav, /블로그|방문실측|상담/);
  assert.match(playground, /data-mg-theme/);
  assert.match(playground, /aria-busy="true"/);
  assert.match(playground, /disabled/);
  assert.match(playground, /mg-status--success/);
  assert.match(playground, /mg-status--error/);
});

test('authority docs assign product screens and customer journeys to downstream projects', async () => {
  const paths = ['DESIGN.md', 'README.md', 'AGENTS.md', 'DESIGN_QUICKSTART.md', 'PROMPTS.md'];
  const documents = await Promise.all(paths.map(text));
  for (const [index, source] of documents.entries()) {
    assert.match(source, /실제 화면, URL, 메뉴, 정보구조, 고객 여정, CTA 연결은 하위 프로젝트 권한이다/, paths[index]);
  }
  const combined = documents.join('\n');
  assert.match(combined, /중앙 브랜드는 시각·브랜드·공통 컴포넌트 계약만 관리한다/);
  assert.match(combined, /플레이그라운드는 제품 시안이나 구현 오더가 아니다/);
  assert.match(combined, /서비스 프로젝트는 플레이그라운드 화면을 복사하지 않고 토큰과 공통 컴포넌트 계약만 적용한다/);
});

test('active design files contain no unsupported claims or empty links', async () => {
  const paths = [
    'BRAND_GUIDELINE.html',
    'design-system/playground/index.html',
    'design-system/playground/main.js',
  ];
  const active = (await Promise.all(paths.map(text))).join('\n');
  assert.doesNotMatch(active, /도어\s*업계\s*1위|대한민국\s*No\.1|고객만족\s*100%|최저가\s*보장|영업일\s*기준\s*1일|절대\s*추가금\s*없음|무조건\s*가능/);
  assert.doesNotMatch(active, /href=["']#["']/);
});

test('Tmoney font is included once and matches the official distribution hash', async () => {
  const fontDir = join(root, 'design-system', 'assets', 'fonts');
  const files = (await readdir(fontDir)).filter((name) => /TmoneyRoundWind.*\.(ttf|otf)$/i.test(name));
  assert.deepEqual(files, ['TmoneyRoundWindExtraBold.ttf']);
  const bytes = await readFile(join(fontDir, files[0]));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '6a7c0fd1d71a3b78584bf337a6608137071eeff337087025948678a144415edc');
});
