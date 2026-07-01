# 문장군 중앙 브랜드 문서

> 버전: v3.9
> 최종 업데이트: 2026-07-01
> 변경 요약: 신규 상품 5개 상세페이지 자산 572개를 상품 위키 체계에 추가 등록

이 폴더는 문장군 브랜드의 중앙 원본입니다.

모든 문장군 관련 프로젝트는 콘텐츠, 디자인, 웹앱, 자동화, 프롬프트 작성 시 이 폴더의 문서를 우선 참조합니다.

## 처음 온 프로젝트 총괄 5분 루트

처음 온 총괄은 전체 문서 목록을 모두 읽기 전에, 지금 작업 유형을 먼저 고릅니다.

공통으로 먼저 읽을 문서:

```text
README.md
BRAND_CONTEXT.md
FIELD_JUDGMENT_RULES.md
EVIDENCE_REGISTER.md
OPEN_QUESTIONS_REGISTER.md
```

작업 유형별 추가 입구:

| 작업 유형 | 먼저 볼 문서 |
| --- | --- |
| 디자인, 랜딩, 카드뉴스, 썸네일 | `DESIGN_QUICKSTART.md` → `DESIGN.md` → `PHOTO_TREATMENT.md` → `ANTI_PATTERNS.md` |
| 웹앱, 랜딩 구현 | `tokens/brand.tokens.json` → `tokens/brand.css` |
| 상품 설명, 상세페이지, 이미지/GIF/썸네일 사용 | `BRAND_WIKI_ARCHITECTURE.md` → `SOURCE_REGISTRY.md` → `PRODUCT_WIKI_INDEX.md` → 필요한 상품 위키 → `ASSET_SEMANTIC_INDEX.md` → 상품별 `asset-manifest.json` |
| 고객/현장/리뷰/FAQ/카피 원료 사용 | `BRAND_MATERIAL_INDEX.md` → 필요한 개별 원료 은행 문서 |
| 프로젝트에 중앙 기준 연결 | `PROJECT_ADAPTERS.md` → `PROMPTS.md` |

중요: 상품/이미지 자산은 "찾을 수 있음"과 "어떤 맥락에서 다시 쓸 수 있음"이 다릅니다. `문장군상품/` 아래 현재 등록된 상품별 상세페이지 자산은 문장군이 공식 제작·검토한 결과물이므로 중앙 브랜드 위키에서 별도 OCR/육안 개인정보 검수를 다시 요구하지 않습니다. 다만 가격, 이벤트, 월 납입, 스펙, 옵션, 전원/센서, 보강, 패키지 구성처럼 시간이 지나면 달라지거나 현장 조건에 따라 달라질 수 있는 문구를 원본 상세페이지 맥락 밖에서 재사용할 때는 최신성을 확인합니다.

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| BRAND_CONTEXT.md | 문장군이 무엇을 말해야 하는지 정리한 브랜드 컨텍스트 |
| FIELD_JUDGMENT_RULES.md | 고객 오해, 시공 가능 여부, 추가금, AppSheet 현장 활용 등 실제 현장 판단 기준 |
| DESIGN.md | 문장군이 어떻게 보여야 하는지 정리한 브랜드 디자인 기준 |
| DESIGN_QUICKSTART.md | DESIGN.md v3.0을 실무자가 빠르게 적용하기 위한 1장 요약 |
| PHOTO_TREATMENT.md | 실제 시공 사진의 밝기, 색온도, 수직선, 개인정보, 크롭 기준 |
| ANTI_PATTERNS.md | 문장군답지 않은 디자인 패턴과 대체 기준 |
| EVIDENCE_REGISTER.md | 리뷰 수, 가격, A/S, 일정 등 변동 claim의 기준일과 근거 관리 |
| NAVER_BRANDSTORE_PRODUCT_EXPORT_2026-06-30.md | 사용자 제공 네이버 스마트스토어 상품 CSV export 기반 상품군·기준 판매가·할인 상태 기록 |
| PRODUCT_THUMBNAIL_ASSET_INDEX_2026-06-30.md | 네이버 스마트스토어 공개 판매 상품 14개 썸네일 자산과 manifest 관리 |
| THREE_PANEL_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-06-30.md | 3연동중문 상세페이지 이미지/GIF 이전 스냅샷 |
| THREE_PANEL_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md | 3연동중문 교체본 202개 자산 구조와 재사용 manifest 관리 |
| ONE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md | 원슬라이딩중문 신규 105개 자산 구조와 재사용 manifest 관리 |
| THREE_PANEL_AUTO_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md | 3연동 자동중문 131개 자산 구조와 재사용 manifest 관리 |
| THREE_PANEL_LSHAPE_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md | 3연동 ㄱ자 중문 120개 자산 구조와 재사용 manifest 관리 |
| ABS_DOOR_REPLACEMENT_DETAILPAGE_ASSET_INDEX_2026-07-01.md | ABS도어 방문교체 90개 자산 구조와 재사용 manifest 관리 |
| SWING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md | 스윙중문 84개 자산 구조와 재사용 manifest 관리 |
| WIDE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md | 양개형중문/미서기 147개 자산 구조와 재사용 manifest 관리 |
| OPEN_QUESTIONS_REGISTER.md | 사장 확인, 최신 캡처, 운영 정책 확인이 필요한 항목 추적 |
| BRAND_WIKI_ARCHITECTURE.md | codebase-memory와 구분되는 문장군 브랜드 위키 권위·ID·검색 구조 |
| SOURCE_REGISTRY.md | 상품 상세페이지, CSV, 이미지 묶음 등 유입 소스 등록부 |
| PRODUCT_WIKI_INDEX.md | 상품별 위키 문서와 상태, 연결 자산의 입구 |
| PRODUCT_WIKI_3PANEL_MIDDLE_DOOR.md | 3연동중문과 베이직/모던/클래식/아트 컬렉션 상품 위키 |
| PRODUCT_WIKI_ONE_SLIDING_MIDDLE_DOOR.md | 원슬라이딩중문과 베이직/모던/클래식/아트 컬렉션 상품 위키 |
| PRODUCT_WIKI_3PANEL_AUTO_MIDDLE_DOOR.md | 3연동 자동중문 상품 위키 |
| PRODUCT_WIKI_3PANEL_LSHAPE_MIDDLE_DOOR.md | 3연동 ㄱ자 중문 상품 위키 |
| PRODUCT_WIKI_ABS_DOOR_REPLACEMENT.md | ABS도어 방문교체 상품 위키 |
| PRODUCT_WIKI_SWING_MIDDLE_DOOR.md | 스윙중문 상품 위키 |
| PRODUCT_WIKI_WIDE_SLIDING_MIDDLE_DOOR.md | 양개형중문/미서기 상품 위키 |
| ASSET_SEMANTIC_INDEX.md | 이미지/GIF의 의미, 태그, 추천 용도, 주의 claim을 관리하는 의미 인덱스 |
| BRAND_MATERIAL_INDEX.md | 고객·제품·현장·리뷰·증거·FAQ·카피 원료 은행의 입구와 권위 관계 |
| RAW_MATERIAL_INTAKE_PROTOCOL.md | 연계 프로젝트 자료를 중앙 브랜드 원료로 승격하는 절차 |
| CUSTOMER_SEGMENTS.md | 고객을 상황, 집 구조, 불안 유형으로 분류한 원료 |
| PRODUCT_SELECTION_GUIDE.md | 제품별 고려 조건, 주의 조건, 실측 질문, 콘텐츠 각도 |
| FIELD_STORY_BANK.md | 개인정보 없이 활용 가능한 비식별 현장 이야기 패턴 |
| REVIEW_PROOF_BANK.md | 리뷰 원문이 아니라 리뷰가 증명하는 불안 해소 유형과 안전 표현 |
| PROOF_ASSET_INDEX.md | 사진, 리뷰, AppSheet, 운영 증거의 비식별 색인 |
| FAQ_OBJECTION_BANK.md | 가격, 추가금, 일정, A/S, 거주중 시공 등 상담 FAQ 원료 |
| COPY_ASSET_BANK.md | 블로그, 인스타그램, 릴스, 랜딩에서 쓰는 안전한 제목/CTA/후킹 원료 |
| tokens/brand.tokens.json | DESIGN.md 토큰을 구현용 구조화 데이터로 옮긴 파일 |
| tokens/brand.css | 웹앱과 랜딩에서 바로 쓸 수 있는 CSS 변수 토큰 |
| preview.html | DESIGN.md v3.0을 브라우저에서 확인하는 정적 디자인 미리보기 |
| index.html | GitHub Pages 루트에서 preview.html로 안내하는 진입 페이지 |
| PROJECT_ADAPTERS.md | 블로그, 인스타그램, 릴스, 웹앱 등 프로젝트별 어댑터 운영 방식 |
| CHANGELOG.md | 브랜드 기준 변경 이력 |
| PROMPTS.md | 각 프로젝트 총괄 세션에 전달할 적용 프롬프트 |
| AGENTS.md | 중앙 브랜드 책임자와 에이전트 작업 지침 |
| TEAM.md | 브랜드 운영팀 역할, 책임 범위, 협업 흐름 |
| BRAND_RAW_MATERIAL_GAP_AUDIT_2026-06-30.md | 2026-06-30 기준 브랜드 원료 부족분과 보강 범위 감사 |
| PROJECT_RELATIONSHIP_AUDIT_2026-06-25.md | 문장군 연계 프로젝트 조사 분석 |

## 목적별 빠른 묶음

문서를 삭제하거나 합치기보다, 목적별로 아래 묶음에서 필요한 문서만 먼저 확인합니다.

| 목적 | 문서 |
| --- | --- |
| 필수 기준 | `BRAND_CONTEXT.md`, `FIELD_JUDGMENT_RULES.md`, `EVIDENCE_REGISTER.md`, `OPEN_QUESTIONS_REGISTER.md` |
| 디자인 | `DESIGN.md`, `DESIGN_QUICKSTART.md`, `PHOTO_TREATMENT.md`, `ANTI_PATTERNS.md`, `tokens/` |
| claim/증거 | `EVIDENCE_REGISTER.md`, `PROOF_ASSET_INDEX.md`, `REVIEW_PROOF_BANK.md` |
| 원료 은행 | `BRAND_MATERIAL_INDEX.md`, `CUSTOMER_SEGMENTS.md`, `PRODUCT_SELECTION_GUIDE.md`, `FIELD_STORY_BANK.md`, `FAQ_OBJECTION_BANK.md`, `COPY_ASSET_BANK.md` |
| 상품/자산 위키 | `BRAND_WIKI_ARCHITECTURE.md`, `SOURCE_REGISTRY.md`, `PRODUCT_WIKI_INDEX.md`, 상품별 위키, `ASSET_SEMANTIC_INDEX.md`, 상품별 `asset-manifest.json` |
| 프로젝트 하달 | `PROJECT_ADAPTERS.md`, `PROMPTS.md`, `AGENTS.md`, `TEAM.md` |
| 감사/스냅샷 | `CHANGELOG.md`, `BRAND_RAW_MATERIAL_GAP_AUDIT_2026-06-30.md`, `PROJECT_RELATIONSHIP_AUDIT_2026-06-25.md` |

## 운영 원칙

중앙 브랜드 문서는 문장군 브랜드의 기본 기준입니다.

단, 블로그, 인스타그램, 웹앱, 운영 자동화 등 각 프로젝트의 채널 특성과 기존 구조에 따라 보조 규칙을 둘 수 있습니다.

프로젝트별 보조 규칙은 중앙 원본과 충돌하지 않게 분리해서 관리합니다. 충돌이 발생하면 중앙 원본을 우선 검토하고, 필요한 경우 중앙 원본 자체를 업데이트합니다.

## GitHub 기준 경로

공개 중앙 원본 저장소:

```text
https://github.com/westgeneraldoor/munjanggun-brand
```

각 프로젝트와 GPT/Codex 세션은 GitHub 기준으로 아래 상대 경로를 우선 참조합니다.

```text
./BRAND_CONTEXT.md
./FIELD_JUDGMENT_RULES.md
./DESIGN.md
./DESIGN_QUICKSTART.md
./PHOTO_TREATMENT.md
./ANTI_PATTERNS.md
./EVIDENCE_REGISTER.md
./NAVER_BRANDSTORE_PRODUCT_EXPORT_2026-06-30.md
./PRODUCT_THUMBNAIL_ASSET_INDEX_2026-06-30.md
./THREE_PANEL_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-06-30.md
./THREE_PANEL_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md
./ONE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md
./THREE_PANEL_AUTO_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md
./THREE_PANEL_LSHAPE_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md
./ABS_DOOR_REPLACEMENT_DETAILPAGE_ASSET_INDEX_2026-07-01.md
./SWING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md
./WIDE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md
./OPEN_QUESTIONS_REGISTER.md
./BRAND_WIKI_ARCHITECTURE.md
./SOURCE_REGISTRY.md
./PRODUCT_WIKI_INDEX.md
./PRODUCT_WIKI_3PANEL_MIDDLE_DOOR.md
./PRODUCT_WIKI_ONE_SLIDING_MIDDLE_DOOR.md
./PRODUCT_WIKI_3PANEL_AUTO_MIDDLE_DOOR.md
./PRODUCT_WIKI_3PANEL_LSHAPE_MIDDLE_DOOR.md
./PRODUCT_WIKI_ABS_DOOR_REPLACEMENT.md
./PRODUCT_WIKI_SWING_MIDDLE_DOOR.md
./PRODUCT_WIKI_WIDE_SLIDING_MIDDLE_DOOR.md
./ASSET_SEMANTIC_INDEX.md
./BRAND_MATERIAL_INDEX.md
./RAW_MATERIAL_INTAKE_PROTOCOL.md
./CUSTOMER_SEGMENTS.md
./PRODUCT_SELECTION_GUIDE.md
./FIELD_STORY_BANK.md
./REVIEW_PROOF_BANK.md
./PROOF_ASSET_INDEX.md
./FAQ_OBJECTION_BANK.md
./COPY_ASSET_BANK.md
./tokens/brand.tokens.json
./tokens/brand.css
./preview.html
./index.html
./PROJECT_ADAPTERS.md
./CHANGELOG.md
./PROMPTS.md
./AGENTS.md
./TEAM.md
./BRAND_RAW_MATERIAL_GAP_AUDIT_2026-06-30.md
./PROJECT_RELATIONSHIP_AUDIT_2026-06-25.md
```

## 브랜드 원료 은행

브랜드 원료 은행은 중앙 기준을 대체하지 않고, 각 프로젝트가 안전하게 재사용할 수 있는 고객·제품·현장·리뷰·FAQ·카피 재료를 제공합니다.

## 브랜드 위키

브랜드 위키는 codebase-memory MCP 인덱싱과 다릅니다. MCP는 파일과 문서를 찾는 보조 장치이고, 브랜드 위키는 소스의 권위, 상태, 발행 가능 여부, 의미 태그, 상품 연결, claim 위험을 판단하는 운영 체계입니다.

자료 등록 흐름:

```text
SOURCE_REGISTRY.md
→ 상품별 asset-manifest.json
→ ASSET_SEMANTIC_INDEX.md
→ PRODUCT_WIKI_INDEX.md
→ 상품별 위키
```

자료 사용 흐름:

```text
PRODUCT_WIKI_INDEX.md
→ 필요한 상품별 위키
→ ASSET_SEMANTIC_INDEX.md
→ 상품별 asset-manifest.json
→ SOURCE_REGISTRY.md
→ EVIDENCE_REGISTER.md / OPEN_QUESTIONS_REGISTER.md
```

프로젝트 총괄이 이미지를 찾을 때는 파일명 `001.jpg`를 직접 외우지 않고, `ASSET_SEMANTIC_INDEX.md`에서 `collection:classic`, `asset_topic:frame_size`처럼 의미 태그로 찾습니다.

주의: `ASSET_SEMANTIC_INDEX.md`는 현재 대표 이미지/GIF만 의미 태깅한 인덱스입니다. 여기에 없다고 위험한 자산이라는 뜻은 아니며, 아직 의미 검색용 태그가 덜 붙은 자산입니다. 공식 제작 자산의 개인정보 상태는 `official_reviewed`로 보되, 재사용 맥락과 변동 claim은 별도 확인합니다.

상품 상세페이지 자산 운영 상태:

```text
검색/내부 참고: 가능
공식 제작 개인정보 상태: official_reviewed
재사용 확인: claimRisk, usageStatus, EVIDENCE_REGISTER.md, OPEN_QUESTIONS_REGISTER.md
현재 등록: 3연동중문 202개, 원슬라이딩중문 105개, 3연동 자동중문 131개, 3연동 ㄱ자 중문 120개, ABS도어 방문교체 90개, 스윙중문 84개, 양개형중문/미서기 147개
```

자료가 많아질수록 중앙 원본은 삭제보다 추적 가능한 보존을 우선합니다. 오래된 자료는 `superseded` 또는 `retired`로 낮추고, 새 자료의 `source_id`와 manifest 버전으로 대체 관계를 남깁니다. 대량 자산 변경은 개별 파일이 아니라 `source_id`, manifest 버전, semantic index 범위 단위로 `CHANGELOG.md`에 기록합니다.

권위 순서:

```text
BRAND_CONTEXT.md
FIELD_JUDGMENT_RULES.md
DESIGN.md
EVIDENCE_REGISTER.md
OPEN_QUESTIONS_REGISTER.md
BRAND_WIKI_ARCHITECTURE.md
RAW_MATERIAL_INTAKE_PROTOCOL.md
BRAND_MATERIAL_INDEX.md
각 원료 은행 문서
PROJECT_ADAPTERS.md
각 프로젝트 어댑터
```

원료 은행의 문구나 사례를 쓰기 전 상태값을 확인합니다. `publishable` 또는 `vetted`가 아니면 외부 발행물에 직접 사용하지 않고, 리뷰 수·가격·A/S·일정·이벤트 claim은 `EVIDENCE_REGISTER.md`와 연결된 경우에만 사용합니다.

## 디자인 미리보기

GitHub Pages에서 DESIGN.md v3.0 미리보기를 확인합니다.

```text
https://westgeneraldoor.github.io/munjanggun-brand/
https://westgeneraldoor.github.io/munjanggun-brand/preview.html
```

## 디자인 토큰 권위

디자인 토큰은 아래 순서로 관리합니다.

```text
DESIGN.md front matter
→ tokens/brand.tokens.json
→ tokens/brand.css
→ preview.html 및 각 프로젝트 구현
```

색상, 타이포그래피, radius, spacing, 컴포넌트 토큰을 바꿀 때는 `DESIGN.md`를 먼저 수정하고, `tokens/brand.tokens.json`, `tokens/brand.css`, `preview.html`, `CHANGELOG.md`를 함께 갱신합니다.

미디어 토큰의 구도, 최소 해상도, 텍스트 안전영역 같은 메타데이터는 `DESIGN.md`와 `tokens/brand.tokens.json`을 기준으로 확인합니다. `tokens/brand.css`는 웹 구현에 필요한 CSS 변수만 제공합니다.

명칭 변환 규칙:

- `DESIGN.md`는 kebab-case와 `rounded`를 사용합니다.
- `tokens/brand.tokens.json`은 camelCase와 `radius`를 사용합니다.
- `tokens/brand.css`는 `--mg-*` CSS 변수명을 사용합니다.
- 이름은 달라도 값과 역할은 같아야 합니다.

## 로컬 작업 경로

로컬 Windows 작업 폴더는 다음 위치입니다.

```text
C:\Users\hjh\안티그래비티\문장군_브랜드\
```

## 적용 방식

이 중앙 폴더에서는 원본 문서만 관리합니다.

기존 프로젝트의 파일을 이 세션에서 직접 수정하지 않습니다. 각 프로젝트 반영은 해당 프로젝트 총괄 세션이 중앙 원본을 읽고, 프로젝트 사정에 맞게 직접 세팅합니다.

역할 분리:

| 역할 | 책임 |
| --- | --- |
| 중앙 브랜드 총괄 | 중앙 원본 유지, 적용 기준 제공, 하달 프롬프트 작성, 충돌 판단, 최종 검수 |
| 프로젝트 총괄 | 자기 프로젝트 구조 확인, 중앙 원본 연결 위치 결정, 프로젝트 내부 수정, 변경 파일 보고 |
| 검수 담당 | 금지 표현, 현장 판단, 사진/디자인 기준, 민감 정보, 토큰 사용 여부 확인 |

중앙 총괄의 직접 수정 예외는 `PROJECT_ADAPTERS.md` 8장을 기준으로 판단합니다. 요약하면 긴급 보안 수정, 명백한 참조 오류, 프로젝트 총괄의 명시 요청, 단순 링크/오탈자처럼 운영 위험이 낮고 범위가 좁은 경우에만 각 프로젝트 파일을 직접 수정합니다.

권장 적용 방식:

1. 각 프로젝트 총괄 세션에 PROMPTS.md의 프롬프트를 전달합니다.
2. 총괄 세션이 기존 프로젝트 구조, 자동화, 프롬프트, 문서 위치를 먼저 파악합니다.
3. 중앙 원본을 우선 참조하도록 프로젝트 내부 문서 또는 지침을 정리합니다.
4. 프로젝트 특화 규칙은 중앙 원본과 분리해서 둡니다.
5. 적용 후 변경 파일과 적용 방식을 요약합니다.

## 문서 업데이트 규칙

중앙 원본을 수정할 때는 다음을 지킵니다.

- BRAND_CONTEXT.md, FIELD_JUDGMENT_RULES.md, DESIGN.md 중 어느 문서에 들어갈 내용인지 먼저 판단합니다.
- 실제 상담, 실측, 시공 가능 여부, 추가금, 고객 오해, AppSheet 현장 활용 기준은 FIELD_JUDGMENT_RULES.md에 둡니다.
- 디자인을 빠르게 적용할 때는 DESIGN_QUICKSTART.md를 먼저 읽고, 세부 판단은 DESIGN.md를 확인합니다.
- 실제 시공 사진의 공개 여부와 보정 기준은 PHOTO_TREATMENT.md를 확인합니다.
- 디자인 검수 중 문장군답지 않은 방향이 보이면 ANTI_PATTERNS.md의 대체 기준을 확인합니다.
- 블로그, 인스타그램, 릴스, 웹앱별 적용 방식은 각 프로젝트 어댑터에 두고, 공통 방식만 PROJECT_ADAPTERS.md에 둡니다.
- 숫자, 리뷰, 가격, A/S, 시공 기간처럼 변할 수 있는 정보는 `EVIDENCE_REGISTER.md`에 기준 날짜, 출처, 확인자, 재확인 주기를 함께 남깁니다.
- 고객·제품·현장·리뷰·FAQ·카피 원료를 사용하거나 수정할 때는 `BRAND_MATERIAL_INDEX.md`를 먼저 확인합니다.
- 연계 프로젝트 자료를 중앙 원료로 승격할 때는 `RAW_MATERIAL_INTAKE_PROTOCOL.md`의 채굴, 비식별화, claim 검증, 상태 부여 절차를 따릅니다.
- 변경 후 CHANGELOG.md에 버전, 날짜, 변경 요약을 기록합니다.
- 각 프로젝트 총괄에게 전달이 필요한 변경이면 PROMPTS.md도 갱신합니다.
