# 문장군 디자인 빠른 적용

> 기준 문서: `DESIGN.md` v5.0 Editorial Showroom

## 먼저 지킬 것

- 핵심 한 줄: `좋은 문을 고르는 일, 어렵지 않게 도와드립니다.`
- Ink를 주요 정보와 CTA에, Forest를 상담·도움·포커스에 사용합니다.
- 한글 헤드라인과 타입 락업은 Tmoney RoundWind ExtraBold, 본문과 UI는 Pretendard를 사용합니다.
- 그래픽 마크를 임의로 만들지 않고 `문장군 / MUNJANGGUN` 타입 락업을 사용합니다.
- 무료 방문실측은 선택과 가격 불안을 줄이는 상담입니다. 자동 견적이나 최종 선택처럼 말하지 않습니다.

## 권위 경계

중앙 브랜드는 시각·브랜드·공통 컴포넌트 계약만 관리한다. 실제 화면, URL, 메뉴, 정보구조, 고객 여정, CTA 연결은 하위 프로젝트 권한이다.

플레이그라운드는 제품 시안이나 구현 오더가 아니다. 서비스 프로젝트는 플레이그라운드 화면을 복사하지 않고 토큰과 공통 컴포넌트 계약만 적용한다.

## 구현 순서

```text
DESIGN.md
→ tokens/brand.tokens.json
→ tokens/brand.css
→ BRAND_GUIDELINE.html
→ design-system/playground/
```

화면은 primitive 값을 직접 쓰지 말고 semantic 또는 component 토큰을 사용합니다. 라이트·다크 테마는 `data-mg-theme="light|dark"`로 전환합니다.

## 화면 체크

- 큰 한글 제목, 넓은 여백, 실제 주거 이미지, 단정한 카드 경계를 사용했는가
- 모바일 메뉴와 모든 실제 클릭 요소가 44px 이상인가
- focus-visible, skip link, reduced-motion을 제공하는가
- 오류와 성공을 색뿐 아니라 텍스트·아이콘·ARIA로 전달하는가
- 근거 없는 최고·최저가·연락 기한·자동 확정 표현이 없는가
- raw HEX, rgba, 반복 px 대신 토큰을 사용했는가

사진과 자산은 `PHOTO_TREATMENT.md`, `SOURCE_REGISTRY.md`, `ASSET_SEMANTIC_INDEX.md`, 상품별 manifest를 함께 확인합니다.
