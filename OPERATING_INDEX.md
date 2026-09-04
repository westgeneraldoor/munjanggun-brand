# 문장군 중앙 브랜드 운영 인덱스

> 버전: v1.1
> 최종 업데이트: 2026-09-04

## 먼저 실행

```bash
npm test
npm run validate
```

`npm run validate`는 상품 manifest, 근거·확인 질문·소스 상태, 자산 의미 태깅 coverage를 검사한다.

## 작업별 루트

| 작업 | 먼저 볼 문서 | gate |
| --- | --- | --- |
| 블로그·콘텐츠 | `BRAND_CONTEXT.md`, `FIELD_JUDGMENT_RULES.md`, `BRAND_MATERIAL_INDEX.md` | `EVIDENCE_REGISTER.md`, `OPEN_QUESTIONS_REGISTER.md` |
| 상품 설명·자산 사용 | `PRODUCT_WIKI_INDEX.md`, 상품 위키, `ASSET_SEMANTIC_INDEX.md` | `SOURCE_REGISTRY.md`, manifest, claim 상태 |
| 새 claim | `EVIDENCE_REGISTER.md` | 기준일, 출처, 확인자, 재확인 주기, 상태 |
| 원료 승격 | `RAW_MATERIAL_INTAKE_PROTOCOL.md` | 비식별화, claim 검증, 중앙 위치 |
| 프로젝트 어댑터 | `PROJECT_ADAPTERS.md`, 템플릿 | 중앙 기준과 프로젝트 특화 규칙 분리 |

시각 디자인 작업에는 중앙 디자인 기준이 없다. 로고, 색상, 폰트, UI, 이미지 스타일은 해당 프로젝트가 자체 결정한다.

## 외부 발행 상태

| 상태 | 판단 |
| --- | --- |
| `publishable` | 기준일과 범위를 유지하면 발행 가능 |
| `vetted` | 일반 방향은 가능하나 예외 조건 확인 |
| `candidate` | 내부 기획용, 발행 전 재확인 |
| `needs_confirmation` | 확인 전 발행 금지 |
| `restricted` | 공개용 재가공 필요 |
| `expired` | 최신 근거 재등록 전 발행 금지 |

## 변경 전 체크

- 중앙 기준과 프로젝트 규칙을 분리했다.
- 민감 정보와 원본 운영 화면을 넣지 않았다.
- 이미지 속 식별 정보와 변동 claim을 확인했다.
- 새 상품 자산 manifest가 스키마를 따른다.
- 변경 후 `CHANGELOG.md`를 갱신한다.
