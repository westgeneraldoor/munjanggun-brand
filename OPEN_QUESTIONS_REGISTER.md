# OPEN_QUESTIONS_REGISTER - 문장군 확인 필요 항목

> 버전: v1.0
> 최종 업데이트: 2026-06-30
> 목적: 사장 확인, 최신 캡처, 운영 정책 확인이 필요한 브랜드 항목을 중앙에서 추적한다.

이 문서는 발행 가능한 브랜드 기준이 아니다. 여기에 있는 항목은 확인 전 외부 발행물에서 단정하지 않는다.

## 상태값

| 상태 | 뜻 |
| --- | --- |
| `open` | 확인 필요 |
| `in_review` | 확인 중 |
| `resolved` | 중앙 문서 반영 완료 |
| `deferred` | 지금은 보류 |

## 확인 필요 항목

| id | 항목 | 왜 중요한가 | 현재 임시 기준 | 필요한 확인 | 연결 문서 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| OQ-001 | 최신 전체 상품 리뷰 수 | 리뷰 수는 신뢰 근거지만 변동 claim | 2026-06 기준 후보 수치만 존재 | 최신 스마트스토어 캡처와 범위 확인 | EVIDENCE_REGISTER.md, REVIEW_PROOF_BANK.md | `open` |
| OQ-002 | 대표 상품 단일 리뷰 수 | 전체 브랜드 리뷰와 혼동 위험 | 대표 상품 단일 근거로만 사용 | 상품명, 기준일, 캡처 범위 확인 | EVIDENCE_REGISTER.md | `open` |
| OQ-003 | 네이버 예약 리뷰 수 | 연계 프로젝트 레거시 숫자 존재 | 숫자 사용 금지 | 최신 공개 근거 확인 | EVIDENCE_REGISTER.md | `open` |
| OQ-004 | A/S 무상 범위와 제외 조건 | 기간만 말하면 과장될 수 있음 | 도어 3년, 중문 2년 기준은 candidate | 제품/시공 범위별 예외와 접수 절차 확인 | FAQ_OBJECTION_BANK.md, EVIDENCE_REGISTER.md | `open` |
| OQ-005 | 중문 제작 후 시공 일정 | 중앙 3~4일과 일부 프로젝트 4~6일 충돌 | 상담 시 최신 확인 | 현재 운영 기준과 예외 확인 | EVIDENCE_REGISTER.md, FAQ_OBJECTION_BANK.md | `open` |
| OQ-006 | 특수 구조 시공 시간 | 일반 2~3시간과 철거/ㄱ자/보강 시간이 다름 | 일반 중문만 2~3시간 | 철거, ㄱ자, 보강별 안내 범위 확인 | EVIDENCE_REGISTER.md | `open` |
| OQ-007 | 서비스 가능 지역 | 모든 지역 가능 단정 위험 | 큰 지역명 기준 상담 확인 | 가능 지역, 먼 지역 추가금, 지방 기준 확인 | EVIDENCE_REGISTER.md | `open` |
| OQ-008 | 무이자 할부/결제 혜택 | 기간/카드/플랫폼 조건 변동 | 발행 금지 | 최신 정책과 사용 가능 문구 확인 | EVIDENCE_REGISTER.md, COPY_ASSET_BANK.md | `open` |
| OQ-009 | 리뷰 이벤트 조건 | 이벤트는 변동 가능 | 구체 혜택 발행 금지 | 기간, 혜택, 참여 조건 확인 | EVIDENCE_REGISTER.md | `open` |
| OQ-010 | 보양/청소 표현 허용 범위 | 중앙 금지 표현과 현장 안내가 충돌할 수 있음 | "시공 자리 정리/작업 동선 안내"만 사용 | 실제 제공 범위와 금지 문구 확정 | FAQ_OBJECTION_BANK.md, EVIDENCE_REGISTER.md | `open` |
| OQ-011 | 현관문/기타 시공 운영 범위 | 제품 범위에는 있으나 프로젝트별 확인 필요 | 핵심 서비스처럼 전면 사용 금지 | 현재 취급 여부와 조건 확인 | PRODUCT_SELECTION_GUIDE.md | `open` |
| OQ-012 | 공개 가능한 사진/리뷰 승인 흐름 | 원료 은행이 실제 증거 없이 약해질 수 있음 | 원본 중앙 저장 금지 | 승인자, 보관 위치, evidence_ref 방식 확인 | PROOF_ASSET_INDEX.md, PHOTO_TREATMENT.md | `open` |

## 처리 규칙

1. 확인된 항목은 관련 중앙 문서와 `CHANGELOG.md`를 함께 갱신한다.
2. 변동 claim이면 `EVIDENCE_REGISTER.md`의 상태와 기준일도 갱신한다.
3. 프로젝트에서 발견된 새 확인 필요 항목은 바로 중앙 기준으로 쓰지 않고 이 문서에 먼저 등록한다.
4. `resolved`가 되기 전까지는 카피 은행에서 `publishable` 문장으로 만들지 않는다.
