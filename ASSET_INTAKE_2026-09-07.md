# 2026-09-07 쇼핑스토리 자산 intake 상태

> intake: `INTAKE-20260907-01`
>
> 현재 상태: Z 단일 복구본·receipt·candidate manifest·object 중복 제거·URL 연결·비공개 시각 후보 판독 완료 / 운영 권위 봉인 보류
>
> 외부 발행과 공개 Git: 차단

## 입수 위치와 범위

사용자가 지정한 `C:\Users\hjh\안티그래비티\문장군\_브랜드\문장군상품\신규`는 확인 시점에 존재하지 않았다. 실제 자료는 `C:\Users\hjh\안티그래비티\문장군_브랜드\문장군상품\신규\쇼핑스토리`에서 확인했다. 경로 차이를 숨기지 않고 intake 증거에 함께 기록했다.

- 전체 106파일, 65,400,694바이트
- 운영 대상 97파일, `Thumbs.db` 9파일은 `ignored_system_cache`
- 시각 자산 87개: JPG 74개, GIF 13개
- 네이버 쇼핑스토리 바로가기 10개
- intake 내부 SHA-256 완전 중복 0개
- 조사 시작·종료 스냅샷의 파일 수·바이트·목록 해시 변화 0

## 보존과 실물 관리

사장 지시에 따라 복구 원본은 Z 한 곳에만 둔다.

```text
Z:\문장군_브랜드_원본보관\INTAKE-2026-09-07-01\raw
Z:\문장군_브랜드_원본보관\INTAKE-2026-09-07-01\receipt.json
```

원본과 Z 복구본은 106파일·65,400,694바이트·tree hash `257bf1ac60d94d00642b088fea9f3a6e32e3dfb8a0ed9f846bc170914f7ecd3b`으로 일치했다. 로컬 `신규` 폴더는 아직 유지하며 삭제·이동하지 않는다.

candidate는 Z에 메타데이터만 생성한다. 이미지·GIF 실물은 기존 private object store에 SHA-256 단일 object로 연결했다.

- 신규 시각 경로: 87
- 기존 object와 동일: 5
- 새 object: 82
- 전체 private object: 450 → 532
- 기존 5개를 재복사하지 않아 9,324,688바이트 중복을 피함

## 자료 구성

쇼핑스토리 아래 9개 주제 묶음이다.

- 도서 기부 캠페인과 후기
- CS 교육
- 브랜드 가치
- 본사 직영 시공팀
- 지역별 출장비
- 디지털 보증서
- 12개월 무이자 할부
- 맞춤 견적 상담
- 포토리뷰 이벤트

가격·이벤트·출장비·보증 기간·할부 조건·0원/무료 표현은 변동 claim이다. 이미지가 문장군 자체제작이고 블로그·SNS 재사용 승인을 받았더라도 게시 시점의 최신성 확인은 별도다.

## URL 확인

`.url` 10개는 2026-09-07 네이버 쇼핑스토리 화면에서 읽기 전용으로 열어 제목과 주제 폴더 연결을 확인했다. URL 접근 확인은 캠페인·가격·혜택·보증·출장비 내용의 최신 승인과 다르다.

## 권리와 사용 상태

기존 사장 지시는 이번 추가 자료에도 같은 운영 원칙으로 적용한다.

- 문장군 내부 자체제작 자료
- 회사 비공개 보존 승인
- 문장군 비공개 Codex 프로젝트의 공용 소스 사용 승인
- 블로그·SNS 재사용 승인
- 사장 차원의 별도 인물·후기 제한 없음
- 공개 Git 원본 저장은 보류

현재 candidate는 아직 시각 내용 authority가 아니다. 개별 이미지·GIF의 실제 visible text, 디자인 구성, 검색 용도, claim·개인정보 신호를 원본에서 판독하고 새 증거 계약을 통과하기 전까지 검색·handoff·외부 추출에 연결하지 않는다.

## 비공개 시각 후보 재검토 결과

정지 이미지 74개는 두 묶음으로 판독·교차검증했다. 74개 SHA·인덱스·원본 경로·크기·카탈로그 연결 불일치가 모두 0이며, 74개 모두 `reviewed_original_semantics_private_candidate`다.

- `review-part-001-037.json`: SHA-256 `27c6de35c1e0c5161432665873e7237e00cd18e30ccbfe67d0ae9954bbf9a3be`
- `review-part-038-074.json`: SHA-256 `6b6c77d489a0ddf356f346597d714f4e4f4a7dda18b56a80dcb8d7c811512069`
- claim 증빙 포함 66개·태그 110건, 개인정보 가능성 신호 포함 18개·신호 23건, 불확실성 포함 46개·기록 63건
- `ABS도어`의 `AS`나 경로명의 `원`만으로 A/S·가격 태그를 붙인 항목 0개

GIF 13개는 원본 982프레임·40,610ms를 도구로 디코딩했으며 Pillow·gifuct-js·ffprobe 간 수치 불일치가 0이다. 사람이 확인한 범위는 균등 표본 130장(고유 프레임 121개)과 보조 표본 78장이다. 전체 프레임이나 전체 연속 재생을 확인했다고 간주하지 않는다.

- `review-part-001-007.json`: SHA-256 `0af6d199fdb96ffb12379aec88c0f297d4a71e3a731352ce69ee4e7bf0320c5c`
- `review-part-008-013.json`: SHA-256 `eb4913c04ac3f3145be231e2e90acbbb9148c38634e9ddd7cd320440de7f6a7f`
- `fullPlaybackObserved: true` 0개, `allFramesObserved: true` 0개
- 13개 모두 `sampled_only_needs_escalation`
- 1~7번의 잘못 생성된 표본 PNG 픽셀 13건은 같은 디코더의 canonical RGBA PNG로 다시 만들고 최종 byte/pixel 불일치 0을 확인

위 결과는 내용 검색용 비공개 후보일 뿐이다. 1차 판독 원문 서명, 모든 자산의 독립 2차 의미 판정, 정지 이미지 native-resolution 전체 타일 커버리지, 민감 문구의 독립 2차 서명, GIF 전체 재생 증거를 포함한 `content-evidence-v4` authority로 봉인되지 않았으므로 공용 검색·handoff·외부 추출 차단을 유지한다.

## 완료 기준

- Z receipt와 live source 불일치 0
- 시각 경로 87개 manifest 연결
- private object 87개 해시 검증
- 정지 이미지 74개 전체 해상도 후보 판독 완료, 운영 권위 봉인은 보류
- GIF 13개 decoded frame metadata와 표본 판독 범위 분리 기록 완료, 전체 재생 검토는 보류
- visible text와 source context·추론 문구 분리
- 가격·A/S·보증·행사 등 민감 태그에 픽셀 근거 연결
- URL 10개 접근·제목·주제 연결 기록
- 검토 시각이 봉인 시각보다 늦은 항목 0
- 미판정 항목은 `needs_review` 또는 `sampled_only_needs_escalation`으로 명시
- 공개 Git 바이너리 0
