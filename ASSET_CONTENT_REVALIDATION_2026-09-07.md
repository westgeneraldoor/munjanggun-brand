# 2026-09-07 자산 내용 재검증 기록

> 대상: `INTAKE-20260904-01`의 고유 시각 자산 407개
> 결론: 기존 내용 태깅과 오류가 남은 `verified-v1`~`verified-v3`는 감사 이력으로만 보존하고, 원본·상품 정체성·교차상품을 독립 재검증한 `verified-v4` content authority만 적용한다.

## 발생 원인

기존 `semanticSummary`, `ocrText`, `claimSignals`는 영구 생성기가 아닌 일회성 OCR·키워드 분류 결과에서 시작됐다. 원화 기호 `₩`가 가격 판정식에서 빠졌고, `소프트아치` 같은 디자인명을 동작 표현으로 오인했다. 병합기와 완료 검사기는 내용의 원본 일치가 아니라 필드 존재와 상태값 일치만 확인해 오류를 막지 못했다.

| 원본 | 기존 오분류 | 재판독 결과 |
| --- | --- | --- |
| `3연동중문/014.png` | 유리 선택 이미지 | 3연동 디자인 10종과 60만~90만원 가격표 |
| `3연동중문/017.png` | 개폐 기능 이미지 | 아치 디자인 4종과 각 가격표 |
| `스윙중문/013.jpg` | 개폐 기능 이미지 | 스윙도어 아치 디자인 4종 안내 |
| `3연동 자동중문/020.jpg` | 일반 3연동 이미지 | 자동중문 디자인 8종과 104만·109만원 가격표 |
| `3연동 자동중문/026.png` | 일반 3연동 이미지 | 자동중문 아치 4종과 104만~119만원 가격표 |

## 재검증 범위

| 구분 | 수량 | 확인 방식 |
| --- | ---: | --- |
| 정지 이미지 | 335 | 각 원본을 전체 해상도로 직접 열어 판독 |
| GIF | 72 | 각 원본의 전체 루프를 총 605개 시간순 프레임으로 판독 |
| 합계 | 407 | 원본 경로·원본 SHA·object SHA·sourceRefs를 다시 대조 |

기존 카탈로그 대비 최종 overlay에서 `semanticSummary` 362개, OCR 322개, claim 신호 160개, 개인정보 신호 23개가 달라졌다. 고유 설명은 316개에서 405개로 늘었다. 이는 반복 템플릿 문구와 상품군 오분류를 원본별 관찰 결과로 교체한 결과다.

GIF 72개는 모두 내용 판독이 끝났다. 그중 가격·스펙·행사 등 변동 claim이 있는 64개는 내용 태깅 완료와 별개로 외부 발행 시 최신성 확인 상태를 유지한다.

## 새 통제

- 기존 catalog의 식별자, object, 원래 경로, 권리 기록은 유지한다.
- 잘못된 내용 필드는 private content overlay로만 대체한다.
- overlay는 407개 SHA를 정확히 한 번씩 포함해야 한다.
- 정지 이미지는 `full_resolution_original_reviewed`, GIF는 `full_loop_original_reviewed` 증거가 없으면 병합할 수 없다.
- 보이는 가격 문구에 가격 claim 신호가 없으면 생성이 실패한다.
- 원본 파일, object 파일, sourceRefs, review shard, 결정 해시, overlay, receipt의 연결을 검증한다.
- 단일 상품 source는 해당 상품의 필수 이름을 포함해야 하며, 교차상품은 원본에서 실제 확인되고 기존 sourceRefs와 중복되지 않을 때만 선언한다.
- 공용 ABS 이미지는 세부 서비스명으로 강제 분류하지 않는다. profile이 허용한 `ABS도어` family와 원본 판독 사유가 함께 봉인된 경우에만 generic 판정을 허용한다.
- intake profile 원본 바이트를 private authority 안에 snapshot으로 보존하고 receipt가 경로·SHA를 함께 고정한다.
- 품질 정책에 등록되지 않은 catalog는 기본 거부한다.
- 공용 검색, 직접 검색, 블로그 선택, handoff, 외부 추출은 같은 품질 게이트를 통과해야 한다.
- handoff는 호출자가 넘긴 파일 경로·출처·발행 상태를 신뢰하지 않고 검증된 overlay와 object store에서 선택 결과를 다시 구성한다.
- 기존 Z 보고서와 catalog 내용 필드는 `superseded_invalid_semantics` 감사 이력으로 보존하며 덮어쓰지 않는다.

## 봉인 기준

공개 Git에는 이미지·GIF나 private overlay를 넣지 않는다. Git에는 검증 코드, 스키마, 정책의 SHA와 운영 기록만 둔다.

- base catalog SHA-256: `523e2f50ba99e9181c5ebeb814b0af9345118aee01257204b4fa8671841ae61b`
- intake profile snapshot SHA-256: `df8160f8419de06c41ebfe134ac1da53c3707d71a73584ec6c56fbce5092371b`
- content overlay SHA-256: `a4234503b0cff596926bda06be3b8e1433621d9bc8f5739e7870efef556ef6db`
- revalidation receipt SHA-256: `f14c3fbd82e164c66cf3aa018be3129ad74d2a3191625fc0aae656c8d33cc4b3`

최종 receipt의 현재 내용 위험 신호 집계는 claim 236개, 가격 77개, 개인정보 28개다. 이는 시각 내용 태깅 집계이며 외부 발행 승인 수가 아니다. 외부 발행은 기존 권리 서명·claim 최신성·개인정보 게이트를 계속 통과해야 한다.

사용권 결정은 다시 받지 않는다. 문장군 자체 제작, 비공개 Codex 공용 소스 사용, 블로그·SNS 재사용 승인, 공개 Git 보류라는 기존 사장 지시는 그대로 유지한다. 가격·행사·스펙의 최신성 판단과 공개 Git 저장 가능 여부는 내용 정확성과 별도 상태다.
