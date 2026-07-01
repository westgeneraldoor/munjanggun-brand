# RAW_MATERIAL_INTAKE_PROTOCOL - 브랜드 원료 승격 절차

> 버전: v1.1
> 최종 업데이트: 2026-07-01
> 목적: 블로그, 인스타그램, 릴스, AppSheet, 리뷰, 사진 자료를 중앙 브랜드 원료로 승격하거나 보존/보류/대체/폐기할 때의 절차와 금지선을 정한다.

중앙 브랜드 원본은 연계 프로젝트의 좋은 자료를 받아들일 수 있다. 하지만 그대로 복사하면 중앙 원본이 곧 레거시 표현, 개인정보, 검증 안 된 claim의 집합이 된다.

원칙은 다음과 같다.

```text
입수 -> 등록 -> 비식별화 -> claim 검증 -> 중앙 문서 위치 결정 -> 상태 부여 -> 보존/발행/대체 판단 -> CHANGELOG 기록
```

브랜드 위키 소스가 포함된 경우 아래 단계를 추가한다.

```text
source_id 부여 -> 기술 manifest 생성 -> 의미 인덱스 작성 -> 상품 위키 연결
```

## 0. 신규 자료 입수 체크리스트

자료가 들어오면 승격 여부를 판단하기 전에 아래를 먼저 확인한다.

| 확인 항목 | 기준 |
| --- | --- |
| source_id | 신규 소스 묶음에 고유 ID를 부여했는가 |
| 원본 위치 | 중앙 저장 가능, 외부 위치 기록, 중앙 저장 금지 중 어디에 해당하는가 |
| 민감정보 | 고객명, 전화번호, 주소, 동호수, 얼굴, 차량번호, 관리자 화면, AppSheet 원본이 있는가 |
| 변동 claim | 가격, 할인, 월 납입, 리뷰 수, 이벤트, A/S, 일정, 배송/반품, 스펙 문구가 있는가 |
| 파일 묶음 | 이미지/GIF/영상/CSV라면 manifest 또는 요약 문서가 필요한가 |
| 연결 대상 | 상품 위키, 증거 색인, FAQ, 카피 은행 중 어디에 연결할 것인가 |
| 초기 상태 | `candidate`, `needs_confirmation`, `restricted` 중 어떤 보수적 상태가 맞는가 |

이 체크리스트를 통과하지 않은 자료는 중앙 기준 문장으로 승격하지 않는다.

## 1. 승격 가능한 원료

| 원료 유형 | 예시 | 중앙 목적지 |
| --- | --- | --- |
| 고객 상황 | 이사 전, 거주중, 구축 아파트, 좁은 현관, 셀프중문 고민 | CUSTOMER_SEGMENTS.md |
| 제품 선택 기준 | 3연동, 원슬라이딩, 스윙, 문짝교체, 문틀세트 선택 기준 | PRODUCT_SELECTION_GUIDE.md |
| 현장 사례 패턴 | 신발장 간섭, 바닥 단차, 스위치 간섭, 화장실 타일 경계 | FIELD_STORY_BANK.md |
| 리뷰 근거 유형 | 상담이 쉬웠다, 마감이 깔끔했다, 일정 안내가 좋았다 | REVIEW_PROOF_BANK.md |
| 증거 자산 색인 | 공개 가능 Before/After 사진 묶음, 리뷰 캡처 후보, 운영 흐름 캡처 후보 | PROOF_ASSET_INDEX.md |
| 유입 소스 등록 | 상품 상세페이지, CSV, 이미지 묶음, 리뷰 캡처 후보 | SOURCE_REGISTRY.md |
| 이미지/GIF 의미 태그 | 프레임 두께, 컬러 옵션, 유리 옵션, 이벤트 공지, 컬렉션 분위기 | ASSET_SEMANTIC_INDEX.md |
| 상품별 위키 | 3연동중문, 원슬라이딩중문, 스윙중문, ABS도어 등 | PRODUCT_WIKI_INDEX.md 및 상품별 위키 |
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
| review_due | 재확인 필요 날짜 또는 조건 |
| preservation_status | active / reference / superseded / retired / restricted_source |
| superseded_by | 대체 소스나 대체 manifest가 있으면 기록 |
| retire_reason | 더 이상 쓰지 않는 이유 |
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

## 7. 승격하지 않고 보존만 하는 경우

좋은 자료라도 아래에 해당하면 중앙 기준으로 승격하지 않고 보존 또는 reference 상태로 둔다.

- 원본 안에 개인정보나 관리자 정보가 있어 중앙 저장이 부적절한 경우
- 가격, 이벤트, 리뷰 수, 월 납입 등 최신성 위험이 큰데 근거가 부족한 경우
- 특정 프로젝트의 채널 문법에는 맞지만 문장군 공통 기준으로 보기 어려운 경우
- 상품 위키나 증거 문서에 연결되기 전인 대량 원본 묶음

이 경우 `SOURCE_REGISTRY.md`에는 남기되, `review_status: needs_review` 또는 `restricted`, `preservation_status: reference`로 둔다.

## 8. 대체와 retired 처리

자료는 삭제보다 대체 이력을 남기는 것을 기본으로 한다.

| 상황 | 처리 |
| --- | --- |
| 최신 상세페이지가 들어와 기존 상세페이지를 대체 | 기존 source를 `superseded`, 새 source를 `active`로 등록 |
| 이벤트/가격 문구가 만료됨 | 관련 claim을 `expired`, 자산은 `reference` 또는 `retired`로 변경 |
| 개인정보 위험이 발견됨 | 즉시 `restricted`, 외부 발행 금지, 필요 시 중앙 원본에서 원본 제거 |
| 중복 이미지 발견 | 삭제하지 않고 `sha256`, `duplicateGroup`, 대표 자산 관계 기록 |
| 상품 운영이 종료됨 | 상품 위키를 `retired`로 낮추고 신규 발행 금지 |

`retired` 또는 `superseded` 자료는 신규 발행물의 원본으로 쓰지 않는다. 필요한 경우 "과거 기준 참고"로만 사용한다.

## 9. 발행 가능 승급 조건

`publishable`로 올리려면 아래 조건을 모두 만족해야 한다.

1. `source_id`와 원본 위치 정책이 기록되어 있다.
2. 민감정보 검수가 완료됐다.
3. 변동 claim이 있으면 `EVIDENCE_REGISTER.md`에 연결됐다.
4. 확인이 남아 있으면 `OPEN_QUESTIONS_REGISTER.md`에 등록됐다.
5. 이미지/GIF 자산이면 문장군 공식 제작 결과물은 `privacyStatus: official_reviewed`로 둔다. 외부 유입 원본은 `privacyStatus`가 `not_verified`인 동안 공개 사용하지 않는다.
6. `claimRisk: high` 또는 `claimRisk: medium` 자산은 최신 근거, 사용 조건, 이미지 안 문구 처리 방침이 확인됐다.
7. 승인자 또는 승인 기준이 기록됐다.

하나라도 빠지면 `vetted`, `candidate`, `needs_confirmation` 중 더 보수적인 상태를 유지한다.
