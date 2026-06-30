# PROOF_ASSET_INDEX - 문장군 증거 자산 색인

> 버전: v1.0
> 최종 업데이트: 2026-06-30
> 목적: 사진, 리뷰, AppSheet, 운영 증거를 원본이 아니라 비식별 색인으로 관리한다.

이 문서는 원본 파일 저장소가 아니다. 중앙 저장소에는 고객 개인정보, AppSheet 원본, 관리자 캡처, 리뷰 원문을 넣지 않는다.

## 1. 증거 자산 상태

| 상태 | 뜻 |
| --- | --- |
| `needed` | 아직 확보가 필요한 자산 |
| `candidate` | 후보는 있으나 공개 가능 여부 미확인 |
| `needs_confirmation` | 최신 정책, 기간, 조건 확인 필요 |
| `approved_public` | 공개 사용 가능 검수 완료 |
| `internal_only` | 내부 확인용. 외부 발행 금지 |
| `restricted` | 개인정보 또는 관리자 정보 포함. 중앙 원본 저장 금지 |
| `expired` | 최신성 재확인 필요 |

## 1-1. evidence_ref 원칙

AppSheet, 리뷰, 사진 원본은 중앙 저장소에 복사하지 않는다. 중앙 문서에는 공개 가능 여부를 판단할 수 있는 비식별 참조만 둔다.

권장 형식:

```text
evidence_ref: project-local opaque id
asset_id: PROOF-BEFORE-AFTER-MIDDLE-DOOR
public_scope: approved_public / candidate / needs_confirmation / internal_only / restricted / expired
privacy_checked: yes / no
claim_checked: yes / no / not_applicable
```

금지:

- AppSheet 레코드 원문
- 고객명, 상세 주소, 전화번호
- 관리자 화면 캡처
- 파일명이 고객을 식별하는 이미지명

## 2. 증거 자산 색인

| asset_id | 유형 | 증명하는 것 | 필요한 메타데이터 | 공개 가능 조건 | 현재 상태 |
| --- | --- | --- | --- | --- | --- |
| PROOF-REVIEW-ALL-COUNT | 스마트스토어 전체 상품 리뷰 수 | 전체 상품 리뷰 규모 | 기준일, 캡처일, 캡처 범위, 상품/전체 구분 | 최신 캡처 확인, 관리자 정보 제거 | `candidate` |
| PROOF-REVIEW-REP-PRODUCT | 대표 인기 상품 단일 리뷰 수 | 특정 상품의 리뷰 근거 | 상품명, 기준일, 캡처 범위 | 전체 브랜드 리뷰처럼 쓰지 않기 | `candidate` |
| PROOF-NAVER-RESERVATION | 네이버 예약 리뷰 | 방문상담/시공 경험 | 기준일, 공개 리뷰 여부 | 닉네임/개인정보 제거 | `needed` |
| PROOF-BEFORE-AFTER-MIDDLE-DOOR | 중문 Before/After 사진 묶음 | 공간 변화와 마감 | 지역 범위, 제품, 촬영 동의, 개인정보 검수 | 얼굴, 동호수, 차량번호, 송장 제거 | `needed` |
| PROOF-BEFORE-AFTER-ABS | ABS 도어 Before/After 사진 묶음 | 구축 아파트 분위기 개선 | 제품, 문짝/문틀 범위, 촬영 동의 | 가족사진, 주소표식 제거 | `needed` |
| PROOF-FIELD-OBSTACLE | 신발장/스위치/단차 현장 변수 사진 | 실측이 필요한 이유 | 변수 유형, 해결 방식, 공개 승인 | 고객 식별 불가 크롭 | `needed` |
| PROOF-FACTORY | 화성 공장/제작 과정 | 직접 제작 기반 | 촬영일, 공개 가능 구역 | 내부 도면/주문 정보 노출 금지 | `candidate` |
| PROOF-INSTALL-TEAM | 전속 시공팀 작업 장면 | 직접 시공 책임 | 촬영 동의, 얼굴 노출 여부 | 얼굴/차량번호/현장주소 제거 | `candidate` |
| PROOF-APPSHEET-WORKFLOW | AppSheet 운영 흐름 | 전산 기반 운영 체계 | 화면 유형, 공개용 재현 여부 | 원본 캡처 금지. 모의 화면 또는 비식별 다이어그램만 | `restricted` |
| PROOF-AS-PROCESS | A/S 접수와 조치 흐름 | 시공 후 관리 | 절차, 기준일, 예외 조건 | 고객 정보 없는 절차 설명 | `needed` |
| PROOF-PRICE-RANGE | 가격대/월 납입 표현 | 가격 투명성 | 기준일, 상품 범위, 결제 조건 | EVIDENCE_REGISTER와 연결 | `candidate` |
| PROOF-EVENT-INSTALLMENT | 이벤트/무이자 할부 | 결제 편의 | 기준일, 기간, 카드/플랫폼 조건 | 최신 운영 정책 확인 전 외부 발행 금지 | `needs_confirmation` |

## 3. 공개 전 검수

사진:

- 고객 얼굴 없음
- 동호수, 상세 주소, 차량번호, 택배 송장 없음
- 가족사진, 개인 소지품 노출 최소화
- Before/After 방향과 밝기 기준 확인
- `PHOTO_TREATMENT.md` 기준 통과

리뷰:

- 작성자명/닉네임 제거
- 원문 전문 저장 금지
- 인용 길이 최소화
- 상품 단일/전체 상품/예약 리뷰 범위 구분
- `EVIDENCE_REGISTER.md` 기준일 확인

운영 화면:

- AppSheet 원본 캡처 금지
- 고객명, 담당자 연락처, 주소, 견적서 세부 정보 제거
- 필요하면 공개용 모의 화면 또는 흐름 다이어그램으로 재제작

## 4. 증거 자산 생애주기

```text
needed -> candidate -> approved_public
                 -> needs_confirmation
                 -> internal_only
                 -> restricted
                 -> expired
```

`approved_public`이 아닌 자산은 발행물에 직접 사용하지 않는다.
