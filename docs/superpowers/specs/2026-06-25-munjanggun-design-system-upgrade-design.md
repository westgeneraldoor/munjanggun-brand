# Munjanggun Design System Upgrade Design

> **Archive status:** Completed/superseded historical artifact. This spec records the approved 2026-06-25 design direction that became `DESIGN.md` v3.0. Use current root documents as authority for new work.

> **Goal:** 문장군 중앙 `DESIGN.md`를 더 탄탄한 브랜드 디자인 원본으로 고도화하기 위한 승인된 디자인 방향을 정의한다.
>
> **Approved Direction:** A 색감 + B 문구/구조 + B 타이포그래피.
>
> **Status:** 사용자 승인 완료, 구현 계획 작성 전 검토용 스펙.

---

## 1. 배경

문장군의 현재 중앙 `DESIGN.md`는 브랜드 정체성, 디자인 토큰, 컴포넌트, 이미지 기준을 이미 갖추고 있다. 다만 사용자는 문장군 디자인을 더 탄탄하게 정립하고 싶어 하며, 특히 Claude 디자인 문서처럼 실무자가 바로 따라 쓸 수 있는 촘촘한 구조를 선호한다.

첨부된 Claude 디자인 문서에서 참고할 부분은 브랜드 자체의 색이나 서체가 아니라 문서 구성 방식이다.

- YAML 토큰이 먼저 나온다.
- 색상과 표면 모드의 역할이 명확하다.
- 타이포그래피가 브랜드 인상을 강하게 만든다.
- 컴포넌트 단위로 실제 사용처와 금지 기준을 정한다.
- Do/Don't와 반응형 기준이 실제 제작 판단까지 연결된다.

문장군에는 이 구조를 가져오되, 도어·중문 시공 브랜드의 실제 세계에 맞게 재해석한다.

## 2. 승인된 디자인 방향

### 핵심 문장

```text
좋은 문을 고르는 일,
따뜻하게 정확하게
```

이 문장은 기존 핵심 카피인 "좋은 문을 고르는 일, 어렵지 않게 도와드립니다"를 디자인 시스템용으로 재해석한 문장이다. 브랜드 첫인상에는 따뜻함을 주고, 상담·실측·제작·시공 흐름에는 정확함을 준다.

### 디자인 thesis

```text
Warm Craft, Guided Choice, Verified Work.
```

- **Warm Craft:** 흙, 나무, 크림, 테라코타에서 오는 장인적 온기.
- **Guided Choice:** 고객이 혼자 고르지 않도록 상담과 선택 구조를 시각화.
- **Verified Work:** 무료 방문실측, 직접 제작, 전속 시공, 리뷰, A/S로 검증되는 신뢰.

### 인상 목표

문장군은 감성 인테리어 브랜드처럼만 보여도 안 되고, 투박한 시공업체처럼 보여도 안 된다.

새 방향은 첫 화면에서 "따뜻한 집의 문을 잘 아는 브랜드"로 느껴지고, 화면을 더 볼수록 "실측·제작·시공·A/S까지 체계가 있는 브랜드"로 확신하게 만든다.

## 3. 컬러 방향

사용자는 첨부 이미지의 A 계열 색감을 선호했다. 따라서 새 디자인 시스템은 기존 네이비 중심에서 한 단계 이동해, 흙과 나무의 온기를 더 강한 첫인상으로 둔다.

### Core Palette

| Token | HEX | 역할 |
| --- | --- | --- |
| `cocoa-oak` | `#2C221E` | 깊은 나무결, 장인성, 제목, 다크 신뢰 표면 |
| `clay-terracotta` | `#B35D43` | 상담 CTA, 온기, 핵심 강조 |
| `cashmere-cream` | `#F5EFE6` | 기본 배경, 따뜻한 주거감 |
| `toasted-almond` | `#C5B9A5` | 보조 표면, 소재감, 구분면 |
| `verified-navy` | `#1D3858` | 상담·검증·전산·책임 흐름의 제한적 신뢰색 |
| `paper-white` | `#FFFCF7` | 카드 내부, 본문 표면 |
| `warm-line` | `#E2D7C8` | 얇은 경계선 |
| `ink-warm` | `#171512` | 핵심 텍스트 |
| `body-warm` | `#443B34` | 본문 텍스트 |
| `muted-warm` | `#6B6259` | 캡션, 보조 설명 |

### 색상 역할

`cocoa-oak`은 새 문장군의 가장 중요한 깊이 색이다. 기존의 검정 또는 네이비가 주던 신뢰감을 더 따뜻하고 장인적인 방식으로 바꾼다.

`clay-terracotta`는 행동색이다. 무료 방문실측 CTA, 중요한 강조, 짧은 키워드 하이라이트에 쓴다. 단, 할인 강조처럼 보이면 안 된다.

`cashmere-cream`은 기본 캔버스다. 기존 `canvas-warm`보다 조금 더 크림감이 있다. 순백색보다 브랜드 온도를 만든다.

`verified-navy`는 버리지 않는다. 다만 첫인상 주색이 아니라, 검증·전산·시공 흐름·관리자/운영 화면의 신뢰 보조색으로 제한한다.

### 권장 비율

- 60%: `cashmere-cream`, `paper-white`
- 18%: `toasted-almond`, 따뜻한 보조 표면
- 12%: `cocoa-oak`, 제목과 다크 신뢰 영역
- 7%: `clay-terracotta`, CTA와 핵심 강조
- 3%: `verified-navy`, 검증과 시스템 신뢰

## 4. 타이포그래피 방향

사용자는 `Noto Serif KR`을 고려했고, 최종 상담에서는 "균형형"을 승인했다.

### 핵심 결정

`Noto Serif KR`은 문장군의 감성과 장인성을 만드는 제목 서체로 사용한다. 본문과 UI까지 전부 세리프로 가지 않는다.

| 역할 | Primary | Fallback | 기준 |
| --- | --- | --- | --- |
| Brand / Hero Display | `Noto Serif KR` | `Song Myung`, `Noto Serif CJK KR`, serif | 큰 제목, 브랜드 선언문, 섹션 대표 문장 |
| UI / Body | `Pretendard` | `Noto Sans KR`, `Apple SD Gothic Neo`, `Malgun Gothic`, sans-serif | 본문, 카드, FAQ, 폼, 버튼 |
| Number / English | `Manrope` | `Inter`, system-ui | 리뷰 숫자, 가격대, `MUNJANGGUN`, 라벨 |

### 사용 원칙

- 히어로 제목과 큰 섹션 제목은 `Noto Serif KR` 700을 기본으로 한다.
- 본문, 버튼, 폼, 탭, 긴 설명은 산세리프로 유지한다.
- `Noto Serif KR`은 브랜드를 따뜻하게 만들지만, 과하게 쓰면 정보 화면이 느려진다.
- `MUNJANGGUN`은 여전히 한글보다 작게 둔다.
- 한글 제목은 `word-break: keep-all`을 기본으로 한다.

### 예시 계층

| Token | Desktop | Mobile | Weight | Use |
| --- | --- | --- | --- | --- |
| `display-hero` | 56px | 34px | 700 | 히어로 메인 카피 |
| `display-section` | 40px | 29px | 700 | 주요 섹션 제목 |
| `display-card` | 24px | 21px | 700 | 큰 카드 제목 |
| `body` | 16px | 15px | 400 | 본문 |
| `body-strong` | 16px | 15px | 650 | 강조 본문 |
| `label` | 13px | 12px | 750 | 배지, 라벨 |
| `metric` | 34px | 28px | 850 | 리뷰 수, 가격대 |

## 5. 표면 모드

Claude 문서처럼 표면 모드를 명확히 둔다. 문장군은 색을 여러 개 흩뿌리는 대신, 화면의 리듬을 표면 모드로 만든다.

| Surface | 색 | 사용처 |
| --- | --- | --- |
| Cream Canvas | `cashmere-cream` | 기본 페이지 배경, 브랜드 스토리 |
| Paper Card | `paper-white` | 본문 카드, FAQ, 가격 설명 |
| Almond Band | `toasted-almond`의 연한 변형 | 선택 가이드, 상담 흐름, 부드러운 정보 영역 |
| Cocoa Trust Surface | `cocoa-oak` | 신뢰 섹션, 직접 제작·전속 시공, A/S 근거 |
| Verified Navy Surface | `verified-navy` | 전산, 검증, 관리자, 운영 체계, 중요한 증거 영역 |
| Terracotta Callout | `clay-terracotta` | 단일 강한 CTA 밴드, 상담 전환 영역 |

### 표면 사용 규칙

- 첫 화면은 `Cream Canvas` 또는 밝은 주거 사진 중심으로 시작한다.
- `Cocoa Trust Surface`는 신뢰를 깊게 만드는 구간에 사용한다.
- `Verified Navy Surface`는 넓게 깔지 않고, 운영 체계나 검증 흐름이 필요한 곳에 제한한다.
- `Terracotta Callout`은 한 화면에 여러 번 쓰지 않는다.
- 카드 안에 카드를 넣지 않는다.

## 6. 컴포넌트 방향

### Button Primary

역할:

- 무료 방문실측 신청
- 상담 예약
- 담당 매니저 상담받기

기준:

- Background: `clay-terracotta`
- Text: white
- Radius: 8px
- Height: 46~50px
- Label: 산세리프 700~800

금지:

- 빨간 할인 버튼처럼 보이게 만들기
- "최저가 확인하기"
- "특가 마감"

### Button Secondary

역할:

- 우리 집과 비슷한 사례 보기
- 시공 사례 보기
- 중문/도어 가이드 보기

기준:

- Background: `paper-white`
- Border: `warm-line`
- Text: `cocoa-oak`
- Primary와 같은 높이

### Trust Badge

첫 화면 배지는 3개만 사용한다.

```text
무료 방문실측
직접 제작 · 전속 시공
고객 리뷰로 검증
```

배지 색은 기본적으로 `cocoa-oak` 또는 밝은 크림 표면 위 어두운 텍스트를 쓴다. 네이비 배지는 검증 섹션에서만 보조로 사용한다.

### Proof Panel

새 디자인 시스템에서 중요한 컴포넌트다. 따뜻한 첫인상 뒤에 확인 가능한 근거를 보여준다.

구성:

1. 작은 라벨: `VERIFIED WORK`
2. 큰 세리프 제목
3. 짧은 설명
4. 실측/제작/A/S 같은 3개 이하의 근거 칩

색:

- 기본: `cocoa-oak`
- 강조: `toasted-almond`, `paper-white`
- 특수 검증: `verified-navy`

### Price Box

가격 박스는 기존 원칙을 유지하되 새 팔레트에 맞춘다.

- 배경: `paper-white` 또는 연한 `toasted-almond`
- 가격 숫자: `cocoa-oak` 또는 제한적 `verified-navy`
- CTA: `clay-terracotta`
- 빨간 가격 강조 금지
- "무료 방문실측 후 정확 안내"를 가격 옆에 둔다.

### Case Card

시공 사례 카드는 제품보다 집 분위기를 먼저 보여준다.

구성:

1. 밝은 완성 사진
2. 분위기 태그
3. 제품군
4. 핵심 변화 한 줄
5. 상담 또는 사례 CTA

사진이 없는 텍스트 카드 반복은 피한다.

### Consultation Flow

무료 방문실측 흐름은 문장군의 핵심 경험이다.

권장 흐름:

```text
상담 접수 → 무료 방문실측 → 샘플/컬러북 확인 → 견적 안내 → 결제 → 제작 → 전속 시공 → A/S
```

디자인:

- 기본 표면은 `Cream Canvas`
- 단계 번호 또는 핵심 흐름은 `cocoa-oak`
- CTA는 `clay-terracotta`
- 전산/알림톡/운영 흐름을 보여줄 때만 `verified-navy`

## 7. 사진과 이미지 기준

기존 `DESIGN.md`의 사진 원칙은 유지하되, 새 팔레트에 맞게 보정 기준을 더 명확히 한다.

### 첫인상 이미지

- 밝은 주거 공간
- 완성된 중문/도어
- 화이트, 우드, 크림, 따뜻한 자연광
- 제품이 공간을 압도하지 않고 분위기를 완성하는 장면

### 신뢰 이미지

- 실측 상담 장면
- 샘플북, 컬러북
- 공장 또는 제작 디테일
- 전속 시공팀의 작업 장면
- Before/After 변화

신뢰 이미지는 첫 화면의 주 이미지가 아니라 중간 이후의 근거 섹션에서 사용한다.

### 보정 방향

- 밝기는 실제보다 약간 밝게
- 색온도는 따뜻하게, 노랗게는 금지
- 그림자는 살리되 탁하게 뭉개지 않게
- 수직선 보정 필수
- 테라코타/오크 계열이 과하게 붉어지지 않게 조정

## 8. 문서 구조 고도화 방향

중앙 `DESIGN.md`는 Claude 문서처럼 다음 구조로 재정리한다.

1. YAML token block
2. Overview
3. Design Thesis
4. Brand Name & Lockup
5. Colors
6. Surface Modes
7. Typography
8. Layout & Spacing
9. Imagery
10. Components
11. Content Modules
12. Motion & Interaction
13. Responsive Behavior
14. Do's and Don'ts
15. AI Agent Implementation Guide
16. Known Gaps

현재 `DESIGN.md`에 이미 있는 좋은 내용은 유지한다. 팔레트, 타이포그래피, 표면 모드, 컴포넌트 설명만 승인된 방향에 맞춰 고도화한다.

## 9. 기존 DESIGN.md와 달라지는 점

| 영역 | 기존 | 새 방향 |
| --- | --- | --- |
| 주색 | Warm canvas + Trust Navy 중심 | Cocoa Oak + Clay Terracotta + Cashmere Cream 중심 |
| 신뢰색 | Trust Navy가 CTA와 검증을 함께 담당 | Terracotta는 CTA, Navy는 검증/운영 전용 |
| 제목 서체 | Paperlogy 중심 | Noto Serif KR 중심 |
| 본문/UI | Pretendard 중심 | Pretendard/Noto Sans KR 유지 |
| 브랜드 인상 | 따뜻한 주거 전문가 + 시스템형 전문 브랜드 | 장인성 있는 따뜻한 주거 브랜드 + 정확한 상담 신뢰 |
| 표면 모드 | 상대적으로 약함 | Cream, Almond, Cocoa, Navy, Terracotta로 명확화 |
| 문서 구조 | 이미 충분하지만 일부 섹션 간밀도 차이 있음 | Claude식으로 토큰-표면-컴포넌트-적용 기준 강화 |

## 10. 성공 기준

이 고도화가 성공하면 다음이 가능해야 한다.

- 신규 웹앱/랜딩 작업자가 `DESIGN.md`만 읽어도 문장군 화면의 색, 서체, CTA, 카드, 사진 톤을 재현할 수 있다.
- 블로그 썸네일, 인스타 카드뉴스, 릴스 썸네일이 같은 브랜드 온도를 가진다.
- 문장군이 싸구려 시공업체나 차가운 시스템 업체가 아니라, 따뜻하지만 체계적인 도어·중문 전문 브랜드로 보인다.
- Noto Serif KR이 브랜드 감성을 만들지만, 상담 폼과 정보 화면의 실용성을 해치지 않는다.
- 네이비 사용이 줄어들어도 신뢰감이 약해지지 않고, 검증 영역에서 더 명확하게 작동한다.

## 11. 구현 범위 제안

이 스펙은 디자인 방향 승인 문서다. 다음 구현 계획에서는 아래 작업을 다룬다.

1. 중앙 `DESIGN.md` v3.0 재작성
2. `CHANGELOG.md` v3.0 기록
3. `PROMPTS.md`의 신규 웹앱/랜딩 제작 프롬프트에 새 디자인 방향 반영
4. 필요 시 `preview.html`을 새 v3 방향으로 재제작
5. `문장군_디자인` 프로젝트와 중앙 `DESIGN.md`의 권위 관계 감사

## 12. 제외 범위

이 단계에서는 아래를 직접 구현하지 않는다.

- 실제 웹앱 화면 코드 수정
- 실제 이미지 보정 프리셋 제작
- 로고 파일 제작
- 폰트 파일 설치
- 연계 프로젝트 문서 수정
- 브랜드 디자인 최종 배포

위 항목은 사용자가 이 스펙을 승인한 뒤 별도 구현 계획에서 다룬다.

