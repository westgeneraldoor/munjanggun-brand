# 시각 자산 재검토 작업대

> 상태: 도구 준비 완료, 실제 내용 재검토 미완료, 공용 검색·추천·handoff·외부 추출 차단 유지

이 문서는 2026-09-04 묶음과 2026-09-07 쇼핑스토리 묶음을 원본 SHA 기준으로 함께 검토하는 운영 입구다. 대기열과 검토 증거는 비공개 Z 보관소에만 두며, 공개 Git에는 이미지·GIF·개인키·검토 결과를 넣지 않는다.

## 현재 확인된 범위

| 항목 | 수량 |
| --- | ---: |
| 원래 논리 경로 | 1,221 |
| 고유 시각 자산 | 489 |
| 정지 이미지 | 409 |
| 고유 GIF | 80 |
| 두 intake 사이 동일 SHA | 5 |
| 고유 GIF 디코딩 프레임 | 7,033 |
| 고유 GIF 재생시간 합계 | 442,580ms |

비공개 대기열은 `Z:\문장군_브랜드_원본보관\VISUAL-REVIEW-2026-09-08\review-queue.json`에 생성했다. 파일 SHA-256은 `884e922883efd6f2fd400c3e18fa4709068cafbd1521c1a94694c9be78497390`, 대기열 내부 entry 집합 SHA-256은 `6fd0f3e00125e98c923d121407782183e8097b020b86ab11f81398cc6274d906`이다.

이 숫자는 원본 경로·크기·SHA와 GIF 디코딩 메타데이터를 확인한 결과다. 이미지 설명의 정확성이나 GIF 전체 재생 관찰 완료를 뜻하지 않는다.

## 실행 순서

1. `assets:build-visual-review-queue`로 각 catalog와 raw root를 같은 순서로 연결해 대기열을 만든다. 기존 출력은 덮어쓰지 않는다.
2. 1차·2차 검토자는 `ASSET_REVIEW_SIGNING_TOOLS.md`에 따라 서로 다른 Ed25519 키를 만든다.
3. 정지 이미지는 원본 전체 픽셀 타일을 확인하고, 보이는 문구와 설명을 원본 픽셀 근거에 연결한다.
4. GIF는 `assets:review-gif-playback`에서 0ms부터 한 주기를 자연속도로 연속 관찰한다. 표본 프레임만 본 것은 완료로 기록하지 않는다.
5. 2차 검토자가 원본을 독립 확인한 뒤 1차 결정과 일치하는 경우에만 별도 서명 verdict를 만든다.
6. 불확실 항목이 하나라도 있으면 `verified`로 승격하지 않고 `needs_escalation`으로 남긴다.
7. 두 intake의 전체 대상과 증거가 완성된 뒤에만 `content-evidence-v4` authority를 새로 봉인하고 소비 단계에서 다시 검증한다.

## 정지 이미지 타일 증거 예시

한 자산씩 생성하는 것이 기본이다. `--all-static`은 저장 공간과 작업 범위를 확인한 뒤 명시적으로 사용할 때만 허용된다.

```powershell
npm run assets:generate-static-tiles -- `
  --queue "Z:\문장군_브랜드_원본보관\VISUAL-REVIEW-2026-09-08\review-queue.json" `
  --queue-sha256 "884e922883efd6f2fd400c3e18fa4709068cafbd1521c1a94694c9be78497390" `
  --sha256 "<검토할 원본 SHA-256>" `
  --output-root "Z:\문장군_브랜드_원본보관\VISUAL-REVIEW-2026-09-08\static-evidence\<SHA-256>"
```

생성기는 대기열과 모든 원본 경로의 크기·SHA를 다시 확인하고, 원본 전체 픽셀을 겹침 없이 정확히 한 번 덮는 canonical PNG 타일과 manifest를 만든다. 출력은 Z 드라이브 하위만 허용하며 기존 폴더는 덮어쓰지 않는다. `--inventory`는 쓰기 없이 대상만 열거하고, `--dry-run`은 원본 재해시·디코딩까지 수행하되 파일을 만들지 않는다.

## GIF 작업대 예시

```powershell
npm run assets:review-gif-playback -- `
  --queue "Z:\문장군_브랜드_원본보관\VISUAL-REVIEW-2026-09-08\review-queue.json" `
  --reviewer "asset-reviewer-primary" `
  --evidence-root-for "INTAKE-20260904-01=Z:\문장군_브랜드_원본보관\INTAKE-2026-09-04\content-authority-v5\evidence" `
  --evidence-root-for "INTAKE-20260907-01=Z:\문장군_브랜드_원본보관\INTAKE-2026-09-07-01\content-authority-v2\evidence"
```

작업대는 `127.0.0.1`에만 열린다. 창 숨김, 포커스 이탈, seek, reload, 재생 오류, heartbeat 단절, 실제 재생시간 부족이 있으면 완료 영수증을 거부한다. 영수증 생성은 사람이 내용을 정확히 판독했다는 자동 보증이 아니므로 판독 메모와 독립 2차 검토가 별도로 필요하다.

## 완료와 금지

- 검토 도구 테스트 통과를 실제 검토 완료로 보고하지 않는다.
- 대기열 생성과 GIF 디코딩 성공을 전체 재생 관찰로 보고하지 않는다.
- 검토자의 이름만 바꿔 2차 검토자로 등록하지 않는다. principal과 canonical 공개키 fingerprint가 모두 달라야 한다.
- 기존 v1~v4 내용 결과를 새 판정으로 복사하지 않는다.
- 실제 `content-evidence-v4` 봉인과 품질 정책 전환 전에는 공용 자료실을 재개하지 않는다.
