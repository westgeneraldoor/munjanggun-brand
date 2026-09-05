# 블로그 자산 검색·선택 절차

이 문서는 블로그 작성자가 상품명, 설치 장면, 색상, 디자인, 상담 주제로 자산 후보를 찾고 안전하게 발췌하는 절차를 설명한다. 색상과 디자인은 상품 선택 정보이며 중앙 시각 디자인 기준을 뜻하지 않는다.

## 1. 빠른 검색과 다축 후보 검색

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

## 2. 후보 판정 읽기

모든 후보에는 `catalogMetadataStatus`와 `externalExtractionBlockers`가 표시된다.

- `review_only`: 글의 구성과 검토 대상으로만 선택할 수 있다. 권리, 개인정보, claim, 검토 또는 발행 상태 중 하나 이상이 미완료이므로 외부 추출 단계가 제공되지 않는다.
- `ready_for_guarded_extraction_request`: 카탈로그 메타데이터상 다음 검증을 요청할 수 있다. 외부 사용 승인을 뜻하지 않는다.

미승인 자산도 검색 결과에서 숨기지 않는다. 출처와 상세페이지 맥락을 보존하고 검토 대상을 찾기 위해서다. 대신 미승인 자산을 선택하면 `externalExtractionRequestStatus: blocked_by_catalog_metadata`, `nextStep: null`이 반환된다.

## 3. 한 후보 선택

검색 조건에 포함된 `contentId`만 선택할 수 있다.

```text
npm run assets:pick-for-blog -- --catalog <reviewed-content-catalog.json> --product "3연동중문" --color "베이지" --select-content-id <CONTENT-ID>
```

선택 결과가 `requires_assets_extract_content_revalidation`이면 `nextStep`의 고정 인자와 아래 필수 경로를 사용해 기존 추출기를 실행한다.

```text
npm run assets:extract-content -- --catalog <reviewed-content-catalog.json> --evidence-receipt <review-evidence/receipt.json> --approval-ledger <owner-decisions.json> --approval-receipt <owner-decisions-receipt.json> --use-evidence-registry <use-evidence-registry.json> --use-evidence-receipt <use-evidence-receipt.json> --channel blog --object-root <private-object-root> --output-root <local-publication-staging> --content-id <CONTENT-ID> --purpose external-publication --destination-class local-publication-staging
```

추출기는 검색 결과를 신뢰하지 않고 카탈로그 SHA, 봉인된 육안 검토 증거, 사장 결정, 실제 권리·claim 증거, 사용 채널, 개인정보 상태, object SHA를 다시 검증한다. 하나라도 실패하면 출력 묶음을 만들지 않는다.

## 4. 사용 금지

- `review_only` 후보를 object store나 원본 폴더에서 직접 복사하지 않는다.
- 검색 점수나 `contentId`만으로 사용 승인을 추정하지 않는다.
- 가격, 이벤트, 월 납입, 스펙, 옵션, 보증, 일정 문구는 이미지 원본 맥락 밖에서 재사용하기 전에 최신 근거를 확인한다.
- 추출 영수증이 없는 파일을 블로그 원고나 CMS에 연결하지 않는다.
