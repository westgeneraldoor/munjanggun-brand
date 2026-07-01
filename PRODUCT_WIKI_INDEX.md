# PRODUCT_WIKI_INDEX - 문장군 상품 위키 입구

> 버전: v1.3
> 최종 업데이트: 2026-07-01
> 목적: 문장군 상품별 위키 문서와 연결 원료, 검수 상태, 확인 필요 항목을 한 곳에서 찾는다.

상품 위키는 상품 판매표가 아니다. 고객 불안, 현장 변수, 선택 기준, 디자인 라인, 연결 증거, 검수 상태, 주의 claim을 연결하는 중앙 지식 입구다.

## 1. 상품 위키 목록

| product_id | 상품/상품군 | 위키 문서 | 상태 | 주요 연결 |
| --- | --- | --- | --- | --- |
| `PROD-3PANEL-MIDDLE-DOOR` | 3연동중문 | `PRODUCT_WIKI_3PANEL_MIDDLE_DOOR.md` | `candidate` | `SRC-2026-07-01-3PANEL-DETAILPAGE-V2`, `문장군상품/3연동중문/asset-manifest.json`, `THREE_PANEL_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `ASSET_SEMANTIC_INDEX.md` |
| `PROD-ONE-SLIDING-MIDDLE-DOOR` | 원슬라이딩중문 | `PRODUCT_WIKI_ONE_SLIDING_MIDDLE_DOOR.md` | `candidate` | `SRC-2026-07-01-ONESLIDING-DETAILPAGE`, `문장군상품/원슬라이딩중문/asset-manifest.json`, `ONE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `ASSET_SEMANTIC_INDEX.md` |
| `PROD-3PANEL-AUTO-MIDDLE-DOOR` | 3연동 자동중문 | `PRODUCT_WIKI_3PANEL_AUTO_MIDDLE_DOOR.md` | `candidate` | `SRC-2026-07-01-3PANEL-AUTO-DETAILPAGE`, `문장군상품/3연동 자동중문/asset-manifest.json`, `THREE_PANEL_AUTO_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `ASSET_SEMANTIC_INDEX.md` |
| `PROD-3PANEL-LSHAPE-MIDDLE-DOOR` | 3연동 ㄱ자 중문 | `PRODUCT_WIKI_3PANEL_LSHAPE_MIDDLE_DOOR.md` | `candidate` | `SRC-2026-07-01-3PANEL-LSHAPE-DETAILPAGE`, `문장군상품/3연동ㄱ자/asset-manifest.json`, `THREE_PANEL_LSHAPE_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `ASSET_SEMANTIC_INDEX.md` |
| `PROD-ABS-DOOR-REPLACEMENT` | ABS도어 방문교체 | `PRODUCT_WIKI_ABS_DOOR_REPLACEMENT.md` | `candidate` | `SRC-2026-07-01-ABS-DOOR-REPLACEMENT-DETAILPAGE`, `문장군상품/ABS도어 방문교체/asset-manifest.json`, `ABS_DOOR_REPLACEMENT_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `ASSET_SEMANTIC_INDEX.md` |
| `PROD-SWING-MIDDLE-DOOR` | 스윙중문 | `PRODUCT_WIKI_SWING_MIDDLE_DOOR.md` | `candidate` | `SRC-2026-07-01-SWING-DETAILPAGE`, `문장군상품/스윙중문/asset-manifest.json`, `SWING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `ASSET_SEMANTIC_INDEX.md` |
| `PROD-WIDE-SLIDING-MIDDLE-DOOR` | 양개형중문/미서기 | `PRODUCT_WIKI_WIDE_SLIDING_MIDDLE_DOOR.md` | `candidate` | `SRC-2026-07-01-WIDE-SLIDING-DETAILPAGE`, `문장군상품/양개형중문 미서기/asset-manifest.json`, `WIDE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `ASSET_SEMANTIC_INDEX.md` |
| `PROD-FIRE-RATED-FRONT-DOOR` | 방화문/현관문 | 예정 | `needed` | 협력제조사/직접제작 메시지 분리 필요 |

## 2. 상품 위키 필수 구성

각 상품 위키는 아래 항목을 가진다.

- 상품 정의
- 먼저 고려할 고객/현장
- 조심해야 할 고객/현장
- 실측 질문
- 디자인/옵션 구조
- 고객 불안과 답변 방향
- 연결 이미지/증거 자산과 검수 상태
- 자산별 `usageStatus`, `privacyStatus`, `claimRisk`
- 변동 claim과 확인 필요 항목
- 블로그/인스타/릴스/웹앱 적용 각도
- 금지 표현

## 2-1. 상품 위키 생성 최소 요건

새 상품군이 들어왔을 때 모든 내용을 완성하지 못해도, 아래 최소 요건은 갖춰야 상품 위키 입구를 만들 수 있다.

| 항목 | 최소 기준 |
| --- | --- |
| product_id | 기존 ID 규칙에 맞는 고유 상품 ID |
| 상품 정의 | 고객에게 어떤 문제를 해결하는 상품인지 1~3문장 |
| source_id | 상품 정보를 가져온 소스 등록부 ID |
| technical_manifest | 이미지/GIF/CSV 묶음이 있으면 manifest 경로 |
| 주요 현장 변수 | 사이즈, 구조, 간섭, 옵션, 시공 가능 여부 중 핵심 변수 |
| 연결 자산 상태 | `usageStatus`, `privacyStatus`, `claimRisk` 요약 |
| 변동 claim | 가격, 리뷰 수, 이벤트, A/S, 일정, 스펙 확인 필요 항목 |
| 발행 상태 | `needed`, `candidate`, `vetted`, `publishable`, `restricted`, `retired` 중 하나 |

상품 위키가 `needed` 상태인 상품은 썸네일이나 캡처만 보고 콘텐츠를 만들지 않는다.

상품 위키 상태:

| 상태 | 뜻 | 외부 발행 |
| --- | --- | --- |
| `needed` | 상품 위키가 필요하지만 아직 정보가 부족함 | 금지 |
| `candidate` | 내부 참고 가능한 후보 위키 | 직접 발행 금지 |
| `vetted` | 방향은 검수됐지만 상황별 확인 필요 | 조건 확인 후 가능 |
| `publishable` | 중앙 기준과 근거가 확인됨 | 가능 |
| `restricted` | 민감정보 또는 비공개 자료 포함 가능 | 금지 |
| `retired` | 더 이상 신규 기준으로 쓰지 않음 | 금지 |

## 3. 사용 규칙

상품 위키에서 좋은 설명을 찾았더라도, 아래 정보는 반드시 별도 확인한다.

- 가격
- 할인
- 월 납입
- 리뷰 수
- 이벤트
- 배송/반품 조건
- A/S 기간과 예외
- 제작/시공 일정

상품 위키의 상태가 `candidate` 이하라면 외부 발행 전 `SOURCE_REGISTRY.md`, `ASSET_SEMANTIC_INDEX.md`, `EVIDENCE_REGISTER.md`, `OPEN_QUESTIONS_REGISTER.md`를 다시 확인한다.
