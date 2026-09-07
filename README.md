# 문장군 중앙 브랜드 문서

> 버전: v5.6
> 최종 업데이트: 2026-09-07
> 변경 요약: 오분류 봉인본 v1~v3를 폐기하고 407개 자산의 상품 정체성·가격·교차상품을 다시 검증한 v4 authority를 공용 검색·추천·handoff에 연결한다.

이 저장소는 문장군의 브랜드 사실, 현장 판단, 변동 claim 근거, 공통 원료, 상품·자산 위키를 관리한다.

2026-09-04부터 이 저장소는 로고, 색상 팔레트, 서체, 웹폰트, 레이아웃, UI 컴포넌트, 사진 보정 스타일 등 시각 디자인을 관리하거나 배포하지 않는다. 하위 프로젝트는 시각 디자인을 자체적으로 결정한다.

## 운영 빠른 시작

```bash
npm test
npm run validate
npm run validate:manifests
npm run report:assets
```

검증 범위는 상품별 `asset-manifest.json`, evidence/open question/source registry 상태값, 자산 의미 태깅 coverage다.

## 작업별 입구

| 작업 | 먼저 볼 문서 |
| --- | --- |
| 공통 브랜드·카피 | `BRAND_CONTEXT.md`, `FIELD_JUDGMENT_RULES.md` |
| 변동 claim | `EVIDENCE_REGISTER.md`, `OPEN_QUESTIONS_REGISTER.md` |
| 상품 설명·이미지·GIF·썸네일 | `BRAND_WIKI_ARCHITECTURE.md`, `SOURCE_REGISTRY.md`, `PRODUCT_WIKI_INDEX.md`, 상품 위키, `ASSET_SEMANTIC_INDEX.md`, manifest |
| 2026-09-04 신규 자산 intake | `ASSET_INTAKE_2026-09-04.md` |
| 고객·현장·리뷰·FAQ·카피 원료 | `BRAND_MATERIAL_INDEX.md`와 필요한 원료 은행 문서 |
| 프로젝트 연결 | `PROJECT_ADAPTERS.md`, `PROMPTS.md` |

## 핵심 파일

| 파일 | 역할 |
| --- | --- |
| `BRAND_CONTEXT.md` | 브랜드 정의, 제품 범위, 표현 기준 |
| `FIELD_JUDGMENT_RULES.md` | 상담·실측·시공 판단 기준 |
| `EVIDENCE_REGISTER.md` | 가격·리뷰·A/S·일정 등 변동 claim 근거 |
| `OPEN_QUESTIONS_REGISTER.md` | 미확정 운영 기준 추적 |
| `BRAND_WIKI_ARCHITECTURE.md` | 상품·자산 위키 구조 |
| `SOURCE_REGISTRY.md` | 자료 유입 소스 등록부 |
| `PRODUCT_WIKI_INDEX.md` | 상품별 위키 입구 |
| `ASSET_SEMANTIC_INDEX.md` | 이미지/GIF 의미와 사용 상태 |
| `BLOG_ASSET_PICKER.md` | 블로그용 다축 자산 검색·선택·안전 추출 절차 |
| `BRAND_MATERIAL_INDEX.md` | 공통 원료 은행 입구 |
| `RAW_MATERIAL_INTAKE_PROTOCOL.md` | 프로젝트 자료의 중앙 승격 절차 |
| `PROJECT_ADAPTERS.md` | 중앙과 프로젝트 책임 분리 |
| `PROMPTS.md` | 프로젝트 총괄 전달 프롬프트 |
| `CHANGELOG.md` | 변경 이력 |
| `ASSET_INTAKE_2026-09-04.md` | 신규 10개 상품 묶음의 보존·중복·검토·승격 게이트 |
| `ASSET_CONTENT_REVALIDATION_2026-09-07.md` | 407개 자산 내용 오분류 원인·전수 재판독·봉인 기록 |

## 상품·자산 운영

`문장군상품/`과 `assets/product-thumbnails/`는 실제 상품 설명과 증거 자산이다. 상품의 색상·유리·컬렉션 정보는 브랜드 시각 디자인이 아니라 고객 선택과 상품 사양 자료이므로 유지한다.

공식 제작·검토 자산은 `privacyStatus: official_reviewed`로 관리한다. 단 가격, 이벤트, 월 납입, 스펙, 옵션, 보증, 일정 등 변동 문구는 원본 맥락 밖에서 재사용하기 전에 최신 근거를 확인한다.

대량 intake는 원본 복구본, 논리 경로, 단일 object, 발행 상태를 분리한다. 검색은 상태를 바꾸지 않는다. 외부용 추출은 봉인 검토 증거와 권리·개인정보·claim·발행 게이트를 모두 통과해야 하며, 결과 자산과 추출 영수증을 한 묶음으로 만든다.

> **내용 정확성 재검증 완료:** `INTAKE-20260904-01`의 정지 이미지 335개는 전체 해상도, GIF 72개는 전체 루프로 다시 확인했다. 최초 v1과 추가 감찰 중 만든 v2·v3는 모두 폐기했고, 상품별 필수명·실제 교차상품·공용 ABS family 사유까지 검증한 `verified-v4`만 운영 권위다. 검색·추천·handoff·외부 추출은 `config/asset-content-quality.json`이 고정한 private overlay·receipt·profile snapshot을 검증한 뒤 새 내용만 사용한다. 기존 catalog JSON의 `semanticSummary`를 직접 읽어 재사용하면 안 된다. 상세 기록은 `ASSET_CONTENT_REVALIDATION_2026-09-07.md`를 따른다.

다른 문장군 프로젝트는 버전 폴더를 직접 찾지 않고 아래 누적 공용 입구만 사용한다. 이 인덱스는 각 intake의 불변 pointer와 SHA를 연결하므로 새 묶음을 추가해도 이전 묶음이 검색에서 사라지지 않는다.

```text
C:\Users\hjh\안티그래비티\문장군_브랜드\config\asset-library-index.json
```

```bash
npm run assets:library:index -- --index "C:\Users\hjh\안티그래비티\문장군_브랜드\config\asset-library-index.json" --query "3연동ㄱ자"
npm run assets:library:index -- --index "C:\Users\hjh\안티그래비티\문장군_브랜드\config\asset-library-index.json" --query "3연동ㄱ자" --select-sha256 <SHA-256> --consumer munjanggun-blog --output-name <작업명>
```

두 번째 명령은 봉인된 시각 재검증 overlay를 검증한 뒤 실행된다. 실제 이미지 복사 없이 `asset-handoff.json`과 미리보기 HTML만 등록된 프로젝트의 비공개·Git 제외 영역에 만든다. 기존 단일 최신 묶음용 `assets:library -- --pointer ...`도 같은 내용 정확성 게이트를 거치므로 base catalog의 낡은 설명으로 우회할 수 없다.

```bash
npm run assets:search -- --catalog <reviewed-content-catalog.json> --query "검색어"
npm run assets:pick-for-blog -- --catalog <reviewed-content-catalog.json> --product "3연동중문" --installation-scene "현관" --color "베이지" --design "모던" --consultation-topic "좁은 공간"
npm run assets:validate-approval-input -- --catalog <reviewed-content-catalog.json> --input <owner-approval-input.json>
npm run assets:record-owner-rights -- --catalog <reviewed-content-catalog.json> --attestation-input <private-intake-owner-attestation.json> --output-root <private-owner-rights-bundle>
npm run assets:validate-owner-rights -- --bundle-root <private-owner-rights-bundle>
npm run assets:extract-content -- --catalog <reviewed-content-catalog.json> --evidence-receipt <review-evidence/receipt.json> --approval-ledger <owner-decisions.json> --approval-receipt <owner-decisions-receipt.json> --use-evidence-registry <use-evidence-registry.json> --use-evidence-receipt <use-evidence-receipt.json> --channel blog --object-root <private-object-root> --output-root <output> --content-id <CONTENT-ID> --purpose external-publication --destination-class local-publication-staging
```

`assets:record-owner-rights`는 사장님의 쉬운 사업 결정을 해당 intake의 모든 고유 자산과 원래 경로에 작업자 책임으로 연결한다. 자체제작, 비공개 Codex 공용 소스 사용, 블로그·SNS 재사용, 별도 특수 제한 없음은 기록하되 공개 Git은 보류한다. 가격·행사 등 변동 claim, 개인정보, 추가 판독은 사용권과 분리해 계속 검수한다. 사장님에게 SHA나 근거 ID 입력을 요구하지 않는다.

`rightsStatus: owner_approved_recorded`는 사장님의 사용권 결정이 기록됐다는 뜻이다. `verified` 전자서명이나 외부 발행 완료를 뜻하지 않으며, 검색 결과는 권리 승인과 남은 claim·개인정보·발행 차단 사유를 따로 보여야 한다.

블로그 후보 검색과 선택은 `BLOG_ASSET_PICKER.md`를 따른다. 검색 결과의 `ready_for_guarded_extraction_request`는 추출 승인이 아니라 다음 검증을 요청할 수 있다는 뜻이다. 실제 사용 가능 여부는 `assets:extract-content`가 봉인 증거와 사장 승인을 다시 검증해 성공한 경우에만 확정된다.

`assets:extract`와 `assets:materialize`는 외부 발행 도구가 아니다. 두 명령은 `internal-recovery/private-recovery`, 정책에 등록된 비공개 루트, 복구 참조, 요청자, 사유, 발행 금지 확인을 모두 요구하고 복원 영수증을 남긴다. 외부용 자산은 실제 권리·claim 증거 파일이 봉인되고 `config/asset-owner-trust.json`에 등록된 사장 공개키로 use-evidence 및 owner-decision 영수증이 각각 서명된 경우에만 `assets:extract-content`로 추출한다. 현재 신뢰키 목록은 비어 있으므로 사장 키 등록 전 외부 추출은 기술적으로 차단된다.

권리 미검토 자산은 기본 거부된다. 외부용 추출은 카탈로그 SHA와 해당 intake 전체 자산 결정을 고정한 사장 결정 원장·영수증도 검증한다. 내부 감사 예외는 비공개 승인 루트, 감사 참조, 담당자, 사유, 만료일, 발행 금지 확인과 실패 게이트별 정확한 `--override-gate`가 모두 있어야 한다.

다음 자료 묶음은 `config/intakes/<INTAKE-ID>.profile.json`에 날짜·상품·출처를 적고, `<INTAKE-ID>.audit.json`에 그 묶음의 정확한 완료 수치를 고정한다. 프로그램에는 이번 묶음의 10개 상품명이나 407/1,134/2,013/450 같은 숫자를 넣지 않는다.

검토 보고서의 개수와 파일명도 프로그램에 고정하지 않는다. profile의 `review.catalogReports`, `review.similarityReports`, `review.supportingCollections`가 정적 이미지·GIF 판독 shard와 선택적 contact sheet/storyboard 위치를 정의하며, 봉인과 병합 도구는 이 설정을 공통으로 읽는다.

공용 자료실의 소비 프로젝트는 `config/asset-library-consumers.json`에 중앙 정책으로 등록한다. 현재 실제 전달이 검증되는 대상은 `munjanggun-blog`와 `munjanggun-crm` 두 곳이다. 등록 루트는 서로 같거나 부모·자식으로 겹칠 수 없고, handoff 대상은 실제 Git 제외·비추적 상태여야 한다. `current.json` 갱신은 최초 생성 시 `--expect-absent`, 이후에는 기존 파일의 정확한 `--expected-current-sha256`을 요구하며 이전 pointer와 활성화 영수증을 private history에 남긴다. 누적 인덱스에는 그 불변 이력 pointer만 SHA와 함께 추가한다.

## 민감 정보

고객명, 전화번호, 상세 주소, 동호수, 상담 원문, AppSheet 원본·캡처, 관리자 통계 원본, 계정 키·토큰·비밀번호는 중앙 저장소에 넣지 않는다. 이미지에도 차량번호, 송장, 우편물, 가족사진 등 식별 정보가 없는지 확인한다.

## 프로젝트 적용 원칙

- 중앙은 브랜드 사실·현장·근거·안전 기준을 관리한다.
- 화면, URL, 메뉴, 고객 여정, CTA 연결, 로고, 색상, 폰트, UI와 기타 시각 디자인은 프로젝트 권한이다.
- 중앙 파일을 프로젝트에 무조건 복사하지 않고 얇은 참조 문서나 어댑터를 둔다.
- 충돌은 `중앙 우선 / 프로젝트 우선 / 중앙 업데이트 필요 / 확인 필요`로 분류한다.
- 변경 후 `CHANGELOG.md`를 갱신한다.

## 저장소 위치

```text
https://github.com/westgeneraldoor/munjanggun-brand
C:\Users\hjh\안티그래비티\문장군_브랜드\
```
