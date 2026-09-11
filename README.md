# 문장군 중앙 브랜드 문서

> 버전: v5.27
> 최종 업데이트: 2026-09-11
> 변경 요약: 7개 `vetted` 상품군의 폴더·파일 순서를 상품 전체 스토리로 연결하고, 내부 검색·handoff가 개별 자산보다 먼저 전체/일부 범위와 필수 선택지 누락을 전달한다.

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
| 2026-09-07 쇼핑스토리 자산 intake | `ASSET_INTAKE_2026-09-07.md` |
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
| `config/product-story-contexts.json` | 폴더·파일 순서를 상품 전체 스토리와 선택지 관계로 연결 |
| `BLOG_ASSET_PICKER.md` | 블로그용 다축 자산 검색·선택·안전 추출 절차 |
| `BRAND_MATERIAL_INDEX.md` | 공통 원료 은행 입구 |
| `RAW_MATERIAL_INTAKE_PROTOCOL.md` | 프로젝트 자료의 중앙 승격 절차 |
| `PROJECT_ADAPTERS.md` | 중앙과 프로젝트 책임 분리 |
| `PROMPTS.md` | 프로젝트 총괄 전달 프롬프트 |
| `CHANGELOG.md` | 변경 이력 |
| `ASSET_INTAKE_2026-09-04.md` | 신규 10개 상품 묶음의 보존·중복·검토·승격 게이트 |
| `ASSET_CONTENT_REVALIDATION_2026-09-07.md` | 407개 자산 내용 오분류 원인·재판독 진행·다음 봉인 기준 |
| `ASSET_VISUAL_REVIEW_WORKBENCH.md` | 두 intake 489개 고유 자산의 재검토 원장·픽셀/OCR 작업대·직접 검토 대시보드·서명 절차 |

## 상품·자산 운영

`문장군상품/`과 `assets/product-thumbnails/`는 실제 상품 설명과 증거 자산이다. 상품의 색상·유리·컬렉션 정보는 브랜드 시각 디자인이 아니라 고객 선택과 상품 사양 자료이므로 유지한다.

공식 제작·검토 자산은 `privacyStatus: official_reviewed`로 관리한다. 단 가격, 이벤트, 월 납입, 스펙, 옵션, 보증, 일정 등 변동 문구는 원본 맥락 밖에서 재사용하기 전에 최신 근거를 확인한다.

대량 intake는 원본 복구본, 논리 경로, 단일 object, 발행 상태를 분리한다. 검색은 상태를 바꾸지 않는다. 외부용 추출은 봉인 검토 증거와 권리·개인정보·claim·발행 게이트를 모두 통과해야 하며, 결과 자산과 추출 영수증을 한 묶음으로 만든다.

> **운영 경로 분리:** 철회된 `verified-v4`와 기존 발행용 `assets:library:index`, `assets:search`, `assets:pick-for-blog`, `assets:extract-content`는 계속 차단한다. 대신 489개 원본과 1차 판독·픽셀 근거·서명을 다시 검증하는 `assets:library:internal`만 내부 검색·미리보기·메타데이터 handoff에 사용한다. 이 내부 결과는 `non_authority`이며, 실제 게시에는 선택한 자산만 원본 문구·최신 claim·개인정보를 다시 확인해야 한다.

정지 이미지 409개는 6개 활성 원장에서 독립 1·2차 판독과 제3자 교정을 마쳤고 모두 `complete_non_authority`로 검증됐다. GIF 80개도 전체 시간 재생 기술 영수증, 서로 독립된 시간축 표본 판독 2종, 제3자 비교·교정을 연결해 관찰 충돌 미해결 0으로 닫았다. GIF 최종 교정은 자산당 10개 필드, 총 800개 결정을 원본 SHA에 묶는다. 다만 `resolved`는 보이는 내용의 판독 충돌이 정리됐다는 뜻이지 가격·행사·성능의 최신성, 촬영 동의, 외부 발행 또는 공용 자료실 승격을 뜻하지 않는다.

초안 변환은 GIF의 P1 기술 전체 재생, P7 시간축 표본 의미 판독, P5 제3자 교정을 서로 다른 수행자·방법·시각으로 보존한다. `full_loop_original_opened`라는 합성 이력은 사용하지 않는다. 정지 이미지의 문자 상태도 `observed 375 / none_observed 32 / uncertain 2`를 그대로 유지한다. 교정된 비공개 초안 입구는 `Z:\문장군_브랜드_원본보관\VISUAL-REVIEW-2026-09-08\content-authority-drafts-current.json`이며, 모든 상태는 계속 `non_authority`·`needs_evidence`·`blocked`다.

v2 정지 이미지 교정 계약은 정규화된 1차 원문을 기준으로 삼고, 1·2차 차이 또는 최종값 변경이 있는 모든 필드의 결정을 요구한 뒤 최종 관찰 전체를 다시 조립해 제출본과 완전히 비교한다. 따라서 결정 목록에 없는 설명·가격/A/S 신호·배열 변경이나 배열 항목 단위 우회는 거절된다. 첫 세그먼트 원장은 아래 명령으로 원본·서명·작성자 독립성·교정 연결을 다시 검사하며, 나머지 5개 세그먼트도 같은 `pilot-complete` 검사를 통과해야 전체 완료 영수증이 유효하다.

```powershell
npm run assets:validate-raw-review-ledger -- --ledger "Z:\문장군_브랜드_원본보관\VISUAL-REVIEW-2026-09-08\raw-review-ledger-v1\LEDGER_INDEX.json" --mode pilot-complete --reviewer-trust "Z:\문장군_브랜드_원본보관\VISUAL-REVIEW-2026-09-08\raw-review-ledger-v1\reviewer-trust.json"
```

후속 정지 이미지 구간은 기존 0~11 원장의 pair·교정 서명을 다시 만들지 않고 `raw-review-ledger-v1/segments/<구간>/`에 별도 불변 세그먼트로 보존한다. 교정 전에는 `attested-integrity`로 원본·두 원문·pair뿐 아니라 모든 raw batch의 작성자 서명과 선언된 서명 수까지 검증한다. 19번 작은 문구는 사장 확인에 따라 `핸드커버래핑`으로 정정했으며 이전 `핸드커버댐핑` 판독과 서명본은 superseded 증거로만 보존한다. 인물·개인정보·가격·행사·성능 주장 신호는 판독 완료와 별개로 외부 사용 단계에서 다시 차단·확인한다.

```powershell
npm run assets:validate-raw-review-ledger -- --ledger <segment-ledger-index.json> --mode attested-integrity --reviewer-trust <segment-reviewer-trust.json>
npm run assets:validate-raw-review-ledger -- --ledger <segment-ledger-index.json> --mode pilot-complete --reviewer-trust <segment-reviewer-trust.json>
```

다른 문장군 프로젝트는 버전 폴더나 Z 경로를 직접 찾지 않고 내부 자료실 설정 하나만 사용한다.

```text
C:\Users\hjh\안티그래비티\문장군_브랜드\config\asset-internal-library.json
```

```bash
npm run assets:library:internal -- --product "3연동중문"
npm run assets:library:internal -- --query "3연동중문 우드"
npm run assets:library:internal -- --query "양개형중문 미서기 4연동"
npm run assets:library:internal -- --query "ABS도어 방문교체 패키지1"
npm run assets:library:internal -- --query "3연동ㄱ자" --select-sha256 <SHA-256> --consumer munjanggun-blog --output-name <작업명>
npm run assets:library:internal -- --query "3연동ㄱ자" --select-sha256 <SHA-256> --consumer munjanggun-crm --output-name <작업명>
```

7개 `vetted` 상품군 검색 결과에는 개별 이미지보다 먼저 `contentBrief`가 나온다. 전체 상품 요청이면 상품별 필수 구조·컬렉션·컬러·유리·패키지를 확인하도록 안내한다. `3연동중문 우드`, `양개형중문 미서기 4연동`, `ABS도어 방문교체 패키지1`처럼 일부를 요청하면 `requestScope: product_subset`으로 표시하고 전체 선택 구조 안에서 어디에 해당하는지 함께 전달한다. 세부 색상 요청의 각 결과는 `storyEvidenceMatch`에서 `exact_detail_evidence`와 `option_group_context`를 구분하며 색상표 같은 직접 근거를 참고 연출보다 먼저 정렬한다. 각 자산의 `storyPlacement`·`storySourcePath`는 현재 요청에 우선하는 원래 폴더 위치를, `narrativePlacements`는 같은 바이트가 재사용된 위치까지 포함한 모든 절·선택지 관계를 보여준다. `originalPath`는 이미지 바이트 검증용 보관 위치이므로 상품 문맥 경로로 해석하지 않는다.

검색 결과의 `resultCoverage`는 현재 상위 결과에 빠진 절·선택지뿐 아니라 세부 색상표·유리 종류표·적용 예시 같은 필수 설명 근거 역할도 표시한다. `wholeProductExplanationEvidenceComplete`와 `completionAssessment.configuredEvidenceContractComplete`는 설정된 근거 역할 충족을 뜻할 뿐 실제 글이 독자의 질문에 답했다는 보증이 아니다. `completionAssessment.readerQuestionAnswerComplete`는 별도 집필 검토 전까지 거짓으로 유지하며 현장 판단에는 `FIELD_JUDGMENT_RULES.md` 확인을 요구한다. 컬렉션·컬러 사이의 원본 제한은 `applicableConstraints`로 별도 전달하며, 전체 상품 요청에는 등록된 제한을 모두 포함한다.

상품 별칭은 공백 차이를 제거하되 독립된 복수 상품을 하나의 긴 이름으로 축소하지 않는다. 이 공백 동등성은 상품 문맥 판정과 검색 조건 제거에 동일하게 적용하며, 상품명만 요청한 경우 등록 스토리 출처에 연결된 자산만 반환해 결과 집합·스토리 순서도 표기 방식에 따라 달라지지 않는다. 세부 색상과 등록 코드는 상위 컬러 그룹에 연결하고, 행사·유리·시공 같은 절 주제와 구조화 필터도 `product_subset`으로 판정한다. 근거 없는 추가 조건은 자유 검색어뿐 아니라 `color`, `design`, `topic`, `scene` 어느 입력칸에 있어도 입력칸 출처와 함께 `unresolvedConditions`·`unresolvedTerms`·`requestResolution`에 남기고 같은 그룹 자료로 대체하지 않는다. 복수 상품 또는 같은 선택 축의 비교는 `comparison_requires_split`로 반환해 대상별 검색을 요구한다.

명령은 활성 1차 검토 pointer와 후보·픽셀 근거·검토자 서명·489개 원본 SHA를 확인한 뒤 실행된다. 스토리 선택자는 등록 `sourceIds`와 함께 검증하고, handoff에는 스토리 설정 버전·SHA-256·출처 ID를 기록한다. 실제 이미지 복사 없이 `asset-handoff.json`과 미리보기 HTML만 등록 프로젝트의 비공개·Git 제외 영역에 만든다. 결과의 내부 열람 상태는 `usable`, 외부 발행은 `blocked_selected_asset_review_required`, 공개 Git은 `blocked`로 고정된다.

기존 `assets:library:index`, `assets:library`, `assets:search`, `assets:pick-for-blog`, `assets:extract-content`는 완전한 발행 authority를 요구하는 별도 경로다. 내부 자료실 개방을 이유로 이 차단을 완화하거나 우회하지 않는다.

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
