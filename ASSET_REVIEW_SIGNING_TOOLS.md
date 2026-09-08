# 자산 내용 검토 서명 도구

이 문서는 시각 자산 재검증에 사용하는 Ed25519 검토자 키와 서명 파일을 만드는 절차만 설명한다. 서명은 검토자의 기록이 바뀌지 않았음을 확인하는 장치이며 이미지 설명의 정확성이나 발행 승인을 대신하지 않는다.

## 안전 원칙

- 키와 서명 결과는 반드시 이 공개 Git 저장소 밖의 절대 경로에 만든다.
- 개인키 파일은 Git, 로그, 채팅, 검토자 trust 파일에 넣지 않는다.
- 출력 파일이 이미 있으면 덮어쓰지 않고 실패한다.
- 한 검토자 principal에는 이번 authority에서 한 개의 키만 등록한다.
- 서로 다른 검토자는 실제로 다른 키쌍을 사용한다. PEM 줄바꿈이나 공백만 바꾼 동일 키는 canonical SPKI DER SHA-256 fingerprint가 같으므로 거부된다.

## 1. 검토자별 키 생성

검토자마다 서로 다른 비공개 폴더를 지정한다.

```powershell
npm run assets:create-reviewer-key -- `
  --output-dir "Z:\문장군_브랜드_원본보관\INTAKE-2026-09-04\content-authority-v5\reviewers\primary" `
  --principal-id "asset-reviewer-primary" `
  --key-id "asset-reviewer-primary-20260908"
```

폴더에는 다음 파일이 생긴다.

- `private-key.pem`: 외부에 공개하지 않는 PKCS#8 개인키
- `public-key.pem`: SPKI 공개키
- `reviewer-key.json`: principal, key ID, 공개키, canonical fingerprint와 파일 경로를 담은 등록 입력

CLI 출력에는 개인키 내용이 포함되지 않는다.

## 2. reviewer trust 생성

1차 검토자와 독립 2차 검토자의 `reviewer-key.json`을 함께 지정한다.

```powershell
npm run assets:build-reviewer-trust -- `
  --entry "<primary>\reviewer-key.json" `
  --entry "<independent>\reviewer-key.json" `
  --output "<private-authority>\reviewer-trust.json"
```

정규화한 principal, `keyId`, canonical SPKI fingerprint 중 하나라도 중복되면 생성하지 않는다. trust에는 공개키만 포함된다.

## 3. 검토 문서 서명

```powershell
npm run assets:sign-content-review -- `
  --input "<private-authority>\unsigned\static-001.json" `
  --private-key "<primary>\private-key.pem" `
  --key-id "asset-reviewer-primary-20260908" `
  --output "<private-authority>\signed\static-001.json"
```

서명기는 입력 JSON의 기존 `signature`를 제거한 뒤 키 순서를 안정화한 본문을 Ed25519로 서명한다. `assetContentReviewInput.v1`과 `visibleTextSecondReview.v1`은 출력 전에 정식 JSON Schema 검사도 수행한다. 다른 검토 receipt JSON도 동일한 방식으로 서명할 수 있지만, 서명 성공만으로 downstream 계약 검증을 통과한 것은 아니다.

출력 파일이 이미 있거나 개인키가 Ed25519가 아니거나 출력 경로가 공개 저장소 안이면 실패한다. 최종 authority 생성기는 reviewer trust, principal, 서명, 증거 SHA와 검토 시각을 다시 검증해야 한다.
