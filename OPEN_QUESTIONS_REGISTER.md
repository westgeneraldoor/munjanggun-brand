# OPEN_QUESTIONS_REGISTER - 문장군 확인 필요 항목

> 버전: v1.2
> 최종 업데이트: 2026-07-01
> 목적: 사장 확인, 최신 캡처, 운영 정책 확인이 필요한 브랜드 항목을 중앙에서 추적한다.

이 문서는 발행 가능한 브랜드 기준이 아니다. 여기에 있는 항목은 확인 전 외부 발행물에서 단정하지 않는다.

## 상태값

| 상태 | 뜻 |
| --- | --- |
| `open` | 확인 필요 |
| `in_review` | 확인 중 |
| `resolved` | 중앙 문서 반영 완료 |
| `deferred` | 지금은 보류 |

## 확인 필요 항목

| id | 항목 | 왜 중요한가 | 현재 임시 기준 | 필요한 확인 | 연결 문서 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| OQ-001 | 최신 전체 상품 리뷰 수 | 리뷰 수는 신뢰 근거지만 변동 claim | 2026-06-30 사용자 제공 브랜드스토어 캡처 기준 보이는 상품 리뷰 합계 31,510건 후보. CSV에는 리뷰 수 없음 | 발행 전 최신 브랜드스토어 화면과 전체상품 범위 재확인 | EVIDENCE_REGISTER.md, REVIEW_PROOF_BANK.md | `in_review` |
| OQ-002 | 대표 상품 단일 리뷰 수 | 전체 브랜드 리뷰와 혼동 위험 | 2026-06-30 사용자 제공 캡처 기준 3연동중문 베이직 상품 리뷰 14,952건 후보. CSV에는 리뷰 수 없음 | 상품명, 기준일, 캡처 범위 최신 재확인 | EVIDENCE_REGISTER.md | `in_review` |
| OQ-003 | 네이버 예약 리뷰 수 | 연계 프로젝트 레거시 숫자 존재 | 숫자 사용 금지 | 최신 공개 근거 확인 | EVIDENCE_REGISTER.md | `open` |
| OQ-004 | A/S 무상 범위와 제외 조건 | 기간만 말하면 과장될 수 있음 | 도어 3년, 중문 2년 기준은 candidate | 제품/시공 범위별 예외와 접수 절차 확인 | FAQ_OBJECTION_BANK.md, EVIDENCE_REGISTER.md | `open` |
| OQ-005 | 중문 제작 후 시공 일정 | 중앙 3~4일과 일부 프로젝트 4~6일 충돌 | 상담 시 최신 확인 | 현재 운영 기준과 예외 확인 | EVIDENCE_REGISTER.md, FAQ_OBJECTION_BANK.md | `open` |
| OQ-006 | 특수 구조 시공 시간 | 일반 2~3시간과 철거/ㄱ자/보강 시간이 다름 | 일반 중문만 2~3시간 | 철거, ㄱ자, 보강별 안내 범위 확인 | EVIDENCE_REGISTER.md | `open` |
| OQ-007 | 서비스 가능 지역 | 모든 지역 가능 단정 위험 | 큰 지역명 기준 상담 확인 | 가능 지역, 먼 지역 추가금, 지방 기준 확인 | EVIDENCE_REGISTER.md | `open` |
| OQ-008 | 무이자 할부/결제 혜택 | 기간/카드/플랫폼 조건 변동 | 발행 금지 | 최신 정책과 사용 가능 문구 확인 | EVIDENCE_REGISTER.md, COPY_ASSET_BANK.md | `open` |
| OQ-009 | 리뷰 이벤트 조건 | 이벤트는 변동 가능 | 구체 혜택 발행 금지 | 기간, 혜택, 참여 조건 확인 | EVIDENCE_REGISTER.md | `open` |
| OQ-010 | 보양/청소 표현 허용 범위 | 중앙 금지 표현과 현장 안내가 충돌할 수 있음 | "시공 자리 정리/작업 동선 안내"만 사용 | 실제 제공 범위와 금지 문구 확정 | FAQ_OBJECTION_BANK.md, EVIDENCE_REGISTER.md | `open` |
| OQ-011 | 현관문/기타 시공 운영 범위 | 제품 범위에는 있으나 프로젝트별 확인 필요 | 2026-06-30 사용자 제공 상품 CSV에서 현관문/방화문, 천장몰딩 공개 판매 확인 | 현재 취급 여부, 시공 조건, 핵심 서비스 전면 노출 가능 여부 확인 | PRODUCT_SELECTION_GUIDE.md, NAVER_BRANDSTORE_PRODUCT_EXPORT_2026-06-30.md | `in_review` |
| OQ-012 | 공개 가능한 사진/리뷰 승인 흐름 | 원료 은행이 실제 증거 없이 약해질 수 있음 | 원본 중앙 저장 금지 | 승인자, 보관 위치, evidence_ref 방식 확인 | PROOF_ASSET_INDEX.md, PHOTO_TREATMENT.md | `open` |
| OQ-013 | 배송비/반품교환 조건 | 혜택 표현은 고객 전환에 영향을 주지만 조건이 변동될 수 있음 | 2026-06-30 사용자 제공 상품 CSV 기준 공개 판매 상품 14개 배송비유형은 무료, 반품/교환배송비는 상품별 상이 | 상품별 적용 범위, 기간, 예외 조건 확인. 무료교환반품은 CSV만으로 확정하지 않음 | EVIDENCE_REGISTER.md, NAVER_BRANDSTORE_PRODUCT_EXPORT_2026-06-30.md | `open` |
| OQ-014 | 3연동중문 상세페이지 이벤트/가격성 claim | 상세페이지 이미지 안에 이벤트, 월 납입, 가격, 리뷰/혜택성 문구가 포함될 수 있음 | 2026-07-01 사용자 제공 3연동중문 교체본 202개 자산 확보. 문장군 공식 제작·검토 결과물이므로 별도 개인정보 OCR 검수 대상은 아님 | 원본 상세페이지 맥락 밖에서 이벤트/혜택 기간, 가격/월 납입 조건, 리뷰 근거 문구를 재사용할 때 최신성 확인 | THREE_PANEL_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md, 문장군상품/3연동중문/asset-manifest.json, EVIDENCE_REGISTER.md | `open` |
| OQ-015 | 3연동중문 클래식 006 누락 | 상세페이지 진열 순서가 깨질 수 있음 | 2026-06-30 사용자가 클래식 005 이미지를 새로 추가하고 기존 005를 006으로 변경했으나, 2026-07-01 기존 3연동 폴더가 전체 교체됨 | 이전 이슈는 2026-07-01 교체본으로 대체. 새 순서는 manifest 기준으로 확인 | THREE_PANEL_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md, 문장군상품/3연동중문/asset-manifest.json | `resolved` |
| OQ-016 | 원슬라이딩중문 상세페이지 이벤트/가격성 claim | 신규 원슬라이딩 상세페이지 이미지 안에 이벤트, 월 납입, 가격, 스펙/옵션/혜택성 문구가 포함될 수 있음 | 2026-07-01 사용자 제공 원슬라이딩중문 105개 자산 확보. 문장군 공식 제작·검토 결과물이므로 별도 개인정보 OCR 검수 대상은 아님 | 원본 상세페이지 맥락 밖에서 이벤트/혜택 기간, 가격/월 납입 조건, 운영 옵션/스펙 문구를 재사용할 때 최신성 확인 | ONE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md, 문장군상품/원슬라이딩중문/asset-manifest.json, EVIDENCE_REGISTER.md | `open` |
| OQ-017 | 3연동 자동중문 전원/센서/유지관리 claim | 자동 기능은 설치 조건과 유지관리 오해가 생기기 쉬움 | 2026-07-01 사용자 제공 3연동 자동중문 131개 자산 확보. 공식 제작 자산이므로 별도 개인정보 OCR 검수 대상은 아님 | 전원 위치, 센서 조건, 수동 전환, 유지관리, A/S, 가격/이벤트 문구 최신성 확인 | THREE_PANEL_AUTO_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md, 문장군상품/3연동 자동중문/asset-manifest.json, EVIDENCE_REGISTER.md | `open` |
| OQ-018 | 3연동 ㄱ자 중문 보강/특수 구조 claim | ㄱ자 구조는 추가 보강, 코너 고정, 추가 시간이 달라질 수 있음 | 2026-07-01 사용자 제공 3연동 ㄱ자 중문 120개 자산 확보. 공식 제작 자산이므로 별도 개인정보 OCR 검수 대상은 아님 | 보강, 코너 고정, 가벽, 바닥/천장 마감, 추가금/추가 시간 문구 최신성 확인 | THREE_PANEL_LSHAPE_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md, 문장군상품/3연동ㄱ자/asset-manifest.json, EVIDENCE_REGISTER.md | `open` |
| OQ-019 | ABS도어 방문교체 패키지/시공 범위 claim | 문짝만 교체와 문짝+문틀+문선 패키지를 혼동하면 고객 오해가 큼 | 2026-07-01 사용자 제공 ABS도어 방문교체 90개 자산 확보. 공식 제작 자산이므로 별도 개인정보 OCR 검수 대상은 아님 | 패키지별 포함 범위, 가격, 거주중 시공, 문틀/문선/필름 조건 최신성 확인 | ABS_DOOR_REPLACEMENT_DETAILPAGE_ASSET_INDEX_2026-07-01.md, 문장군상품/ABS도어 방문교체/asset-manifest.json, EVIDENCE_REGISTER.md | `open` |
| OQ-020 | 스윙중문 문 열림 방향/옵션 claim | 스윙중문은 문 열림 방향과 신발장/현관문 간섭이 핵심 변수 | 2026-07-01 사용자 제공 스윙중문 84개 자산 확보. 공식 제작 자산이므로 별도 개인정보 OCR 검수 대상은 아님 | 문 열림 방향, 간섭 조건, 유리/컬러/디자인 옵션, 가격/이벤트 문구 최신성 확인 | SWING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md, 문장군상품/스윙중문/asset-manifest.json, EVIDENCE_REGISTER.md | `open` |
| OQ-021 | 양개형중문/미서기 폭/구조 claim | 넓은 현관 구조는 3연동 양개, 4연동, 미서기 양개, 미서기 중문으로 분기됨 | 2026-07-01 사용자 제공 양개형중문/미서기 147개 자산 확보. 공식 제작 자산이므로 별도 개인정보 OCR 검수 대상은 아님 | 폭, 좌우 벽공간, 중앙 개방 폭, 문짝 수, 레일, 구조별 가격/이벤트 문구 최신성 확인 | WIDE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md, 문장군상품/양개형중문 미서기/asset-manifest.json, EVIDENCE_REGISTER.md | `open` |

## 처리 규칙

1. 확인된 항목은 관련 중앙 문서와 `CHANGELOG.md`를 함께 갱신한다.
2. 변동 claim이면 `EVIDENCE_REGISTER.md`의 상태와 기준일도 갱신한다.
3. 프로젝트에서 발견된 새 확인 필요 항목은 바로 중앙 기준으로 쓰지 않고 이 문서에 먼저 등록한다.
4. `resolved`가 되기 전까지는 카피 은행에서 `publishable` 문장으로 만들지 않는다.
