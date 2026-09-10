# 블로그 자산 검색·선택 절차

이 문서는 블로그 작성자가 상품명, 설치 장면, 색상, 디자인, 상담 주제로 자산 후보를 찾고 안전하게 발췌하는 절차를 설명한다. 색상과 디자인은 상품 선택 정보이며 중앙 시각 디자인 기준을 뜻하지 않는다.

2026-09-07 사장 지시로 두 intake의 자료는 문장군 내부 자체제작이며 내부 Codex 프로젝트와 블로그·SNS 재사용 권리가 확인됐다. 공개 Git 저장은 보류하고, 가격·행사 등 변동 문구와 개인정보는 실제 게시에 선택한 자산만 다시 확인한다.

## 현재 운영 상태

2026-09-07 `verified-v4`는 내용 오류 때문에 철회됐고 발행용 검색·추출 경로는 계속 중지돼 있다. 이후 두 intake를 합친 489개 자산의 1차 판독·픽셀 근거·서명을 연결했다. 이 결과는 발행 authority가 아니지만, 원본 SHA까지 다시 확인하는 별도 내부 자료실에서 검색·미리보기·메타데이터 전달에 사용할 수 있다.

2026-09-10에는 489개 전체에 대한 픽셀/OCR 보조 자료와 직접 검토 대시보드를 만들었다. 이어 직접 픽셀 그룹 441개, 문구 큐가 없는 정지 이미지 119개, 문구 큐가 없는 GIF 25개를 실제 원본·근거 이미지와 대조하고, GIF 80개는 1회 루프 합산 442,580ms의 전체 시간 범위에서 장면 변화 97프레임을 추가 확인했다. 마지막 구조 보류 6건과 문자 불확실 2건도 원본으로 다시 확인해 비공개 영수증 `a1ca887fdc87a305421ca109a1c0cd689938fc89c21663d79330f1b1e2d8fafa`로 봉인했다. 이는 6,162개 모든 GIF 프레임을 각각 육안 확인했다는 뜻이 아니며, 가격·행사·A/S·스펙 문구의 현재 진실성을 승인한 것도 아니다.

이전의 “직접 픽셀 확인 322개가 남았다”는 단계와 자산별 1차 구조화는 끝났다. 최종 1차 후보는 489/489 준비·미해결 관찰 0이고, 정지 관찰 2,372건과 GIF 관찰 410건에 연결된 고유 픽셀 증거 2,279개를 원본에서 역검증했다. 이 후보의 exact bytes도 전용 1차 검토자 키로 서명했다.

489개 독립 2차 의미 확인·claim 389개·privacy 50개·GIF 80개 전체 프레임 재검토는 더 이상 내부 자료실 개방 조건이 아니다. 필요 시 감찰용 대기 큐로 보존한다. 실제 게시 단계에서는 선택 자산만 원본 문구, 가격·행사·A/S·스펙의 최신성, 개인정보를 확인한다. 재검증 전에 만든 네 handoff는 `REVOCATION.json`으로 계속 철회 상태이며 다시 사용하지 않는다.

## 1. 내부 자료실 검색·미리보기

버전 폴더와 Z 경로를 직접 찾지 않는다.

```text
npm run assets:library:internal -- --query "3연동중문 베이지 현관"
```

결과에는 원본 경로와 미리보기 주소, 내부 사용 가능 여부, 게시 전 확인 신호가 함께 나온다. 선택한 후보는 등록된 블로그 비공개 영역에 바이너리 없이 전달한다.

```text
npm run assets:library:internal -- --query "3연동ㄱ자 제품 연출 썸네일" --select-sha256 <SHA-256> --consumer munjanggun-blog --output-name <작업명>
```

`asset-handoff.json`과 `preview.html`만 생기며 `data/private/`의 Git 제외 상태를 유지한다. 이 단계는 내부 제작 참고용이고 외부 게시 승인은 아니다. CRM은 `--consumer munjanggun-crm`으로 같은 방식으로 전달한다.

소비 프로젝트와 비공개 대상 루트는 중앙의 `config/asset-library-consumers.json`에서만 승인한다. 현재 등록 대상은 블로그와 CRM이다. 임의 경로 출력은 지원하지 않으며 저장소에 추적되는 위치에는 handoff를 만들 수 없다.

## 2. 발행 authority용 기존 도구

아래 기존 도구는 완전한 발행 authority가 생겼을 때 사용하는 별도 경로다. 지금 실행하면 차단되는 것이 정상이다.

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

## 3. 내부 후보 판정 읽기

모든 내부 후보에는 `usageStatus`와 `reviewFlags`가 표시된다.

- `internalSearchPreview: usable`: 내부에서 검색하고 미리볼 수 있다.
- `externalPublication: blocked_selected_asset_review_required`: 게시할 파일로 선택한 뒤 원본·최신성·개인정보를 확인한다.
- `publicGit: blocked`: 원본을 공개 Git에 넣지 않는다.

claim·privacy 신호가 있는 자산도 내부 검색에서 숨기지 않는다. `reviewFlags`로 표시하고 실제 게시 대상이 됐을 때만 확인한다.

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
