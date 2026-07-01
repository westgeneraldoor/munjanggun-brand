# THREE_PANEL_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01

> 버전: v2.0
> 최종 업데이트: 2026-07-01
> source_id: `SRC-2026-07-01-3PANEL-DETAILPAGE-V2`
> product_id: `PROD-3PANEL-MIDDLE-DOOR`
> proof_id: `PROOF-3PANEL-DETAILPAGE-ASSETS-2026-07-01`
> 목적: 2026-07-01에 교체 투입된 문장군 3연동중문 상세페이지 이미지/GIF 원본 묶음을 기술 manifest와 상품 위키에 연결한다.

## 1. 교체 요약

기존 `SRC-2026-06-30-3PANEL-DETAILPAGE`는 132개 자산 기준이었다.

2026-07-01 사용자가 기존 3연동중문 상품 폴더를 삭제하고 새 `문장군상품/3연동중문/` 폴더를 다시 투입했다. 따라서 기존 2026-06-30 source는 보존하되, 현재 운영 기준은 이 2026-07-01 source로 본다.

```text
이전 기준: 132개 자산
현재 기준: 202개 자산
manifest: 문장군상품/3연동중문/asset-manifest.json
```

## 2. 자산 구성

| 구분 | 수량 | 해석 |
| --- | ---: | --- |
| 루트 상세페이지 흐름 | 74 | 001부터 이어지는 공통 상세페이지 본문 순서 |
| 이벤트 및 공지 | 12 | 이벤트, 혜택, 가격성 문구 가능성이 높은 고위험 claim 구역 |
| 컬러 옵션 | 17 | 컬러 선택 안내 후보 |
| 유리 옵션 | 2 | 유리 선택 안내 후보 |
| 컬렉션 상세 | 64 | 베이직, 모던, 클래식, 아트별 상세 설명 |
| 컬렉션 썸네일 | 33 | 컬렉션별 대표 썸네일 후보 |
| 전체 | 202 | JPG 151개, PNG 4개, GIF 47개 |

컬렉션별 구성:

| 컬렉션 | 수량 | 비고 |
| --- | ---: | --- |
| 베이직 | 14 | 상세 9, 썸네일 5 |
| 모던 | 30 | 상세 22, 썸네일 8 |
| 클래식 | 27 | 상세 17, 썸네일 10 |
| 아트 | 26 | 상세 16, 썸네일 10 |
| 공통/옵션 | 105 | 루트, 이벤트, 컬러, 유리 |

## 3. 운영 상태

| 상태 항목 | 값 | 의미 |
| --- | --- | --- |
| `usageStatus` | `candidate` | 내부 검색과 상품 이해에 사용 가능 |
| `privacyStatus` | `official_reviewed` | 문장군 공식 제작·검토 결과물. 중앙 위키에서 별도 OCR/육안 개인정보 검수를 반복하지 않음 |
| `claimRisk` | `low` / `medium` / `high` | 가격, 이벤트, 월 납입, 스펙, 옵션 문구 재사용 시 최신성 확인 |
| `externalPublish` | manifest 값 확인 | 원본 상세페이지 밖 재사용 전 맥락과 claim 최신성 확인 |

주의:

- `official_reviewed`는 개인정보 재검수 면제 상태이지, 가격/이벤트/스펙 최신성 확인 면제가 아니다.
- `이벤트 및 공지` 폴더와 컬렉션 대표 요약 GIF는 `claimRisk: high`로 본다.
- 파일명 `001.jpg` 같은 순서는 manifest의 `relativePath`와 `sequence`로 확인한다.
- 동일 해시 자산은 삭제하지 않고 manifest의 `duplicateGroup`으로 추적한다. 중복은 오류가 아니라 컬렉션/썸네일/상품 간 공유 가능성을 뜻할 수 있다.

## 4. 연결 문서

```text
문장군상품/3연동중문/asset-manifest.json
PRODUCT_WIKI_3PANEL_MIDDLE_DOOR.md
PRODUCT_WIKI_INDEX.md
ASSET_SEMANTIC_INDEX.md
SOURCE_REGISTRY.md
EVIDENCE_REGISTER.md
OPEN_QUESTIONS_REGISTER.md
```

## 5. 사용 규칙

3연동중문 관련 이미지를 찾을 때는 직접 파일명을 외우지 않는다.

예:

```text
클래식 프레임 설명 → ASSET_SEMANTIC_INDEX.md에서 collection:classic + asset_topic:frame_size
이벤트 이미지 제외 → claim_type:event 또는 claim_risk:high 제외
컬러 안내 → asset_topic:color_option
유리 안내 → asset_topic:glass_option
```

상세페이지 원본 흐름을 재현하거나 점검할 때는 `asset-manifest.json`의 `relativePath`, `sequence`, `folderRole`, `collection`, `sha256`을 기준으로 한다.
