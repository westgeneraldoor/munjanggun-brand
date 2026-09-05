# 문장군 중앙 브랜드 문서

> 버전: v5.0
> 최종 업데이트: 2026-09-05
> 변경 요약: 신규 상품 자산을 Z 원본·중복 제거 object·검토 메타데이터 구조로 전환하고, 사장 승인표와 블로그 안전 검색 절차를 추가했다.

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

## 상품·자산 운영

`문장군상품/`과 `assets/product-thumbnails/`는 실제 상품 설명과 증거 자산이다. 상품의 색상·유리·컬렉션 정보는 브랜드 시각 디자인이 아니라 고객 선택과 상품 사양 자료이므로 유지한다.

공식 제작·검토 자산은 `privacyStatus: official_reviewed`로 관리한다. 단 가격, 이벤트, 월 납입, 스펙, 옵션, 보증, 일정 등 변동 문구는 원본 맥락 밖에서 재사용하기 전에 최신 근거를 확인한다.

대량 intake는 원본 복구본, 논리 경로, 단일 object, 발행 상태를 분리한다. 검색은 상태를 바꾸지 않는다. 외부용 추출은 봉인 검토 증거와 권리·개인정보·claim·발행 게이트를 모두 통과해야 하며, 결과 자산과 추출 영수증을 한 묶음으로 만든다.

```bash
npm run assets:search -- --catalog <reviewed-content-catalog.json> --query "검색어"
npm run assets:pick-for-blog -- --catalog <reviewed-content-catalog.json> --product "3연동중문" --installation-scene "현관" --color "베이지" --design "모던" --consultation-topic "좁은 공간"
npm run assets:validate-approval-input -- --catalog <reviewed-content-catalog.json> --input <owner-approval-input.json>
npm run assets:extract-content -- --catalog <reviewed-content-catalog.json> --evidence-receipt <review-evidence/receipt.json> --approval-ledger <owner-decisions.json> --approval-receipt <owner-decisions-receipt.json> --use-evidence-registry <use-evidence-registry.json> --use-evidence-receipt <use-evidence-receipt.json> --channel blog --object-root <private-object-root> --output-root <output> --content-id <CONTENT-ID> --purpose external-publication --destination-class local-publication-staging
```

블로그 후보 검색과 선택은 `BLOG_ASSET_PICKER.md`를 따른다. 검색 결과의 `ready_for_guarded_extraction_request`는 추출 승인이 아니라 다음 검증을 요청할 수 있다는 뜻이다. 실제 사용 가능 여부는 `assets:extract-content`가 봉인 증거와 사장 승인을 다시 검증해 성공한 경우에만 확정된다.

`assets:extract`와 `assets:materialize`는 외부 발행 도구가 아니다. 두 명령은 `internal-recovery/private-recovery`, 정책에 등록된 비공개 루트, 복구 참조, 요청자, 사유, 발행 금지 확인을 모두 요구하고 복원 영수증을 남긴다. 외부용 자산은 실제 권리·claim 증거 파일이 봉인되고 `config/asset-owner-trust.json`에 등록된 사장 공개키로 use-evidence 및 owner-decision 영수증이 각각 서명된 경우에만 `assets:extract-content`로 추출한다. 현재 신뢰키 목록은 비어 있으므로 사장 키 등록 전 외부 추출은 기술적으로 차단된다.

권리 미검토 자산은 기본 거부된다. 외부용 추출은 카탈로그 SHA와 407개 자산 결정을 고정한 사장 결정 원장·영수증도 검증한다. 내부 감사 예외는 비공개 승인 루트, 감사 참조, 담당자, 사유, 만료일, 발행 금지 확인과 실패 게이트별 정확한 `--override-gate`가 모두 있어야 한다.

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
