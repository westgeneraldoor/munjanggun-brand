# RAW_MATERIAL_INTAKE_PROTOCOL - 브랜드 원료 승격 절차

> 버전: v1.0
> 최종 업데이트: 2026-06-30
> 목적: 블로그, 인스타그램, 릴스, AppSheet, 리뷰, 사진 자료를 중앙 브랜드 원료로 승격할 때의 절차와 금지선을 정한다.

중앙 브랜드 원본은 연계 프로젝트의 좋은 자료를 받아들일 수 있다. 하지만 그대로 복사하면 중앙 원본이 곧 레거시 표현, 개인정보, 검증 안 된 claim의 집합이 된다.

원칙은 다음과 같다.

```text
채굴 -> 비식별화 -> claim 검증 -> 중앙 문서 위치 결정 -> 상태 부여 -> CHANGELOG 기록
```

## 1. 승격 가능한 원료

| 원료 유형 | 예시 | 중앙 목적지 |
| --- | --- | --- |
| 고객 상황 | 이사 전, 거주중, 구축 아파트, 좁은 현관, 셀프중문 고민 | CUSTOMER_SEGMENTS.md |
| 제품 선택 기준 | 3연동, 원슬라이딩, 스윙, 문짝교체, 문틀세트 선택 기준 | PRODUCT_SELECTION_GUIDE.md |
| 현장 사례 패턴 | 신발장 간섭, 바닥 단차, 스위치 간섭, 화장실 타일 경계 | FIELD_STORY_BANK.md |
| 리뷰 근거 유형 | 상담이 쉬웠다, 마감이 깔끔했다, 일정 안내가 좋았다 | REVIEW_PROOF_BANK.md |
| 증거 자산 색인 | 공개 가능 Before/After 사진 묶음, 리뷰 캡처 후보, 운영 흐름 캡처 후보 | PROOF_ASSET_INDEX.md |
| FAQ/반박 | 전화 견적, 추가금, 먼지, 소음, A/S, 자재 판매 질문 | FAQ_OBJECTION_BANK.md |
| 카피 원료 | 제목 공식, CTA, 첫 문장, Proof Panel 문장 | COPY_ASSET_BANK.md |
| 변동 claim | 리뷰 수, 가격대, A/S 기간, 일정, 이벤트, 할부 | EVIDENCE_REGISTER.md |

## 2. 중앙 승격 금지 원료

아래는 중앙 원본에 넣지 않는다.

- 고객 실명
- 전화번호
- 상세 주소
- 동호수
- 상담 원문
- 리뷰 원문 전문
- 리뷰 작성자 닉네임
- AppSheet 원본 레코드
- AppSheet 원본 캡처
- 관리자 통계 원본
- 서비스 계정 키, 토큰, 비밀번호, `.env` 원문
- 최신 근거가 없는 가격, 리뷰 수, 이벤트, 일정 claim

필요하면 아래처럼 바꾼다.

```text
금지: "OO아파트 101동 1203호 고객이 신발장 때문에..."
허용: "구축 아파트 현장에서 신발장 간섭 때문에 중문틀 고정 공간을 다시 검토한 사례"
```

## 3. 승격 감사표

중앙 원료로 승격하기 전 아래 항목을 기록한다.

| 항목 | 확인 기준 |
| --- | --- |
| source_project | 원료가 나온 프로젝트나 자료 범위 |
| source_path | 내부 파일 경로 또는 자료 위치. 공개 불가 원본이면 구체 경로 대신 비식별 메모 |
| material_summary | 중앙으로 승격할 핵심 내용 |
| destination_doc | 들어갈 중앙 문서 |
| purification | 제거하거나 바꿔야 하는 표현 |
| privacy_check | 개인정보, 주소, 원문, 캡처 포함 여부 |
| claim_check | 변동 claim 포함 여부와 EVIDENCE_REGISTER 연결 |
| status | candidate / vetted / publishable / needs_confirmation / restricted / expired |
| owner | 중앙 총괄 / 프로젝트 총괄 / 사장 확인 |
| next_action | 필요한 확인 또는 반영 작업 |

## 4. 상태 부여 규칙

| 상태 | 부여 조건 |
| --- | --- |
| `publishable` | 중앙 문서와 근거가 일치하고 민감정보가 없으며 그대로 발행 가능한 문장 |
| `vetted` | 사실 방향은 맞지만 현장 구조나 채널에 맞게 조정해야 하는 원료 |
| `candidate` | 좋은 후보지만 중앙 총괄 검수 전인 원료 |
| `needs_confirmation` | 최신 근거, 사장 확인, 정책 확인이 필요한 원료 |
| `restricted` | 원본 접근 제한이 필요한 원료. 색인만 저장 가능 |
| `expired` | 기준일이 지나 최신성 재확인이 필요한 원료 |

## 5. 변동 claim 처리

아래는 항상 `EVIDENCE_REGISTER.md`를 확인한다.

- 리뷰 수
- 판매량
- 가격대
- 월 납입 금액
- A/S 기간과 예외
- 제작/시공 일정
- 시공 시간
- 서비스 가능 지역
- 이벤트, 무상 조건, 사은품
- 무이자 할부

`EVIDENCE_REGISTER.md` 상태가 `candidate`, `needs_confirmation`, `restricted`, `expired`이면 외부 발행물에서는 숫자를 단정하지 않는다.

허용 예:

```text
최근 기준은 상담 시 다시 확인해드립니다.
현장 구조와 옵션에 따라 달라질 수 있어 무료 방문실측 후 정확히 안내드립니다.
```

금지 예:

```text
무조건 이 가격입니다.
절대 추가금 없습니다.
리뷰 수는 항상 이 숫자입니다.
```

## 6. 승격 후 기록

중앙 문서가 실제로 바뀌면 아래를 함께 갱신한다.

```text
CHANGELOG.md
README.md
PROMPTS.md
PROJECT_ADAPTERS.md
필요 시 EVIDENCE_REGISTER.md
```

연계 프로젝트의 운영 방식만 바뀌면 중앙 `CHANGELOG.md`가 아니라 해당 프로젝트 어댑터에 기록한다.
