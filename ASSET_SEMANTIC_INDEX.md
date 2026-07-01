# ASSET_SEMANTIC_INDEX - 문장군 이미지/GIF 의미 인덱스

> 버전: v1.4
> 최종 업데이트: 2026-07-01
> 목적: 이미지/GIF가 단순 파일 경로가 아니라 어떤 의미를 담고 있고 어디에 써도 되는지 검색 가능하게 관리하되, 공식 제작 자산과 변동 claim 확인 책임을 분리한다.

이 문서는 기술 manifest를 대체하지 않는다. 파일 규격, 해시, 순서는 상품별 `asset-manifest.json`을 기준으로 한다. 이 문서는 의미, 태그, 사용처, 주의 claim을 관리한다.

현재 v1.3은 아래 상품 자산의 대표 의미 태그를 관리한다.

| product_id | 상품 | 전체 자산 | 대표 의미 태깅 | manifest |
| --- | --- | ---: | ---: | --- |
| `PROD-3PANEL-MIDDLE-DOOR` | 3연동중문 | 202 | 14 | `문장군상품/3연동중문/asset-manifest.json` |
| `PROD-ONE-SLIDING-MIDDLE-DOOR` | 원슬라이딩중문 | 105 | 10 | `문장군상품/원슬라이딩중문/asset-manifest.json` |
| `PROD-3PANEL-AUTO-MIDDLE-DOOR` | 3연동 자동중문 | 131 | 5 | `문장군상품/3연동 자동중문/asset-manifest.json` |
| `PROD-3PANEL-LSHAPE-MIDDLE-DOOR` | 3연동 ㄱ자 중문 | 120 | 5 | `문장군상품/3연동ㄱ자/asset-manifest.json` |
| `PROD-ABS-DOOR-REPLACEMENT` | ABS도어 방문교체 | 90 | 6 | `문장군상품/ABS도어 방문교체/asset-manifest.json` |
| `PROD-SWING-MIDDLE-DOOR` | 스윙중문 | 84 | 4 | `문장군상품/스윙중문/asset-manifest.json` |
| `PROD-WIDE-SLIDING-MIDDLE-DOOR` | 양개형중문/미서기 | 147 | 8 | `문장군상품/양개형중문 미서기/asset-manifest.json` |

여기에 없는 자산은 위험 자산이라는 뜻이 아니라 아직 의미 태깅이 덜 된 자산이다. 파일 경로와 기본 상태는 상품별 `asset-manifest.json`, 원본 맥락은 `SOURCE_REGISTRY.md`, 변동 claim 재사용은 `EVIDENCE_REGISTER.md`와 `OPEN_QUESTIONS_REGISTER.md`를 확인한다.

문장군 공식 상세페이지 자산은 문장군이 제작·검토한 결과물이므로 중앙 브랜드 위키에서 별도 OCR/육안 개인정보 검수를 다시 요구하지 않는다. 단, 가격, 이벤트, 월 납입, 스펙, 운영 조건처럼 시간이 지나면 달라질 수 있는 문구를 원본 상세페이지 맥락 밖에서 재사용할 때는 최신성을 확인한다.

## 1. 필드 정의

| 필드 | 뜻 |
| --- | --- |
| `asset_id` | manifest의 `assetId` |
| `source_id` | 소스 등록부 ID |
| `product_id` | 연결 상품 ID |
| `path` | 중앙 저장소 기준 경로 |
| `topic` | 이미지가 말하는 핵심 주제 |
| `visible_text_summary` | 이미지 안 주요 문구의 의미 요약. OCR 전문이 아님 |
| `semantic_tags` | 검색용 통제 태그 |
| `recommended_use` | 추천 용도 |
| `avoid_use` | 피해야 할 용도 |
| `claim_risk` | low / medium / high |
| `privacy_status` | official_reviewed / not_verified / checked / restricted |
| `status` | candidate / vetted / publishable / needs_confirmation / restricted |

## 2. 3연동중문 대표 의미 인덱스

| asset_id | product_id | path | topic | visible_text_summary | semantic_tags | recommended_use | avoid_use | claim_risk | privacy_status | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `mg-3panel-detailpage-root-001` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/001.jpg` | hero_intro | 문장군 슬라이딩 3연동 중문 대표 도입 | `product:3연동중문`, `asset_topic:hero`, `usage_channel:상세페이지` | 3연동중문 대표 구조 이해, 상세페이지 도입 참고 | 브랜드 v3 대표 히어로로 그대로 사용 | medium | official_reviewed | candidate |
| `mg-3panel-detailpage-root-005` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/005.jpg` | detail_flow | 3연동중문 공통 상세 흐름의 긴 설명 이미지 | `product:3연동중문`, `asset_topic:detail_flow` | 상세페이지 순서 이해, 문구 구조 참고 | 이미지 안 문구를 최신 운영 사실처럼 복사 | medium | official_reviewed | candidate |
| `mg-3panel-collection-detail-basic-001` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/컬렉션/베이직/001.gif` | basic_summary | 베이직 요약, 프레임/디자인/컬러/가격성 문구 포함 가능 | `collection:basic`, `asset_topic:summary`, `claim_type:price` | 베이직 구조 이해 | 가격 문구 포함 상태로 외부 발행 | high | official_reviewed | needs_confirmation |
| `mg-3panel-collection-detail-modern-001` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/컬렉션/모던/001.gif` | modern_summary | 모던 요약, 프레임/디자인/컬러/가격성 문구 포함 가능 | `collection:modern`, `asset_topic:summary`, `asset_topic:frame_size`, `claim_type:price` | 모던 라인 내부 설명 | 가격/스펙 확인 없이 발행 | high | official_reviewed | needs_confirmation |
| `mg-3panel-collection-detail-classic-001` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/컬렉션/클래식/001.gif` | classic_summary | 클래식 요약, 5cm 프레임과 권장 사이즈/가격성 문구 포함 가능 | `collection:classic`, `asset_topic:summary`, `asset_topic:frame_size`, `claim_type:price`, `field_variable:현관폭` | 클래식 스펙 후보 확인, 내부 설명 | 가격/권장 사이즈 확정 발행 | high | official_reviewed | needs_confirmation |
| `mg-3panel-collection-detail-classic-005` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/컬렉션/클래식/005.jpg` | classic_frame_5cm | 클래식 프레임 두께/안정감 설명 후보 | `collection:classic`, `asset_topic:frame_size`, `visual_mood:무게감`, `customer_concern:디자인선택` | 클래식 프레임 설명 이미지 후보 | 스펙 확정 전 단정 | medium | official_reviewed | candidate |
| `mg-3panel-collection-detail-art-001` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/컬렉션/아트/001.gif` | art_summary | 아트 요약, 곡선/포인트 디자인과 가격성 문구 포함 가능 | `collection:art`, `asset_topic:summary`, `visual_mood:아치`, `claim_type:price` | 아트 라인 내부 설명 | 가격 문구 포함 상태로 외부 발행 | high | official_reviewed | needs_confirmation |
| `mg-3panel-color-option-001` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/컬러/001.jpg` | color_collection | 컬러 옵션 도입 | `asset_topic:color_option`, `customer_concern:디자인선택` | 컬러 옵션 구조 설명 | 현재 운영 색상 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-3panel-glass-option-001` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/유리/001.jpg` | glass_option | 유리 옵션 설명 | `asset_topic:glass_option`, `customer_concern:답답함`, `customer_concern:디자인선택` | 유리 선택 안내 | 현재 운영 옵션 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-3panel-event-notice-001` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/이벤트 및 공지/001.jpg` | event_notice | 이벤트/혜택성 안내 후보 | `asset_topic:event_notice`, `claim_type:event`, `claim_type:price` | 내부 확인용 | 최신 확인 없이 외부 발행 | high | official_reviewed | needs_confirmation |
| `mg-3panel-thumbnail-basic-001` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/컬렉션/베이직/썸네일/001.jpg` | basic_thumbnail | 베이직 대표 썸네일 후보 | `collection:basic`, `asset_topic:thumbnail` | 상품 썸네일 후보 탐색 | 최신 상품 노출 확인 없이 광고 대표 이미지 확정 | low | official_reviewed | candidate |
| `mg-3panel-thumbnail-modern-001` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/컬렉션/모던/썸네일/001.jpg` | modern_thumbnail | 모던 대표 썸네일 후보 | `collection:modern`, `asset_topic:thumbnail` | 상품 썸네일 후보 탐색 | 최신 상품 노출 확인 없이 광고 대표 이미지 확정 | low | official_reviewed | candidate |
| `mg-3panel-thumbnail-classic-001` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/컬렉션/클래식/썸네일/001.jpg` | classic_thumbnail | 클래식 대표 썸네일 후보 | `collection:classic`, `asset_topic:thumbnail` | 상품 썸네일 후보 탐색 | 최신 상품 노출 확인 없이 광고 대표 이미지 확정 | low | official_reviewed | candidate |
| `mg-3panel-thumbnail-art-001` | `PROD-3PANEL-MIDDLE-DOOR` | `문장군상품/3연동중문/컬렉션/아트/썸네일/001.jpg` | art_thumbnail | 아트 대표 썸네일 후보 | `collection:art`, `asset_topic:thumbnail` | 상품 썸네일 후보 탐색 | 최신 상품 노출 확인 없이 광고 대표 이미지 확정 | low | official_reviewed | candidate |

## 3. 원슬라이딩중문 대표 의미 인덱스

| asset_id | product_id | path | topic | visible_text_summary | semantic_tags | recommended_use | avoid_use | claim_risk | privacy_status | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `mg-onesliding-detailpage-root-001` | `PROD-ONE-SLIDING-MIDDLE-DOOR` | `문장군상품/원슬라이딩중문/001.jpg` | one_sliding_intro | 단 하나의 도어, 완성된 하나의 작품 메시지와 4컬렉션 도입 | `product:원슬라이딩중문`, `asset_topic:hero`, `asset_topic:one_sliding_structure` | 원슬라이딩 상품 정체성 이해 | 프리미엄 과장 문구로 그대로 사용 | medium | official_reviewed | candidate |
| `mg-onesliding-detailpage-root-005` | `PROD-ONE-SLIDING-MIDDLE-DOOR` | `문장군상품/원슬라이딩중문/005.jpg` | detail_flow | 원슬라이딩 공통 상세 흐름 이미지 | `product:원슬라이딩중문`, `asset_topic:detail_flow` | 상세페이지 순서 이해 | 이미지 안 문구를 최신 운영 사실처럼 복사 | medium | official_reviewed | candidate |
| `mg-onesliding-collection-detail-basic-001` | `PROD-ONE-SLIDING-MIDDLE-DOOR` | `문장군상품/원슬라이딩중문/컬렉션/베이직/001.jpg` | basic_summary | 원슬라이딩 베이직 컬렉션 설명 | `collection:basic`, `asset_topic:summary` | 베이직 라인 내부 설명 | 옵션/스펙 최신성 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-onesliding-collection-detail-modern-001` | `PROD-ONE-SLIDING-MIDDLE-DOOR` | `문장군상품/원슬라이딩중문/컬렉션/모던/001.jpg` | modern_summary | 원슬라이딩 모던 컬렉션 설명 | `collection:modern`, `asset_topic:summary`, `visual_mood:모던` | 모던 라인 내부 설명 | 옵션/스펙 최신성 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-onesliding-collection-detail-classic-001` | `PROD-ONE-SLIDING-MIDDLE-DOOR` | `문장군상품/원슬라이딩중문/컬렉션/클래식/001.jpg` | classic_summary | 목재감과 아치/유리 스타일이 있는 클래식 컬렉션 설명 | `collection:classic`, `asset_topic:summary`, `visual_mood:목재감`, `visual_mood:아치` | 클래식 분위기 설명 | 운영 옵션 확정 없이 발행 | medium | official_reviewed | candidate |
| `mg-onesliding-collection-detail-art-001` | `PROD-ONE-SLIDING-MIDDLE-DOOR` | `문장군상품/원슬라이딩중문/컬렉션/아트/001.jpg` | art_summary | 원슬라이딩 아트 컬렉션 설명 | `collection:art`, `asset_topic:summary`, `visual_mood:포인트` | 아트 라인 내부 설명 | 공간 적합성 확인 없이 단정 | medium | official_reviewed | candidate |
| `mg-onesliding-thumbnail-001` | `PROD-ONE-SLIDING-MIDDLE-DOOR` | `문장군상품/원슬라이딩중문/썸네일/001.jpg` | one_sliding_thumbnail | 원슬라이딩 대표 썸네일 후보 | `product:원슬라이딩중문`, `asset_topic:thumbnail` | 상품 썸네일 후보 탐색 | 최신 상품 노출 확인 없이 광고 대표 이미지 확정 | low | official_reviewed | candidate |
| `mg-onesliding-color-option-001` | `PROD-ONE-SLIDING-MIDDLE-DOOR` | `문장군상품/원슬라이딩중문/컬러/001.jpg` | color_option | 원슬라이딩 컬러 옵션 안내 | `asset_topic:color_option`, `customer_concern:디자인선택` | 컬러 옵션 구조 설명 | 현재 운영 색상 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-onesliding-glass-option-001` | `PROD-ONE-SLIDING-MIDDLE-DOOR` | `문장군상품/원슬라이딩중문/유리/001.jpg` | glass_option | 원슬라이딩 유리 옵션 안내 | `asset_topic:glass_option`, `customer_concern:답답함`, `customer_concern:디자인선택` | 유리 선택 안내 | 현재 운영 옵션 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-onesliding-event-notice-001` | `PROD-ONE-SLIDING-MIDDLE-DOOR` | `문장군상품/원슬라이딩중문/이벤트 및 공지/001.jpg` | event_notice | 이벤트/혜택성 안내 후보 | `asset_topic:event_notice`, `claim_type:event`, `claim_type:price` | 내부 확인용 | 최신 확인 없이 외부 발행 | high | official_reviewed | needs_confirmation |

## 4. 신규 상품 대표 의미 인덱스

| asset_id | product_id | path | topic | visible_text_summary | semantic_tags | recommended_use | avoid_use | claim_risk | privacy_status | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `mg-3panel-auto-detailpage-root-001` | `PROD-3PANEL-AUTO-MIDDLE-DOOR` | `문장군상품/3연동 자동중문/001.gif` | auto_intro | 3연동 자동중문 대표 도입 | `product:3연동자동중문`, `asset_topic:hero`, `asset_topic:auto_operation` | 자동중문 상품 정체성 이해 | 전원/센서 조건 확인 없이 설치 가능 단정 | medium | official_reviewed | candidate |
| `mg-3panel-auto-event-notice-001` | `PROD-3PANEL-AUTO-MIDDLE-DOOR` | `문장군상품/3연동 자동중문/이벤트 및 공지/001.jpg` | event_notice | 이벤트/혜택성 안내 후보 | `product:3연동자동중문`, `asset_topic:event_notice`, `claim_type:event`, `claim_type:price` | 내부 확인용 | 최신 확인 없이 외부 발행 | high | official_reviewed | needs_confirmation |
| `mg-3panel-auto-color-option-001` | `PROD-3PANEL-AUTO-MIDDLE-DOOR` | `문장군상품/3연동 자동중문/컬러/001.jpg` | color_option | 자동중문 컬러 옵션 안내 | `product:3연동자동중문`, `asset_topic:color_option` | 컬러 옵션 구조 설명 | 현재 운영 색상 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-3panel-auto-glass-option-001` | `PROD-3PANEL-AUTO-MIDDLE-DOOR` | `문장군상품/3연동 자동중문/유리/001.jpg` | glass_option | 자동중문 유리 옵션 안내 | `product:3연동자동중문`, `asset_topic:glass_option` | 유리 선택 안내 | 현재 운영 옵션 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-3panel-auto-thumbnail-001` | `PROD-3PANEL-AUTO-MIDDLE-DOOR` | `문장군상품/3연동 자동중문/썸네일/001.jpg` | thumbnail | 자동중문 대표 썸네일 후보 | `product:3연동자동중문`, `asset_topic:thumbnail` | 썸네일 후보 탐색 | 최신 상품 노출 확인 없이 광고 대표 이미지 확정 | low | official_reviewed | candidate |
| `mg-3panel-lshape-detailpage-root-001` | `PROD-3PANEL-LSHAPE-MIDDLE-DOOR` | `문장군상품/3연동ㄱ자/001.jpg` | lshape_intro | 3연동 ㄱ자 중문 대표 도입 | `product:3연동ㄱ자`, `asset_topic:hero`, `field_variable:코너`, `field_variable:가벽` | ㄱ자 구조 설명 | 사진만 보고 가능 여부 단정 | medium | official_reviewed | candidate |
| `mg-3panel-lshape-event-notice-001` | `PROD-3PANEL-LSHAPE-MIDDLE-DOOR` | `문장군상품/3연동ㄱ자/이벤트 및 공지/001.jpg` | event_notice | 이벤트/혜택성 안내 후보 | `product:3연동ㄱ자`, `asset_topic:event_notice`, `claim_type:event`, `claim_type:price` | 내부 확인용 | 최신 확인 없이 외부 발행 | high | official_reviewed | needs_confirmation |
| `mg-3panel-lshape-color-option-001` | `PROD-3PANEL-LSHAPE-MIDDLE-DOOR` | `문장군상품/3연동ㄱ자/컬러/001.jpg` | color_option | ㄱ자 중문 컬러 옵션 안내 | `product:3연동ㄱ자`, `asset_topic:color_option` | 컬러 옵션 구조 설명 | 현재 운영 색상 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-3panel-lshape-glass-option-001` | `PROD-3PANEL-LSHAPE-MIDDLE-DOOR` | `문장군상품/3연동ㄱ자/유리/001.jpg` | glass_option | ㄱ자 중문 유리 옵션 안내 | `product:3연동ㄱ자`, `asset_topic:glass_option` | 유리 선택 안내 | 현재 운영 옵션 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-3panel-lshape-thumbnail-001` | `PROD-3PANEL-LSHAPE-MIDDLE-DOOR` | `문장군상품/3연동ㄱ자/썸네일/001.jpg` | thumbnail | ㄱ자 중문 대표 썸네일 후보 | `product:3연동ㄱ자`, `asset_topic:thumbnail` | 썸네일 후보 탐색 | 최신 상품 노출 확인 없이 광고 대표 이미지 확정 | low | official_reviewed | candidate |
| `mg-abs-door-detailpage-root-001` | `PROD-ABS-DOOR-REPLACEMENT` | `문장군상품/ABS도어 방문교체/001.jpg` | abs_intro | ABS도어 방문교체 대표 도입 | `product:ABS도어`, `asset_topic:hero`, `product_scope:방문교체` | ABS도어 상품 정체성 이해 | 문짝/문틀 범위 혼동 | medium | official_reviewed | candidate |
| `mg-abs-door-package-detail-package-1-door-only-001` | `PROD-ABS-DOOR-REPLACEMENT` | `문장군상품/ABS도어 방문교체/패키지/패키지1_ABS도어 교체/001.jpg` | package_door_only | ABS도어 문짝 교체 패키지 후보 | `product:ABS도어`, `asset_topic:package`, `package:door_only`, `claim_type:scope` | 패키지 범위 이해 | 가격/포함 범위 확인 없이 발행 | high | official_reviewed | needs_confirmation |
| `mg-abs-door-package-detail-package-2-door-frame-001` | `PROD-ABS-DOOR-REPLACEMENT` | `문장군상품/ABS도어 방문교체/패키지/패키지2_ABS도어+문틀 세트 시공/001.jpg` | package_door_frame | ABS도어+문틀 세트 패키지 후보 | `product:ABS도어`, `asset_topic:package`, `package:door_frame`, `claim_type:scope` | 패키지 범위 이해 | 가격/포함 범위 확인 없이 발행 | high | official_reviewed | needs_confirmation |
| `mg-abs-door-design-option-001` | `PROD-ABS-DOOR-REPLACEMENT` | `문장군상품/ABS도어 방문교체/디자인/001.jpg` | design_option | ABS도어 디자인 옵션 안내 | `product:ABS도어`, `asset_topic:design_option` | 디자인 옵션 구조 설명 | 현재 운영 옵션 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-abs-door-color-option-001` | `PROD-ABS-DOOR-REPLACEMENT` | `문장군상품/ABS도어 방문교체/컬러/001.jpg` | color_option | ABS도어 컬러 옵션 안내 | `product:ABS도어`, `asset_topic:color_option` | 컬러 옵션 구조 설명 | 현재 운영 색상 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-abs-door-event-notice-001` | `PROD-ABS-DOOR-REPLACEMENT` | `문장군상품/ABS도어 방문교체/이벤트 및 공지/001.jpg` | event_notice | 이벤트/혜택성 안내 후보 | `product:ABS도어`, `asset_topic:event_notice`, `claim_type:event`, `claim_type:price` | 내부 확인용 | 최신 확인 없이 외부 발행 | high | official_reviewed | needs_confirmation |
| `mg-swing-detailpage-root-001` | `PROD-SWING-MIDDLE-DOOR` | `문장군상품/스윙중문/001.png` | swing_intro | 스윙중문 대표 도입 | `product:스윙중문`, `asset_topic:hero`, `field_variable:문열림방향` | 스윙중문 상품 정체성 이해 | 문 열림 동선 확인 없이 설치 가능 단정 | medium | official_reviewed | candidate |
| `mg-swing-event-notice-001` | `PROD-SWING-MIDDLE-DOOR` | `문장군상품/스윙중문/이벤트 및 공지/001.jpg` | event_notice | 이벤트/혜택성 안내 후보 | `product:스윙중문`, `asset_topic:event_notice`, `claim_type:event`, `claim_type:price` | 내부 확인용 | 최신 확인 없이 외부 발행 | high | official_reviewed | needs_confirmation |
| `mg-swing-glass-option-001` | `PROD-SWING-MIDDLE-DOOR` | `문장군상품/스윙중문/유리/001.jpg` | glass_option | 스윙중문 유리 옵션 안내 | `product:스윙중문`, `asset_topic:glass_option` | 유리 선택 안내 | 현재 운영 옵션 확인 없이 발행 | medium | official_reviewed | candidate |
| `mg-swing-thumbnail-001` | `PROD-SWING-MIDDLE-DOOR` | `문장군상품/스윙중문/썸네일/001.jpg` | thumbnail | 스윙중문 대표 썸네일 후보 | `product:스윙중문`, `asset_topic:thumbnail` | 썸네일 후보 탐색 | 최신 상품 노출 확인 없이 광고 대표 이미지 확정 | low | official_reviewed | candidate |
| `mg-wide-sliding-detailpage-root-001` | `PROD-WIDE-SLIDING-MIDDLE-DOOR` | `문장군상품/양개형중문 미서기/001.jpg` | wide_sliding_intro | 양개형중문/미서기 대표 도입 | `product:양개형중문`, `product:미서기`, `asset_topic:hero`, `field_variable:개구부폭` | 넓은 현관 구조군 이해 | 구조별 차이 없이 단일 상품처럼 설명 | medium | official_reviewed | candidate |
| `mg-wide-sliding-wide-collection-detail-three-panel-double-001` | `PROD-WIDE-SLIDING-MIDDLE-DOOR` | `문장군상품/양개형중문 미서기/컬렉션_와이드/3연동 양개 중문/001.jpg` | three_panel_double | 3연동 양개 중문 하위 구조 | `wide_collection:3연동양개`, `asset_topic:wide_structure`, `field_variable:개구부폭` | 넓은 현관 구조 비교 | 현장 폭 확인 없이 추천 | medium | official_reviewed | candidate |
| `mg-wide-sliding-wide-collection-detail-four-panel-001` | `PROD-WIDE-SLIDING-MIDDLE-DOOR` | `문장군상품/양개형중문 미서기/컬렉션_와이드/4연동 중문/001.jpg` | four_panel | 4연동 중문 하위 구조 | `wide_collection:4연동`, `asset_topic:wide_structure`, `field_variable:개구부폭` | 넓은 현관 구조 비교 | 문짝 수/레일 조건 확인 없이 추천 | medium | official_reviewed | candidate |
| `mg-wide-sliding-wide-collection-detail-double-sliding-001` | `PROD-WIDE-SLIDING-MIDDLE-DOOR` | `문장군상품/양개형중문 미서기/컬렉션_와이드/미서기 양개 중문/001.jpg` | double_sliding | 미서기 양개 중문 하위 구조 | `wide_collection:미서기양개`, `asset_topic:wide_structure`, `field_variable:좌우벽공간` | 넓은 현관 구조 비교 | 좌우 이동 공간 확인 없이 추천 | medium | official_reviewed | candidate |
| `mg-wide-sliding-wide-collection-detail-sliding-001` | `PROD-WIDE-SLIDING-MIDDLE-DOOR` | `문장군상품/양개형중문 미서기/컬렉션_와이드/미서기 중문/001.jpg` | sliding | 미서기 중문 하위 구조 | `wide_collection:미서기`, `asset_topic:wide_structure`, `field_variable:좌우벽공간` | 넓은 현관 구조 비교 | 레일/고정면 확인 없이 추천 | medium | official_reviewed | candidate |
| `mg-wide-sliding-event-notice-001` | `PROD-WIDE-SLIDING-MIDDLE-DOOR` | `문장군상품/양개형중문 미서기/이벤트 및 공지/001.jpg` | event_notice | 이벤트/혜택성 안내 후보 | `product:양개형중문`, `asset_topic:event_notice`, `claim_type:event`, `claim_type:price` | 내부 확인용 | 최신 확인 없이 외부 발행 | high | official_reviewed | needs_confirmation |
| `mg-wide-sliding-thumbnail-001` | `PROD-WIDE-SLIDING-MIDDLE-DOOR` | `문장군상품/양개형중문 미서기/썸네일/001.jpg` | thumbnail | 양개형중문/미서기 대표 썸네일 후보 | `product:양개형중문`, `asset_topic:thumbnail` | 썸네일 후보 탐색 | 최신 상품 노출 확인 없이 광고 대표 이미지 확정 | low | official_reviewed | candidate |
| `mg-wide-sliding-color-option-001` | `PROD-WIDE-SLIDING-MIDDLE-DOOR` | `문장군상품/양개형중문 미서기/컬러/001.jpg` | color_option | 양개형중문/미서기 컬러 옵션 안내 | `product:양개형중문`, `asset_topic:color_option` | 컬러 옵션 구조 설명 | 현재 운영 색상 확인 없이 발행 | medium | official_reviewed | candidate |

## 5. 검색 예시

클래식 프레임 또는 분위기 이미지를 찾을 때:

```text
collection:classic + asset_topic:frame_size
collection:classic + visual_mood:목재감
```

원슬라이딩 구조 이미지를 찾을 때:

```text
product:원슬라이딩중문 + asset_topic:one_sliding_structure
```

이벤트/혜택 이미지를 배제할 때:

```text
claim_type:event 또는 claim_risk:high 제외
```

## 6. 확장 규칙

1. 새 상품 폴더가 들어오면 먼저 상품별 `asset-manifest.json`을 만든다.
2. 모든 이미지를 한 번에 의미 태깅하지 않아도 된다. 우선 자주 찾을 가능성이 높은 대표 이미지부터 태깅한다.
3. 이미지 안에 가격, 이벤트, 리뷰 수, 혜택이 있으면 `claim_risk: high`로 둔다.
4. 문장군 공식 제작 결과물은 `privacy_status: official_reviewed`를 사용할 수 있다. 외부 유입 사진이나 리뷰 캡처처럼 공식 제작 자산이 아닌 경우에만 공개 전 개인정보 검수가 끝나기 전까지 `privacy_status: not_verified`를 유지한다.
5. 의미 태그는 `BRAND_WIKI_ARCHITECTURE.md`의 통제 태그를 우선한다.

## 7. 미태깅 자산 큐

`asset-manifest.json`에는 있지만 이 문서에 없는 자산은 미태깅 자산이다. 미태깅은 의미 검색이 덜 됐다는 뜻이지 문장군 공식 제작 자산의 개인정보 검수가 안 됐다는 뜻이 아니다.

미태깅 자산의 기본 해석:

```text
usageStatus: candidate
privacyStatus: official_reviewed
claimRisk: manifest 값 우선
external_publish: manifest 값과 변동 claim 최신성 확인
```

우선 태깅 순서:

1. 첫 화면, 상세페이지 도입, 대표 상품 설명에 쓰일 가능성이 높은 이미지
2. 가격, 이벤트, 월 납입, 리뷰 수, 혜택, A/S, 일정 문구가 들어간 이미지
3. 프레임 두께, 사이즈, 옵션, 유리, 컬러처럼 상담에 자주 필요한 이미지
4. 블로그/인스타/웹앱에서 반복 재사용될 가능성이 높은 이미지
5. 중복 또는 변형 이미지

태깅 범위는 `CHANGELOG.md`에 source/manifest 단위로 요약한다.

## 8. semantic coverage 기준

semantic coverage는 전체 자산 중 의미 태깅이 완료된 비율이다. 이 비율은 사용 가능 비율이 아니라 검색 가능 비율이다.

| coverage | 해석 |
| --- | --- |
| 0~20% | 대표 탐색 단계. 필요한 자산은 manifest에서 추가 확인 |
| 20~60% | 주요 사용처 탐색 가능. 미태깅 자산은 의미 태깅 보강 대상 |
| 60% 이상 | 운영 검색성이 높음. 그래도 변동 claim 재사용은 최신성 확인 필요 |

coverage가 높아져도 `publishable` 승급을 대체하지 않는다.
