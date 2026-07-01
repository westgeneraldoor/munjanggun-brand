# SOURCE_REGISTRY - 문장군 브랜드 소스 등록부

> 버전: v1.3
> 최종 업데이트: 2026-07-01
> 목적: 중앙 브랜드 원본에 들어오는 상품 상세페이지, CSV, 이미지, 리뷰, 상담, 현장 자료의 출처, 사용 상태, 보존/대체/재검토 상태를 추적한다.

이 문서는 자료 원본 저장소가 아니다. 어떤 자료가 언제 들어왔고, 어디에 요약/색인됐으며, 외부 발행에 쓸 수 있는지 판단하기 위한 등록부다.

## 1. 소스 상태

| index_status | 뜻 |
| --- | --- |
| `registered` | 소스가 등록됨 |
| `indexed` | 기술 manifest 또는 요약 문서가 있음 |
| `semantic_indexed` | 의미 태그와 사용 규칙까지 정리됨 |
| `retired` | 더 이상 기준으로 쓰지 않음 |

| review_status | 뜻 |
| --- | --- |
| `not_reviewed` | 개인정보, claim, 최신성 검토 전 |
| `needs_review` | 공개 전 검토 필요 |
| `reviewed_candidate` | 후보 사용 가능성은 검토됐지만 외부 발행 전 재확인 필요 |
| `approved_public` | 공개 사용 가능 검수 완료 |
| `restricted` | 중앙에 원본 저장 금지 또는 내부 확인용 |

## 1-1. 보존 상태

| preservation_status | 뜻 |
| --- | --- |
| `active` | 현재 기준으로 관리 중 |
| `reference` | 내부 참고용. 외부 발행 금지 |
| `superseded` | 새 소스나 새 manifest로 대체됨 |
| `retired` | 더 이상 기준으로 쓰지 않음 |
| `restricted_source` | 원본 접근 제한 또는 중앙 저장 금지 |

`index_status`는 찾을 수 있는지를 말하고, `review_status`는 쓸 수 있는지를 말하며, `preservation_status`는 앞으로 보존/대체/폐기 흐름을 말한다.

## 2. 소스 등록부

| source_id | 소스 | 원본 위치 | 연결 문서 | 주요 내용 | 개인정보 위험 | claim 위험 | index_status | review_status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SRC-2026-06-30-BRANDSTORE-PRODUCT-CSV` | 네이버 스마트스토어 상품 CSV export | 중앙 저장소에 원본 CSV 미저장. 사용자 제공 파일 기반 요약 | `NAVER_BRANDSTORE_PRODUCT_EXPORT_2026-06-30.md` | 공개 판매 상품 14개, 판매가/할인가, 배송/반품 조건 후보 | 낮음 | 높음. 가격/할인/배송 조건 포함 | `indexed` | `needs_review` |
| `SRC-2026-06-30-BRANDSTORE-THUMBNAILS` | 네이버 스마트스토어 공개 판매 상품 대표 썸네일 | `assets/product-thumbnails/naver-brandstore-2026-06-30/` | `PRODUCT_THUMBNAIL_ASSET_INDEX_2026-06-30.md` | 공개 판매 상품 14개 대표 썸네일 | 낮음 | 중간. 상품 노출/가격과 분리 필요 | `indexed` | `needs_review` |
| `SRC-2026-06-30-3PANEL-DETAILPAGE` | 3연동중문 상세페이지 이미지/GIF 원본 묶음 v1 | `문장군상품/3연동중문/` 기존 132개 기준. 현재 실제 폴더는 2026-07-01 v2로 대체됨 | `THREE_PANEL_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-06-30.md` | 3연동중문 공통 도입, 이벤트/공지, 컬러, 유리, 베이직/모던/클래식/아트 컬렉션의 이전 스냅샷 | 낮음. 문장군 공식 제작·검토 결과물 | 중간~높음. 가격/이벤트/혜택 문구는 재사용 시 최신성 확인 | `retired` | `reviewed_candidate` |
| `SRC-2026-07-01-3PANEL-DETAILPAGE-V2` | 3연동중문 상세페이지 이미지/GIF 교체본 v2 | `문장군상품/3연동중문/` | `THREE_PANEL_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `문장군상품/3연동중문/asset-manifest.json`, `ASSET_SEMANTIC_INDEX.md` | 3연동중문 루트 상세 흐름 74개, 이벤트/공지 12개, 컬러 17개, 유리 2개, 4개 컬렉션 상세/썸네일 97개 | 낮음. 문장군 공식 제작·검토 결과물 | 중간~높음. 이벤트/가격/월 납입/스펙 문구는 원본 맥락 밖 재사용 시 최신성 확인 | `semantic_indexed` | `reviewed_candidate` |
| `SRC-2026-07-01-ONESLIDING-DETAILPAGE` | 원슬라이딩중문 상세페이지 이미지/GIF 원본 묶음 | `문장군상품/원슬라이딩중문/` | `ONE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `문장군상품/원슬라이딩중문/asset-manifest.json`, `ASSET_SEMANTIC_INDEX.md` | 원슬라이딩중문 루트 상세 흐름 62개, 썸네일 10개, 이벤트/공지 9개, 컬러 10개, 유리 2개, 4개 컬렉션 상세 12개 | 낮음. 문장군 공식 제작·검토 결과물 | 중간~높음. 이벤트/가격/월 납입/스펙 문구는 원본 맥락 밖 재사용 시 최신성 확인 | `semantic_indexed` | `reviewed_candidate` |
| `SRC-2026-07-01-3PANEL-AUTO-DETAILPAGE` | 3연동 자동중문 상세페이지 이미지/GIF 원본 묶음 | `문장군상품/3연동 자동중문/` | `THREE_PANEL_AUTO_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `문장군상품/3연동 자동중문/asset-manifest.json`, `ASSET_SEMANTIC_INDEX.md` | 루트 82개, 썸네일 10개, 이벤트/공지 9개, 컬러 17개, 유리 2개, 컬렉션 11개 | 낮음. 문장군 공식 제작·검토 결과물 | 중간~높음. 자동 기능, 전원/센서/유지관리, 가격/이벤트 문구는 재사용 시 최신성 확인 | `semantic_indexed` | `reviewed_candidate` |
| `SRC-2026-07-01-3PANEL-LSHAPE-DETAILPAGE` | 3연동 ㄱ자 중문 상세페이지 이미지/GIF 원본 묶음 | `문장군상품/3연동ㄱ자/` | `THREE_PANEL_LSHAPE_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `문장군상품/3연동ㄱ자/asset-manifest.json`, `ASSET_SEMANTIC_INDEX.md` | 루트 73개, 썸네일 5개, 이벤트/공지 12개, 컬러 17개, 유리 2개, 컬렉션 11개 | 낮음. 문장군 공식 제작·검토 결과물 | 중간~높음. 보강/특수 구조/추가금/이벤트 문구는 재사용 시 최신성 확인 | `semantic_indexed` | `reviewed_candidate` |
| `SRC-2026-07-01-ABS-DOOR-REPLACEMENT-DETAILPAGE` | ABS도어 방문교체 상세페이지 이미지/GIF 원본 묶음 | `문장군상품/ABS도어 방문교체/` | `ABS_DOOR_REPLACEMENT_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `문장군상품/ABS도어 방문교체/asset-manifest.json`, `ASSET_SEMANTIC_INDEX.md` | 루트 45개, 디자인 6개, 썸네일 10개, 이벤트/공지 10개, 컬러 11개, 패키지 8개 | 낮음. 문장군 공식 제작·검토 결과물 | 높음. 패키지 구성, 가격, 시공 범위, 이벤트 문구는 재사용 시 최신성 확인 | `semantic_indexed` | `reviewed_candidate` |
| `SRC-2026-07-01-SWING-DETAILPAGE` | 스윙중문 상세페이지 이미지/GIF 원본 묶음 | `문장군상품/스윙중문/` | `SWING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `문장군상품/스윙중문/asset-manifest.json`, `ASSET_SEMANTIC_INDEX.md` | 루트 55개, 디자인 4개, 썸네일 10개, 유리 1개, 이벤트/공지 9개, 컬러 5개 | 낮음. 문장군 공식 제작·검토 결과물 | 중간~높음. 가격/이벤트/옵션/시공 조건 문구는 재사용 시 최신성 확인 | `semantic_indexed` | `reviewed_candidate` |
| `SRC-2026-07-01-WIDE-SLIDING-DETAILPAGE` | 양개형중문/미서기 상세페이지 이미지/GIF 원본 묶음 | `문장군상품/양개형중문 미서기/` | `WIDE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `문장군상품/양개형중문 미서기/asset-manifest.json`, `ASSET_SEMANTIC_INDEX.md` | 루트 86개, 썸네일 10개, 유리 2개, 이벤트/공지 9개, 컬러 17개, 일반 컬렉션 11개, 와이드 컬렉션 12개 | 낮음. 문장군 공식 제작·검토 결과물 | 중간~높음. 폭/구조/가격/이벤트 문구는 재사용 시 최신성 확인 | `semantic_indexed` | `reviewed_candidate` |
| `SRC-2026-06-30-BRANDSTORE-SCREENSHOTS` | 브랜드스토어 전체상품 화면 캡처 2장 | 중앙 저장소에 원본 이미지 미저장. 사용자 제공 캡처 기반 요약 | `EVIDENCE_REGISTER.md`, `PROOF_ASSET_INDEX.md` | 화면상 리뷰 수 후보, 상품 노출 후보 | 낮음 | 높음. 리뷰 수 변동 claim | `indexed` | `needs_review` |

## 2-1. 보존/재검토 추적표

소스 등록부 본문 표는 출처와 연결 문서 확인용이고, 아래 표는 장기 보존, 대체, 재검토 추적용이다.

| source_id | preservation_status | retention_policy | owner | review_due | superseded_by | retire_reason |
| --- | --- | --- | --- | --- | --- | --- |
| `SRC-2026-06-30-BRANDSTORE-PRODUCT-CSV` | `active` | `preserve` | 중앙 브랜드 총괄 | 가격/할인/배송 조건 외부 발행 전 | 없음 | 없음 |
| `SRC-2026-06-30-BRANDSTORE-THUMBNAILS` | `active` | `preserve` | 중앙 브랜드 총괄 | 썸네일 외부 재사용 전 | 없음 | 없음 |
| `SRC-2026-06-30-3PANEL-DETAILPAGE` | `superseded` | `archive_after_superseded` | 중앙 브랜드 총괄 | 신규 발행 기준으로 직접 사용하지 않음 | `SRC-2026-07-01-3PANEL-DETAILPAGE-V2` | 사용자가 기존 3연동중문 폴더를 삭제하고 2026-07-01 교체본을 재투입함 |
| `SRC-2026-07-01-3PANEL-DETAILPAGE-V2` | `active` | `preserve` | 중앙 브랜드 총괄 | 원본 상세페이지 맥락 밖에서 가격/이벤트/스펙 문구 재사용 시 최신성 확인 | 없음 | 없음 |
| `SRC-2026-07-01-ONESLIDING-DETAILPAGE` | `active` | `preserve` | 중앙 브랜드 총괄 | 원본 상세페이지 맥락 밖에서 가격/이벤트/스펙 문구 재사용 시 최신성 확인 | 없음 | 없음 |
| `SRC-2026-07-01-3PANEL-AUTO-DETAILPAGE` | `active` | `preserve` | 중앙 브랜드 총괄 | 자동 기능, 가격/이벤트/스펙 문구 재사용 시 최신성 확인 | 없음 | 없음 |
| `SRC-2026-07-01-3PANEL-LSHAPE-DETAILPAGE` | `active` | `preserve` | 중앙 브랜드 총괄 | 특수 구조, 보강, 가격/이벤트/스펙 문구 재사용 시 최신성 확인 | 없음 | 없음 |
| `SRC-2026-07-01-ABS-DOOR-REPLACEMENT-DETAILPAGE` | `active` | `preserve` | 중앙 브랜드 총괄 | 패키지 구성, 가격/이벤트/시공 범위 문구 재사용 시 최신성 확인 | 없음 | 없음 |
| `SRC-2026-07-01-SWING-DETAILPAGE` | `active` | `preserve` | 중앙 브랜드 총괄 | 가격/이벤트/옵션/시공 조건 문구 재사용 시 최신성 확인 | 없음 | 없음 |
| `SRC-2026-07-01-WIDE-SLIDING-DETAILPAGE` | `active` | `preserve` | 중앙 브랜드 총괄 | 폭/개폐 구조, 가격/이벤트/스펙 문구 재사용 시 최신성 확인 | 없음 | 없음 |
| `SRC-2026-06-30-BRANDSTORE-SCREENSHOTS` | `reference` | `external_only` | 중앙 브랜드 총괄 | 리뷰 수 또는 상품 노출 claim 사용 전 최신 캡처 확인 | 없음 | 원본 캡처 중앙 미저장. 요약 근거로만 사용 |

## 3. 신규 소스 등록 템플릿

```text
source_id:
source_name:
received_at:
source_type: product_detail / image_set / csv / review / 상담요약 / field_photo / app_screen / other
original_location:
central_summary_doc:
technical_manifest:
semantic_index:
product_id:
proof_id:
privacy_risk: low / medium / high / restricted
claim_risk: low / medium / high
index_status:
review_status:
preservation_status: active / reference / superseded / retired / restricted_source
retention_policy: preserve / external_only / archive_after_superseded / delete_after_confirmation
owner:
review_due:
superseded_by:
retire_reason:
sensitive_original_location_policy:
next_action:
```

## 4. 등록 원칙

1. 원본이 고객정보, 관리자 화면, AppSheet 원본, 리뷰 원문을 포함하면 중앙 저장소에 복사하지 않는다.
2. 상품 상세페이지 이미지는 원본 파일명과 순서를 보존하고 manifest로 관리한다.
3. 이미지 안 문구도 claim으로 본다.
4. 소스가 많아질수록 문서 본문보다 `source_id`, `asset_id`, `product_id`, `claim_id` 연결을 우선한다.
5. `approved_public`은 검색 완료가 아니라 공개 사용 검수 완료 상태다. 승인 근거가 없으면 `approved_public`으로 올리지 않는다.
6. 대체 자료가 들어오면 기존 소스를 삭제하지 않고 `preservation_status: superseded`, `superseded_by`, `retire_reason`을 남긴다.
7. `review_due`가 지난 소스는 외부 발행 전 최신성 재확인을 거친다.
