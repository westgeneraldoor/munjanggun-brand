# Munjanggun Design System Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the central Munjanggun `DESIGN.md` into a v3.0 design-system source using the approved "A palette + B messaging/structure + B typography" direction.

**Architecture:** Treat `docs/superpowers/specs/2026-06-25-munjanggun-design-system-upgrade-design.md` as the approved design spec. Rewrite `DESIGN.md` as the canonical source, then update `CHANGELOG.md` and `PROMPTS.md` so linked projects know the new design authority. Keep `preview.html` as optional visual follow-up unless explicitly requested during execution.

**Tech Stack:** Markdown, YAML front matter, UTF-8 Korean text. No application code required.

---

## File Structure

| File | Action | Responsibility |
| --- | --- | --- |
| `DESIGN.md` | Modify | Central v3.0 design system source. Replace v2.0 palette/type direction with approved v3.0 while preserving valid Munjanggun product, content, photo, and component rules. |
| `CHANGELOG.md` | Modify | Record v3.0 update with date, summary, and affected downstream projects. |
| `PROMPTS.md` | Modify | Update the webapp/landing prompt and any design-related project prompt language to mention the new design direction. |
| `README.md` | Modify if needed | Only update if file roles or latest version metadata should mention DESIGN v3.0. |
| `preview.html` | Leave unchanged in this plan | Rebuild as a separate follow-up unless the user explicitly includes preview execution. |

Git note: `C:\Users\hjh\안티그래비티\문장군_브랜드` is not currently a git repository. Do not run commit commands. Use `CHANGELOG.md` as the change record.

## Source Documents

Read these before editing:

1. `AGENTS.md`
2. `BRAND_CONTEXT.md`
3. `FIELD_JUDGMENT_RULES.md`
4. `DESIGN.md`
5. `PROJECT_ADAPTERS.md`
6. `docs/superpowers/specs/2026-06-25-munjanggun-design-system-upgrade-design.md`

The approved design direction is:

```text
색감: A
문구/구조: B
타이포그래피: B
```

Core sentence:

```text
좋은 문을 고르는 일,
따뜻하게 정확하게
```

Design thesis:

```text
Warm Craft, Guided Choice, Verified Work.
```

---

### Task 1: Rewrite `DESIGN.md` Metadata and Token Block

**Files:**
- Modify: `DESIGN.md`
- Reference: `docs/superpowers/specs/2026-06-25-munjanggun-design-system-upgrade-design.md`

- [ ] **Step 1: Read the current metadata and YAML token block**

Run:

```powershell
Get-Content -Encoding UTF8 -TotalCount 130 'DESIGN.md'
```

Expected: output shows `version: alpha`, `name: MUNJANGGUN`, current v2.0 metadata, existing `colors`, `typography`, `rounded`, `spacing`, and `components`.

- [ ] **Step 2: Replace YAML colors with v3.0 approved tokens**

Use this exact color token set in the front matter:

```yaml
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
```

- [ ] **Step 3: Replace typography tokens with balanced serif/sans system**

Use this exact typography token structure:

```yaml
typography:
  brand-ko:
    fontFamily: "Noto Serif KR, Song Myung, Noto Serif CJK KR, serif"
    fontSize: 42px
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: 0
  brand-en:
    fontFamily: "Manrope, Inter, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: 0
  display-hero:
    fontFamily: "Noto Serif KR, Song Myung, Noto Serif CJK KR, serif"
    fontSize: 56px
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: 0
  display-section:
    fontFamily: "Noto Serif KR, Song Myung, Noto Serif CJK KR, serif"
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: 0
  display-card:
    fontFamily: "Noto Serif KR, Song Myung, Noto Serif CJK KR, serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.34
    letterSpacing: 0
  body:
    fontFamily: "Pretendard, Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: 0
  body-strong:
    fontFamily: "Pretendard, Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 16px
    fontWeight: 650
    lineHeight: 1.62
    letterSpacing: 0
  label:
    fontFamily: "Manrope, Pretendard, Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: 0
  caption:
    fontFamily: "Pretendard, Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  metric:
    fontFamily: "Manrope, Inter, Pretendard, system-ui, sans-serif"
    fontSize: 34px
    fontWeight: 850
    lineHeight: 1
    letterSpacing: 0
```

- [ ] **Step 4: Update component tokens**

Use this exact baseline for the component section:

```yaml
components:
  button-primary:
    backgroundColor: "{colors.clay-terracotta}"
    textColor: "{colors.on-terracotta}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: 14px 20px
    height: 50px
  button-secondary:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.cocoa-oak}"
    borderColor: "{colors.warm-line}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: 14px 20px
    height: 50px
  trust-badge:
    backgroundColor: "{colors.cocoa-oak}"
    textColor: "{colors.cashmere-cream}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
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
```

- [ ] **Step 5: Update document metadata**

At the Markdown heading section, set:

```markdown
# DESIGN - 문장군

> 버전: v3.0  
> 최종 업데이트: 2026-06-25  
> 변경 요약: A 색감 + B 문구/구조 + B 타이포그래피 기반 디자인 시스템 고도화  
> 기준: 중앙 BRAND_CONTEXT.md, FIELD_JUDGMENT_RULES.md, 2026-06-25 디자인 상담, Claude DESIGN 문서 구조 벤치마킹
```

- [ ] **Step 6: Verify token references**

Run:

```powershell
rg -n "canvas-warm|surface-oat|surface-oak|trust-navy|hinge-brass|glass-blue|Paperlogy" 'DESIGN.md'
```

Expected: output is empty, except historical references are acceptable only inside a clearly marked "기존 v2.0 대비 변경" section.

---

### Task 2: Rewrite Main `DESIGN.md` Narrative Sections

**Files:**
- Modify: `DESIGN.md`
- Reference: `BRAND_CONTEXT.md`
- Reference: `FIELD_JUDGMENT_RULES.md`
- Reference: `docs/superpowers/specs/2026-06-25-munjanggun-design-system-upgrade-design.md`

- [ ] **Step 1: Replace Overview and Design Thesis**

Use these exact thesis elements:

```markdown
### Design Thesis

**Warm Craft, Guided Choice, Verified Work.**

- Warm Craft: 흙, 나무, 크림, 테라코타에서 오는 장인적 온기.
- Guided Choice: 고객이 혼자 고르지 않도록 고민별·분위기별 선택지를 좁혀주는 구조.
- Verified Work: 무료 방문실측, 직접 제작, 전속 시공, 리뷰, A/S로 신뢰를 증명하는 구조.
```

Keep this rule in the Overview:

```text
문장군은 감성 인테리어 브랜드처럼만 보여도 안 되고, 투박한 시공업체처럼 보여도 안 된다.
```

- [ ] **Step 2: Rewrite the Colors section**

The Colors section must include:

1. Core Palette table with all v3 color tokens.
2. Color ratio:
   - 60% `cashmere-cream`, `paper-white`
   - 18% `toasted-almond`
   - 12% `cocoa-oak`
   - 7% `clay-terracotta`
   - 3% `verified-navy`
3. Role notes:
   - `clay-terracotta` is CTA/action warmth, not discount emphasis.
   - `verified-navy` is for 검증·전산·운영 flow, not the main brand mood.
   - `cocoa-oak` replaces broad black/navy depth with warmer craft depth.

- [ ] **Step 3: Add Surface Modes section after Colors**

Add this section exactly:

```markdown
## Surface Modes

문장군은 색을 여러 개 흩뿌리는 대신 표면 모드로 화면 리듬을 만든다.

| Surface | 색 | 사용처 |
| --- | --- | --- |
| Cream Canvas | `{colors.cashmere-cream}` | 기본 페이지 배경, 브랜드 스토리 |
| Paper Card | `{colors.paper-white}` | 본문 카드, FAQ, 가격 설명 |
| Almond Band | `{colors.toasted-almond}`의 연한 변형 | 선택 가이드, 상담 흐름, 부드러운 정보 영역 |
| Cocoa Trust Surface | `{colors.cocoa-oak}` | 신뢰 섹션, 직접 제작·전속 시공, A/S 근거 |
| Verified Navy Surface | `{colors.verified-navy}` | 전산, 검증, 관리자, 운영 체계, 중요한 증거 영역 |
| Terracotta Callout | `{colors.clay-terracotta}` | 단일 강한 CTA 밴드, 상담 전환 영역 |
```

Then add the usage rules from the approved spec: first viewport starts warm/light, cocoa is for deep trust, navy is limited, terracotta callout is rare, no nested cards.

- [ ] **Step 4: Rewrite Typography**

Ensure Typography says:

- Noto Serif KR is for Brand / Hero Display only.
- Pretendard or Noto Sans KR remains for body/UI.
- Manrope or Inter remains for numbers and English.
- Full serif UI is not allowed.
- `MUNJANGGUN` stays smaller than `문장군`.

- [ ] **Step 5: Rewrite Components**

Preserve existing components but update names and color roles:

- `button-primary` uses `clay-terracotta`.
- `button-secondary` uses `paper-white` and `cocoa-oak`.
- `trust-badge` first viewport still only 3 badges:

```text
무료 방문실측
직접 제작 · 전속 시공
고객 리뷰로 검증
```

- Add `Proof Panel` as a first-class component.
- Keep `Problem Selector`, `Mood Selector`, `Case Card`, `Review Card`, `Price Box`, `Consultation Flow`, `Direct Work Section`, `FAQ`, `Form Fields`.

- [ ] **Step 6: Preserve existing brand/product constraints**

Confirm these rules remain present:

- Red price emphasis is forbidden.
- Dark smart-store thumbnails are not the whole brand mood.
- First viewport proof badges are capped at 3.
- Product-in-home imagery is primary.
- Factory/site photos are proof, not first impression.
- Review proof is `전체 상품 리뷰 3만 개+`, `대표상품 단일 리뷰 1.4만 개+`.
- Customer begins from problem/mood, not product taxonomy.
- Mobile Korean line breaks must be verified.

---

### Task 3: Update `CHANGELOG.md`

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add v3.0 entry at the top**

Insert this entry below the title:

```markdown
## v3.0 - 2026-06-25

- DESIGN.md v3.0 고도화
  - A 색감 + B 문구/구조 + B 타이포그래피 승인 방향 반영
  - 코코아 오크, 클레이 테라코타, 캐시미어 크림, 토스티드 아몬드, 검증 네이비 기반 팔레트 재정의
  - Noto Serif KR은 히어로/섹션 제목 중심, 본문/UI는 Pretendard 또는 Noto Sans KR 유지
  - 표면 모드 추가: Cream Canvas, Paper Card, Almond Band, Cocoa Trust Surface, Verified Navy Surface, Terracotta Callout
  - Proof Panel 컴포넌트 추가
  - 기존 네이비 중심 신뢰 구조를 검증/전산/운영 보조색으로 제한
- Claude DESIGN 문서 구조를 벤치마킹하되 문장군 도어·중문 시공 브랜드에 맞게 재해석
```

- [ ] **Step 2: Verify changelog order**

Run:

```powershell
Get-Content -Encoding UTF8 -TotalCount 40 'CHANGELOG.md'
```

Expected: v3.0 appears before v2.2.

---

### Task 4: Update `PROMPTS.md`

**Files:**
- Modify: `PROMPTS.md`

- [ ] **Step 1: Update metadata**

Set top metadata:

```markdown
> 버전: v1.2  
> 최종 업데이트: 2026-06-25  
> 변경 요약: DESIGN.md v3.0 고도화 방향을 신규 웹앱/랜딩 제작 프롬프트에 반영
```

- [ ] **Step 2: Update Section 5 신규 웹앱/랜딩 프롬프트**

In the 핵심 기준 block, replace design-related bullets with:

```text
- 문장군 디자인은 Warm Craft, Guided Choice, Verified Work를 따른다.
- 첫인상은 코코아 오크, 클레이 테라코타, 캐시미어 크림 기반의 따뜻한 장인성으로 만들고, 검증/전산/운영 흐름에는 네이비를 제한적으로 사용한다.
- 큰 제목과 브랜드 문장은 Noto Serif KR 계열을 우선하고, 본문/UI/버튼/폼은 Pretendard 또는 Noto Sans KR 계열을 사용한다.
- 메인 비주얼은 제품이 인테리어와 예쁘게 어울리는 밝은 주거 공간 이미지여야 한다.
- 첫 화면 신뢰 배지는 무료 방문실측, 직접 제작·전속 시공, 고객 리뷰 검증 3개를 우선한다.
```

Preserve the existing forbidden direction:

```text
- 빨간 가격 강조, 할인 전단지 느낌, 근거 없는 최고/최저가/No.1 표현, 차가운 대기업 느낌, 둥글둥글한 생활앱 느낌은 피해주세요.
```

- [ ] **Step 3: Check central paths remain intact**

Run:

```powershell
rg -n "문장군_브랜드\\DESIGN.md|FIELD_JUDGMENT_RULES.md|BRAND_CONTEXT.md" 'PROMPTS.md'
```

Expected: central source paths are still listed in the common and project prompts.

---

### Task 5: Optional README Metadata Update

**Files:**
- Modify: `README.md` only if execution changes the central version label.

- [ ] **Step 1: Decide whether README needs a version bump**

If `DESIGN.md`, `CHANGELOG.md`, and `PROMPTS.md` are updated to v3.0/v1.2, set README metadata to:

```markdown
> 버전: v3.0  
> 최종 업데이트: 2026-06-25  
> 변경 요약: 중앙 DESIGN.md v3.0 디자인 시스템 고도화 반영
```

If README is meant to track only folder composition rather than design version, leave it unchanged and note that in the completion report.

- [ ] **Step 2: Verify file list still includes design planning docs**

Run:

```powershell
rg -n "DESIGN.md|AGENTS.md|TEAM.md|PROJECT_RELATIONSHIP_AUDIT|docs/superpowers" 'README.md'
```

Expected: README still lists the central design source and existing operating docs. It does not need to list every plan/spec unless intentionally chosen.

---

### Task 6: Verification Pass

**Files:**
- Read: all modified files

- [ ] **Step 1: Check for stale v2 design tokens in DESIGN.md**

Run:

```powershell
rg -n "canvas-warm|surface-oat|surface-oak|trust-navy|hinge-brass|glass-blue|Paperlogy" 'DESIGN.md'
```

Expected: no active-token references. Historical comparison references are acceptable only if clearly marked as v2.

- [ ] **Step 2: Check required v3 terms exist**

Run:

```powershell
rg -n "Warm Craft|Guided Choice|Verified Work|cocoa-oak|clay-terracotta|cashmere-cream|Noto Serif KR|Proof Panel|Surface Modes" 'DESIGN.md'
```

Expected: all terms appear.

- [ ] **Step 3: Check forbidden claims remain forbidden**

Run:

```powershell
rg -n "최저가|No\\.1|100%|무조건 가능|절대 추가금|빨간 가격" 'DESIGN.md'
```

Expected: terms appear only in Don't/금지 sections, not as recommended copy.

- [ ] **Step 4: Check UTF-8 Korean readability**

Run:

```powershell
Get-Content -Encoding UTF8 -TotalCount 20 'DESIGN.md'
Get-Content -Encoding UTF8 -TotalCount 20 'PROMPTS.md'
Get-Content -Encoding UTF8 -TotalCount 20 'CHANGELOG.md'
```

Expected: Korean displays correctly.

- [ ] **Step 5: Report completion**

Completion report must include:

- Modified files.
- Whether README was updated.
- Whether preview rebuild was deferred.
- Any unresolved design questions.
- Note that git commit was not run because this folder is not a git repository.

