# BRAND_MATERIAL_INDEX - 문장군 브랜드 원료 은행

> 버전: v1.1
> 최종 업데이트: 2026-07-01
> 목적: 문장군 중앙 브랜드 원본 안의 고객, 제품, 현장, 리뷰, 증거, 카피, 상품/자산 원료 문서를 한 장에서 안내한다.

이 문서는 문장군 브랜드 원료 은행의 입구다.

중앙 원본은 단순히 "무엇을 금지할지"만 정하지 않는다. 각 프로젝트 총괄이 블로그, 인스타그램, 릴스, 웹앱, 랜딩, 상담 자동화에서 바로 꺼내 쓸 수 있는 검증된 원료를 제공해야 한다.

단, 원료 은행은 발행물 저장소가 아니다. 여기에는 고객 개인정보, 리뷰 원문, AppSheet 원본, 관리자 화면 캡처, 상세 주소, 상담 원문을 넣지 않는다.

## 1. 원료 은행 문서 지도

| 문서 | 역할 | 사용처 | 금지 사용 |
| --- | --- | --- | --- |
| RAW_MATERIAL_INTAKE_PROTOCOL.md | 연계 프로젝트와 현장 자료를 중앙 원료로 승격하는 절차 | 중앙 총괄, 검수 담당 | 검증 없이 프로젝트 자료를 복사 |
| BRAND_RAW_MATERIAL_GAP_AUDIT_2026-06-30.md | 현재 부족한 원료와 우선 구축 범위 | 중앙 로드맵, PR 검수 | 최신 운영 사실처럼 직접 인용 |
| CUSTOMER_SEGMENTS.md | 고객 상황별 불안, 질문, 필요한 근거 | 블로그 주제, 랜딩 구조, 카드뉴스 기획 | 나이/성별 고정 페르소나처럼 사용 |
| PRODUCT_SELECTION_GUIDE.md | 제품별 고려 조건, 주의 조건, 실측 질문 | 상담형 콘텐츠, 상품 비교, 웹앱 추천 흐름 | 무조건 가능/불가능 단정 |
| FIELD_STORY_BANK.md | 비식별 현장 사례 패턴 | 블로그 실제 시공 단락, 릴스 대본, FAQ 근거 | 고객 원문, 주소, AppSheet 원본 저장 |
| REVIEW_PROOF_BANK.md | 리뷰/후기 근거 유형과 안전 표현 | 신뢰 섹션, 후기 카드, Proof Panel | 리뷰 원문/닉네임/캡처 무단 저장 |
| PROOF_ASSET_INDEX.md | 사진, 리뷰, AppSheet, 운영 증거의 비식별 색인 | 산출물 제작 전 증거 확인 | 원본 파일이나 개인정보 저장 |
| BRAND_WIKI_ARCHITECTURE.md | 브랜드 위키 권위, ID, 상태, 검색/사용 규칙 | 중앙 총괄, 프로젝트 총괄, 신규 세션 온보딩 | codebase-memory를 브랜드 판단 체계처럼 대체 |
| SOURCE_REGISTRY.md | 유입 소스의 출처, 원본 위치, 상태, claim/privacy 위험 등록 | 자료 수집, 신규 소스 검수 | 미등록 원본을 바로 중앙 기준으로 사용 |
| PRODUCT_WIKI_INDEX.md | 상품별 위키 입구와 상태 | 상품별 콘텐츠/상담/웹앱 기획 | 상품 위키 없이 이미지 파일만 보고 판단 |
| ASSET_SEMANTIC_INDEX.md | 이미지/GIF의 의미 태그, 추천 용도, 피해야 할 용도 | 이미지 검색, 카드뉴스/웹앱/랜딩 제작 | 의미 태그 없이 파일명만으로 재사용 |
| FAQ_OBJECTION_BANK.md | 가격, 추가금, 일정, 거주중 시공, A/S 질문 응답 | 상담 FAQ, 블로그 H2, 랜딩 FAQ | 확정 견적/절대 표현 |
| COPY_ASSET_BANK.md | 안전한 후킹, CTA, 제목, 검증 문장 원료 | 블로그/인스타/랜딩/릴스 카피 | 검증 상태 없는 숫자/최고 표현 |
| EVIDENCE_REGISTER.md | 변동 claim의 기준일, 근거, 사용 상태 | 리뷰 수, 가격, A/S, 일정, 이벤트 표현 | 최신 근거 없이 수치 단정 |
| OPEN_QUESTIONS_REGISTER.md | 아직 확인되지 않은 운영 기준과 사장 확인 항목 | 중앙 총괄 확인 목록, 프로젝트 보고 | 확인 전 발행 가능한 기준처럼 사용 |

## 2. 원료 상태값

모든 원료는 아래 상태 중 하나를 가진다.

| 상태 | 뜻 | 사용 기준 |
| --- | --- | --- |
| `publishable` | 중앙 기준과 근거가 확인되어 발행 가능 | 문구를 그대로 쓰기 전 채널 톤만 조정 |
| `vetted` | 공통 방향은 검수됐지만 상황별 확인이 필요 | 콘텐츠 구조나 설명 재료로 사용 |
| `candidate` | 연계 프로젝트에서 발견한 후보 원료 | 중앙 총괄 검수 전 발행 금지 |
| `needs_confirmation` | 사장 확인, 최신 캡처, 정책 확인이 필요 | 외부 발행 금지. 내부 기획에만 사용 |
| `restricted` | 민감정보, 관리자 화면, 원본 리뷰 등 제한 원료 | 비식별 요약과 승인 절차 없이는 사용 금지 |
| `expired` | 기준일이 지나거나 운영 변경 가능성이 큰 원료 | 최신 근거 확인 후 재등록 |

## 2-1. 문서별 상태 매핑

일부 원료 문서는 세부 상태명을 추가로 쓴다. 프로젝트 총괄은 아래 매핑으로 발행 가능 여부를 판단한다.

| 문서 | 세부 상태 | 중앙 공통 상태로 해석 | 사용 기준 |
| --- | --- | --- | --- |
| REVIEW_PROOF_BANK.md | `theme_only` | `vetted` | 리뷰 원문 없이 불안 해소 주제나 구조로만 사용 |
| REVIEW_PROOF_BANK.md | `needs_source` | `needs_confirmation` | 실제 캡처, 링크, 권한 확인 전 외부 발행 금지 |
| REVIEW_PROOF_BANK.md | `publishable_quote` | `publishable` | 개인정보 검수와 사용 권한이 완료된 짧은 인용만 가능 |
| REVIEW_PROOF_BANK.md | `restricted` | `restricted` | 내부 확인용. 외부 발행 금지 |
| PROOF_ASSET_INDEX.md | `approved_public` | `publishable` | 공개 가능 검수 완료 자산만 발행물에 직접 사용 |
| PROOF_ASSET_INDEX.md | `candidate` | `candidate` | 후보 자산. 공개 가능 여부 확인 전 직접 사용 금지 |
| PROOF_ASSET_INDEX.md | `needed` | `needs_confirmation` | 아직 확보가 필요한 자산. 외부 발행 금지 |
| PROOF_ASSET_INDEX.md | `needs_confirmation` | `needs_confirmation` | 최신 정책, 기간, 조건 확인 전 외부 발행 금지 |
| PROOF_ASSET_INDEX.md | `internal_only` | `restricted` | 내부 확인용. 외부 발행 금지 |
| PROOF_ASSET_INDEX.md | `restricted` | `restricted` | 개인정보 또는 관리자 정보 포함 가능. 중앙 원본 저장 금지 |
| PROOF_ASSET_INDEX.md | `expired` | `expired` | 최신성 재확인 전 사용 금지 |
| SOURCE_REGISTRY.md | `index_status: registered/indexed/semantic_indexed` | 발행 상태 아님 | 검색/관리 단계만 뜻한다. 외부 발행 가능 여부는 `review_status`와 자산 상태를 함께 본다 |
| SOURCE_REGISTRY.md | `review_status: not_reviewed/needs_review` | `needs_confirmation` | 소스는 찾을 수 있지만 외부 발행 금지 |
| SOURCE_REGISTRY.md | `review_status: reviewed_candidate` | `candidate` | 내부 기획과 재가공 후보. 발행 전 추가 검수 필요 |
| SOURCE_REGISTRY.md | `review_status: approved_public` | `publishable` | 공개 가능 검수 완료. 단, 변동 claim은 `EVIDENCE_REGISTER.md`를 다시 확인 |
| SOURCE_REGISTRY.md | `review_status: restricted` | `restricted` | 내부 확인용. 외부 발행 금지 |
| ASSET_SEMANTIC_INDEX.md | `status: candidate` | `candidate` | 의미 태깅 후보. 공식 제작 자산은 개인정보 재검수 대상이 아니지만, 변동 claim 재사용은 최신성 확인 필요 |
| ASSET_SEMANTIC_INDEX.md | `status: needs_confirmation` | `needs_confirmation` | 가격, 이벤트, 스펙, 옵션, 개인정보 등 확인 전 외부 발행 금지 |
| ASSET_SEMANTIC_INDEX.md | `status: publishable/vetted` | `publishable` 또는 `vetted` | 해당 상태가 명시된 경우에만 제한적으로 사용. 더 보수적인 상태값이 있으면 그 값을 따른다 |
| ASSET_SEMANTIC_INDEX.md | `privacy_status: official_reviewed` | 상태 유지 | 문장군 공식 제작·검토 결과물. 중앙 브랜드 위키에서 별도 OCR/육안 개인정보 검수를 다시 요구하지 않음 |
| ASSET_SEMANTIC_INDEX.md | `privacy_status: not_verified` | `needs_confirmation` | 외부 유입 사진, 리뷰 캡처, 현장 원본 등 공식 제작 자산이 아닌 이미지의 개인정보 검수 전 상태 |
| ASSET_SEMANTIC_INDEX.md | `claim_risk: high` | `needs_confirmation` | 가격, 이벤트, 리뷰 수, 혜택 등 변동 claim 포함 가능. 외부 발행 금지 |
| ASSET_SEMANTIC_INDEX.md | `claim_risk: medium` | `candidate` | 내부 참고 가능. 외부 발행 전 근거와 최신성 확인 |
| 상품별 asset-manifest.json | `usageStatus: candidate` | `candidate` | 기술 색인 완료 상태. 발행 가능 상태가 아니다 |
| 상품별 asset-manifest.json | `usageStatus: needs_confirmation` | `needs_confirmation` | 사용 전 내용/개인정보/claim 확인 필요 |
| 상품별 asset-manifest.json | `privacyStatus: official_reviewed` | 상태 유지 | 문장군 공식 제작 결과물. 중앙 추가 OCR/육안 개인정보 검수 대상이 아님 |
| 상품별 asset-manifest.json | `privacyStatus: not_verified` | `needs_confirmation` | 외부 유입 원본의 개인정보 검수 전 상태 |

## 3. 권위 관계

브랜드 원료 문서의 권위는 아래 순서를 따른다.

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

예를 들어 `COPY_ASSET_BANK.md`에 좋은 문장이 있어도, 그 문장이 `EVIDENCE_REGISTER.md`에서 `needs_confirmation` 상태인 리뷰 수나 가격을 포함하면 발행할 수 없다.

## 4. 중앙과 프로젝트의 경계

중앙 원료 은행에 넣는 것:

- 고객 불안 유형
- 제품 선택 기준
- 현장 변수와 판단 패턴
- 비식별 사례 구조
- 리뷰/사진/운영 증거의 유형과 안전 표현
- 공통 CTA와 후킹 원칙
- 변동 claim의 기준일과 사용 상태

프로젝트 어댑터에 두는 것:

- 네이버 블로그 SEO 운영 방식
- 인스타그램 캐러셀 장수와 해시태그
- 릴스 컷 구성과 자막 템플릿
- 웹앱 라우팅, 컴포넌트 구현, 배포 방식
- 프로젝트별 파일 저장 규칙과 QA 자동화

## 5. 원료 사용 전 확인

프로젝트 총괄은 원료를 쓰기 전에 아래를 확인한다.

1. 원료 상태가 `publishable` 또는 `vetted`인가.
2. 리뷰 수, 가격, A/S, 일정, 이벤트 같은 변동 claim은 `EVIDENCE_REGISTER.md`와 연결되어 있는가.
3. 고객명, 전화번호, 주소, 동호수, 상담 원문, AppSheet 원본, 관리자 화면이 포함되지 않았는가.
4. 프로젝트 특화 규칙을 중앙 공통 기준처럼 쓰고 있지 않은가.
5. 제품 가능 여부를 `무조건 가능`처럼 단정하지 않았는가.

## 6. 이번 라운드의 판단

2026-06-30 기준 중앙 브랜드 원본은 브랜드 헌법, 디자인 기준, 현장 판단 기준은 작동한다. 다만 반복 제작에 필요한 고객 세그먼트, 제품 선택 원료, 현장 사례 패턴, 리뷰/증거 원료, FAQ/카피 원료가 부족했다.

이번 라운드의 목표는 문장군 브랜드를 더 화려하게 보이게 하는 것이 아니라, 각 프로젝트 총괄이 안전하게 꺼내 쓸 수 있는 원료와 검증 절차를 세우는 것이다.
