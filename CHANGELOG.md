# CHANGELOG - 문장군 중앙 브랜드 문서

## v4.0 - 2026-07-01

- 블로그/외부 발행용 claim 상태 정리
  - 네이버 상품 리뷰 수를 `3.5만 개 이상`으로 `publishable` 등록
  - 전체 누적 리뷰 `5만 개 이상`은 중앙 공개 근거 미등록 상태로 `needs_confirmation` 유지
  - A/S 기준을 도어 3년, 중문 2년 보증으로 확정하고 제품 자체 결함 무상 수리 원칙과 유상 예외 조건 반영
  - 중문 제작 후 시공 일정을 `보통 3~6일 내 진행`으로 통일하고 도어 시공 일정은 약 1주일로 확정
  - 서비스 지역/출장비 기준을 `문장군상품/3연동중문/070.jpg` 상세페이지 이미지와 사용자 확인 기반으로 `publishable` 등록
  - 문장군 공식 12개월 무이자 할부 배너 문구는 조건 범위 안에서 블로그 활용 가능하도록 `vetted` 정리
- ABS도어 방문교체 패키지 범위 확정
  - 패키지1은 문짝교체, 손잡이, 경첩 포함 및 기존 문짝 무상수거
  - 패키지2는 문짝+문틀+문선 케이싱마감, 손잡이, 경첩 포함
  - 세트 철거폐기물처리비는 세트당 3만원 별도
- 상품 위키 운영 상태 정리
  - 등록된 7개 상품 위키를 상품 구조 설명과 자산 탐색에 사용할 수 있는 `vetted` 상태로 정리
  - 원슬라이딩, 3연동 자동, 3연동 ㄱ자, ABS도어 방문교체, 스윙중문, 양개형중문/미서기 상품 위키의 글자 깨짐을 정상 한국어 문서로 복구
  - 해당 6개 상세페이지 자산 인덱스의 글자 깨짐도 정상 한국어 요약 문서로 복구
- 블로그/카피 원료 반영
  - `FAQ_OBJECTION_BANK.md`, `COPY_ASSET_BANK.md`, `BRAND_CONTEXT.md`, `PRODUCT_SELECTION_GUIDE.md`에 즉시 사용 가능한 안전 문장과 금지 문장 반영

- 프로젝트 하달 프롬프트 보강
  - `PROMPTS.md`에 상품 위키 `vetted` 사용 범위와 변동 claim 우선 확인 규칙 추가
- PR #8 협업 재검수 후 보강
  - `README.md`, `FAQ_OBJECTION_BANK.md`, `PROMPTS.md`, `PROJECT_ADAPTERS.md`의 최신 버전/하달 기준 보강
  - `COPY_ASSET_BANK.md`의 네이버 상품 리뷰 3.5만 문장을 네이버 상품 리뷰 범위 안으로 축소
  - 6개 상세페이지 자산 인덱스에 `proof_id`, manifest 상태 요약, `PROOF_ASSET_INDEX.md` 연결 복원
  - ABS도어 방문교체 원본 패키지3/4 자산과 현재 발행 기준 패키지1/2의 경계 문구 추가

## v3.9 - 2026-07-01

- 신규 상품 상세페이지 자산 5종 추가 등록
  - `문장군상품/3연동 자동중문/asset-manifest.json`: 131개 자산 색인화
  - `문장군상품/3연동ㄱ자/asset-manifest.json`: 120개 자산 색인화
  - `문장군상품/ABS도어 방문교체/asset-manifest.json`: 90개 자산 색인화
  - `문장군상품/스윙중문/asset-manifest.json`: 84개 자산 색인화
  - `문장군상품/양개형중문 미서기/asset-manifest.json`: 147개 자산 색인화
- 신규 source/product/proof 연결
  - `SRC-2026-07-01-3PANEL-AUTO-DETAILPAGE`, `PROD-3PANEL-AUTO-MIDDLE-DOOR`, `PROOF-3PANEL-AUTO-DETAILPAGE-ASSETS-2026-07-01`
  - `SRC-2026-07-01-3PANEL-LSHAPE-DETAILPAGE`, `PROD-3PANEL-LSHAPE-MIDDLE-DOOR`, `PROOF-3PANEL-LSHAPE-DETAILPAGE-ASSETS-2026-07-01`
  - `SRC-2026-07-01-ABS-DOOR-REPLACEMENT-DETAILPAGE`, `PROD-ABS-DOOR-REPLACEMENT`, `PROOF-ABS-DOOR-REPLACEMENT-DETAILPAGE-ASSETS-2026-07-01`
  - `SRC-2026-07-01-SWING-DETAILPAGE`, `PROD-SWING-MIDDLE-DOOR`, `PROOF-SWING-DETAILPAGE-ASSETS-2026-07-01`
  - `SRC-2026-07-01-WIDE-SLIDING-DETAILPAGE`, `PROD-WIDE-SLIDING-MIDDLE-DOOR`, `PROOF-WIDE-SLIDING-DETAILPAGE-ASSETS-2026-07-01`
- 신규 상품 위키와 상세 자산 인덱스 생성
  - `PRODUCT_WIKI_3PANEL_AUTO_MIDDLE_DOOR.md`, `THREE_PANEL_AUTO_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`
  - `PRODUCT_WIKI_3PANEL_LSHAPE_MIDDLE_DOOR.md`, `THREE_PANEL_LSHAPE_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`
  - `PRODUCT_WIKI_ABS_DOOR_REPLACEMENT.md`, `ABS_DOOR_REPLACEMENT_DETAILPAGE_ASSET_INDEX_2026-07-01.md`
  - `PRODUCT_WIKI_SWING_MIDDLE_DOOR.md`, `SWING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`
  - `PRODUCT_WIKI_WIDE_SLIDING_MIDDLE_DOOR.md`, `WIDE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`
- 상품/자산 위키 연결 확대
  - `PRODUCT_WIKI_INDEX.md`, `SOURCE_REGISTRY.md`, `PRODUCT_SELECTION_GUIDE.md`, `README.md`에 신규 상품 5종 연결
  - `ASSET_SEMANTIC_INDEX.md` v1.4로 갱신하고 신규 상품 대표 의미 태그 28개 추가
  - `EVIDENCE_REGISTER.md`, `OPEN_QUESTIONS_REGISTER.md`, `PROOF_ASSET_INDEX.md`에 자동중문, ㄱ자, ABS 패키지, 스윙, 와이드/미서기 변동 claim 확인 항목 추가

## v3.8 - 2026-07-01

- 3연동중문 상세페이지 자산 교체본 등록
  - 사용자가 기존 `문장군상품/3연동중문/` 폴더를 삭제하고 새 폴더를 재투입함
  - `문장군상품/3연동중문/asset-manifest.json`을 새로 생성하고 202개 자산을 색인화
  - 기존 `SRC-2026-06-30-3PANEL-DETAILPAGE`는 `superseded`로 낮추고, 현재 기준을 `SRC-2026-07-01-3PANEL-DETAILPAGE-V2`로 등록
  - `THREE_PANEL_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md` 생성
- 원슬라이딩중문 상품 위키 신규 편입
  - `문장군상품/원슬라이딩중문/asset-manifest.json`을 생성하고 105개 자산을 색인화
  - `SRC-2026-07-01-ONESLIDING-DETAILPAGE`, `PROD-ONE-SLIDING-MIDDLE-DOOR`, `PROOF-ONESLIDING-DETAILPAGE-ASSETS-2026-07-01` 연결
  - `ONE_SLIDING_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-07-01.md`, `PRODUCT_WIKI_ONE_SLIDING_MIDDLE_DOOR.md` 생성
- 이미지/GIF 의미 인덱스 정합화
  - `ASSET_SEMANTIC_INDEX.md`를 새 manifest assetId 기준 v1.3으로 갱신
  - 3연동 대표 14개, 원슬라이딩 대표 10개 의미 태깅
  - 공식 제작 자산은 `official_reviewed`로 유지하되, 이벤트/가격/월 납입/스펙 문구는 원본 상세페이지 맥락 밖 재사용 시 최신성 확인하도록 분리
- 근거/확인 항목 갱신
  - `EVIDENCE_REGISTER.md`, `OPEN_QUESTIONS_REGISTER.md`, `PROOF_ASSET_INDEX.md`에 3연동 교체본과 원슬라이딩 신규 상세페이지 claim 확인 항목 추가
  - `README.md`, `PRODUCT_WIKI_INDEX.md`, `PRODUCT_WIKI_3PANEL_MIDDLE_DOOR.md`, `SOURCE_REGISTRY.md` 연결 업데이트

## v3.7 - 2026-07-01

- 신규 프로젝트 총괄 온보딩 정리
  - `README.md` 상단에 처음 온 프로젝트 총괄 5분 루트 추가
  - 문서 삭제 없이 목적별 빠른 묶음 추가: 필수 기준, 디자인, claim/증거, 원료 은행, 상품/자산 위키, 프로젝트 하달, 감사/스냅샷
- 상품/자산 위키 하달 drift 보정
  - `AGENTS.md`, `PROJECT_ADAPTERS.md`, `PROMPTS.md`에 상품, 상세페이지, 이미지, GIF, 썸네일 자산 사용 시 확인해야 할 위키 4종과 상품별 manifest 확인 절차 추가
  - 프로젝트 총괄 보고 형식에 상품/자산 위키 확인, `usageStatus`, `privacyStatus`, `claimRisk`, 외부 발행 가능 여부 항목 추가
- 3연동중문 상세페이지 자산의 공식 제작 자산 기준 명시
  - `README.md`와 `ASSET_SEMANTIC_INDEX.md`에 문장군 공식 제작·검토 결과물은 `privacyStatus/privacy_status: official_reviewed`로 관리함을 명시
  - `ASSET_SEMANTIC_INDEX.md`가 전체 132개 자산이 아니라 대표 14개 의미 태깅 인덱스임을 명시하고, 미태깅은 위험 상태가 아니라 의미 검색 보강 대상임을 정리
- 변동 claim 복사 위험 보강
  - `BRAND_CONTEXT.md`의 월 납입/가격대 예시, A/S 기간, 제작·시공 일정에 발행 전 `EVIDENCE_REGISTER.md`와 `OPEN_QUESTIONS_REGISTER.md` 확인 라벨 추가
- 원료/자산 상태 매핑 확장
  - `BRAND_MATERIAL_INDEX.md`에 `SOURCE_REGISTRY.md`의 `index_status`/`review_status`, `ASSET_SEMANTIC_INDEX.md`의 `status`/`privacy_status`/`claim_risk`, 상품별 manifest의 `usageStatus`/`privacyStatus` 해석 기준 추가
  - `PRODUCT_WIKI_INDEX.md`에서 "사용 가능한 원료" 표현을 "연결 원료와 검수 상태" 중심으로 낮춰 정리
- 장기 운영/보존 규칙 보강
  - `BRAND_WIKI_ARCHITECTURE.md`에 자료 생애주기, 대량 유입 최소 등록 요건, 상태 승급 게이트, 보존/대체/retired 원칙, CHANGELOG 기록 단위 추가
  - `SOURCE_REGISTRY.md`에 `preservation_status`, `retention_policy`, `owner`, `review_due`, `superseded_by`, `retire_reason`, 민감 원본 위치 정책 필드 추가
  - `RAW_MATERIAL_INTAKE_PROTOCOL.md`에 신규 자료 입수 체크리스트, 승격하지 않고 보존만 하는 경우, 대체/retired 처리, `publishable` 승급 조건 추가
  - `ASSET_SEMANTIC_INDEX.md`에 미태깅 자산 큐, 우선 태깅 순서, semantic coverage 기준 추가
  - `PRODUCT_WIKI_INDEX.md`에 신규 상품 위키 생성 최소 요건 추가
  - `PROJECT_ADAPTERS.md`, `PROMPTS.md`에 `source_id`, `asset_id`, `claim_id`, `proof_id`, `review_due`, retired/superseded 사용 여부 보고 항목 추가
  - review pass 반영: `SOURCE_REGISTRY.md`에 기존 4개 소스의 보존/재검토 추적표 추가, `claimRisk: medium` 승급 조건 보강, `PROMPTS.md` 프로젝트별 개별 프롬프트 2~5장에 상품/자산 위키 확인 경로 반복 반영
  - `README.md`, `PRODUCT_WIKI_INDEX.md`, `BRAND_WIKI_ARCHITECTURE.md`의 상품/자산 사용 순서와 상태값 표기법을 정합화
- 공식 제작 자산 검수 책임 정정
  - 사용자 확인 기준에 따라 `문장군상품/3연동중문` 상세페이지 이미지/GIF는 문장군이 공식 제작·검토한 결과물로 보고 `privacyStatus/privacy_status: official_reviewed` 적용
  - 중앙 브랜드 위키는 해당 공식 제작 자산에 대해 별도 OCR/육안 개인정보 검수를 요구하지 않으며, 원본 상세페이지 맥락 밖에서 가격/이벤트/월 납입/스펙/운영 조건을 재사용할 때 최신성만 확인
  - `asset-manifest.json` v1.2로 갱신하고, `README.md`, `SOURCE_REGISTRY.md`, `ASSET_SEMANTIC_INDEX.md`, `BRAND_MATERIAL_INDEX.md`, `BRAND_WIKI_ARCHITECTURE.md`, `RAW_MATERIAL_INTAKE_PROTOCOL.md`, `PROMPTS.md`의 과잉 보류 문구 정정

## v3.6 - 2026-06-30

- 네이버 스마트스토어 상품 CSV export 기록 추가
  - `NAVER_BRANDSTORE_PRODUCT_EXPORT_2026-06-30.md`: 사용자 제공 상품 CSV 기준 공개 판매 상품 14개, 기준 판매가, 할인가, 배송/반품 조건, 상품군 분석 기록
  - CSV의 `판매가`를 기준 가격 후보로, `할인가`를 할인/예약할인/프로모션 가격 후보로 분리
  - 공개 판매 상품 14개 기준 판매가 150,000원~1,490,000원, 할인가 125,000원~990,000원을 `EVIDENCE_REGISTER.md`에 분리 등록
  - 화면 캡처의 리뷰 수 후보는 CSV에 없는 정보로 분리해 `candidate` 상태 유지
  - `대표이미지 URL` 기준 공개 판매 상품 14개 썸네일을 `assets/product-thumbnails/naver-brandstore-2026-06-30/`에 저장하고 `manifest.json` 생성
  - `PRODUCT_THUMBNAIL_ASSET_INDEX_2026-06-30.md`에 상품별 썸네일 파일, 상품군 판단, 사용 원칙 기록
  - `문장군상품/3연동중문` 상세페이지 이미지/GIF 원본 132개를 `asset-manifest.json`으로 색인화
  - `THREE_PANEL_MIDDLE_DOOR_DETAILPAGE_ASSET_INDEX_2026-06-30.md`에 공통 도입, 이벤트/공지, 컬러, 유리, 베이직/모던/클래식/아트 컬렉션 구조 기록
  - 클래식 컬렉션 005 신규 추가와 기존 005→006 변경을 manifest v1.1에 반영하고 006 누락 확인 항목을 resolved 처리
  - 상세페이지 이미지 안의 이벤트/가격성 문구를 변동 claim으로 분리하고 `EVIDENCE_REGISTER.md`, `OPEN_QUESTIONS_REGISTER.md`에 확인 필요 항목 등록
  - `PRODUCT_SELECTION_GUIDE.md`에 3연동 디자인 라인, 폴딩도어/접이식 중문, 현관문/천장몰딩 CSV 확인 상태 반영
  - `PROOF_ASSET_INDEX.md`에 상품 CSV export와 화면 캡처 증거 자산을 분리 등록
  - `OPEN_QUESTIONS_REGISTER.md`에서 가격/리뷰/배송·반품 조건의 확인 필요 상태 정리
- 브랜드 위키 운영 계층 추가
  - `BRAND_WIKI_ARCHITECTURE.md`: codebase-memory MCP와 브랜드 위키의 차이, 권위 계층, ID/상태/검색 규칙 정의
  - `SOURCE_REGISTRY.md`: CSV, 썸네일, 3연동중문 상세페이지, 캡처 소스 등록
  - `PRODUCT_WIKI_INDEX.md`: 상품별 위키 입구 생성
  - `PRODUCT_WIKI_3PANEL_MIDDLE_DOOR.md`: 3연동중문과 베이직/모던/클래식/아트 컬렉션 위키 생성
  - `ASSET_SEMANTIC_INDEX.md`: 이미지/GIF 의미 태그와 추천/금지 용도 인덱스 생성
  - `asset-manifest.json`과 `ASSET_SEMANTIC_INDEX.md`의 위험도/상태 충돌 방지를 위해 semantic index 우선 규칙과 보수적 상태 동기화 적용
  - `SOURCE_REGISTRY.md`의 소스 상태를 `index_status`와 `review_status`로 분리

## v3.5 - 2026-06-30

- 브랜드 원료 은행 추가
  - `BRAND_MATERIAL_INDEX.md`: 고객·제품·현장·리뷰·증거·FAQ·카피 원료 은행의 입구와 권위 관계 정의
  - `RAW_MATERIAL_INTAKE_PROTOCOL.md`: 연계 프로젝트 자료를 중앙 원료로 승격하는 채굴, 비식별화, claim 검증, 상태 부여 절차 정의
  - `OPEN_QUESTIONS_REGISTER.md`: 사장 확인, 최신 캡처, 운영 정책 확인이 필요한 항목 추적
  - `BRAND_RAW_MATERIAL_GAP_AUDIT_2026-06-30.md`: 중앙 브랜드 원본의 부족한 원료와 이번 라운드 보강 범위 기록
- 고객·제품·현장 원료 문서 추가
  - `CUSTOMER_SEGMENTS.md`: 고객을 나이/성별이 아니라 상황, 집 구조, 불안 유형으로 분류
  - `PRODUCT_SELECTION_GUIDE.md`: 제품별 고려 조건, 주의 조건, 실측 질문, 콘텐츠 각도 정리
  - `FIELD_STORY_BANK.md`: 개인정보 없이 사용할 수 있는 비식별 현장 이야기 패턴 정리
- 리뷰·증거·FAQ·카피 원료 문서 추가
  - `REVIEW_PROOF_BANK.md`: 리뷰 원문이 아니라 리뷰가 증명하는 불안 해소 유형과 안전 표현 정리
  - `PROOF_ASSET_INDEX.md`: 사진, 리뷰, AppSheet, 운영 증거의 비식별 색인과 공개 가능 상태 정의
  - `FAQ_OBJECTION_BANK.md`: 가격, 추가금, 일정, A/S, 거주중 시공 등 상담 FAQ 원료 정리
  - `COPY_ASSET_BANK.md`: 안전한 제목, CTA, 후킹, Proof Panel 문장 원료 정리
- `EVIDENCE_REGISTER.md` v1.1 확장
  - `publishable`, `vetted`, `candidate`, `needs_confirmation`, `restricted`, `expired` claim 상태값 추가
  - 네이버 예약 리뷰 수, 중문 일정 충돌, 특수 구조 시공 시간, 무이자 할부, 리뷰 이벤트, 서비스 가능 지역, 보양/청소 표현, 건강/질병형 훅을 확인 필요 또는 제한 claim으로 등록
  - 리뷰 수, 가격, A/S, 일정, 이벤트 claim의 안전 문장 규칙 추가
- 운영 문서 연결 업데이트
  - `README.md`, `AGENTS.md`, `PROJECT_ADAPTERS.md`, `PROMPTS.md`, `TEAM.md`에 원료 은행 사용 기준, 승격 절차, 프로젝트 하달/검수 기준 반영

## v3.4 - 2026-06-29

- 하달 전 중앙 governance cleanup 반영
  - AGENTS.md 필수 읽기 순서에 DESIGN_QUICKSTART.md, PHOTO_TREATMENT.md, ANTI_PATTERNS.md, tokens/, EVIDENCE_REGISTER.md 추가
  - CTA는 클레이 테라코타, verified-navy는 검증/운영 근거용이라는 v3 디자인 기준 정합성 보강
  - 중앙 총괄 직접 수정 예외 기준을 PROJECT_ADAPTERS.md 8장으로 일원화
- EVIDENCE_REGISTER.md 추가
  - 리뷰 수, 가격, A/S, 일정, 시공 시간 등 변동 claim의 기준일, 출처, 확인자, 재확인 주기 관리
  - BRAND_CONTEXT.md와 FIELD_JUDGMENT_RULES.md의 중문 시공 시간 기준을 2~3시간 안내로 정합화
- PROMPTS.md 경로 구조 정리
  - GitHub 저장소와 상대 경로를 우선 참조하도록 하달 프롬프트 수정
  - 로컬 Windows 경로는 README.md의 로컬 작업 경로 fallback으로만 사용하도록 조정
- 디자인 토큰 동기화 보강
  - tokens/brand.tokens.json에 media focalPoint 동기화
  - tokens/brand.css에 미디어 최소 크기, focal point, safe text area 메타 변수 추가
  - preview.html에 비권위 시각 참고 보드 안내, 더미 지역 예시, 폰트 스택과 버튼/배지 weight 정합성 보강
- 민감 정보와 보안 예방 기준 보강
  - FIELD_JUDGMENT_RULES.md에 내부 운영/개별 견적 정보와 공개 콘텐츠 비식별 기준 분리
  - .gitignore에 .env, service account, credential, pem/key 패턴 추가
  - 과거 superpowers 계획/스펙과 프로젝트 관계 감사 문서에 historical/snapshot 안내 추가

## v3.3 - 2026-06-25

- 중앙 브랜드 총괄과 프로젝트 총괄의 적용 책임 분리 기준 정리
  - 중앙 총괄: 중앙 원본 유지, 기준 제공, 충돌 판단, 최종 검수
  - 프로젝트 총괄: 자기 프로젝트 구조 확인, 중앙 원본 연결, 프로젝트 내부 수정, 변경 보고
- PROJECT_ADAPTERS.md에 적용 책임 원칙, 적용 보고 형식, 중앙 총괄 직접 수정 예외 조건 추가
- AGENTS.md에 연계 프로젝트 적용 기본 흐름 추가
- PROMPTS.md에 프로젝트 총괄용 적용 보고 형식과 중앙 총괄 검수 프롬프트 추가
- README.md에 역할 분리 표 추가

## v3.2 - 2026-06-25

- 디자인 시스템 운영 문서 추가
  - DESIGN_QUICKSTART.md: DESIGN.md v3.0 실무자용 1장 요약과 출시 전 12문항 체크
  - PHOTO_TREATMENT.md: 실제 시공 사진의 밝기, 색온도, 수직선, 개인정보, 크롭 기준
  - ANTI_PATTERNS.md: 문장군답지 않은 시각 패턴과 대체 기준
- 구현 토큰 추가
  - tokens/brand.tokens.json
  - tokens/brand.css
  - 토큰 권위 관계 명시: DESIGN.md front matter → tokens JSON → CSS variables → preview/project implementation
- DESIGN.md Known Gaps 정정
  - preview.html v3.0 재제작 필요 문장을 현재 배포 상태에 맞게 수정
- README.md와 PROMPTS.md에 신규 운영 문서와 토큰 참조 추가

## v3.1 - 2026-06-25

- README.md 경로 구조 정리
  - GitHub 기준 경로와 로컬 Windows 작업 경로 분리
  - GitHub Pages 디자인 미리보기 URL 추가
- index.html 추가
  - GitHub Pages 루트에서 preview.html로 이동할 수 있는 진입 페이지 제공

## v3.0 - 2026-06-25

- DESIGN.md v3.0 고도화
  - A 색감 + B 문구/구조 + B 타이포그래피 승인 방향 반영
  - 코코아 오크, 클레이 테라코타, 캐시미어 크림, 토스티드 아몬드, 검증 네이비 기반 팔레트 재정의
  - Noto Serif KR은 히어로/섹션 제목 중심, 본문/UI는 Pretendard 또는 Noto Sans KR 유지
  - 표면 모드 추가: Cream Canvas, Paper Card, Almond Band, Cocoa Trust Surface, Verified Navy Surface, Terracotta Callout
  - Proof Panel 컴포넌트 추가
  - 모바일 타이포그래피, 버튼/폼 상태, 이미지 비율·크롭 기준 토큰 보강
  - 기존 네이비 중심 신뢰 구조를 검증/전산/운영 보조색으로 제한
- 공식 브랜드 핵심 문장과 디자인/히어로 변형 문장의 역할 분리
- preview.html v3.0 제작
  - 히어로, 팔레트, Surface Modes, 타이포그래피, Proof Panel, 상담/가격 컴포넌트, 이미지 크롭 기준을 브라우저에서 확인할 수 있는 정적 미리보기로 구현
- Claude DESIGN 문서 구조를 벤치마킹하되 문장군 도어·중문 시공 브랜드에 맞게 재해석

## v2.2 - 2026-06-25

- AGENTS.md 추가
  - 중앙 브랜드 책임자 역할, 작업 전 필수 읽기 순서, 중앙 원본 권위, 금지 표현, 민감 정보 처리, 서브에이전트 운용, 변경 절차 정리
- TEAM.md 추가
  - 브랜드 책임자, 리서치, 브랜드 전략, 현장 판단, 카피/콘텐츠, 디자인, 검수, 연계 프로젝트 운영 역할 정의
- PROJECT_RELATIONSHIP_AUDIT_2026-06-25.md 추가
  - `munjanggun`, `문장군블로그`, `문장군 인스타그램`, `문장군 컨텐츠`, `문장군_디자인`, `문장군 릴스 엔진`, `문장군 시공릴스`, `Virtual Studio`, `backup`, `open-design` 연계 상태 조사
  - 중앙 브리지 보강 필요 프로젝트와 운영 리스크 정리
- README.md 메타와 파일 구성 갱신
- PROMPTS.md 메타를 현재 내용 기준으로 갱신

## v2.1 - 2026-06-25

- FIELD_JUDGMENT_RULES.md 추가
  - 2026-06-25 사장 인터뷰 기반 고객 오해, 무료 방문 실측, 중문 구조별 가능 범위, 견적 변수, 셀프중문/자재판매, 9mm/12mm 문선, ABS도어/방문교체, 거주중 시공, AppSheet 현장 활용 기준 정리
- PROJECT_ADAPTERS.md 추가
  - 중앙 브랜드 원본과 프로젝트별 어댑터를 분리하는 운영 방식 확정
  - 블로그, 인스타그램, 릴스, 웹앱 등 채널별 규칙은 중앙 원본에 섞지 않고 프로젝트 어댑터로 관리
- README.md 파일 구성과 참조 경로 갱신
- PROMPTS.md 프로젝트 총괄 적용 프롬프트 갱신
  - 중앙 FIELD_JUDGMENT_RULES.md 참조 추가
  - 블로그 프로젝트는 docs/brand/BRAND_SOURCE.md와 BLOG_BRAND_ADAPTER.md를 우선 확인하도록 보강

## v2.0 - 2026-06-15

- DESIGN.md 전면 재작성
- GitHub 공개 DESIGN.md 사례와 Google DESIGN.md 형식 벤치마킹 반영
- YAML front matter 기반 디자인 토큰 추가
  - colors
  - typography
  - rounded
  - spacing
  - components
- 한글/영문 브랜드명 표기 기준 추가
  - `문장군`
  - `MUNJANGGUN`
  - `munjanggun`
- 서체 체계 강화
  - Korean Brand / Display: Paperlogy 권장
  - Korean UI / Body: Pretendard Variable
  - English / Number: Manrope
- 색상 체계 재정의
  - Warm canvas, oak, sage, brass, navy 역할 분리
  - 네이비 사용 비율과 금지 기준 추가
- 컴포넌트 기준 확장
  - 버튼
  - 신뢰 배지
  - 고민 선택 컴포넌트
  - 분위기 선택 컴포넌트
  - 시공 사례 카드
  - 리뷰 카드
  - 가격 안내 박스
  - 실측 상담 흐름
  - FAQ
  - 블로그 썸네일
  - 인스타 카드뉴스
- 기존 preview.html은 v1.0 기준이므로 v2.0 기준 재제작 필요

## v1.0 - 2026-06-15

- 문장군 중앙 브랜드 원본 최초 정리
- BRAND_CONTEXT.md 생성
- DESIGN.md 생성
- README.md 생성
- PROMPTS.md 생성
- 기존 프로젝트별 BRAND_CONTEXT를 직접 수정하지 않고 중앙 원본 참조 구조로 전환하는 운영 원칙 수립
- 2026-06 스마트스토어 전체상품 캡처 기준으로 리뷰 표현 정정
  - 전체 상품 리뷰 3만 개+
  - 대표 인기 상품 단일 리뷰 1.4만 개+
  - 기존 "리뷰 15,000개+" 표현은 전체 브랜드 리뷰 표현으로 사용하지 않도록 정리
- 브랜드 핵심 정체성 확정
  - 문장군은 무료 방문실측으로 집에 맞는 선택을 돕고, 직접 제작과 전속 시공으로 끝까지 책임지는 도어·중문 전문 브랜드다.
- 디자인 방향 확정
  - 따뜻한 주거 전문가
  - 규모 있는 시스템형 전문 브랜드
  - 밝은 주거 공간 속 제품 이미지 중심
  - 네이비는 신뢰 포인트로 제한 사용
