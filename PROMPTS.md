# PROMPTS - 문장군 중앙 브랜드 문서 적용 프롬프트

> 버전: v1.6
> 최종 업데이트: 2026-06-30
> 변경 요약: 브랜드 원료 은행과 원료 승격 절차 하달 기준 추가

## 1. 프로젝트 총괄 세션 공통 적용 프롬프트

아래 프롬프트를 각 프로젝트 총괄 세션에 전달하세요.

```text
문장군 브랜드 중앙 원본이 생성되었습니다.

중요:
이 작업은 중앙 브랜드 총괄이 프로젝트 파일을 대신 덮어쓰는 작업이 아닙니다.
해당 프로젝트 총괄인 당신이 프로젝트 구조, 자동화, 기존 문서, 프롬프트 흐름을 직접 확인한 뒤 중앙 원본을 연결해야 합니다.
중앙 브랜드 총괄은 기준 제공과 최종 검수 역할을 맡습니다.

공식 원본 위치:
GitHub 저장소: https://github.com/westgeneraldoor/munjanggun-brand

GitHub 기준 상대 경로를 우선 참조하세요.

./BRAND_CONTEXT.md
./FIELD_JUDGMENT_RULES.md
./DESIGN.md
./DESIGN_QUICKSTART.md
./PHOTO_TREATMENT.md
./ANTI_PATTERNS.md
./EVIDENCE_REGISTER.md
./OPEN_QUESTIONS_REGISTER.md
./BRAND_MATERIAL_INDEX.md
./RAW_MATERIAL_INTAKE_PROTOCOL.md
./CUSTOMER_SEGMENTS.md
./PRODUCT_SELECTION_GUIDE.md
./FIELD_STORY_BANK.md
./REVIEW_PROOF_BANK.md
./PROOF_ASSET_INDEX.md
./FAQ_OBJECTION_BANK.md
./COPY_ASSET_BANK.md
./tokens/brand.tokens.json
./tokens/brand.css
./PROJECT_ADAPTERS.md
./CHANGELOG.md

같은 Windows PC에서 로컬로 작업할 때만 README.md의 "로컬 작업 경로"를 fallback으로 사용하세요.

이 프로젝트의 기존 브랜드 문서, 콘텐츠 생성 로직, 프롬프트, README, AGENTS.md, 자동화 흐름을 먼저 점검해주세요.

목표:
앞으로 문장군 관련 콘텐츠, 디자인, 웹앱, 자동화 작업 시 위 중앙 원본을 우선 참조하도록 이 프로젝트를 세팅해주세요.

주의:
- 기존 프로젝트 구조와 자동화 흐름을 먼저 파악하세요.
- 기존 파일을 무조건 삭제하거나 덮어쓰지 마세요.
- 필요하면 프로젝트 내부에는 중앙 원본 경로를 안내하는 얇은 참조 문서만 두세요.
- 이 프로젝트 특화 규칙이 있다면 중앙 원본과 충돌하지 않도록 별도 섹션으로 분리하세요.
- 실제 상담·실측·시공 가능 여부·추가금·고객 오해·AppSheet 현장 활용 기준은 FIELD_JUDGMENT_RULES.md를 우선 확인하세요.
- 디자인을 빠르게 적용할 때는 DESIGN_QUICKSTART.md를 먼저 보고, 세부 기준은 DESIGN.md를 확인하세요.
- 실제 시공 사진, 썸네일, Before/After 이미지는 PHOTO_TREATMENT.md를 기준으로 공개 가능 여부와 보정 기준을 판단하세요.
- 디자인이 싸구려 전단지형, 네이비 대기업형, 파스텔 생활앱형, AI 카드뉴스형으로 흐르지 않는지 ANTI_PATTERNS.md로 검수하세요.
- 웹앱/랜딩 구현 시 tokens/brand.css 또는 tokens/brand.tokens.json을 우선 사용하고, 토큰 변경이 필요하면 DESIGN.md부터 수정해야 합니다.
- 리뷰 수, 가격, A/S, 일정, 시공 시간처럼 변동 가능한 claim은 EVIDENCE_REGISTER.md의 기준일과 상태를 확인하세요.
- 확인되지 않은 운영 기준이나 사장 확인이 필요한 항목은 OPEN_QUESTIONS_REGISTER.md를 확인하고, 외부 발행물에서 단정하지 마세요.
- 고객 상황, 제품 선택 기준, 현장 이야기, 리뷰/증거, FAQ, 카피 원료를 쓸 때는 BRAND_MATERIAL_INDEX.md와 필요한 개별 원료 은행 문서를 확인하세요.
- 원료 은행의 문구나 사례를 쓰기 전 상태값을 확인하세요. publishable 또는 vetted가 아니면 외부 발행물에 직접 사용하지 마세요.
- 연계 프로젝트 안에서 중앙으로 올릴 만한 좋은 자료를 발견하면 바로 복사하지 말고 RAW_MATERIAL_INTAKE_PROTOCOL.md 기준으로 비식별화, claim 검증, 상태 부여를 거쳐 후보로 보고하세요.
- 채널별 파일 저장 방식, QA, 발행 방식, 통계 분석 방식은 중앙 원본에 섞지 말고 프로젝트 어댑터로 분리하세요.
- 중앙 원본과 프로젝트 기존 규칙이 충돌하면 바로 수정하지 말고 충돌 지점을 요약해주세요.
- 적용 후 어떤 파일을 바꿨는지, 앞으로 어떤 문서를 기준으로 삼는지 요약해주세요.

적용 후 보고 형식:
- 프로젝트:
- 적용 일자:
- 읽은 중앙 문서:
- 수정한 파일:
- 새로 만든 참조/어댑터 문서:
- 중앙 원본과 충돌한 지점:
- 충돌 분류: 중앙 우선 / 프로젝트 우선 / 중앙 업데이트 필요 / 확인 필요
- 민감 정보 노출 여부:
- 사진/디자인 기준 적용 여부:
- 토큰 사용 여부:
- 원료 은행 사용 여부:
- 원료 상태값 확인 여부:
- 변동 claim 근거 확인 여부:
- 남은 확인 사항:

중앙 원본의 권위 수준:
중앙 원본은 문장군 브랜드의 기본 기준입니다. 다만 블로그, 인스타그램, 웹앱, 운영 자동화 등 각 프로젝트의 채널 특성과 기존 구조에 따라 보조 규칙을 둘 수 있습니다. 보조 규칙은 중앙 원본과 충돌하지 않게 분리해서 관리해주세요.
```

## 1-1. 중앙 총괄 검수 프롬프트

각 프로젝트 총괄이 적용 보고를 완료한 뒤 중앙 브랜드 총괄 또는 검수 담당에게 전달하세요.

```text
아래 프로젝트의 문장군 중앙 브랜드 원본 적용 결과를 검수해주세요.

검수 기준:
- 중앙 BRAND_CONTEXT.md와 말투, 제품 범위, 리뷰/가격/A/S 표현이 충돌하지 않는가
- FIELD_JUDGMENT_RULES.md의 현장 판단 기준을 어기지 않는가
- DESIGN.md, DESIGN_QUICKSTART.md, PHOTO_TREATMENT.md, ANTI_PATTERNS.md 기준과 충돌하지 않는가
- tokens/brand.css 또는 tokens/brand.tokens.json을 잘못 변형하지 않았는가
- EVIDENCE_REGISTER.md 기준 없이 리뷰 수, 가격, A/S, 일정, 시공 시간 claim을 단정하지 않았는가
- BRAND_MATERIAL_INDEX.md의 원료 상태값을 확인했는가
- CUSTOMER_SEGMENTS.md, PRODUCT_SELECTION_GUIDE.md, FIELD_STORY_BANK.md, REVIEW_PROOF_BANK.md, PROOF_ASSET_INDEX.md, FAQ_OBJECTION_BANK.md, COPY_ASSET_BANK.md를 중앙 기준보다 높은 권위처럼 쓰지 않았는가
- 연계 프로젝트 자료를 중앙 원료로 승격한다면 RAW_MATERIAL_INTAKE_PROTOCOL.md의 비식별화와 claim 검증을 거쳤는가
- 중앙 원본에 들어가면 안 되는 프로젝트 특화 규칙을 중앙 기준처럼 만들지 않았는가
- 고객명, 전화번호, 상세 주소, 상담 원문, AppSheet 원본, 관리자 통계 원본이 노출되지 않았는가
- 충돌 분류가 중앙 우선 / 프로젝트 우선 / 중앙 업데이트 필요 / 확인 필요 중 적절한가

프로젝트 총괄 보고:
[여기에 프로젝트 총괄 보고를 붙여넣기]

결과는 APPROVED 또는 ISSUES_FOUND로 시작하고, 수정이 필요하면 파일/항목/이유/권장 조치로 정리해주세요.
```

## 2. 문장군 컨텐츠 프로젝트 적용 프롬프트

```text
문장군 컨텐츠 프로젝트에 중앙 브랜드 원본을 연결해주세요.

중앙 원본:
GitHub 저장소: https://github.com/westgeneraldoor/munjanggun-brand
./BRAND_CONTEXT.md
./FIELD_JUDGMENT_RULES.md
./DESIGN.md
./DESIGN_QUICKSTART.md
./PHOTO_TREATMENT.md
./ANTI_PATTERNS.md
./EVIDENCE_REGISTER.md
./OPEN_QUESTIONS_REGISTER.md
./RAW_MATERIAL_INTAKE_PROTOCOL.md
./BRAND_MATERIAL_INDEX.md
./CUSTOMER_SEGMENTS.md
./PRODUCT_SELECTION_GUIDE.md
./FIELD_STORY_BANK.md
./REVIEW_PROOF_BANK.md
./PROOF_ASSET_INDEX.md
./FAQ_OBJECTION_BANK.md
./COPY_ASSET_BANK.md
./PROJECT_ADAPTERS.md

이 프로젝트는 문장군 콘텐츠 생성의 기준 프로젝트일 가능성이 높으므로, 기존 BRAND_CONTEXT.md와 콘텐츠 생성 프롬프트가 중앙 원본과 어떻게 겹치는지 먼저 비교해주세요.

요청:
- 기존 브랜드 컨텍스트 파일을 바로 덮어쓰지 말고, 중앙 원본 참조 방식으로 바꾸는 최선의 위치를 제안해주세요.
- 콘텐츠 생성 시 BRAND_CONTEXT.md는 말할 내용의 기준으로, DESIGN.md는 썸네일/카드/웹앱/시각 표현 기준으로 참조하게 해주세요.
- 썸네일과 카드뉴스 사진 기준은 PHOTO_TREATMENT.md를 함께 반영해주세요.
- 디자인 빠른 기준은 DESIGN_QUICKSTART.md를 우선 적용하고, 금지 패턴 검수는 ANTI_PATTERNS.md를 활용해주세요.
- 리뷰 수, 가격, A/S, 일정, 시공 시간 claim은 EVIDENCE_REGISTER.md 기준일과 상태를 확인해주세요.
- 확인되지 않은 운영 기준은 OPEN_QUESTIONS_REGISTER.md에서 확인하고 외부 발행물에서 단정하지 마세요.
- 고객 상황, 제품 선택, FAQ, 카피 원료는 BRAND_MATERIAL_INDEX.md와 개별 원료 은행의 상태값을 확인한 뒤 사용해주세요.
- 리뷰 원문, 고객명, 닉네임, AppSheet 원본, 관리자 캡처는 중앙 원료로 복사하지 말고 PROOF_ASSET_INDEX.md 방식의 비식별 색인만 사용해주세요.
- 중앙으로 올릴 원료 후보는 RAW_MATERIAL_INTAKE_PROTOCOL.md 기준으로 비식별화와 claim 검증을 거쳐 보고해주세요.
- 기존 프로젝트에만 필요한 운영 규칙은 프로젝트 보조 규칙으로 분리해주세요.
- 적용 전후 차이를 요약해주세요.
```

## 3. 문장군 인스타그램 프로젝트 적용 프롬프트

```text
문장군 인스타그램 프로젝트에 중앙 브랜드 원본을 연결해주세요.

중앙 원본:
GitHub 저장소: https://github.com/westgeneraldoor/munjanggun-brand
./BRAND_CONTEXT.md
./FIELD_JUDGMENT_RULES.md
./DESIGN.md
./DESIGN_QUICKSTART.md
./PHOTO_TREATMENT.md
./ANTI_PATTERNS.md
./EVIDENCE_REGISTER.md
./OPEN_QUESTIONS_REGISTER.md
./RAW_MATERIAL_INTAKE_PROTOCOL.md
./BRAND_MATERIAL_INDEX.md
./CUSTOMER_SEGMENTS.md
./PRODUCT_SELECTION_GUIDE.md
./FIELD_STORY_BANK.md
./REVIEW_PROOF_BANK.md
./PROOF_ASSET_INDEX.md
./FAQ_OBJECTION_BANK.md
./COPY_ASSET_BANK.md
./PROJECT_ADAPTERS.md

이 프로젝트는 인스타그램 카드뉴스, 리뷰/후기 콘텐츠, 향후 예쁜 시공 사례 콘텐츠를 다루므로 DESIGN.md의 인스타그램 카드뉴스 기준과 사진 톤 기준을 우선 확인해주세요.

요청:
- 기존 data/brand/BRAND_CONTEXT.md 사용 흐름을 확인해주세요.
- 중앙 원본을 우선 참조하도록 프롬프트나 지침을 조정해주세요.
- 인스타그램 특화 규칙은 중앙 원본과 분리해서 유지해주세요.
- AI 느낌 나는 문구, 빨간 가격 강조, 복잡한 배너형 디자인을 피하도록 생성 규칙을 점검해주세요.
- 인스타 카드뉴스가 텍스트 카드만 반복되거나 파스텔 생활앱형으로 흐르지 않도록 ANTI_PATTERNS.md 기준을 적용해주세요.
- 실제 시공 사진 사용 전 PHOTO_TREATMENT.md의 개인정보, 색온도, 수직선, crop safe zone 기준을 확인해주세요.
- 리뷰 수, 가격, A/S, 일정, 시공 시간 claim은 EVIDENCE_REGISTER.md 기준일과 상태를 확인해주세요.
- 확인되지 않은 운영 기준은 OPEN_QUESTIONS_REGISTER.md에서 확인하고 외부 발행물에서 단정하지 마세요.
- 카드뉴스 소재는 CUSTOMER_SEGMENTS.md, PRODUCT_SELECTION_GUIDE.md, FAQ_OBJECTION_BANK.md, COPY_ASSET_BANK.md에서 상태값이 확인된 원료만 사용해주세요.
- 실제 현장 사진이나 리뷰 근거는 PROOF_ASSET_INDEX.md와 REVIEW_PROOF_BANK.md 기준으로 개인정보와 원문 노출을 막아주세요.
- 중앙으로 올릴 원료 후보는 RAW_MATERIAL_INTAKE_PROTOCOL.md 기준으로 비식별화와 claim 검증을 거쳐 보고해주세요.
- 적용 후 변경 파일과 적용 방식을 요약해주세요.
```

## 4. 문장군 블로그 프로젝트 적용 프롬프트

```text
문장군 블로그 프로젝트에 중앙 브랜드 원본을 연결해주세요.

중앙 원본:
GitHub 저장소: https://github.com/westgeneraldoor/munjanggun-brand
./BRAND_CONTEXT.md
./FIELD_JUDGMENT_RULES.md
./DESIGN.md
./DESIGN_QUICKSTART.md
./PHOTO_TREATMENT.md
./ANTI_PATTERNS.md
./EVIDENCE_REGISTER.md
./OPEN_QUESTIONS_REGISTER.md
./RAW_MATERIAL_INTAKE_PROTOCOL.md
./BRAND_MATERIAL_INDEX.md
./CUSTOMER_SEGMENTS.md
./PRODUCT_SELECTION_GUIDE.md
./FIELD_STORY_BANK.md
./REVIEW_PROOF_BANK.md
./PROOF_ASSET_INDEX.md
./FAQ_OBJECTION_BANK.md
./COPY_ASSET_BANK.md
./PROJECT_ADAPTERS.md

이 프로젝트는 블로그 전략, 검색 유입, 고객 고민형 제목, 실제 시공 사진 기반 썸네일 기준이 중요합니다.

요청:
- 기존 docs/strategy/BRAND_CONTEXT.md와 중앙 원본의 차이를 확인해주세요.
- docs/brand/BRAND_SOURCE.md와 docs/brand/BLOG_BRAND_ADAPTER.md가 있으면 먼저 읽고, 없으면 새로 만드세요.
- 기존 블로그 글 생성 규칙이 중앙 BRAND_CONTEXT.md의 말투, 금지 표현, 고객 언어 사전과 맞는지 점검해주세요.
- FIELD_JUDGMENT_RULES.md의 현장 판단 기준이 신규 원고의 `실제 시공 현장` 단락에 반영되는지 확인해주세요.
- 블로그 썸네일 또는 이미지 생성 규칙이 DESIGN.md의 블로그 썸네일 기준과 맞는지 확인해주세요.
- 블로그 썸네일 사진은 PHOTO_TREATMENT.md의 `blogThumbnail` 기준과 개인정보 기준을 함께 확인해주세요.
- 어두운 스마트스토어 썸네일 남발형이나 AI 카드뉴스형으로 흐르지 않도록 ANTI_PATTERNS.md를 검수 기준에 넣어주세요.
- 리뷰 수, 가격, A/S, 일정, 시공 시간 claim은 EVIDENCE_REGISTER.md 기준일과 상태를 확인해주세요.
- 확인되지 않은 운영 기준은 OPEN_QUESTIONS_REGISTER.md에서 확인하고 외부 발행물에서 단정하지 마세요.
- 블로그 주제와 본문 흐름은 CUSTOMER_SEGMENTS.md, PRODUCT_SELECTION_GUIDE.md, FIELD_STORY_BANK.md, FAQ_OBJECTION_BANK.md, COPY_ASSET_BANK.md의 원료를 참고하되 상태값을 확인해주세요.
- AppSheet 현장 서사와 리뷰 근거는 중앙으로 원본 복사하지 말고, PROOF_ASSET_INDEX.md처럼 비식별 evidence_ref 또는 요약으로만 다뤄주세요.
- 중앙으로 올릴 원료 후보는 RAW_MATERIAL_INTAKE_PROTOCOL.md 기준으로 비식별화와 claim 검증을 거쳐 보고해주세요.
- 특히 기존 "리뷰 15,000개+" 표현은 전체 브랜드 리뷰 표현으로 쓰지 말고, 중앙 원본의 리뷰 기준으로 정정해주세요.
- 네이버 블로그 전용 단일 MD, AppSheet 현장 서사 슬롯, 발행 하드게이트, 일일 SEO 관제는 블로그 어댑터에 둡니다.
- 적용 후 변경 파일과 적용 방식을 요약해주세요.
```

## 5. 신규 웹앱/랜딩 제작 세션용 프롬프트

```text
문장군 웹앱 또는 랜딩 제작을 시작합니다.

작업 전에 반드시 중앙 브랜드 원본을 읽고 반영해주세요.

중앙 원본:
GitHub 저장소: https://github.com/westgeneraldoor/munjanggun-brand
./BRAND_CONTEXT.md
./FIELD_JUDGMENT_RULES.md
./DESIGN.md
./DESIGN_QUICKSTART.md
./PHOTO_TREATMENT.md
./ANTI_PATTERNS.md
./EVIDENCE_REGISTER.md
./OPEN_QUESTIONS_REGISTER.md
./RAW_MATERIAL_INTAKE_PROTOCOL.md
./BRAND_MATERIAL_INDEX.md
./CUSTOMER_SEGMENTS.md
./PRODUCT_SELECTION_GUIDE.md
./FIELD_STORY_BANK.md
./REVIEW_PROOF_BANK.md
./PROOF_ASSET_INDEX.md
./FAQ_OBJECTION_BANK.md
./COPY_ASSET_BANK.md
./tokens/brand.css
./tokens/brand.tokens.json
./PROJECT_ADAPTERS.md

핵심 기준:
- 문장군은 무료 방문실측으로 집에 맞는 선택을 돕고, 직접 제작과 전속 시공으로 끝까지 책임지는 도어·중문 전문 브랜드입니다.
- 문장군 디자인은 Warm Craft, Guided Choice, Verified Work를 따릅니다.
- 첫인상은 코코아 오크, 클레이 테라코타, 캐시미어 크림 기반의 따뜻한 장인성으로 만들고, 검증/전산/운영 흐름에는 네이비를 제한적으로 사용합니다.
- 큰 제목과 브랜드 문장은 Noto Serif KR 계열을 우선하고, 본문/UI/버튼/폼은 Pretendard 또는 Noto Sans KR 계열을 사용합니다.
- 메인 비주얼은 제품이 인테리어와 예쁘게 어울리는 밝은 주거 공간 이미지여야 합니다.
- 첫 화면 신뢰 배지는 무료 방문실측, 직접 제작·전속 시공, 고객 리뷰 검증 3개를 우선합니다.
- 구현 토큰은 tokens/brand.css 또는 tokens/brand.tokens.json을 사용하고, 토큰 자체를 바꿔야 하면 중앙 DESIGN.md부터 갱신합니다.
- 사진 보정과 crop safe zone은 PHOTO_TREATMENT.md를 따릅니다.
- 이미지 구도, 최소 해상도, 텍스트 안전영역은 DESIGN.md와 tokens/brand.tokens.json의 media 토큰을 확인합니다.
- 출시 전 DESIGN_QUICKSTART.md의 12문항 체크를 통과해야 합니다.
- 가격은 숨기지 말고 가격대와 조건 설명, 무료 실측 후 정확 견적 안내를 함께 보여주세요.
- 리뷰 수, 가격, A/S, 일정, 시공 시간 claim은 EVIDENCE_REGISTER.md 기준일과 상태를 확인한 뒤 사용하세요.
- 확인되지 않은 운영 기준은 OPEN_QUESTIONS_REGISTER.md를 확인하고 단정하지 마세요.
- 고객 고민별 화면 구조는 CUSTOMER_SEGMENTS.md를, 제품 추천 흐름은 PRODUCT_SELECTION_GUIDE.md를, FAQ는 FAQ_OBJECTION_BANK.md를, CTA/Proof Panel 문장은 COPY_ASSET_BANK.md를 참고하세요.
- 실제 리뷰와 사진 근거는 REVIEW_PROOF_BANK.md와 PROOF_ASSET_INDEX.md 기준으로 공개 가능 상태를 확인하세요.
- 웹앱/랜딩에서 새 원료 후보를 발견하면 RAW_MATERIAL_INTAKE_PROTOCOL.md 기준으로 중앙 승격 후보로만 보고하세요.
- 빨간 가격 강조, 할인 전단지 느낌, 근거 없는 최고/최저가/No.1 표현, 차가운 대기업 느낌, 둥글둥글한 생활앱 느낌은 피해주세요.

작업 전 이 프로젝트의 목적, 화면 수, 주요 CTA를 먼저 확인하고 중앙 원본 기준에 맞는 화면 구조를 제안해주세요.
```
