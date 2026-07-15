---
version: v5.0
updated: 2026-07-15
concept: Editorial Showroom
primary: Ink
secondary: Forest
font-display: Tmoney RoundWind ExtraBold
font-body: Pretendard Variable
token-entry: tokens/brand.css
structured-source: tokens/brand.tokens.json
visual-guide: BRAND_GUIDELINE.html
playground: design-system/playground/
---

# 문장군 공식 디자인 시스템

> 좋은 문을 고르는 일, 어렵지 않게 도와드립니다.

이 문서는 문장군 중앙 디자인 정본이다. 디자인 판단이 충돌하면 `BRAND_CONTEXT.md`, `FIELD_JUDGMENT_RULES.md`, `EVIDENCE_REGISTER.md`의 사실·현장·근거 규칙을 먼저 지키고 이 문서를 시각 기준으로 적용한다.

## 1. 정본과 적용 순서

1. `DESIGN.md`: 사람을 위한 공식 기준
2. `tokens/brand.tokens.json`: primitive → semantic → component 구조화 원본
3. `tokens/brand.css`: 웹 구현 공식 진입점
4. `BRAND_GUIDELINE.html`: 정본의 브라우저 시각 가이드
5. `design-system/components/`: 하위 프로젝트가 참고하는 공통 React 컴포넌트 계약
6. `design-system/playground/`: 공통 상태와 접근성만 확인하는 정적 플레이그라운드

과거 시험용 팔레트·토큰·미리보기는 활성 기준으로 보존하지 않는다. 변경 이력은 Git과 `CHANGELOG.md`에서 확인한다.

## 2. 디자인 방향 — Editorial Showroom

밝고 정돈된 주거 쇼룸에 편집 매거진의 정보 위계를 결합한다. 큰 한글 헤드라인, 여백이 넉넉한 화면, 실제 공간 이미지, 얇고 단정한 경계, 유리 질감 내비게이션을 사용한다.

- Primary: Ink — 문장, 주요 CTA, 정보 위계
- Secondary: Forest — 상담·도움·선택 상태와 포커스
- Neutral: 사진과 콘텐츠가 주인공이 되는 배경과 표면
- Status: 성공·정보·경고·오류의 의미 전달에만 사용

다크 테마도 같은 위계를 유지한다. 단순 반전이 아니라 배경, 표면, 본문, 경계, 액션 의미 토큰을 함께 전환한다.

## 3. 브랜드 표현

### 타입 락업

- 주 표기: `문장군`
- 보조 표기: `MUNJANGGUN`
- 별도 그래픽 마크나 임시 SVG를 공식 로고처럼 만들지 않는다.
- 한글 락업과 큰 제목은 Tmoney RoundWind ExtraBold, UI와 본문은 Pretendard를 사용한다.
- Tmoney 파일은 티머니 공식 배포본과 해시가 같은 한 사본만 저장한다.

### 말의 기준

무료 방문실측은 자동 견적이나 고객의 최종 제품 결정을 뜻하지 않는다. 가격·가능 여부·추가금에 대한 불안을 줄이고, 집 구조와 고객 관심을 함께 살피는 상담 경험으로 설명한다.

허용되는 핵심 표현:

- 좋은 문을 고르는 일, 어렵지 않게 도와드립니다.
- 무료 방문실측으로 집에 맞는 선택을 함께 좁혀드립니다.
- 직접 제작과 전속 시공으로 끝까지 책임집니다.

근거 없이 쓰지 않는 표현:

- 최저가 보장, 대한민국 No.1, 업계 최고, 고객만족 100%
- 무조건 가능, 절대 추가금 없음
- 확인되지 않은 연락 완료 시점
- 방문실측만으로 견적이나 제품이 자동 확정된다는 표현

## 4. 토큰 구조

### Primitive

원시 색상, 간격, 크기, radius, 타이포그래피 값이다. 공식 토큰 정의 외 구현에서 직접 소비하지 않는다.

- Ink: `--mg-color-ink-*`
- Forest: `--mg-color-forest-*`
- Neutral: `--mg-color-neutral-*`
- Status: `--mg-color-success-*`, `--mg-color-info-*`, `--mg-color-warning-*`, `--mg-color-danger-*`
- Spacing: `--mg-space-1`부터 `--mg-space-8`
- Radius: `--mg-radius-chip`, `card`, `frame`, `field`, `lg`, `pill`, `xl`, `full`

### Semantic

테마와 의미가 있는 별칭이다. 화면 구현은 이 층을 기본으로 사용한다.

- 배경과 글자: `--mg-bg`, `--mg-surface`, `--mg-surface-raised`, `--mg-fg`, `--mg-text-body`, `--mg-text-soft`
- 액션: `--mg-action-primary-*`, `--mg-action-secondary-*`, `--mg-action-soft-*`
- 경계와 포커스: `--mg-border-*`, `--mg-focus-ring`
- 상태: `--mg-status-success`, `--mg-status-info`, `--mg-status-warning`, `--mg-status-error`

### Component

Button, Card, Field, GlassNav 등 반복 요소의 높이·radius·상태 별칭이다. 핵심 클릭 요소는 최소 `--mg-control-size-min`인 44px을 보장한다.

## 5. 타이포그래피

- Display: Tmoney RoundWind ExtraBold 800
- Body/UI: Pretendard Variable 400–800
- Hero: `--mg-font-size-hero`, 모바일 `--mg-font-size-hero-mobile`
- Section: `--mg-font-size-section`
- Card: `--mg-font-size-card`
- Body: `--mg-font-size-body`, 큰 본문 `--mg-font-size-body-lg`
- Label/Caption: `--mg-font-size-label`, `--mg-font-size-caption`

헤드라인은 짧고 단단하게, 본문은 고객이 가격·가능 여부·공간 조건을 차분히 이해할 수 있게 쓴다. 본문에 디스플레이 서체를 반복하지 않는다.

## 6. 컴포넌트

### Button

- Primary는 Ink, Secondary는 Forest, Soft는 테마 표면을 사용한다.
- 모든 상태에 hover, active, focus-visible, disabled를 제공한다.
- 로딩 상태는 실제 `disabled`와 `aria-busy`를 함께 사용한다.

### ArticleCard

- 링크 또는 버튼 의미를 실제 루트 요소에 부여한다.
- `href`, `onClick`, `aria-*`, `data-*` 등 전달 속성을 루트에 그대로 전달한다.
- 이미지에 대체 텍스트를 제공하고 로딩·오류 상태는 색 외 텍스트로도 구분한다.

### GlassNav

- 메뉴명, 선택 동작, 보조 액션은 하위 프로젝트가 주입하며 중앙 컴포넌트는 특정 채널 문구를 하드코딩하지 않는다.
- 모바일에서는 44px 이상 메뉴 버튼, `aria-expanded`, `aria-controls`를 사용한다.
- Escape, 메뉴 선택, 보조 액션으로 메뉴가 닫히고 포커스가 복구된다.

### Field와 StatusText

- 라벨을 항상 표시하고 placeholder로 대체하지 않는다.
- 오류는 필드별 `aria-invalid`와 `aria-describedby`로 연결한다.
- 일반 진행은 `role=status`, 제출 오류는 `role=alert`를 사용한다.

## 7. 중앙 브랜드와 하위 프로젝트의 권위 경계

중앙 브랜드는 시각·브랜드·공통 컴포넌트 계약만 관리한다.

실제 화면, URL, 메뉴, 정보구조, 고객 여정, CTA 연결은 하위 프로젝트 권한이다.

플레이그라운드는 제품 시안이나 구현 오더가 아니다. 서비스 프로젝트는 플레이그라운드 화면을 복사하지 않고 토큰과 공통 컴포넌트 계약만 적용한다.

`design-system/playground/`는 BrandLockup, Button, Chip, Field, StatusText, SectionHeading, ArticleCard의 상태와 light/dark, focus-visible, reduced-motion, 모바일 반응형을 확인한다. 블로그 홈·상세·상담 화면이나 실제 고객 정보를 받는 흐름은 두지 않는다.

## 8. 이미지와 사진

- 밝은 자연광의 실제 주거 공간과 제품이 함께 보이는 사진을 우선한다.
- 제품만 잘라낸 이미지보다 바닥·벽·가구가 포함된 맥락 이미지를 우선한다.
- 상담·실측 장면은 고객 개인정보가 드러나지 않는 공식 검수 자산만 사용한다.
- 가격·이벤트·스펙 문구가 포함된 이미지는 `EVIDENCE_REGISTER.md`와 `OPEN_QUESTIONS_REGISTER.md`로 최신성을 확인한다.
- 상세 기준은 `PHOTO_TREATMENT.md`, 자산 선택은 `SOURCE_REGISTRY.md`, `ASSET_SEMANTIC_INDEX.md`, 상품별 manifest를 따른다.

## 9. 접근성과 반응형

- skip link, landmark, 논리적 heading 구조를 제공한다.
- 키보드만으로 모든 노출 조작 요소를 사용할 수 있어야 한다.
- `prefers-reduced-motion: reduce`에서 큰 움직임과 부드러운 스크롤을 제거한다.
- 모바일 390×844에서 플레이그라운드의 탐색·필드·카드·버튼이 잘리지 않고 가로 overflow가 없어야 한다.
- 색만으로 상태를 구분하지 않는다.

## 10. 하드코딩 정책

색상, 그림자, 투명도, 간격, radius, 제어 높이, 글자 크기는 토큰을 사용한다. 다음만 문서화된 예외로 허용한다.

- 반응형 media query breakpoint
- `clamp()`의 viewport 비율
- 사진 veil의 gradient stop
- 실제 콘텐츠 이미지의 `object-position`

예외 값도 여러 파일에서 반복되면 토큰으로 승격한다.

## 11. 검증

```text
npm test
npm run validate
npm run validate:tokens
npm run validate:design-system
git diff --check
```

공식 가이드와 플레이그라운드는 1440×900 및 390×844에서 테마, 키보드, reduced-motion, 컴포넌트 상태, overflow, 44px 조작 영역을 실제 브라우저로 확인한다.
