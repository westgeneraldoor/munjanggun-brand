# 문장군 중앙 브랜드 문서

> 버전: v3.3  
> 최종 업데이트: 2026-06-25  
> 변경 요약: 중앙 총괄과 프로젝트 총괄의 적용 책임 분리 기준 추가

이 폴더는 문장군 브랜드의 중앙 원본입니다.

모든 문장군 관련 프로젝트는 콘텐츠, 디자인, 웹앱, 자동화, 프롬프트 작성 시 이 폴더의 문서를 우선 참조합니다.

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| BRAND_CONTEXT.md | 문장군이 무엇을 말해야 하는지 정리한 브랜드 컨텍스트 |
| FIELD_JUDGMENT_RULES.md | 고객 오해, 시공 가능 여부, 추가금, AppSheet 현장 활용 등 실제 현장 판단 기준 |
| DESIGN.md | 문장군이 어떻게 보여야 하는지 정리한 브랜드 디자인 기준 |
| DESIGN_QUICKSTART.md | DESIGN.md v3.0을 실무자가 빠르게 적용하기 위한 1장 요약 |
| PHOTO_TREATMENT.md | 실제 시공 사진의 밝기, 색온도, 수직선, 개인정보, 크롭 기준 |
| ANTI_PATTERNS.md | 문장군답지 않은 디자인 패턴과 대체 기준 |
| tokens/brand.tokens.json | DESIGN.md 토큰을 구현용 구조화 데이터로 옮긴 파일 |
| tokens/brand.css | 웹앱과 랜딩에서 바로 쓸 수 있는 CSS 변수 토큰 |
| preview.html | DESIGN.md v3.0을 브라우저에서 확인하는 정적 디자인 미리보기 |
| index.html | GitHub Pages 루트에서 preview.html로 안내하는 진입 페이지 |
| PROJECT_ADAPTERS.md | 블로그, 인스타그램, 릴스, 웹앱 등 프로젝트별 어댑터 운영 방식 |
| CHANGELOG.md | 브랜드 기준 변경 이력 |
| PROMPTS.md | 각 프로젝트 총괄 세션에 전달할 적용 프롬프트 |
| AGENTS.md | 중앙 브랜드 책임자와 에이전트 작업 지침 |
| TEAM.md | 브랜드 운영팀 역할, 책임 범위, 협업 흐름 |
| PROJECT_RELATIONSHIP_AUDIT_2026-06-25.md | 문장군 연계 프로젝트 조사 분석 |

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
./tokens/brand.tokens.json
./tokens/brand.css
./preview.html
./index.html
./PROJECT_ADAPTERS.md
./CHANGELOG.md
./PROMPTS.md
./AGENTS.md
./TEAM.md
./PROJECT_RELATIONSHIP_AUDIT_2026-06-25.md
```

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

중앙 총괄은 긴급 보안 수정, 명백한 참조 오류, 프로젝트 총괄의 명시 요청이 없는 한 각 프로젝트 파일을 직접 덮어쓰지 않습니다.

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
- 숫자, 리뷰, 가격, A/S, 시공 기간처럼 변할 수 있는 정보는 기준 날짜를 함께 남깁니다.
- 변경 후 CHANGELOG.md에 버전, 날짜, 변경 요약을 기록합니다.
- 각 프로젝트 총괄에게 전달이 필요한 변경이면 PROMPTS.md도 갱신합니다.
