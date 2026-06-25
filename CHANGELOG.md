# CHANGELOG - 문장군 중앙 브랜드 문서

## v3.0 - 2026-06-25

- DESIGN.md v3.0 고도화
  - A 색감 + B 문구/구조 + B 타이포그래피 승인 방향 반영
  - 코코아 오크, 클레이 테라코타, 캐시미어 크림, 토스티드 아몬드, 검증 네이비 기반 팔레트 재정의
  - Noto Serif KR은 히어로/섹션 제목 중심, 본문/UI는 Pretendard 또는 Noto Sans KR 유지
  - 표면 모드 추가: Cream Canvas, Paper Card, Almond Band, Cocoa Trust Surface, Verified Navy Surface, Terracotta Callout
  - Proof Panel 컴포넌트 추가
  - 모바일 타이포그래피, 버튼/폼 상태, 이미지 비율·크롭 기준 토큰 보강
  - 기존 네이비 중심 신뢰 구조를 검증/전산/운영 보조색으로 제한
- 공식 브랜드 핵심 문장과 디자인/히어로 변형 문장의 역할 분리
- preview.html v3.0 제작
  - 히어로, 팔레트, Surface Modes, 타이포그래피, Proof Panel, 상담/가격 컴포넌트, 이미지 크롭 기준을 브라우저에서 확인할 수 있는 정적 미리보기로 구현
- Claude DESIGN 문서 구조를 벤치마킹하되 문장군 도어·중문 시공 브랜드에 맞게 재해석

## v2.2 - 2026-06-25

- AGENTS.md 추가
  - 중앙 브랜드 책임자 역할, 작업 전 필수 읽기 순서, 중앙 원본 권위, 금지 표현, 민감 정보 처리, 서브에이전트 운용, 변경 절차 정리
- TEAM.md 추가
  - 브랜드 책임자, 리서치, 브랜드 전략, 현장 판단, 카피/콘텐츠, 디자인, 검수, 연계 프로젝트 운영 역할 정의
- PROJECT_RELATIONSHIP_AUDIT_2026-06-25.md 추가
  - `munjanggun`, `문장군블로그`, `문장군 인스타그램`, `문장군 컨텐츠`, `문장군_디자인`, `문장군 릴스 엔진`, `문장군 시공릴스`, `Virtual Studio`, `backup`, `open-design` 연계 상태 조사
  - 중앙 브리지 보강 필요 프로젝트와 운영 리스크 정리
- README.md 메타와 파일 구성 갱신
- PROMPTS.md 메타를 현재 내용 기준으로 갱신

## v2.1 - 2026-06-25

- FIELD_JUDGMENT_RULES.md 추가
  - 2026-06-25 사장 인터뷰 기반 고객 오해, 무료 방문 실측, 중문 구조별 가능 범위, 견적 변수, 셀프중문/자재판매, 9mm/12mm 문선, ABS도어/방문교체, 거주중 시공, AppSheet 현장 활용 기준 정리
- PROJECT_ADAPTERS.md 추가
  - 중앙 브랜드 원본과 프로젝트별 어댑터를 분리하는 운영 방식 확정
  - 블로그, 인스타그램, 릴스, 웹앱 등 채널별 규칙은 중앙 원본에 섞지 않고 프로젝트 어댑터로 관리
- README.md 파일 구성과 참조 경로 갱신
- PROMPTS.md 프로젝트 총괄 적용 프롬프트 갱신
  - 중앙 FIELD_JUDGMENT_RULES.md 참조 추가
  - 블로그 프로젝트는 docs/brand/BRAND_SOURCE.md와 BLOG_BRAND_ADAPTER.md를 우선 확인하도록 보강

## v2.0 - 2026-06-15

- DESIGN.md 전면 재작성
- GitHub 공개 DESIGN.md 사례와 Google DESIGN.md 형식 벤치마킹 반영
- YAML front matter 기반 디자인 토큰 추가
  - colors
  - typography
  - rounded
  - spacing
  - components
- 한글/영문 브랜드명 표기 기준 추가
  - `문장군`
  - `MUNJANGGUN`
  - `munjanggun`
- 서체 체계 강화
  - Korean Brand / Display: Paperlogy 권장
  - Korean UI / Body: Pretendard Variable
  - English / Number: Manrope
- 색상 체계 재정의
  - Warm canvas, oak, sage, brass, navy 역할 분리
  - 네이비 사용 비율과 금지 기준 추가
- 컴포넌트 기준 확장
  - 버튼
  - 신뢰 배지
  - 고민 선택 컴포넌트
  - 분위기 선택 컴포넌트
  - 시공 사례 카드
  - 리뷰 카드
  - 가격 안내 박스
  - 실측 상담 흐름
  - FAQ
  - 블로그 썸네일
  - 인스타 카드뉴스
- 기존 preview.html은 v1.0 기준이므로 v2.0 기준 재제작 필요

## v1.0 - 2026-06-15

- 문장군 중앙 브랜드 원본 최초 정리
- BRAND_CONTEXT.md 생성
- DESIGN.md 생성
- README.md 생성
- PROMPTS.md 생성
- 기존 프로젝트별 BRAND_CONTEXT를 직접 수정하지 않고 중앙 원본 참조 구조로 전환하는 운영 원칙 수립
- 2026-06 스마트스토어 전체상품 캡처 기준으로 리뷰 표현 정정
  - 전체 상품 리뷰 3만 개+
  - 대표 인기 상품 단일 리뷰 1.4만 개+
  - 기존 "리뷰 15,000개+" 표현은 전체 브랜드 리뷰 표현으로 사용하지 않도록 정리
- 브랜드 핵심 정체성 확정
  - 문장군은 무료 방문실측으로 집에 맞는 선택을 돕고, 직접 제작과 전속 시공으로 끝까지 책임지는 도어·중문 전문 브랜드다.
- 디자인 방향 확정
  - 따뜻한 주거 전문가
  - 규모 있는 시스템형 전문 브랜드
  - 밝은 주거 공간 속 제품 이미지 중심
  - 네이비는 신뢰 포인트로 제한 사용
