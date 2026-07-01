# PROOF_ASSET_INDEX - 문장군 증거 자산 색인

> 버전: v1.2
> 최종 업데이트: 2026-07-01
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
| PROOF-BRANDSTORE-PRODUCT-EXPORT-2026-06-30 | 사용자 제공 스마트스토어 상품 CSV export | 공개 판매 상품군, 기준 판매가, 할인가, 배송/반품 조건 후보 | export일, 판매상태, 전시상태, 판매가, 할인가, 상품군 | 원본 CSV는 중앙 저장소에 저장하지 않고 비식별 요약만 사용 | `candidate` |
| PROOF-BRANDSTORE-PRODUCT-SCREENSHOT-2026-06-30 | 사용자 제공 브랜드스토어 전체상품 화면 캡처 2장 | 화면상 리뷰 수 후보와 상품 노출 확인 | 캡처일, 보이는 상품 수, 상품별 리뷰 수 | 원본 이미지는 중앙 저장소에 저장하지 않고 비식별 요약만 사용 | `candidate` |
| PROOF-BRANDSTORE-THUMBNAILS-2026-06-30 | 공개 판매 상품 14개 대표 썸네일 | 상품군 식별, 웹앱/카드뉴스/디자인 시안 기준 이미지 | CSV 대표이미지 URL, localPath, 상품 코드, 전시/판매 상태 | 발행 전 최신 노출 상태와 사용 허용 범위 확인 | `candidate` |
| PROOF-3PANEL-DETAILPAGE-ASSETS-2026-06-30 | 3연동중문 상세페이지 이미지/GIF 원본 묶음 v1 | 상품 구조, 컬렉션별 차이, 컬러/유리 옵션, 상세페이지 흐름의 이전 스냅샷 | 132개 기준 문서 스냅샷 | 2026-07-01 교체본으로 대체. 신규 발행 기준으로 직접 사용하지 않음 | `expired` |
| PROOF-3PANEL-DETAILPAGE-ASSETS-2026-07-01 | 3연동중문 상세페이지 이미지/GIF 교체본 v2 | 상품 구조, 컬렉션별 차이, 컬러/유리 옵션, 상세페이지 흐름 | 폴더 역할, 순서, 규격, GIF 프레임, 해시, claim risk | 공식 제작 자산이므로 개인정보 OCR 재검수 대상 아님. 가격/이벤트/옵션/스펙 문구는 원본 맥락 밖 재사용 전 최신성 확인 | `candidate` |
| PROOF-ONESLIDING-DETAILPAGE-ASSETS-2026-07-01 | 원슬라이딩중문 상세페이지 이미지/GIF 원본 묶음 | 단독 슬라이딩 구조, 4컬렉션, 컬러/유리 옵션, 상세페이지 흐름 | 폴더 역할, 순서, 규격, GIF 프레임, 해시, claim risk | 공식 제작 자산이므로 개인정보 OCR 재검수 대상 아님. 가격/이벤트/옵션/스펙 문구는 원본 맥락 밖 재사용 전 최신성 확인 | `candidate` |
| PROOF-3PANEL-AUTO-DETAILPAGE-ASSETS-2026-07-01 | 3연동 자동중문 상세페이지 이미지/GIF 원본 묶음 | 자동 개폐, 전원/센서/유지관리, 컬러/유리 옵션, 상세페이지 흐름 | 폴더 역할, 순서, 규격, GIF 프레임, 해시, claim risk | 공식 제작 자산이므로 개인정보 OCR 재검수 대상 아님. 자동 기능/가격/이벤트/옵션 문구는 원본 맥락 밖 재사용 전 최신성 확인 | `candidate` |
| PROOF-3PANEL-LSHAPE-DETAILPAGE-ASSETS-2026-07-01 | 3연동 ㄱ자 중문 상세페이지 이미지/GIF 원본 묶음 | ㄱ자 구조, 코너/가벽/보강 변수, 컬러/유리 옵션, 상세페이지 흐름 | 폴더 역할, 순서, 규격, GIF 프레임, 해시, claim risk | 공식 제작 자산이므로 개인정보 OCR 재검수 대상 아님. 특수 구조/보강/가격/이벤트 문구는 원본 맥락 밖 재사용 전 최신성 확인 | `candidate` |
| PROOF-ABS-DOOR-REPLACEMENT-DETAILPAGE-ASSETS-2026-07-01 | ABS도어 방문교체 상세페이지 이미지/GIF 원본 묶음 | 문짝교체, 문짝+문틀, 슬림 문선, 필름 세트, 컬러/디자인 옵션 | 폴더 역할, 순서, 규격, GIF 프레임, 해시, claim risk | 공식 제작 자산이므로 개인정보 OCR 재검수 대상 아님. 패키지 구성/가격/시공 범위 문구는 원본 맥락 밖 재사용 전 최신성 확인 | `candidate` |
| PROOF-SWING-DETAILPAGE-ASSETS-2026-07-01 | 스윙중문 상세페이지 이미지/GIF 원본 묶음 | 여닫이 동선, 문 열림 방향, 컬러/유리/디자인 옵션, 상세페이지 흐름 | 폴더 역할, 순서, 규격, GIF 프레임, 해시, claim risk | 공식 제작 자산이므로 개인정보 OCR 재검수 대상 아님. 문 열림 조건/가격/이벤트/옵션 문구는 원본 맥락 밖 재사용 전 최신성 확인 | `candidate` |
| PROOF-WIDE-SLIDING-DETAILPAGE-ASSETS-2026-07-01 | 양개형중문/미서기 상세페이지 이미지/GIF 원본 묶음 | 넓은 개구부, 3연동 양개, 4연동, 미서기 양개, 미서기 중문, 상세페이지 흐름 | 폴더 역할, 순서, 규격, GIF 프레임, 해시, claim risk | 공식 제작 자산이므로 개인정보 OCR 재검수 대상 아님. 폭/구조/가격/이벤트/옵션 문구는 원본 맥락 밖 재사용 전 최신성 확인 | `candidate` |
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
