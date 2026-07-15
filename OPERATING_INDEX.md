# 문장군 중앙 브랜드 운영 인덱스

> 버전: v1.0
> 최종 업데이트: 2026-07-06
> 목적: 중앙 브랜드 원본을 처음 적용하는 담당자가 작업별로 어떤 문서와 검증을 거쳐야 하는지 빠르게 판단한다.

## 0. 먼저 실행

```bash
npm test
npm run validate
```

`npm run validate`는 토큰 drift, 상품별 `asset-manifest.json`, evidence/open question/source registry 상태값, 자산 의미 태깅 coverage를 함께 확인한다. 오류는 수정 전까지 병합하지 않고, 경고는 외부 발행 여부를 판단할 때 확인한다.

## 1. 작업별 루트

| 작업 | 먼저 볼 문서 | 반드시 확인할 gate | 산출물 |
| --- | --- | --- | --- |
| 블로그 글 작성 | `BRAND_CONTEXT.md`, `FIELD_JUDGMENT_RULES.md`, `BRAND_MATERIAL_INDEX.md` | `EVIDENCE_REGISTER.md`, `OPEN_QUESTIONS_REGISTER.md` | 프로젝트 어댑터에 맞춘 원고와 적용 보고 |
| 쇼룸 UI/웹앱 구현 | `DESIGN.md`, `DESIGN_QUICKSTART.md`, `tokens/brand.css` | `npm run validate:tokens` | 프로젝트 내부 구현, 중앙에는 충돌/필요 업데이트만 보고 |
| 인스타 카드/썸네일 | `DESIGN.md`, `PHOTO_TREATMENT.md`, `ANTI_PATTERNS.md` | 이미지 안 가격/이벤트/스펙 claim 최신성 | 카드 원고/디자인 적용 보고 |
| 상품 설명/상세페이지 자산 사용 | `PRODUCT_WIKI_INDEX.md`, 필요한 상품 위키, `ASSET_SEMANTIC_INDEX.md` | `SOURCE_REGISTRY.md`, 상품별 `asset-manifest.json`, claim gate | 사용한 `source_id`, `asset_id`, `claim_id` 보고 |
| 새 claim 추가 | `EVIDENCE_REGISTER.md` | 기준일, 출처, 확인자, 재확인 주기, 상태값 | `publishable/vetted/candidate` 등 상태가 있는 claim |
| 연계 프로젝트 원료 승격 | `RAW_MATERIAL_INTAKE_PROTOCOL.md` | 비식별화, 변동 claim 검증, 중앙 문서 위치 판단 | 원료 은행 후보 또는 중앙 문서 업데이트 |
| 프로젝트 어댑터 신설 | `PROJECT_ADAPTERS.md`, `templates/PROJECT_ADAPTER_TEMPLATE.md` | 중앙 기준과 채널 예외의 분리 | 프로젝트별 어댑터와 적용 보고 |

## 2. 발행 가능 판단

| 상태 | 외부 발행 판단 |
| --- | --- |
| `publishable` | 기준일과 범위를 유지하면 발행 가능 |
| `vetted` | 일반 방향은 가능하나 예외 조건을 함께 설명 |
| `candidate` | 내부 기획용. 발행 전 재확인 |
| `needs_confirmation` | 사장 확인 또는 최신 근거 전 발행 금지 |
| `restricted` | 원본/민감 정보 가능성이 있어 공개용 재가공 필요 |
| `expired` | 최신 근거 재등록 전 발행 금지 |

## 3. 자산 사용 판단

1. `PRODUCT_WIKI_INDEX.md`에서 상품 상태를 본다.
2. 필요한 상품 위키에서 고객 불안, 현장 변수, 주의 claim을 확인한다.
3. `ASSET_SEMANTIC_INDEX.md`에서 의미 태그와 추천/금지 용도를 본다.
4. 상품별 `asset-manifest.json`에서 `usageStatus`, `privacyStatus`, `claimRisk`, `externalPublish`를 확인한다.
5. 가격, 이벤트, 월 납입, 스펙, 옵션, 보증, 일정 문구가 이미지 안에 있으면 `EVIDENCE_REGISTER.md`와 `OPEN_QUESTIONS_REGISTER.md`를 다시 본다.

## 4. 변경 전 체크

- 중앙 기준인지, 프로젝트 특화 규칙인지 분리했다.
- 고객 실명, 전화번호, 상세 주소, 상담 원문, AppSheet 원본, 관리자 화면, 키/토큰을 넣지 않았다.
- 상태값은 등록된 값만 사용했다.
- 새 상품 자산 manifest는 `schemas/product-detail-asset-manifest.schema.json`의 필수 필드를 따른다.
- 변경 후 `CHANGELOG.md`에 날짜와 요약을 남긴다.

## 5. 보고 형식

```text
작업:
기준 문서:
수정/생성 파일:
검증:
남은 경고:
연계 프로젝트 후속 조치:
사장 확인 필요:
```
