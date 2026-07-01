# BRAND_WIKI_ARCHITECTURE - 문장군 브랜드 위키 구조

> 버전: v1.1
> 최종 업데이트: 2026-07-01
> 목적: 앞으로 들어오는 상품 상세페이지, 이미지/GIF, 리뷰, 상담, 현장 사례를 파일 더미가 아니라 검색 가능하고 검수 가능한 브랜드 지식으로 관리하고, 자료의 입수부터 보존/대체/폐기까지 추적한다.

## 1. codebase-memory MCP와 브랜드 위키의 차이

`codebase-memory MCP`는 코드와 문서를 빠르게 찾는 검색 보조 장치다. 어디에 어떤 파일이 있는지, 어떤 문서가 비슷한지, 어떤 경로에 맥락이 있는지 찾는 데 도움이 된다.

하지만 codebase-memory는 브랜드 권위, 발행 가능 여부, 최신 가격/이벤트 여부, 개인정보 위험, 이미지 안 문구의 claim 위험을 판단하지 않는다.

문장군 브랜드 위키는 아래를 판단하는 운영 체계다.

- 이 정보가 중앙 기준인지, 후보 원료인지, 프로젝트 특화 규칙인지
- 가격, 리뷰 수, 이벤트, A/S, 일정 같은 변동 claim이 검증됐는지
- 이미지, 리뷰, 상담, 현장 사진이 공개 가능한지
- 어떤 고객 불안, 제품 선택 기준, 현장 변수, 콘텐츠 용도와 연결되는지
- 신규 세션이나 타 프로젝트 총괄이 이미지를 다시 보지 않고도 무엇을 찾아 쓸 수 있는지

정리하면:

```text
codebase-memory MCP = 찾는 장치
브랜드 위키 = 판단 가능한 지식 체계
```

MCP는 브랜드 위키를 대체하지 않는다. MCP는 이 위키를 더 잘 찾게 해주는 보조 계층으로 사용한다.

## 2. 권위 계층

문장군 중앙 전체 권위 순서는 `README.md`와 `BRAND_MATERIAL_INDEX.md`의 권위 관계를 따른다.

아래는 브랜드 위키 안에서 소스, 상품 위키, 의미 인덱스를 해석할 때의 내부 참조 순서다.

```text
BRAND_CONTEXT.md
FIELD_JUDGMENT_RULES.md
DESIGN.md
EVIDENCE_REGISTER.md
OPEN_QUESTIONS_REGISTER.md
BRAND_WIKI_ARCHITECTURE.md
RAW_MATERIAL_INTAKE_PROTOCOL.md
SOURCE_REGISTRY.md
PRODUCT_WIKI_INDEX.md
ASSET_SEMANTIC_INDEX.md
각 상품 위키
각 프로젝트 어댑터
```

상품 상세페이지 이미지에 좋은 문구가 있어도, `EVIDENCE_REGISTER.md`에서 확인되지 않은 가격, 이벤트, 리뷰 수, 혜택 claim이면 외부 발행물에 그대로 쓰지 않는다.

## 3. 위키 계층

| 계층 | 역할 | 대표 문서 |
| --- | --- | --- |
| 권위 기준층 | 브랜드, 현장 판단, 디자인, 변동 claim 기준 | `BRAND_CONTEXT.md`, `FIELD_JUDGMENT_RULES.md`, `DESIGN.md`, `EVIDENCE_REGISTER.md` |
| 소스 등록층 | 유입 자료의 출처, 상태, 민감정보, 승격 여부 관리 | `SOURCE_REGISTRY.md` |
| 기술 인덱스층 | 파일 경로, 순서, 규격, 해시, GIF 프레임 관리 | 상품별 `asset-manifest.json` |
| 의미 인덱스층 | 이미지/자료가 무엇을 말하는지, 어디에 쓸 수 있는지 관리 | `ASSET_SEMANTIC_INDEX.md` |
| 상품 위키층 | 제품별 선택 기준, 고객 불안, 컬렉션, 옵션, 증거, 주의 claim 정리 | `PRODUCT_WIKI_INDEX.md`, 상품별 위키 |
| 채널 적용층 | 블로그, 인스타, 릴스, 웹앱별 적용 방식 | `PROJECT_ADAPTERS.md`, 각 프로젝트 어댑터 |

## 4. ID 규칙

| ID | 대상 | 예시 |
| --- | --- | --- |
| `source_id` | 유입 소스 묶음 | `SRC-2026-06-30-3PANEL-DETAILPAGE` |
| `asset_id` | 이미지/GIF/문서 조각 | `mg-3panel-classic-005` |
| `product_id` | 상품 또는 상품군 | `PROD-3PANEL-MIDDLE-DOOR` |
| `claim_id` | 가격, 이벤트, 리뷰, A/S, 일정 등 변동 claim | `CLAIM-3PANEL-DETAIL-EVENT-PRICE-2026-06-30` |
| `proof_id` | 증거 자산 색인 | `PROOF-3PANEL-DETAILPAGE-ASSETS-2026-06-30` |
| `question_id` | 확인 필요 항목 | `OQ-014` |

## 5. 상태값

| 상태 | 뜻 | 외부 발행 |
| --- | --- | --- |
| `publishable` | 중앙 기준과 근거가 확인됨 | 가능 |
| `vetted` | 방향은 검수됐지만 상황별 확인 필요 | 조정 후 가능 |
| `candidate` | 좋은 후보지만 중앙 검수 또는 최신 확인 필요 | 직접 발행 금지 |
| `needs_confirmation` | 사장 확인, 최신 정책, 최신 캡처 필요 | 금지 |
| `restricted` | 민감정보 또는 관리자 정보 포함 가능 | 금지 |
| `expired` | 최신성 재확인 필요 | 금지 |

이미지 자산은 별도 상태를 함께 쓴다.

| 필드 | 뜻 |
| --- | --- |
| `privacy_status` | 공식 제작 검토 또는 개인정보/주소/얼굴/관리자 정보 검수 상태 |
| `claim_risk` | 이미지 안 문구의 가격/이벤트/리뷰/혜택 위험 |
| `recommended_use` | 쓸 수 있는 용도 |
| `avoid_use` | 쓰면 안 되는 용도 |

`privacy_status: official_reviewed`는 문장군이 공식 제작·검토한 상세페이지, 상품 이미지, 브랜드 산출물에 사용한다. 이 상태의 자산은 중앙 브랜드 위키에서 별도 OCR/육안 개인정보 검수를 다시 요구하지 않는다. `privacy_status: not_verified`는 외부 유입 현장 사진, 리뷰 캡처, 상담 자료처럼 문장군 공식 제작 산출물이 아닌 자료에 사용한다.

상태값은 세 축으로 나눠 읽는다. `status`/`review_status`는 발행 가능 검수 상태, `index_status`는 검색/색인 상태, `preservation_status`는 보존/대체/폐기 상태다. 검색/색인 상태가 높아도 발행 가능 상태가 자동으로 올라가지 않는다.

표기법은 파일 성격에 따라 다르다. 상품별 `asset-manifest.json`은 `usageStatus`, `privacyStatus`, `claimRisk`처럼 camelCase를 쓰고, `ASSET_SEMANTIC_INDEX.md`는 `status`, `privacy_status`, `claim_risk`처럼 snake_case를 쓴다. 표기만 다를 뿐 같은 위험 축을 가리키며, 충돌 시 더 보수적인 값을 따른다.

## 6. 통제 태그

자유 태그만 쓰면 검색이 흐려진다. 아래 통제 태그를 우선 사용한다.

| 분류 | 예시 |
| --- | --- |
| `product` | `3연동중문`, `원슬라이딩중문`, `스윙중문`, `ABS도어` |
| `collection` | `basic`, `modern`, `classic`, `art` |
| `asset_topic` | `frame_size`, `color_option`, `glass_option`, `event_notice`, `hero`, `comparison`, `case_gallery` |
| `customer_concern` | `가격`, `가능여부`, `답답함`, `디자인선택`, `추가금`, `시공시간`, `A/S` |
| `field_variable` | `현관폭`, `벽공간`, `바닥단차`, `신발장간섭`, `스위치간섭`, `천장몰딩` |
| `visual_mood` | `담백함`, `모던`, `클래식`, `아치`, `우드`, `밝은공간`, `무게감` |
| `usage_channel` | `상세페이지`, `블로그`, `인스타그램`, `릴스`, `웹앱`, `랜딩`, `상담FAQ` |
| `claim_type` | `price`, `discount`, `review_count`, `event`, `installment`, `shipping`, `as_period`, `schedule` |

확장 승인된 `asset_topic`:

- `size`
- `summary`
- `detail`
- `mood_intro`

확장 승인된 `claim_type`:

- `sizing`
- `spec`

신규 태그는 먼저 `ASSET_SEMANTIC_INDEX.md`에서 임시로 쓰지 않는다. 필요하면 이 문서의 통제 태그 표에 추가한 뒤 사용한다.

## 6-1. 사용 판단 우선순위

상품별 `asset-manifest.json`은 기술 메타데이터의 기준이다. 파일 경로, 순서, 규격, 해시, GIF 프레임은 manifest를 따른다.

하지만 실제 사용 가능 여부는 `ASSET_SEMANTIC_INDEX.md`가 우선한다. manifest와 semantic index의 `status`나 `claim_risk`가 다르면 더 보수적인 값을 따른다.

```text
기술 정보 = asset-manifest.json
사용 판단 = ASSET_SEMANTIC_INDEX.md
충돌 시 = 더 보수적인 상태 우선
```

## 7. 소스 유입 절차

새 자료가 들어오면 아래 순서를 따른다.

```text
source 등록
→ 원본 보존 또는 외부 저장 위치 기록
→ 기술 manifest 생성
→ 의미 인덱스 작성
→ 변동 claim 분리
→ 상품 위키 연결
→ 검수와 상태 승급
→ 발행, 보존, 대체, retired 판단
→ README/CHANGELOG 갱신
→ 필요 시 review/re-review
```

원본 파일명과 폴더 구조는 보존한다. 사람이 보기 좋은 이름으로 바꾸고 싶을 때도 원본은 유지하고, 위키에서 `asset_id`와 의미 태그로 찾게 한다.

## 7-1. 자료 생애주기

브랜드 자료는 아래 생애주기를 가진다.

| 단계 | 뜻 | 필수 기록 |
| --- | --- | --- |
| `received` | 자료가 들어왔지만 아직 중앙 판단 전 | 입수일, 제공자 또는 출처 메모 |
| `registered` | `SOURCE_REGISTRY.md`에 소스 등록 | `source_id`, 원본 위치 정책, owner |
| `indexed` | 기술 색인 또는 요약 문서 생성 | manifest, 요약 문서, 연결 product/proof |
| `semantic_indexed` | 대표 의미 태깅과 사용 주의 정리 | `asset_id`, 태그, 추천/금지 용도 |
| `reviewed_candidate` | 내부 참고 가능성 검토 | privacy/claim 검수 메모 |
| `vetted` | 방향은 검수됐지만 상황별 확인 필요 | 검수자, 기준일, 남은 조건 |
| `publishable` | 외부 발행 가능 | 승인자, 근거, 재확인 주기 |
| `superseded` | 새 자료가 대체 | `superseded_by`, 대체 사유 |
| `retired` | 더 이상 기준으로 쓰지 않음 | `retire_reason`, 보존 위치 |
| `restricted` | 민감 원본 또는 관리자 자료 | 원본 비저장 원칙, 접근 제한 메모 |

`received`, `registered`, `indexed`, `semantic_indexed`는 검색/관리 단계다. 이 단계만으로는 외부 발행 가능 상태가 아니다.

## 7-2. 대량 유입 시 최소 등록 요건

자료가 수십 개 이상 한꺼번에 들어오면 모든 파일을 즉시 의미 태깅하지 않는다. 대신 아래 최소 요건을 먼저 완료한다.

1. `SOURCE_REGISTRY.md`에 소스 묶음을 등록한다.
2. 원본 저장 위치와 중앙 저장 가능 여부를 기록한다.
3. 파일 묶음은 상품별 `asset-manifest.json`을 만든다.
4. manifest에는 최소 `assetId`, `relativePath`, `folderRole`, `sequence`, `bytes`, `sha256`, `usageStatus`, `privacyStatus`, `claimRisk`를 둔다.
5. 가격, 이벤트, 리뷰 수, 혜택, A/S, 일정, 사이즈, 스펙 문구가 보이면 `claimRisk`를 보수적으로 올린다.
6. 대표 이미지부터 `ASSET_SEMANTIC_INDEX.md`에 태깅하고, 미태깅 자산은 외부 발행 불가로 둔다.
7. 상품 위키가 없으면 `PRODUCT_WIKI_INDEX.md`에 `needed` 또는 `candidate` 상태로 입구를 만든다.

## 7-3. 상태 승급 게이트

`candidate` 또는 `needs_confirmation` 자료는 아래 조건을 통과해야 `vetted`나 `publishable`로 올라갈 수 있다.

| 승급 대상 | 필요한 확인 |
| --- | --- |
| 이미지/GIF | 개인정보, 주소, 얼굴, 차량번호, 관리자 화면, AppSheet 원본 노출 여부 |
| 가격/월 납입/이벤트 | `EVIDENCE_REGISTER.md`의 기준일, 조건, 최신성 |
| A/S/일정/시공 시간 | 실제 운영 정책, 예외 조건, `OPEN_QUESTIONS_REGISTER.md` 잔여 여부 |
| 상품 스펙/사이즈/옵션 | 현재 판매/시공 기준과 상품 위키 정합성 |
| 리뷰/증거 | 원문 저장 금지, 사용 권한, 비식별 요약 여부 |

`publishable` 상태에는 승인자 또는 승인 기준이 있어야 한다. 승인자가 불명확하면 `vetted` 이상으로 올리지 않는다.

## 7-4. 보존, 대체, 폐기 원칙

기본 원칙은 삭제보다 보존이다. 오래된 자료도 왜 바뀌었는지 설명하는 히스토리일 수 있기 때문이다.

| 처리 | 기준 | 사용 가능 여부 |
| --- | --- | --- |
| `active` | 현재 기준으로 쓰는 자료 | 상태값에 따라 사용 |
| `reference` | 내부 참고용 | 외부 발행 금지 |
| `superseded` | 새 버전으로 대체됨 | 신규 발행 금지, 이력 확인용 |
| `retired` | 더 이상 기준으로 쓰지 않음 | 사용 금지 |
| `restricted` | 민감 원본 또는 비공개 자료 | 원본 저장/발행 금지 |

중복 파일은 임의 삭제하지 않는다. `sha256`과 `duplicateGroup`으로 묶고, 대표/공유 관계를 manifest에 남긴다.

## 7-5. CHANGELOG 기록 단위

대량 자산 변경은 파일 하나하나를 `CHANGELOG.md`에 나열하지 않는다.

기록 단위:

- `source_id`
- 상품별 manifest 버전
- 상품 위키 버전
- semantic index 범위
- 주요 상태 변경 요약

예:

```text
SRC-YYYY-MM-DD-3PANEL-DETAILPAGE manifest v1.2 반영:
총 132개 중 대표 20개 semantic_indexed, high claim 16개 유지, privacy official_reviewed 적용
```

## 8. 사용 규칙

프로젝트 총괄은 자료를 쓰기 전 아래 순서로 확인한다.

1. `PRODUCT_WIKI_INDEX.md`에서 해당 상품 위키를 찾는다.
2. 상품 위키에서 추천 메시지와 주의 claim을 확인한다.
3. 필요한 이미지가 있으면 `ASSET_SEMANTIC_INDEX.md`에서 의미 태그로 찾는다.
4. 파일 경로와 규격은 상품별 `asset-manifest.json`에서 확인한다.
5. 가격, 이벤트, 리뷰 수, A/S, 일정은 `EVIDENCE_REGISTER.md`와 `OPEN_QUESTIONS_REGISTER.md`를 확인한다.

## 9. 금지

- 이미지 안에 들어 있는 가격/이벤트/혜택 문구를 최신 운영 사실처럼 그대로 발행
- `candidate` 자산을 `approved_public`처럼 사용
- 중복 이미지를 임의 삭제
- 프로젝트 특화 표현을 중앙 기준처럼 승격
- 고객명, 주소, 전화번호, 상담 원문, 관리자 화면, AppSheet 원본 저장
