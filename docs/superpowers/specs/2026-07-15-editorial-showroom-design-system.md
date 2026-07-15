# 문장군 Editorial Showroom 디자인 시스템 통합 설계

> 상태: 사용자 승인 완료
> 승인일: 2026-07-15
> 범위: 중앙 브랜드 저장소 내부 정본, 공통 컴포넌트 계약, 상태 플레이그라운드
> 후속 재검수: 제품 흐름 데모는 중앙 권한을 넘으므로 제거하고 하위 프로젝트 경계를 확정함

## 1. 목표

기존 시험용 v4 디자인 시스템을 병렬 보존하지 않고, Ink Primary / Forest Secondary 기반 Editorial Showroom 시스템으로 교체한다. 사용자가 따라갈 활성 디자인 정본은 `DESIGN.md` 하나이며, 브라우저 가이드는 `BRAND_GUIDELINE.html`, 구현 토큰 진입점은 `tokens/brand.css`다.

## 2. 권위와 구조

1. `DESIGN.md`: 사람을 위한 공식 정본
2. `tokens/brand.tokens.json`: 구조화 토큰 원본
3. `tokens/brand.css`: 모든 CSS 토큰을 노출하는 공식 진입점
4. `BRAND_GUIDELINE.html`: 정본의 브라우저 시각 가이드
5. `design-system/components/`: 공통 React 컴포넌트 계약
6. `design-system/playground/`: 제품 흐름 없는 상태·테마·접근성 플레이그라운드

토큰은 `primitive → semantic → component` 세 층으로 구성한다. 데모와 가이드는 primitive 값을 직접 소비하지 않고 semantic 또는 component 토큰을 사용한다.

## 3. ZIP 선별 매핑

| ZIP 항목 | 처리 | 중앙 위치 또는 이유 |
| --- | --- | --- |
| `uploads/BRAND_DESIGN_SYSTEM.md`, `.html` | 근거 자료로 선별 통합 | `DESIGN.md`, `BRAND_GUIDELINE.html`로 재작성 |
| `tokens/*.css` | 값과 계층을 검토 후 재구성 | `tokens/brand.tokens.json`, `tokens/brand.css` |
| `components/core/*` | 핵심 JSX를 수정·통합 | `design-system/components/` |
| `ui_kits/blog/*` | 제품 흐름은 제외하고 상태·접근성 패턴만 선별 | `design-system/playground/` |
| Tmoney RoundWind ExtraBold 두 사본 | 공식 배포본과 SHA-256 일치 확인 후 1개만 통합 | `design-system/assets/fonts/` |
| `_ds_manifest.json`, `_ds_bundle.js`, `_adherence.oxlintrc.json`, `.thumbnail` | 제외 | Fable 생성기 전용 부산물 |
| `templates/blog/*` | 제외 | UI Kit와 중복 |
| `guidelines/*.html`, `*.prompt.md`, `*.d.ts`, `core.card.html`, `thumbnail.html` | 제외 | 정본·컴포넌트와 중복되거나 생성기용 |

## 4. 권위 경계와 플레이그라운드

- 중앙 브랜드는 시각·브랜드·공통 컴포넌트 계약만 관리한다.
- 실제 화면, URL, 메뉴, 정보구조, 고객 여정, CTA 연결은 하위 프로젝트 권한이다.
- 플레이그라운드는 제품 시안이나 구현 오더가 아니며 제품 화면 사이의 전환이나 고객정보 입력을 포함하지 않는다.
- 테마 버튼은 `data-mg-theme`을 실제로 바꾸고 계산 색상도 달라진다.
- BrandLockup, Button, Chip, Field, StatusText, SectionHeading, ArticleCard의 공통 상태만 확인한다.

## 5. 접근성과 상태

- skip link, `main`, `nav`, 명시적 heading 구조를 사용한다.
- 모든 실제 클릭 대상은 최소 44×44px이며 `:focus-visible`을 제공한다.
- 필드 오류 예시는 입력의 `aria-invalid`, `aria-describedby`에 연결한다.
- 일반 진행 상태는 `role=status`, 오류 요약은 `role=alert`를 사용한다.
- reduced-motion에서는 전환과 애니메이션을 제거한다.
- 카드 이미지 대체 텍스트와 아이콘 버튼의 접근 가능한 이름을 제공한다.

## 6. 기존 v4 처리

현행 `DESIGN.md`, `DESIGN_QUICKSTART.md`, `BRAND_GUIDELINE.html`, `tokens/`, `index.html`, `AGENTS.md`, `ANTI_PATTERNS.md`, `PHOTO_TREATMENT.md`, `README.md`, `PROMPTS.md`의 활성 v4 참조를 새 시스템으로 교체한다. 별도 v4 미리보기는 만들지 않는다. 과거 변경 이력은 Git과 `CHANGELOG.md`에만 남긴다. 브랜드 사실·현장 판단·사진 원칙·근거 규칙은 유지한다.

## 7. 시작 상태 기록

- 브랜치: `codex/brand-ops-validation`
- 기준 HEAD: `a9d1efdecb409b620320bbe7be0dc554262fdf35`
- 기존 수정: `CHANGELOG.md`, `PROMPTS.md`, `README.md`
- 기존 미추적: `.gitattributes`, `.github/workflows/validate-brand.yml`, `OPERATING_INDEX.md`, `package.json`, `schemas/`, `scripts/`, `templates/`, `test/`
- 위 변경은 사용자의 기존 작업으로 간주하고 되돌리거나 덮어쓰지 않는다.

## 8. 완료 조건

저장소 검증, 디자인 시스템 전용 검증, diff 검사, 두 뷰포트 브라우저 검수, 테마·키보드·상태·링크·overflow·44px·금지 주장·토큰 충돌 검사를 모두 통과해야 완료다.
