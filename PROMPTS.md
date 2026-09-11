# PROMPTS - 문장군 중앙 브랜드 적용 프롬프트

> 버전: v2.6
> 최종 업데이트: 2026-09-11

## 프로젝트 총괄용 공통 프롬프트

```text
문장군 중앙 브랜드 원본을 적용합니다.

먼저 README.md, BRAND_CONTEXT.md, FIELD_JUDGMENT_RULES.md, EVIDENCE_REGISTER.md, OPEN_QUESTIONS_REGISTER.md, PROJECT_ADAPTERS.md를 확인하세요.

이 중앙 저장소는 로고, 색상, 폰트, 웹폰트, UI, 레이아웃, 이미지 보정 스타일 등 시각 디자인을 제공하지 않습니다. 시각 디자인은 해당 프로젝트가 자체 관리하고 중앙 원본을 디자인 권위로 인용하지 마세요.

가격, 리뷰 수, A/S, 일정, 추가금, 이벤트, 월 납입, 스펙, 옵션은 EVIDENCE_REGISTER.md에서 publishable/vetted 여부를 확인하기 전까지 단정하지 마세요.

상품·이미지·GIF·썸네일을 사용하면 BRAND_WIKI_ARCHITECTURE.md, SOURCE_REGISTRY.md, PRODUCT_WIKI_INDEX.md, 필요한 상품 위키, ASSET_SEMANTIC_INDEX.md, config/product-story-contexts.json, 상품별 asset-manifest.json을 확인하세요. 먼저 상품 전체 스토리와 선택지 관계를 확인한 뒤 개별 자산을 고르세요. 검색 상위 이미지 몇 장을 상품 전체 옵션으로 간주하지 마세요. 이미지 속 고객 식별 정보와 변동 claim도 확인하세요.

INTAKE-20260904-01 신규 10개 상품 묶음은 문장군 내부 자체제작이며 모든 문장군 비공개 Codex 프로젝트의 공용 소스로 사용 가능합니다. 버전 폴더나 철회된 current.json을 직접 찾지 말고 C:\Users\hjh\안티그래비티\문장군_브랜드\config\asset-internal-library.json을 입구로 assets:library:internal을 사용하세요. 3연동중문은 결과의 contentBrief, requestScope, requestResolution, resultCoverage, completionAssessment, narrativePlacements를 먼저 확인하세요. 세부 색상에서는 exact_detail_evidence를 직접 근거로, option_group_context를 참고자료로 구분하세요. query·color·design·topic·scene 중 어느 입력칸이든 unresolvedTerms와 unresolvedConditions가 있으면 같은 그룹 자료로 대신하지 말고, comparison_requires_split이면 표시된 대상들을 각각 검색하세요. 전체 글이면 4개 컬렉션과 4개 컬러 그룹을 알고 선택하고, 우드 등 일부만 다루면 일부 주제임을 밝히세요. 근거 역할 충족을 집필 완성으로 표현하지 말고 선택 축·정확한 근거·조합 제한·비교 대상·현장 확인 기준에 실제로 답했는지 검수하세요. 공개 Git에는 바이너리를 올리지 말고, 블로그·SNS 발행 시 선택 자산의 변동 claim·개인정보·외부 발행 게이트를 확인하세요.

고객·현장·리뷰·FAQ·카피 원료는 BRAND_MATERIAL_INDEX.md와 필요한 원료 은행 문서의 상태값을 확인하세요. 프로젝트 자료를 중앙으로 올릴 때는 RAW_MATERIAL_INTAKE_PROTOCOL.md에 따라 비식별화와 claim 검증을 거치세요.

중앙 원본을 직접 덮어쓰지 말고 프로젝트 구조에 맞게 적용한 뒤 변경 파일, 충돌 지점, 남은 확인 사항을 보고하세요.
```

## 중앙 총괄 검수 프롬프트

```text
아래 프로젝트의 중앙 브랜드 원본 적용 결과를 검수해주세요.

- BRAND_CONTEXT.md와 제품 범위·표현이 충돌하지 않는가
- FIELD_JUDGMENT_RULES.md의 현장 판단을 어기지 않는가
- EVIDENCE_REGISTER.md 없이 변동 claim을 단정하지 않았는가
- 상품 자산의 source, usageStatus, privacyStatus, claimRisk를 확인했는가
- 상품 전체 스토리와 선택지 관계를 먼저 확인했고, 일부 이미지를 전체 상품처럼 설명하지 않았는가
- retired/superseded 자료를 현재 원본처럼 쓰지 않았는가
- 고객명, 전화번호, 상세 주소, 상담 원문, AppSheet 원본·캡처가 노출되지 않았는가
- 시각 디자인을 중앙 권위로 잘못 인용하지 않았는가
- 충돌 분류가 중앙 우선 / 프로젝트 우선 / 중앙 업데이트 필요 / 확인 필요 중 적절한가

결과는 APPROVED 또는 ISSUES_FOUND로 시작하고 파일, 항목, 이유, 조치를 적어주세요.
```

## 적용 보고 형식

```text
프로젝트:
적용 일자:
읽은 중앙 문서:
수정한 파일:
중앙 원본과 충돌한 지점:
충돌 분류:
민감 정보 노출 여부:
상품/자산 상태 확인 여부:
사용한 source_id / asset_id / claim_id / proof_id:
변동 claim 근거 확인 여부:
남은 확인 사항:
```
