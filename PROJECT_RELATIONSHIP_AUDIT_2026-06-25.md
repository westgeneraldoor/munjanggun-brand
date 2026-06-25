# 문장군 연계 프로젝트 조사 분석 - 2026-06-25

> 조사일: 2026-06-25
> 조사 범위: `C:\Users\hjh\안티그래비티\문장군_브랜드` 및 상위 폴더의 문장군 관련 프로젝트
> 목적: 중앙 브랜드 원본과 각 연계 프로젝트의 참조 관계, 동기화 상태, 운영 리스크를 정리한다.

## 1. 중앙 브랜드 폴더 상태

`문장군_브랜드`는 코드 저장소라기보다 중앙 브랜드 기준 문서 저장소다.

현재 구성:

```text
문장군_브랜드
├─ README.md
├─ BRAND_CONTEXT.md
├─ FIELD_JUDGMENT_RULES.md
├─ DESIGN.md
├─ PROJECT_ADAPTERS.md
├─ PROMPTS.md
├─ CHANGELOG.md
├─ AGENTS.md
├─ TEAM.md
├─ PROJECT_RELATIONSHIP_AUDIT_2026-06-25.md
└─ preview.html
```

핵심 권위 문서:

| 문서 | 역할 |
| --- | --- |
| `BRAND_CONTEXT.md` | 브랜드 정체성, 제품 범위, 고객 불안, 가격/리뷰/A/S 표현, 금지 표현 |
| `FIELD_JUDGMENT_RULES.md` | 무료 방문실측, 현장 변수, 시공 가능 여부, 추가금, 고객 오해, AppSheet 기준 |
| `DESIGN.md` | 디자인 토큰, 컬러, 서체, 이미지 무드, 컴포넌트, 웹/카드/썸네일 기준 |
| `PROJECT_ADAPTERS.md` | 중앙 원본과 프로젝트별 어댑터 분리 원칙 |
| `PROMPTS.md` | 각 프로젝트 총괄 세션 전달용 프롬프트 |
| `CHANGELOG.md` | 중앙 기준 변경 이력 |

`preview.html`은 참고용 시각 보드이며 최신 디자인 권위는 `DESIGN.md`다.

## 2. 연계 프로젝트 지도

상위 폴더에서 확인한 문장군 관련 프로젝트는 아래와 같다.

| 프로젝트 | 관련성 | 현재 중앙 참조 상태 | 판단 |
| --- | --- | --- | --- |
| `munjanggun` | 웹 플랫폼, 디지털 쇼룸, Content OS | `AGENTS.md`, `docs/brand/*`에서 중앙 원본 명시 | 강한 연계, 비교적 양호 |
| `문장군블로그` | 네이버 블로그 운영 OS | `AGENTS.md`, `docs/brand/BRAND_SOURCE.md`, `BLOG_BRAND_ADAPTER.md` 존재 | 강한 연계, 양호 |
| `문장군 인스타그램` | 인스타그램 캐러셀 원고 운영 | `AGENTS.md`, `docs/brand/*` 존재, `data/brand` 레거시 있음 | 강한 연계, 레거시 관리 필요 |
| `문장군 컨텐츠` | 리뷰 릴스 엔진 | `AGENTS.md`, `docs/brand/*` 존재 | 강한 연계, 양호 |
| `문장군_디자인` | 캐러셀/릴스 썸네일 디자인 OS | 자체 `AGENTS.md`, `DESIGN.md` 존재 | 강한 연계, 중앙 `DESIGN.md`와 충돌 점검 필요 |
| `문장군 릴스 엔진` | 레거시 릴스 엔진 | 자체 `BRAND_CONTEXT.md`, `BRAND_CONTEXT_REELS_SUMMARY.md` 중심 | 강한 연계, 중앙 브리지 미흡 |
| `문장군 시공릴스` | 시공 현장 영상/사진 릴스 | 자체 `BRAND_CONTEXT.md`, `DESIGN.md` 중심 | 강한 연계, 중앙 브리지 미흡 |
| `Virtual Studio` | 시공사진 가상 스튜디오로 추정 | 직접 중앙 참조 확인 약함 | 관련 추정, 사용 여부 확인 필요 |
| `backup` | 과거 문장군 웹/자산 아카이브 | 중앙 참조 없음 | 아카이브, 신규 원본으로 사용 금지 |
| `open-design` | 디자인 도구/벤치마크 | 문장군 직접 원본 아님 | 도구/벤치마크로만 취급 |

## 3. 프로젝트별 주요 참조 후보

| 프로젝트 | 주요 경로 |
| --- | --- |
| `munjanggun` | `docs/brand/BRAND_SOURCE.md`, `docs/brand/PROJECT_BRAND_ADAPTER.md`, `docs/brand/BRAND_SYNC_AUDIT_2026-06-25.md`, `docs/platform/BRAND_CONTEXT.md` |
| `문장군블로그` | `docs/brand/BRAND_SOURCE.md`, `docs/brand/BLOG_BRAND_ADAPTER.md`, `docs/brand/BRAND_SYNC_AUDIT_2026-06-25.md`, `docs/strategy/BRAND_CONTEXT.md`, `AGENTS.md` |
| `문장군 인스타그램` | `docs/brand/BRAND_SOURCE.md`, `docs/brand/PROJECT_BRAND_ADAPTER.md`, `docs/brand/BRAND_SYNC_AUDIT_2026-06-25.md`, `data/brand/BRAND_CONTEXT.md`, `AGENTS.md` |
| `문장군 컨텐츠` | `docs/brand/BRAND_SOURCE.md`, `docs/brand/PROJECT_BRAND_ADAPTER.md`, `docs/brand/BRAND_SYNC_AUDIT_2026-06-25.md`, `BRAND_CONTEXT.md`, `AGENTS.md` |
| `문장군_디자인` | `AGENTS.md`, `DESIGN.md`, `PRD.md`, `preview/` |
| `문장군 릴스 엔진` | `BRAND_CONTEXT.md`, `BRAND_CONTEXT_REELS_SUMMARY.md`, `prompts/reels_package_generation_prompt.txt` |
| `문장군 시공릴스` | `BRAND_CONTEXT.md`, `DESIGN.md`, `PROJECT_BRIEF.md`, `촬영소스/` |
| `Virtual Studio` | `app.py` |
| `backup` | `munjanggun-apartment-v2`, `문장군_우리집시공사례`, `문장군_아파트프로젝트` 계열 |

## 4. 동기화 상태

### 이미 중앙 연결이 강한 프로젝트

- `munjanggun`
- `문장군블로그`
- `문장군 인스타그램`
- `문장군 컨텐츠`

이 프로젝트들은 중앙 원본을 명시적으로 참조하는 문서가 있다. 다만 로컬 레거시 `BRAND_CONTEXT.md`나 fallback 문서가 있으므로 중앙 원본과의 충돌을 계속 관리해야 한다.

### 중앙 브리지 보강이 필요한 프로젝트

- `문장군 릴스 엔진`
- `문장군 시공릴스`
- `문장군_디자인`
- `Virtual Studio`

권장 조치:

1. 각 프로젝트에 `docs/brand/BRAND_SOURCE.md` 또는 동등한 중앙 참조 문서를 둔다.
2. 프로젝트 특화 어댑터를 만든다.
3. 기존 `BRAND_CONTEXT.md`가 있으면 legacy/fallback 성격을 명시한다.
4. 중앙 원본과 충돌하는 수치, 이벤트, 가능 여부 표현을 감사한다.

### 신규 원본으로 사용하면 안 되는 영역

- `backup`
- 오래된 audit 출력물
- 과거 preview/실험 결과
- 서비스 계정이나 `.env`가 포함될 가능성이 있는 폴더

## 5. 중앙 승격 후보

연계 프로젝트에서 중앙 원본으로 승격을 검토할 만한 공통 지식 후보:

- 콘텐츠 철학 25점 평가
- 후킹 트리거 기준
- 고객 사진 privacy QA
- public/private 사진 분리 기준
- Content OS 발행 게이트
- 고객 질문/claim registry 구조
- 레거시 수치 감사 방식

승격 전 확인:

- 특정 채널 전용 규칙인지, 문장군 전체 공통 규칙인지 구분한다.
- 민감 정보나 고객 원본 자료를 포함하지 않는다.
- `BRAND_CONTEXT.md`, `FIELD_JUDGMENT_RULES.md`, `DESIGN.md`, `PROJECT_ADAPTERS.md` 중 어디가 맞는지 먼저 판단한다.

## 6. 운영 리스크

| 리스크 | 설명 | 권장 대응 |
| --- | --- | --- |
| 버전 표기 불일치 | 중앙 `CHANGELOG.md`는 v2.1인데 일부 문서 메타가 v1.0으로 남아 있었음 | 메타 업데이트, 변경 시 `CHANGELOG.md` 기록 |
| 레거시 수치 혼입 | 구형 리뷰 수, 이벤트, 시공 규모 표현이 백업/레거시에 남아 있음 | 중앙 원본 기준 우선, 레거시 문서에 fallback/legacy 표시 |
| 중앙 경로 절대값 의존 | Windows 절대 경로에 의존 | 프로젝트별 fallback 문서와 발행 보류 규칙 유지 |
| 디자인 권위 혼선 | 중앙 `DESIGN.md`, `preview.html`, `문장군_디자인/DESIGN.md`가 함께 존재 | 중앙 `DESIGN.md` 우선, 프로젝트 디자인은 어댑터로 분리 |
| 민감 정보 가능성 | 여러 프로젝트에 `.env`류 파일과 서비스 계정/키로 보이는 JSON 존재 | 값 인용 금지, 별도 보안 점검 및 필요 시 회전 |
| 백업 폴더 오용 | 오래된 웹/자산이 신규 기준처럼 쓰일 수 있음 | 아카이브로만 취급, 신규 산출물 원본 사용 금지 |

## 7. 우선 후속 조치

1. `문장군 릴스 엔진`에 중앙 브랜드 원본 참조 문서와 릴스 어댑터를 만든다.
2. `문장군 시공릴스`에 중앙 현장 판단 기준과 시공릴스 전용 어댑터를 연결한다.
3. `문장군_디자인`의 `DESIGN.md`와 중앙 `DESIGN.md`의 권위 관계를 감사한다.
4. 서비스 지역, 리뷰 이벤트, 할부, 시공 가능 일정, 하루 시공 현장 수 같은 변동 정보를 최신 공식 근거로 재검증한다.
5. `.env`와 서비스 계정 파일 존재 프로젝트는 별도 보안 점검 대상으로 분리한다.
6. 백업 폴더의 문장군 자산은 원본 사용 가능 여부와 공개 가능 여부를 재분류한다.

## 8. 확인 필요 질문

- 현재 실제 운영 중인 프로젝트는 `munjanggun`, `문장군블로그`, `문장군 인스타그램`, `문장군 컨텐츠` 외에 어디까지인가?
- `문장군 릴스 엔진`과 `문장군 시공릴스`는 통합 대상인가, 별도 유지 대상인가?
- `문장군_디자인/DESIGN.md`와 중앙 `문장군_브랜드/DESIGN.md`의 최종 권위 관계는 어떻게 둘 것인가?
- 백업 폴더의 서비스 계정/환경 파일은 보존 대상인가, 보안 정리 대상인가?
- 서비스 지역, 리뷰 이벤트, 할부, 시공 가능 일정 같은 변동 정보의 최신 공식 확인자는 누구인가?

