# 블로그 자산 검색·선택 절차

이 문서는 블로그 작성자가 상품명, 설치 장면, 색상, 디자인, 상담 주제로 자산 후보를 찾고 안전하게 발췌하는 절차를 설명한다. 색상과 디자인은 상품 선택 정보이며 중앙 시각 디자인 기준을 뜻하지 않는다.

2026-09-07 사장 지시로 `INTAKE-20260904-01` 신규 10개 묶음은 문장군 내부 자체제작이며 블로그·SNS 재사용 권리가 확인됐다. 검색 기준은 `config/asset-library-index.json`이 연결하는 비공개 누적 묶음이다. 공개 Git 저장은 보류하고, 가격·행사 등 변동 문구와 개인정보는 발행 전에 작업자가 별도로 확인한다.

현재 이 intake는 실제 원본과 설명·claim 태그 불일치가 확인되어 내용 정확성 재검증 중이다. 보존권과 재사용권을 취소한 것이 아니라 잘못된 검색 추천을 중지한 것이다. `assets:library`, `assets:library:index`, `assets:search`, `assets:pick-for-blog`는 모두 재검증 완료 전까지 이 카탈로그를 거부한다. 기존에 만든 네 handoff도 `REVOCATION.json`으로 설명 신뢰가 철회됐다.

## 1. 공용 자료실에서 검색·미리보기

버전 폴더와 Z 경로를 직접 찾지 않는다.

```text
npm run assets:library:index -- --index "C:\Users\hjh\안티그래비티\문장군_브랜드\config\asset-library-index.json" --query "3연동중문 베이지 현관"
```

결과에는 실제 object 경로와 미리보기 주소, 내부 사용 가능 여부, 외부 발행 차단 이유가 함께 나온다. 선택한 후보는 등록된 블로그 비공개 영역에 바이너리 없이 전달한다.

```text
npm run assets:library:index -- --index "C:\Users\hjh\안티그래비티\문장군_브랜드\config\asset-library-index.json" --query "3연동ㄱ자 제품 연출 썸네일" --select-sha256 <SHA-256> --consumer munjanggun-blog --output-name <작업명>
```

`asset-handoff.json`과 `preview.html`만 생기며 `data/private/`의 Git 제외 상태를 유지한다. 같은 바이너리가 여러 intake에 있으면 결과는 하나이고 `origins`에서 모든 입수 출처를 확인한다. 이 단계는 내부 제작 참고용이고 외부 게시 승인은 아니다.

소비 프로젝트와 비공개 대상 루트는 중앙의 `config/asset-library-consumers.json`에서만 승인한다. 현재 등록·검증 대상은 블로그와 CRM이다. `--consumer` 대신 경로를 직접 적어도 동일한 Git 제외·비추적 검사를 통과해야 하며, 저장소에 추적되는 위치에는 handoff를 만들 수 없다.

## 2. 기존 상세 검색

한 문장으로 넓게 찾을 때는 기존 검색을 사용한다.

```bash
npm run assets:search -- --catalog <reviewed-content-catalog.json> --query "3연동중문 베이지 현관"
```

여러 조건을 모두 만족하는 후보를 좁힐 때는 블로그 선택 도구를 사용한다. 여섯 검색 조건 중 하나 이상을 지정해야 하며, 지정한 조건은 모두 일치해야 한다.

```text
npm run assets:pick-for-blog -- --catalog <reviewed-content-catalog.json> --product "3연동중문" --installation-scene "현관 설치" --color "베이지" --design "모던" --consultation-topic "좁은 공간" --limit 20
```

지원 조건:

| 조건 | CLI | 주로 확인하는 정보 |
| --- | --- | --- |
| 자유 검색 | `--query` | 의미 요약, OCR, 그룹, claim, 원본 경로 |
| 상품명 | `--product` | 원본 상품 경로, 의미 요약 |
| 설치 장면 | `--installation-scene` | 의미 요약, OCR, 원본 경로 |
| 색상 | `--color` | 의미 요약, OCR, 원본 경로 |
| 디자인 | `--design` | 의미 요약, OCR, 의미 그룹, 원본 경로 |
| 상담 주제 | `--consultation-topic` | 의미 요약, OCR, claim 신호, 원본 경로 |

`--media-type image/gif`처럼 미디어 형식을 제한할 수 있다. 검색과 후보 선택은 파일이나 상태를 변경하지 않는다.

## 3. 후보 판정 읽기

모든 후보에는 `catalogMetadataStatus`와 `externalExtractionBlockers`가 표시된다.

- `review_only`: 글의 구성과 검토 대상으로만 선택할 수 있다. 권리, 개인정보, claim, 검토 또는 발행 상태 중 하나 이상이 미완료이므로 외부 추출 단계가 제공되지 않는다.
- `ready_for_guarded_extraction_request`: 카탈로그 메타데이터상 다음 검증을 요청할 수 있다. 외부 사용 승인을 뜻하지 않는다.

미승인 자산도 검색 결과에서 숨기지 않는다. 출처와 상세페이지 맥락을 보존하고 검토 대상을 찾기 위해서다. 대신 미승인 자산을 선택하면 `externalExtractionRequestStatus: blocked_by_catalog_metadata`, `nextStep: null`이 반환된다.

## 4. 외부 발행용 추출

검색 조건에 포함된 `contentId`만 선택할 수 있다.

```text
npm run assets:pick-for-blog -- --catalog <reviewed-content-catalog.json> --product "3연동중문" --color "베이지" --select-content-id <CONTENT-ID>
```

선택 결과가 `requires_assets_extract_content_revalidation`이면 `nextStep`의 고정 인자와 아래 필수 경로를 사용해 기존 추출기를 실행한다.

```text
npm run assets:extract-content -- --catalog <reviewed-content-catalog.json> --evidence-receipt <review-evidence/receipt.json> --approval-ledger <owner-decisions.json> --approval-receipt <owner-decisions-receipt.json> --use-evidence-registry <use-evidence-registry.json> --use-evidence-receipt <use-evidence-receipt.json> --channel blog --object-root <private-object-root> --output-root <local-publication-staging> --content-id <CONTENT-ID> --purpose external-publication --destination-class local-publication-staging
```

추출기는 검색 결과를 신뢰하지 않고 카탈로그 SHA, 봉인된 육안 검토 증거, 사장 결정, 실제 권리·claim 증거, 사용 채널, 개인정보 상태, object SHA를 다시 검증한다. 하나라도 실패하면 출력 묶음을 만들지 않는다.

## 5. 사용 금지

- `review_only` 후보를 object store나 원본 폴더에서 직접 복사하지 않는다.
- 검색 점수나 `contentId`만으로 사용 승인을 추정하지 않는다.
- 가격, 이벤트, 월 납입, 스펙, 옵션, 보증, 일정 문구는 이미지 원본 맥락 밖에서 재사용하기 전에 최신 근거를 확인한다.
- 추출 영수증이 없는 파일을 블로그 원고나 CMS에 연결하지 않는다.
- 공용 자료실의 `firstReviewCandidates` 수를 즉시 발행 가능 수로 부르지 않는다. 작업자가 우선 판정하기 좋은 묶음이라는 뜻이다.
