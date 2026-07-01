# ONE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01

> 버전: v1.0
> 최종 업데이트: 2026-07-01
> source_id: `SRC-2026-07-01-ONESLIDING-DETAILPAGE`
> product_id: `PROD-ONE-SLIDING-MIDDLE-DOOR`
> proof_id: `PROOF-ONESLIDING-DETAILPAGE-ASSETS-2026-07-01`
> 목적: 문장군 원슬라이딩중문 상세페이지 이미지/GIF 원본 묶음을 기술 manifest와 상품 위키에 연결한다.

## 1. 소스 요약

2026-07-01 사용자가 `문장군상품/원슬라이딩중문/` 폴더를 신규 투입했다.

```text
현재 기준: 105개 자산
manifest: 문장군상품/원슬라이딩중문/asset-manifest.json
```

원슬라이딩중문은 3연동중문과 같은 베이직/클래식/모던/아트 컬렉션 언어를 공유하지만, 핵심 구조는 한 장의 문이 좌우로 미끄러지는 단독 도어형 슬라이딩이다.

## 2. 자산 구성

| 구분 | 수량 | 해석 |
| --- | ---: | --- |
| 루트 상세페이지 흐름 | 62 | 001부터 이어지는 공통 상세페이지 본문 순서 |
| 썸네일 | 10 | 원슬라이딩 대표 썸네일 후보 |
| 이벤트 및 공지 | 9 | 이벤트, 혜택, 가격성 문구 가능성이 높은 고위험 claim 구역 |
| 컬러 옵션 | 10 | 컬러 선택 안내 후보 |
| 유리 옵션 | 2 | 유리 선택 안내 후보 |
| 컬렉션 상세 | 12 | 베이직, 모던, 클래식, 아트별 상세 설명 |
| 전체 | 105 | JPG 89개, GIF 16개 |

컬렉션별 구성:

| 컬렉션 | 수량 | 비고 |
| --- | ---: | --- |
| 베이직 | 2 | 단정한 기본형 설명 |
| 모던 | 3 | 또렷하고 정돈된 단독 슬라이딩 인상 |
| 클래식 | 4 | 목재감, 아치/캔버스/유리 스타일 등 가구감 있는 인상 |
| 아트 | 3 | 포인트 디자인과 개성 중심 |
| 공통/옵션 | 93 | 루트, 썸네일, 이벤트, 컬러, 유리 |

## 3. 운영 상태

| 상태 항목 | 값 | 의미 |
| --- | --- | --- |
| `usageStatus` | `candidate` | 내부 검색과 상품 이해에 사용 가능 |
| `privacyStatus` | `official_reviewed` | 문장군 공식 제작·검토 결과물. 중앙 위키에서 별도 OCR/육안 개인정보 검수를 반복하지 않음 |
| `claimRisk` | `low` / `medium` / `high` | 가격, 이벤트, 월 납입, 스펙, 옵션 문구 재사용 시 최신성 확인 |

주의:

- 원슬라이딩 첫 화면은 `THE BASIC / THE CLASSIC / THE MODERN / THE ART` 컬렉션 언어를 전면에 둔다.
- "단 하나의 도어", "완성된 하나의 작품" 계열 메시지는 상품 정체성 후보로 좋지만, 과장된 프리미엄 표현이 되지 않게 상담형 문장으로 풀어쓴다.
- 이벤트/공지 자산은 원본 상세페이지 맥락 밖에서 그대로 발행하지 않는다.
- 동일 해시 자산은 삭제하지 않고 manifest의 `duplicateGroup`으로 추적한다. 중복은 오류가 아니라 상세페이지/썸네일/상품 간 공유 가능성을 뜻할 수 있다.

## 4. 연결 문서

```text
문장군상품/원슬라이딩중문/asset-manifest.json
PRODUCT_WIKI_ONE_SLIDING_MIDDLE_DOOR.md
PRODUCT_WIKI_INDEX.md
ASSET_SEMANTIC_INDEX.md
SOURCE_REGISTRY.md
EVIDENCE_REGISTER.md
OPEN_QUESTIONS_REGISTER.md
```

## 5. 사용 규칙

원슬라이딩중문 이미지를 찾을 때는 아래 의미 태그를 우선한다.

```text
product:원슬라이딩중문
asset_topic:one_sliding_structure
collection:basic
collection:modern
collection:classic
collection:art
asset_topic:color_option
asset_topic:glass_option
```

상세페이지 원본 흐름을 재현하거나 점검할 때는 `asset-manifest.json`의 `relativePath`, `sequence`, `folderRole`, `collection`, `sha256`을 기준으로 한다.
