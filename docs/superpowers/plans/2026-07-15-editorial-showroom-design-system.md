# 문장군 Editorial Showroom 구현 계획

> 설계: `docs/superpowers/specs/2026-07-15-editorial-showroom-design-system.md`
> 실행 원칙: 테스트를 먼저 실패시키고, 최소 구현으로 통과시킨 뒤 브라우저 검증까지 반복한다.

## Task 1. 구조·콘텐츠 정적 검증부터 추가

- `scripts/validate-design-system.mjs`와 `test/design-system-contract.test.mjs`를 추가한다.
- 필수 파일, 세 층 토큰, 테마 소비, 금지 주장, 빈 링크/깨진 앵커, 구형 활성 토큰, 44px·focus·reduced-motion·제품 흐름 부재 계약을 검사한다.
- 실패를 확인한 뒤 구현한다.

## Task 2. 토큰과 공식 정본 교체

- `tokens/brand.tokens.json`, `tokens/brand.css`를 Ink/Forest 및 primitive/semantic/component 구조로 교체한다.
- `DESIGN.md`, `DESIGN_QUICKSTART.md`, `AGENTS.md`, `ANTI_PATTERNS.md`, `PHOTO_TREATMENT.md`를 새 정본에 맞춘다.
- 기존 브랜드 사실과 사진·근거 규칙은 보존한다.

## Task 3. React 컴포넌트와 플레이그라운드 구현

- `design-system/components/`에 ArticleCard, BrandLockup, Button, Chip, Field, GlassNav, SectionHeading, StatusText를 구현한다.
- `design-system/playground/`에 공통 컴포넌트 상태, 테마 전환, 모바일 반응형, 접근성 검증만 구현한다.
- 공식 Tmoney 파일 한 사본과 출처 문서를 추가한다.

## Task 4. 공식 시각 가이드와 운영 문서 동기화

- `BRAND_GUIDELINE.html`을 신규 토큰 기반 정적 가이드로 교체한다.
- `index.html`, `README.md`, `PROMPTS.md`, `SOURCE_REGISTRY.md`, `CHANGELOG.md`, 검증기를 동기화한다.
- 기존 v4 활성 링크·문구·토큰을 제거한다.

## Task 5. 자동·브라우저 검증

- `npm test`, `npm run validate`, `npm run validate:tokens`, `npm run validate:design-system`, `git diff --check`를 반복 실행한다.
- 인앱 Browser가 가능하면 우선 사용하고, 실패 시 Playwright CLI로 동일 흐름을 검증한다.
- 1440×900, 390×844에서 테마, 키보드, reduced-motion, 공통 상태, 링크, overflow, 44px를 검증한다.
