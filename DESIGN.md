---
version: v3.0
name: MUNJANGGUN
description: 문장군 중앙 브랜드 디자인 시스템. 따뜻한 장인성과 정확한 상담 신뢰를 함께 구현한다.
colors:
  cocoa-oak: "#2C221E"
  clay-terracotta: "#B35D43"
  cashmere-cream: "#F5EFE6"
  toasted-almond: "#C5B9A5"
  verified-navy: "#1D3858"
  paper-white: "#FFFCF7"
  warm-line: "#E2D7C8"
  warm-line-strong: "#C5B9A5"
  ink-warm: "#171512"
  body-warm: "#443B34"
  muted-warm: "#6B6259"
  cream-soft: "#FAF7F0"
  almond-soft: "#EFE6DA"
  navy-soft: "#E7EEF5"
  caution-red: "#C74332"
  success-green: "#5C8A62"
  on-dark: "#FFFCF7"
  on-terracotta: "#FFFFFF"
typography:
  brand-ko:
    fontFamily: "Noto Serif KR, Song Myung, Noto Serif CJK KR, serif"
    fontSize: 42px
    mobileFontSize: 30px
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: 0
  brand-en:
    fontFamily: "Manrope, Inter, system-ui, sans-serif"
    fontSize: 16px
    mobileFontSize: 13px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: 0
  display-hero:
    fontFamily: "Noto Serif KR, Song Myung, Noto Serif CJK KR, serif"
    fontSize: 56px
    mobileFontSize: 34px
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: 0
  display-section:
    fontFamily: "Noto Serif KR, Song Myung, Noto Serif CJK KR, serif"
    fontSize: 40px
    mobileFontSize: 29px
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: 0
  display-card:
    fontFamily: "Noto Serif KR, Song Myung, Noto Serif CJK KR, serif"
    fontSize: 24px
    mobileFontSize: 21px
    fontWeight: 700
    lineHeight: 1.34
    letterSpacing: 0
  body:
    fontFamily: "Pretendard, Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 16px
    mobileFontSize: 15px
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: 0
  body-strong:
    fontFamily: "Pretendard, Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 16px
    mobileFontSize: 15px
    fontWeight: 650
    lineHeight: 1.62
    letterSpacing: 0
  label:
    fontFamily: "Manrope, Pretendard, Inter, system-ui, sans-serif"
    fontSize: 13px
    mobileFontSize: 12px
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: 0
  caption:
    fontFamily: "Pretendard, Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 13px
    mobileFontSize: 12px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  metric:
    fontFamily: "Manrope, Inter, Pretendard, system-ui, sans-serif"
    fontSize: 34px
    mobileFontSize: 28px
    fontWeight: 850
    lineHeight: 1
    letterSpacing: 0
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  full: 999px
spacing:
  xs: 6px
  sm: 10px
  md: 16px
  lg: 24px
  xl: 36px
  xxl: 56px
  section: 88px
components:
  button-primary:
    backgroundColor: "{colors.clay-terracotta}"
    textColor: "{colors.on-terracotta}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: 14px 20px
    height: 50px
    states:
      hover:
        backgroundColor: "#9E4F39"
        transform: "translateY(-1px)"
      focus:
        outline: "2px solid {colors.clay-terracotta}"
        outlineOffset: 3px
      disabled:
        backgroundColor: "{colors.warm-line}"
        textColor: "{colors.muted-warm}"
        cursor: not-allowed
      loading:
        backgroundColor: "{colors.clay-terracotta}"
        textColor: "{colors.on-terracotta}"
  button-secondary:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.cocoa-oak}"
    borderColor: "{colors.warm-line}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: 14px 20px
    height: 50px
    states:
      hover:
        backgroundColor: "{colors.cream-soft}"
        borderColor: "{colors.warm-line-strong}"
      focus:
        outline: "2px solid {colors.cocoa-oak}"
        outlineOffset: 3px
      disabled:
        backgroundColor: "{colors.cream-soft}"
        textColor: "{colors.muted-warm}"
        borderColor: "{colors.warm-line}"
        cursor: not-allowed
  trust-badge:
    backgroundColor: "{colors.cocoa-oak}"
    textColor: "{colors.cashmere-cream}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 8px 12px
  proof-panel:
    backgroundColor: "{colors.cocoa-oak}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 24px
  price-box:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-warm}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 24px
  review-stat:
    backgroundColor: "{colors.navy-soft}"
    textColor: "{colors.verified-navy}"
    typography: "{typography.metric}"
    rounded: "{rounded.md}"
    padding: 18px
  terracotta-callout:
    backgroundColor: "{colors.clay-terracotta}"
    textColor: "{colors.on-terracotta}"
    typography: "{typography.display-card}"
    rounded: "{rounded.lg}"
    padding: 40px
  form-field:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-warm}"
    borderColor: "{colors.warm-line}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 48px
    padding: 12px 14px
    states:
      focus:
        borderColor: "{colors.clay-terracotta}"
        outline: "2px solid {colors.clay-terracotta}"
        outlineOffset: 2px
      error:
        borderColor: "{colors.caution-red}"
        textColor: "{colors.ink-warm}"
      disabled:
        backgroundColor: "{colors.cream-soft}"
        textColor: "{colors.muted-warm}"
        cursor: not-allowed
  error-message:
    textColor: "{colors.caution-red}"
    typography: "{typography.caption}"
  disabled:
    backgroundColor: "{colors.warm-line}"
    textColor: "{colors.muted-warm}"
media:
  heroImage:
    aspectRatio: "16 / 10"
    mobileAspectRatio: "4 / 5"
    minWidth: 1600px
    minHeight: 1000px
    focalPoint: "door-or-partition plus surrounding interior"
    safeTextArea: "left or right 42% on desktop, top 35% on mobile"
  caseCardImage:
    aspectRatio: "4 / 3"
    minWidth: 1200px
    minHeight: 900px
    focalPoint: "finished door or partition with floor and wall context"
  blogThumbnail:
    aspectRatio: "16 / 9"
    minWidth: 1280px
    minHeight: 720px
    focalPoint: "product, before-after difference, or clear home mood"
    safeTextArea: "outer 12% padding kept free from key product details"
---

# DESIGN - 문장군

> 버전: v3.0  
> 최종 업데이트: 2026-06-29
> 변경 요약: A 색감 + B 문구/구조 + B 타이포그래피 기반 디자인 시스템 고도화, 미디어 토큰 focalPoint 동기화
> 기준: 중앙 BRAND_CONTEXT.md, FIELD_JUDGMENT_RULES.md, 2026-06-25 디자인 상담, Claude DESIGN 문서 구조 벤치마킹

## Overview

문장군 디자인은 "좋은 문을 고르는 일"을 고객이 혼자 감당하지 않도록, 따뜻한 첫인상과 정확한 판단 근거를 함께 보여주는 시스템이다.

공식 브랜드 핵심 문장:

```text
좋은 문을 고르는 일,
어렵지 않게 도와드립니다.
```

디자인/히어로 변형 문장:

```text
좋은 문을 고르는 일,
따뜻하게 정확하게
```

변형 문장은 디자인 캠페인, 랜딩 히어로, 섹션 대표 카피에서 사용할 수 있지만 중앙 브랜드의 공식 한 줄을 대체하지 않는다.

문장군은 감성 인테리어 브랜드처럼만 보여도 안 되고, 투박한 시공업체처럼 보여도 안 된다. 첫 화면에서는 "따뜻한 집의 문을 잘 아는 브랜드"로 느껴져야 하고, 화면을 더 볼수록 무료 방문실측, 직접 제작, 전속 시공, 리뷰, A/S까지 체계가 있는 브랜드로 확신하게 만들어야 한다.

### Design Thesis

**Warm Craft, Guided Choice, Verified Work.**

- Warm Craft: 흙, 나무, 크림, 테라코타에서 오는 장인적 온기.
- Guided Choice: 고객이 혼자 고르지 않도록 고민별·분위기별 선택지를 좁혀주는 구조.
- Verified Work: 무료 방문실측, 직접 제작, 전속 시공, 리뷰, A/S로 신뢰를 증명하는 구조.

### Brand Voltage

문장군의 개성은 장식이 아니라 판단을 도와주는 온도에서 나온다.

1. 밝은 주거 공간 속 완성된 도어·중문 이미지.
2. `Noto Serif KR` 기반의 단단하고 따뜻한 한글 제목.
3. 고객의 가격, 가능 여부, 추가금, 일정, 마감 불안을 줄이는 안내형 구조.
4. 테라코타 CTA와 코코아 오크 신뢰 표면, 제한적인 검증 네이비.

## Brand Name & Lockup

### Korean Name

한글 브랜드명은 **문장군**을 기본 표기로 한다.

사용 위치:

- 웹사이트 헤더
- 랜딩 첫 화면
- 블로그/인스타 썸네일의 출처 표기
- 상담 CTA 주변
- 문서 제목

서체:

- 기본: `{typography.brand-ko}`
- 권장 실제 폰트: `Noto Serif KR`
- 대체: `Song Myung`, `Noto Serif CJK KR`, serif

한글 표기는 지나치게 귀엽거나 장식적으로 보이면 안 된다. 획의 무게가 있어야 하지만, 차갑고 관공서 같은 인상으로 굳어지지 않게 크림, 오크, 테라코타 표면과 함께 사용한다.

### English Name

| 표기 | 사용 위치 | 기준 |
| --- | --- | --- |
| `MUNJANGGUN` | 로고 보조 표기, 제품 이미지 워터마크, 작은 신뢰 스탬프 | 공식 영문 보조 표기 |
| `munjanggun` | URL, 계정명, 파일명, 시스템 식별자 | 디지털 핸들/메타데이터용 |
| `Munjanggun` | 영문 문장 안에서 자연스럽게 언급할 때 | 설명문용 |

영문은 한글보다 작게 둔다. 문장군은 한국 고객 대상 브랜드이므로 한글 브랜드명이 항상 주인공이다.

### Lockup Rules

- 기본 락업: `문장군` 단독.
- 보조 락업: `문장군` 아래 또는 옆에 작은 `MUNJANGGUN`.
- `MUNJANGGUN`은 12~16px 사이에서 작고 단단하게 사용한다.
- 영문을 한글보다 크게 쓰지 않는다.
- 영문에 과한 자간을 주지 않는다. Letter spacing은 0을 유지한다.
- 로고 주변에 과한 배지, 별점, 가격 정보를 붙이지 않는다.

## Colors

문장군 v3.0 컬러는 흙, 나무, 크림의 온기를 첫인상으로 두고, 상담과 행동에는 테라코타를, 검증과 운영 근거에는 네이비를 제한적으로 쓴다.

### Core Palette

| Token | HEX | Role |
| --- | --- | --- |
| `{colors.cocoa-oak}` | `#2C221E` | 깊은 나무결, 장인성, 제목, 다크 신뢰 표면 |
| `{colors.clay-terracotta}` | `#B35D43` | 상담 CTA, 온기, 핵심 강조 |
| `{colors.cashmere-cream}` | `#F5EFE6` | 기본 배경, 따뜻한 주거감 |
| `{colors.toasted-almond}` | `#C5B9A5` | 보조 표면, 소재감, 구분면 |
| `{colors.verified-navy}` | `#1D3858` | 상담·검증·전산·책임 흐름의 제한적 신뢰색 |
| `{colors.paper-white}` | `#FFFCF7` | 카드 내부, 본문 표면 |
| `{colors.warm-line}` | `#E2D7C8` | 얇은 경계선 |
| `{colors.warm-line-strong}` | `#C5B9A5` | 강한 구분선, 표 경계 |
| `{colors.ink-warm}` | `#171512` | 핵심 텍스트 |
| `{colors.body-warm}` | `#443B34` | 본문 텍스트 |
| `{colors.muted-warm}` | `#6B6259` | 캡션, 보조 설명 |
| `{colors.cream-soft}` | `#FAF7F0` | 더 밝은 크림 보조 배경 |
| `{colors.almond-soft}` | `#EFE6DA` | 부드러운 선택/상담 안내 표면 |
| `{colors.navy-soft}` | `#E7EEF5` | 검증 네이비의 연한 배경 |
| `{colors.caution-red}` | `#C74332` | 오류, 위험, 필수 주의. 가격 강조 금지 |
| `{colors.success-green}` | `#5C8A62` | 완료, 확인, 정상 상태 |
| `{colors.on-dark}` | `#FFFCF7` | 어두운 표면 위 텍스트 |
| `{colors.on-terracotta}` | `#FFFFFF` | 테라코타 표면 위 텍스트 |

### Color Ratio

한 화면의 색 비율은 다음을 기본으로 한다.

- 60%: `{colors.cashmere-cream}`, `{colors.paper-white}`
- 18%: `{colors.toasted-almond}` 또는 `{colors.almond-soft}`
- 12%: `{colors.cocoa-oak}`
- 7%: `{colors.clay-terracotta}`
- 3%: `{colors.verified-navy}`

### Color Roles

`{colors.cocoa-oak}`은 기존의 넓은 검정/네이비 깊이를 따뜻한 장인성으로 바꾸는 핵심 색이다. 제목, 신뢰 섹션, 직접 제작·전속 시공 근거에 사용한다.

`{colors.clay-terracotta}`는 행동색이다. 무료 방문실측 CTA, 상담 예약, 중요한 전환 영역에 쓰되 할인 강조처럼 보이면 실패다. 빨간 가격 강조, 특가 배너, 마감 임박 배지의 대체색으로 쓰지 않는다.

`{colors.cashmere-cream}`은 기본 캔버스다. 순백보다 따뜻하지만 누렇게 보이면 안 된다.

`{colors.verified-navy}`는 검증, 전산, 운영 체계, 리뷰 수치, A/S 같은 근거를 조용하게 받치는 색이다. 첫인상 주색이나 넓은 브랜드 배경으로 쓰지 않는다.

`{colors.caution-red}`는 오류와 필수 주의에만 쓴다. 가격, 할인율, 이벤트를 강조하는 데 사용하지 않는다.

## Surface Modes

문장군은 색을 여러 개 흩뿌리는 대신 표면 모드로 화면 리듬을 만든다.

| Surface | 색 | 사용처 |
| --- | --- | --- |
| Cream Canvas | `{colors.cashmere-cream}` | 기본 페이지 배경, 브랜드 스토리 |
| Paper Card | `{colors.paper-white}` | 본문 카드, FAQ, 가격 설명 |
| Almond Band | `{colors.almond-soft}` | 선택 가이드, 상담 흐름, 부드러운 정보 영역 |
| Cocoa Trust Surface | `{colors.cocoa-oak}` | 신뢰 섹션, 직접 제작·전속 시공, A/S 근거 |
| Verified Navy Surface | `{colors.verified-navy}` | 전산, 검증, 관리자, 운영 체계, 중요한 증거 영역 |
| Terracotta Callout | `{colors.clay-terracotta}` | 단일 강한 CTA 밴드, 상담 전환 영역 |

### Surface Rules

- 첫 화면은 `Cream Canvas` 또는 밝은 주거 사진 중심으로 시작한다.
- `Cocoa Trust Surface`는 직접 제작, 전속 시공, A/S, 리뷰 근거처럼 깊은 신뢰가 필요한 구간에 사용한다.
- `Verified Navy Surface`는 운영 체계, 전산 흐름, 검증 수치가 필요한 곳에 제한한다.
- `Terracotta Callout`은 한 화면에 여러 번 쓰지 않는다. 전환 순간 하나만 강하게 둔다.
- 카드 안에 카드를 넣지 않는다.
- 모든 섹션을 카드처럼 감싸지 않는다.
- 표면 전환은 그림자보다 배경 차이, 선, 사진 리듬으로 만든다.

## Typography

문장군 v3.0 타이포그래피는 균형형이다. `Noto Serif KR`은 브랜드 문장과 큰 제목에 온기를 만들고, 본문과 UI는 `Pretendard` 또는 `Noto Sans KR`로 읽기와 조작성을 지킨다.

### Typeface Stack

| Role | Primary | Fallback | Use |
| --- | --- | --- | --- |
| Brand / Hero Display | `Noto Serif KR` | `Song Myung`, `Noto Serif CJK KR`, serif | `문장군`, 히어로, 섹션 대표 문장 |
| UI / Body | `Pretendard` | `Noto Sans KR`, `Apple SD Gothic Neo`, `Malgun Gothic`, sans-serif | 본문, 카드, FAQ, 폼, 버튼 |
| English / Number | `Manrope` | `Inter`, system-ui | `MUNJANGGUN`, 리뷰 숫자, 가격대, 라벨 |

### Type Scale

| Token | Desktop | Mobile | Weight | Line Height | Use |
| --- | --- | --- | --- | --- | --- |
| `{typography.brand-ko}` | 42px | 30px | 700 | 1.18 | 한글 로고형 브랜드명 |
| `{typography.brand-en}` | 16px | 13px | 800 | 1.2 | `MUNJANGGUN` 보조 표기 |
| `{typography.display-hero}` | 56px | 34px | 700 | 1.16 | 첫 화면 메인 카피 |
| `{typography.display-section}` | 40px | 29px | 700 | 1.22 | 주요 섹션 제목 |
| `{typography.display-card}` | 24px | 21px | 700 | 1.34 | 큰 카드 제목, Proof Panel 제목 |
| `{typography.body}` | 16px | 15px | 400 | 1.72 | 본문 |
| `{typography.body-strong}` | 16px | 15px | 650 | 1.62 | 강조 본문, 버튼 |
| `{typography.label}` | 13px | 12px | 750 | 1.3 | 배지, 라벨, 탭 |
| `{typography.caption}` | 13px | 12px | 400 | 1.55 | 캡션, 보조 설명 |
| `{typography.metric}` | 34px | 28px | 850 | 1 | 리뷰 숫자, 가격대 |

### Typography Rules

- `Noto Serif KR`은 히어로, 섹션 제목, 브랜드 선언문 중심으로 사용한다.
- 본문, 버튼, 폼, 탭, 긴 설명, FAQ 답변은 산세리프를 사용한다.
- 전체 UI를 세리프로 만들지 않는다. 정보 화면이 느리고 불편해진다.
- `MUNJANGGUN`은 항상 `문장군`보다 작다.
- 모든 한글 제목은 `word-break: keep-all`을 기본으로 한다.
- "도와드립니다", "견적상담", "직접시공", "무료 방문실측" 같은 단어가 중간에서 갈라지면 실패다.
- 히어로 제목은 2줄, 최대 3줄까지만 허용한다.
- 한 줄 길이는 데스크톱 12~17자, 모바일 8~12자를 우선한다.
- 본문은 70자 이상 길게 늘이지 않는다.

### Hero Hierarchy

Hero:

```text
좋은 문을 고르는 일,
따뜻하게 정확하게
```

Hero subcopy:

```text
무료 방문실측으로 집에 맞는 선택을 안내하고,
직접 제작과 전속 시공으로 끝까지 책임집니다.
```

Section title:

```text
가격은 숨기지 않고,
조건과 함께 보여줍니다.
```

Metric:

```text
최신 확인
범위 구분
```

## Layout & Spacing

문장군 레이아웃은 쇼핑몰처럼 빽빽하면 안 되고, 인테리어 매거진처럼 정보가 부족해도 안 된다. 기본 밀도는 **밝은 이미지 + 필요한 판단 정보**다.

### Section Rhythm

기본 페이지 흐름:

1. 제품이 집 안에서 예쁘게 어울리는 히어로.
2. 고객 고민별 선택 안내.
3. 무료 방문실측 견적상담.
4. 집 분위기별 시공 사례.
5. 고객 리뷰 검증.
6. 직접 제작·전속 시공 근거.
7. 가격대, 추가금, A/S, FAQ.

### Grid

- Desktop container: 1120~1200px.
- Content max width: 720px.
- Long body max width: 680px.
- Card grid: 3 columns desktop, 2 columns tablet, 1 column mobile.
- Hero: text 46~52%, image 48~54%.
- 상담/가격/FAQ 섹션은 이미지보다 정보 비중을 높인다.

### Spacing

- Major section vertical spacing: `{spacing.section}` 88px.
- Mobile section spacing: 56~64px.
- Card gap: 18~24px.
- Inner card padding: 18~24px.
- Hero padding: 80px top/bottom desktop, 48px mobile.

### Container Rules

- 카드 안에 카드를 넣지 않는다.
- 큰 둥근 wrapper를 반복하지 않는다.
- 경계는 무거운 그림자보다 따뜻한 선과 표면 차이로 만든다.
- 같은 화면 안에 너무 많은 배지와 숫자를 넣지 않는다.
- 네이비, 테라코타, 오크 표면이 한 화면에서 모두 크게 경쟁하지 않게 한다.

## Imagery

### Main Image Rule

문장군의 메인 이미지는 제품 단독 컷이 아니다. 제품이 실제 주거 공간 안에서 인테리어와 자연스럽게 어울리는 장면이어야 한다.

고객이 느껴야 하는 첫 감정:

```text
아, 저런 중문이나 도어를 우리 집에 달면 분위기가 좋아지겠네.
```

### Image Mood

Primary:

- 밝은 주거 공간.
- 완성된 중문/도어.
- 화이트, 우드, 크림, 따뜻한 자연광.
- 정돈된 현관과 실내.
- 제품이 공간을 압도하지 않고 분위기를 완성하는 장면.

Secondary:

- 따뜻한 가족집.
- 실제 생활이 가능한 깨끗한 공간.
- 제품 디테일 클로즈업.
- 샘플북, 컬러북, 실측 상담 장면.

Proof Only:

- 공장.
- 작업장.
- 장비.
- 시공 중 현장.
- Before/After 변화.

공장과 현장 사진은 전문성의 근거로는 좋지만, 첫 화면의 주 이미지로 쓰면 투박해진다. 중간 이후의 Proof Panel, Direct Work Section, FAQ 근거 영역에서 사용한다.

### Photo Treatment

- 수직선 보정은 필수.
- 밝기는 실제보다 약간 밝게.
- 색온도는 따뜻하지만 노랗지 않게.
- 그림자는 살리되 어둡게 뭉개지 않게.
- 테라코타/오크 계열이 과하게 붉어지지 않게 조정한다.
- Before/After는 상세 섹션에서 사용한다.
- 첫 화면은 After 또는 완성 공간 중심.

### Image Format Rules

| 용도 | 토큰 | 비율 | 최소 해상도 | 크롭 기준 |
| --- | --- | --- | --- | --- |
| 히어로 | `{media.heroImage}` | Desktop `16 / 10`, Mobile `4 / 5` | 1600x1000 | 제품과 주거 분위기가 함께 보여야 한다. 텍스트가 올라갈 영역은 밝고 단순하게 남긴다. |
| 시공 사례 카드 | `{media.caseCardImage}` | `4 / 3` | 1200x900 | 도어·중문만 확대하지 말고 바닥, 벽, 조명 맥락을 함께 둔다. |
| 블로그 썸네일 | `{media.blogThumbnail}` | `16 / 9` | 1280x720 | 제품, 전후 차이, 고객 고민 중 하나가 첫눈에 읽혀야 한다. |

- 히어로 오버레이 텍스트는 데스크톱에서 좌우 42% 이내, 모바일에서 상단 35% 이내에 배치 가능한 사진을 고른다.
- 텍스트가 올라가는 영역에는 손잡이, 문틀 모서리, 얼굴, 주소, 개인정보가 겹치지 않아야 한다.
- 이미지 생성 프롬프트에는 "bright Korean residential interior, warm natural light, finished door or partition, cream and wood tones"를 기본 분위기로 사용하되, 실제 프로젝트에서는 한국어 지시와 함께 쓴다.
- 자동 크롭을 쓸 때는 제품 전체와 주변 인테리어가 함께 남는지 먼저 확인한다.

### Smart Store Thumbnails

스마트스토어의 어두운 스튜디오형 썸네일은 판매 채널의 현재 운영 자산이다. 문장군 전체 브랜드 디자인의 핵심 기준으로 고정하지 않는다.

웹, 블로그, 인스타, 랜딩, 상담 화면에서는 밝은 주거 공간 이미지를 우선한다.

## Components

컴포넌트는 예쁘기보다 고객 불안을 줄이는 역할을 해야 한다. 문장군 UI는 고객이 가격, 가능 여부, 추가금, 일정, 마감, A/S에서 덜 헤매게 하는 장치다.

### Buttons

#### `button-primary`

용도:

- 무료 방문실측 신청.
- 담당 매니저 상담받기.
- 상담 예약.

규칙:

- Background: `{colors.clay-terracotta}`.
- Text: `{colors.on-terracotta}`.
- Radius: `{rounded.md}` 8px.
- Height: 46~50px.
- Label: `{typography.body-strong}`.
- 한 viewport에 primary button은 1~2개까지만.

금지:

- 빨간 할인 버튼처럼 보이게 만들기.
- "최저가 확인하기".
- "특가 마감".
- 둥근 캡슐 버튼 남발.

#### `button-secondary`

용도:

- 우리 집과 비슷한 사례 보기.
- 중문 시공 사례 보기.
- 도어 교체 사례 보기.
- 중문/도어 가이드 보기.

규칙:

- Background: `{colors.paper-white}`.
- Border: `1px solid {colors.warm-line}`.
- Text: `{colors.cocoa-oak}`.
- Primary와 같은 높이.

### Trust Badge

첫 화면에는 3개만 사용한다.

```text
무료 방문실측
직접 제작 · 전속 시공
고객 리뷰로 검증
```

규칙:

- 첫 화면 배지는 짧고 단단해야 한다.
- 배지 색은 기본적으로 `{colors.cocoa-oak}` 또는 밝은 크림 표면 위 어두운 텍스트를 쓴다.
- 네이비 배지는 검증 섹션에서만 보조로 사용한다.
- 아이콘은 중간 굵기 라인 아이콘.
- 4개 이상을 첫 viewport에 넣지 않는다.

상세 섹션에서 확장 가능한 배지:

- 전체 상품 리뷰 수는 최신 캡처 확인 후 사용.
- 대표상품 단일 리뷰 수는 상품 단위 근거로만 사용.
- 전속 시공팀.
- 도어 3년, 중문 2년 A/S.
- 담당 매니저 책임 관리.

### Proof Panel

Proof Panel은 따뜻한 첫인상 뒤에 확인 가능한 근거를 보여주는 v3.0 핵심 컴포넌트다.

Anatomy:

1. 작은 라벨: `VERIFIED WORK`.
2. 큰 세리프 제목.
3. 짧은 설명.
4. 실측/제작/A/S 같은 3개 이하의 근거 칩.

색:

- 기본: `{colors.cocoa-oak}`.
- 강조: `{colors.toasted-almond}`, `{colors.paper-white}`.
- 특수 검증: `{colors.verified-navy}`.

사용 예:

```text
VERIFIED WORK
실측부터 A/S까지,
같은 기준으로 확인합니다.
```

주의:

- Proof Panel은 "우리가 최고"라고 외치는 영역이 아니다.
- 실제 확인 가능한 근거만 넣는다.
- 공장/시공 사진은 이 영역부터 사용하는 것이 좋다.

### Problem Selector

고객은 상품명보다 고민에서 출발한다.

문제 선택 컴포넌트는 다음 항목을 카드나 리스트로 보여준다.

- 문이 잘 안 닫혀요.
- 현관이 답답해요.
- 냉난방이 새는 것 같아요.
- 중문 종류를 모르겠어요.
- 추가금이 걱정돼요.
- 우리 집에 어울리는 색을 모르겠어요.

규칙:

- 문제 문장은 고객 말투로 쓴다.
- 카드 제목은 질문형 또는 고민형.
- 선택 후 상품군, 사례, 무료실측 CTA로 연결한다.
- 전문 용어보다 고객이 실제로 걱정하는 말부터 보여준다.

### Mood Selector

집 분위기별 선택지를 보여준다.

- 밝은 신축 아파트.
- 화이트/우드톤.
- 모던 블랙.
- 따뜻한 가족집.
- 차분한 현관.

규칙:

- 이미지를 먼저 보여준다.
- 색상명보다 분위기명을 우선한다.
- "우리 집과 비슷한 사례 보기" CTA와 연결한다.

### Case Card

시공 사례 카드는 제품보다 집 분위기를 먼저 보여준다.

Anatomy:

1. 밝고 정돈된 After 이미지.
2. 분위기 태그.
3. 제품군.
4. 핵심 변화 한 줄.
5. 상담/사례 CTA.

예시:

```text
화이트/우드톤 신축 아파트에 어울리는 3연동 중문
현관은 밝게, 거실은 차분하게 분리했습니다.
```

금지:

- 제품명만 길게 나열.
- 가격과 할인율을 카드의 중심으로 배치.
- 어두운 썸네일을 모든 채널의 기본으로 사용.
- 사진 없는 텍스트 카드 반복.

### Review Card

리뷰 카드는 숫자만 크게 쓰지 않는다.

Anatomy:

1. 짧은 실제 후기 요약.
2. 제품 또는 시공 사진.
3. 리뷰 근거 숫자.
4. 고객이 느낀 안심 포인트.

Metric expression:

```text
전체 상품 리뷰 수는 최신 확인 후 사용
대표상품 단일 리뷰 수는 상품 단위로만 사용
```

주의:

- "리뷰 15,000개+"를 브랜드 전체 리뷰처럼 쓰지 않는다.
- 화면에서는 "고객 리뷰로 검증된 브랜드"처럼 자연스럽게 쓴다.
- 문서나 상세에서는 기준일과 숫자를 정확히 남긴다.
- 최신 수치가 필요한 발행물은 기준 날짜와 근거를 확인한다.

### Price Box

가격은 숨기지 않는다. 하지만 가격만 크게 보이면 전단지처럼 보인다.

Anatomy:

1. 가격대.
2. 조건 설명.
3. 무료 방문실측 후 정확 안내.
4. 추가금 사전 안내.

예시:

```text
도어는 상품 기준 월 만원대~5만원대부터,
중문은 월 4만원대~8만원대부터 선택할 수 있습니다.

실제 견적은 현장 구조, 사이즈, 옵션에 따라 달라질 수 있어
무료 방문실측 후 정확하게 안내드립니다.
```

디자인:

- 배경: `{colors.paper-white}` 또는 `{colors.almond-soft}`.
- 핵심 숫자: `{colors.cocoa-oak}` 또는 제한적 `{colors.verified-navy}`.
- CTA: `{colors.clay-terracotta}`.
- 빨간 가격 강조 금지.
- 가격 옆에 "무료 방문실측 후 정확 안내"를 반드시 둔다.

### Consultation Flow

무료 방문실측은 문장군의 핵심 경험이다.

Flow:

```text
상담 접수 → 무료 방문실측 → 샘플/컬러북 확인 → 견적 안내 → 결제 → 제작 → 전속 시공 → A/S
```

규칙:

- 5~8단계로 표현.
- 각 단계는 짧은 제목 + 1줄 설명.
- 아이콘은 라인 아이콘.
- 기본 표면은 `Cream Canvas` 또는 `Almond Band`.
- 단계 번호 또는 핵심 흐름은 `{colors.cocoa-oak}`.
- CTA는 `{colors.clay-terracotta}`.
- 전산/알림톡/운영 흐름을 보여줄 때만 `{colors.verified-navy}`.

### Direct Work Section

직접 제작·전속 시공은 메인 비주얼이 아니라 신뢰 섹션이다.

구성:

- 완성 사진.
- 작은 신뢰 배지.
- 공정 흐름.
- 디테일 클로즈업.
- A/S 보증 문장.

문장:

```text
직접 제작하고 직접 시공하기 때문에,
문장군은 시공 이후까지 책임 있게 관리합니다.
```

주의:

- 외주 시공 중심 브랜드처럼 보이지 않게 한다.
- 공장과 시공 사진은 근거로 쓰되 첫 화면 주 이미지로 쓰지 않는다.
- A/S는 도어 3년, 중문 2년 보증 기준을 정확히 쓴다.

### FAQ

FAQ는 고객 불안을 직접 받아준다.

우선 질문:

- 가격이 얼마예요?
- 추가금이 나오나요?
- 우리 집도 시공 가능한가요?
- 중문이나 도어 종류를 잘 모르겠어요.
- 시공은 얼마나 걸리나요?
- 먼지나 소음은 어느 정도인가요?
- A/S는 어떻게 되나요?

답변은 짧게 시작하고, 필요한 경우 무료 방문실측 CTA로 연결한다. 시공 가능 여부와 추가금은 단정하지 말고 현장 구조, 사이즈, 옵션 확인이 필요하다고 설명한다.

### Form Fields

상담 신청 폼은 조용하고 신뢰감 있게 만든다.

규칙:

- 필드 높이 46~50px.
- Border: `{colors.warm-line}`.
- Focus: `{colors.clay-terracotta}` 또는 검증 성격의 폼에서는 `{colors.verified-navy}` 2px.
- Placeholder는 `{colors.muted-warm}`.
- 필수 항목 경고만 `{colors.caution-red}` 사용.
- 폼 상단에는 "잘 모르겠다면 현장에서 함께 봐드립니다"류의 안심 문구를 둔다.

## Content Modules

문장군 디자인은 웹 UI뿐 아니라 블로그, 인스타, 릴스 썸네일에도 적용되어야 한다.

### Blog Thumbnail

메인 방식:

- 실제 시공 사진.
- 짧은 고민형 제목.
- 작은 문장군 출처 표기.
- 과한 배너 금지.

제목 예시:

- 중문 종류, 우리 집엔 뭐가 맞을까?
- 도어 교체 비용, 왜 집마다 다를까?
- 문이 잘 안 닫힐 때, 교체가 답일까?
- 현관이 답답하다면 중문부터 봐야 할까?

썸네일 규칙:

- 제목은 14~22자 권장.
- 제목은 2줄 이내.
- 사진 위 텍스트는 가독성을 위해 30~45% 어두운 오버레이만 허용.
- 빨간 가격, 형광 테두리, 과한 그림자 금지.
- 제목에는 `Noto Serif KR`을 사용할 수 있지만, 긴 설명은 산세리프를 쓴다.

### Instagram Card News

현재 메인:

- 짧은 고민 해결 카드뉴스.
- 리뷰/후기 기반 콘텐츠.

확장:

- 예쁜 시공 사례 중심 콘텐츠.

권장 슬라이드 구조:

1. 고민형 첫 장.
2. 고객이 헷갈리는 이유.
3. 선택 기준 2~3개.
4. 문장군 실측에서 확인하는 것.
5. 실제 사례 또는 리뷰.
6. 무료 방문실측 CTA.

첫 장 예시:

```text
중문 고르기 전
꼭 봐야 할 3가지
```

금지:

- 텍스트만 있는 카드 반복.
- AI 느낌 나는 결론형 문장 반복.
- "무조건", "최고", "최저가" 단정.
- 브랜드 컬러와 무관한 파스텔 남발.

### Landing Page Hero

히어로에 반드시 포함할 것:

- 주거 공간 안에 놓인 도어·중문 이미지.
- 메인 카피.
- 보조 설명.
- Primary CTA.
- Secondary CTA.
- 첫 화면 신뢰 배지 3개.

히어로에 넣지 말 것:

- 가격표 전체.
- 할인율.
- 공장 사진.
- 배지 5개 이상.
- 긴 설명문.

## Motion & Interaction

문장군 모션은 고객을 흥분시키기보다 흐름을 이해시키는 역할을 한다.

- 버튼 hover는 색을 어둡게 하거나 1~2px 정도만 떠오르게 한다.
- 카드 hover는 이미지 확대 1.02배 이하, 선명도 유지.
- 상담 흐름 단계는 순차 등장 가능하지만 과한 튕김 효과는 금지.
- 숫자 카운트업은 리뷰 수치처럼 검증 근거가 있을 때만 쓴다.
- 모바일에서는 모션보다 줄바꿈, 터치 영역, CTA 접근성을 우선한다.

## Shapes

문장군은 둥글둥글한 생활앱이 아니다. 작은 radius로 친절함만 더한다.

| Token | Size | Use |
| --- | --- | --- |
| `{rounded.xs}` | 4px | 작은 라벨, 이미지 내부 태그 |
| `{rounded.sm}` | 6px | 배지, 작은 선택 칩 |
| `{rounded.md}` | 8px | 버튼, 카드, 가격 박스 |
| `{rounded.lg}` | 12px | 이미지 프레임, Proof Panel, 큰 미디어 카드 |
| `{rounded.full}` | 999px | 아주 제한적인 상태 표시. 버튼에는 기본 사용 금지 |

## Elevation & Depth

문장군 디자인은 그림자로 고급스러움을 만들지 않는다. 깊이는 사진, 표면 모드, 얇은 선, 오크 표면으로 만든다.

그림자 단계:

- Level 0: 대부분의 카드. Shadow 없음.
- Level 1: 중요한 상담/가격 박스. `0 8px 24px rgba(44,34,30,.06)`.
- Level 2: 히어로 위 floating info card. `0 18px 45px rgba(44,34,30,.10)`.

금지:

- 카드마다 무거운 그림자.
- 네온 glow.
- 과한 blur.
- 장식용 오브젝트 그림자.

## Iconography

아이콘은 중간 굵기의 라인 아이콘을 기본으로 한다.

스타일:

- Stroke width: 2px 또는 2.25px.
- Rounded cap 허용.
- Filled icon 금지.
- 귀여운 일러스트 아이콘 금지.
- 기술/실측 영역에서는 약간의 도면 느낌 허용.

아이콘 역할:

- 실측: ruler, measure, map-pin.
- 제작: box, factory outline, layers.
- 시공: tool, door, wrench.
- 리뷰: star, message.
- A/S: shield, check-circle.

## Responsive Behavior

### Breakpoints

| Name | Width | Rule |
| --- | --- | --- |
| Mobile | `< 640px` | 단일 컬럼. Hero 34px. CTA full width. Proof badge stack |
| Tablet | `640px - 1024px` | 2-column grid. Hero 이미지는 아래 또는 옆 배치 |
| Desktop | `1024px - 1440px` | 1120~1200px container. 3-column cards |
| Wide | `> 1440px` | Container를 무한히 늘리지 말고 이미지 여백으로 확장 |

### Mobile Rules

- 한글 제목 단어가 깨지지 않게 한다.
- 모바일 한글 줄바꿈은 실제 viewport에서 검증한다.
- CTA는 full width.
- 신뢰 배지는 세로 스택.
- 가격 박스는 1열.
- 사례 카드는 이미지 먼저, 텍스트 다음.
- 네비게이션은 간결하게: 브랜드명 + 상담 CTA.
- 터치 타깃은 최소 44px 이상.
- 첫 화면 배지 3개 원칙은 모바일에서도 유지한다.

## 실행 기준과 금지 기준

### 해야 할 것

- `{colors.cashmere-cream}`과 `{colors.paper-white}`로 따뜻한 기본 화면 분위기를 만든다.
- `{colors.clay-terracotta}`는 실제 상담 행동에 사용하고 할인 소음처럼 쓰지 않는다.
- `{colors.cocoa-oak}`은 장인성, 제목, 깊은 신뢰 표면에 사용한다.
- `{colors.verified-navy}`는 검증, 운영, 리뷰 수치, 시스템 신뢰에만 제한적으로 사용한다.
- 히어로와 섹션급 한글 제목에는 `Noto Serif KR`을 사용한다.
- 본문, 폼, 버튼, FAQ, 긴 설명은 Pretendard 또는 Noto Sans KR로 유지한다.
- 도어와 중문은 밝은 주거 인테리어 안에서 보여준다.
- 선택 흐름은 제품 분류보다 고객 고민과 집 분위기에서 시작한다.
- 가격대는 무료 방문실측 설명과 함께 제시한다.
- 리뷰 숫자는 범위와 기준일을 함께 확인한다.
- 직접 제작과 전속 시공은 히어로 이후 근거 섹션에서 이야기를 받쳐준다.

### 하지 말 것

- 전체 UI를 세리프로 만들지 않는다.
- 한국어 화면에서 `MUNJANGGUN`을 `문장군`보다 크게 만들지 않는다.
- 어두운 스마트스토어 썸네일 느낌을 브랜드 전체 분위기로 확장하지 않는다.
- 빨간 가격 강조나 할인 전단지형 레이아웃을 쓰지 않는다.
- `verified-navy`를 첫인상 주 배경으로 쓰지 않는다.
- 둥글둥글한 생활앱 형태로 만들지 않는다.
- 확실한 근거 없이 "최고", "최저가", "No.1", "100% 만족"을 쓰지 않는다.
- 시공 가능 여부에 대해 "무조건 가능"이라고 말하지 않는다.
- "절대 추가금 없음"을 포괄 약속처럼 쓰지 않는다.
- 사진이 핵심을 전달해야 하는 곳에 텍스트 카드만 반복하지 않는다.
- 첫 화면 신뢰 배지는 3개를 넘기지 않는다.
- 고객이 리뷰만 보고 고르게 만들지 않는다. 리뷰는 선택 엔진이 아니라 근거로 사용한다.

## Forbidden and Risky Expressions

아래 표현은 중앙 원본 또는 확인 가능한 근거 없이 사용하지 않는다.

- 최저가 보장
- 대한민국 No.1
- 고객만족 100%
- 무조건 가능
- 절대 추가금 없음
- 최고급 시공
- 업계 최고
- 보양 작업 후 청소
- 리뷰 15,000개+를 전체 브랜드 리뷰처럼 표현
- AI 느낌이 강한 "이처럼", "결론적으로", "효과적입니다" 반복

시공 가능 여부, 가격, A/S, 일정, 리뷰 수처럼 변할 수 있는 정보는 기준 날짜와 근거를 확인한다.

## AI 에이전트 구현 지침

AI 에이전트가 문장군 웹앱, 랜딩, 블로그 썸네일, 인스타그램 카드를 만들 때는 아래 순서를 따른다.

1. Read `BRAND_CONTEXT.md`.
2. Read `FIELD_JUDGMENT_RULES.md`.
3. 이 `DESIGN.md`의 토큰 섹션을 디자인 원본으로 사용한다.
4. 밝은 주거 공간 안에 제품이 놓인 이미지에서 시작한다.
5. 공식 브랜드 핵심 문장을 우선하고, 필요할 때 승인된 히어로 변형 문장을 사용한다.
6. 첫인상은 `cashmere-cream`, `paper-white`, `cocoa-oak`, 절제된 `clay-terracotta`로 만든다.
7. `verified-navy`는 검증, 운영, 수치, 시스템 신뢰에만 사용한다.
8. 히어로와 섹션 제목은 `Noto Serif KR`, 본문/UI는 Pretendard 또는 Noto Sans KR을 사용한다.
9. 첫 화면 신뢰 배지는 3개만 둔다.
10. 선택 구조는 제품 분류보다 고객 고민과 집 분위기에서 시작한다.
11. 가격은 빨간 할인 강조가 아니라 조건이 있는 가격대와 무료 실측 설명으로 보여준다.
12. 리뷰 근거는 정확히 쓴다: 전체 상품 리뷰와 대표상품 단일 리뷰를 구분하고, 최신 캡처 확인 후 숫자를 쓴다.
13. 공장/시공 현장 사진은 첫인상이 아니라 근거 섹션에 둔다.
14. 모바일 한글 줄바꿈을 실제 화면에서 확인한다.
15. 고객명, 전화번호, 상세 주소, AppSheet 원본, 비밀 정보는 포함하지 않는다.

### 구현 토큰

- 페이지 배경: `{colors.cashmere-cream}`.
- 카드 배경: `{colors.paper-white}`.
- 주요 제목: `{typography.display-hero}` 또는 `{typography.display-section}`.
- 본문: `{typography.body}`.
- Primary CTA: `{components.button-primary}`.
- Secondary CTA: `{components.button-secondary}`.
- 첫 화면 배지: `{components.trust-badge}`를 3개만 사용.
- 근거 영역: `{components.proof-panel}`.
- 가격 영역: `{components.price-box}`.
- 리뷰 수치: `{components.review-stat}`.
- 입력 필드: `{components.form-field}`.
- 오류 문구: `{components.error-message}`.
- 히어로 이미지: `{media.heroImage}`.
- 시공 사례 이미지: `{media.caseCardImage}`.
- 블로그 썸네일: `{media.blogThumbnail}`.

### 반복 수정 규칙

- 한 번에 하나의 컴포넌트 계열만 바꾼다.
- `{colors.cocoa-oak}`, `{typography.display-hero}`, `{components.price-box}`처럼 토큰명을 직접 참조한다.
- 변형은 숨은 문장 설명이 아니라 별도 컴포넌트 이름으로 추가한다.
- 명확한 이유가 없으면 본문은 `{typography.body}`를 유지한다.
- 테라코타는 아껴 쓴다. 한 viewport에 큰 테라코타 영역이 2개를 넘으면 하나는 버튼이나 작은 callout으로 낮춘다.
- 네이비는 더 아껴 쓴다. 네이비가 화면의 주 분위기가 되면 근거/운영 섹션으로 되돌린다.
- 디자인이 밋밋하면 색을 더하기 전에 타이포그래피와 사진을 먼저 강화한다.
- 디자인이 차갑게 느껴지면 네이비 면적을 줄이고 따뜻한 주거 이미지를 추가한다.
- 디자인이 저렴해 보이면 빨간색, 할인 라벨, 과한 배지, 복잡한 가격 박스를 제거한다.

## Known Gaps

- 문장군의 실제 로고 파일, 공식 영문 워드마크, 실제 사용 서체 파일은 아직 이 문서에 연결되지 않았다.
- `Noto Serif KR` 사용 가능 여부는 프로젝트 환경별로 확인해야 한다.
- 실제 시공 사진의 품질 편차를 보정하는 세부 기준은 `PHOTO_TREATMENT.md`에서 운영한다.
- HTML 미리보기는 `preview.html`과 GitHub Pages에서 v3.0 기준으로 제공 중이며, 토큰 변경 시 함께 갱신해야 한다.
