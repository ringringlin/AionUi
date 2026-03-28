---
name: morph-ppt-5
description: Generate Morph-animated PPTs with officecli (anti-residue morph gates + intent-driven component borrowing)
---

# Morph PPT 5.0

Build Morph PPT decks with a stable workflow: morph1 baseline + intent-driven component borrowing + anti-residue morph gates.

## Use when

- User wants a `.pptx` with Morph animation.

## Non-negotiable Morph constraints

- Scene actors: `!!...` naming, persist across slides.
- Content shapes: `#sN-...` naming, ghost previous content to `x=36cm`.
- Slides 2+ must use `transition=morph`.
- Run verification before delivery.

## Design baseline (must inherit morph1)

- Use morph1 design references as the primary design contract:
  - `reference/pptx-design.md`
  - `reference/quality-gates.md`
  - `reference/decision-rules.md`
- Remote component/template content is reference material only.
- Never let remote examples override morph readability, hierarchy, spacing, or animation rules.

## Component borrowing policy (core of 5.0)

- Default: read component **descriptions** to decide technique fit; do not reconstruct by script.
- Borrow only:
  - semantic usage (when to use)
  - information hierarchy pattern (title/body/evidence layering)
  - visual tone (restraint vs expressive)
- Do not borrow:
  - exact coordinates
  - exact dimensions
  - full layout skeleton from a single sample
- Per slide, borrow at most one main component technique, then compose the rest freely.
- If a borrowed component harms topic expression, downgrade it to subtle structure or remove it.

## 5-Step Workflow

### 1) ModeGate (fast)

Pick one mode first:

- `BRICK_COMPOSE` (default): remote component-first composition.
- `TEMPLATE_GUIDED_BRICK`: template only for calibration, not layout copy.
- `PURE_FREEFORM`: only if user explicitly asks "fully freeform / no remote references".

Rule:

- If user gives reference image, treat it as style signal only.
- Reference image must not disable component-first flow.

### 2) StyleGate (fast, bounded)

Decide style direction quickly:

- Define palette + typography + tone from topic (and reference image if present).
- Keep at most 2 style candidates.
- Use 3 candidates only for strong style-demand topics (cinematic/exhibition/brand portfolio).
- Do not over-explore; once “good enough”, move on.

Color + theme alignment rules (mandatory):

- Build a 3-color system: base / accent / emphasis.
- Each selected component must fit topic tone and chosen palette.
- If component default colors conflict with topic style, recolor the component instead of replacing topic style.
- Keep text contrast high per `pptx-design.md`; readability beats decoration.

Creative expression playbook (reference-only, not hard rules):

- You may use richer color expression, but keep a clear layer relationship:
  - background layer: atmosphere
  - container layer: structure
  - decoration layer: rhythm
  - text/data layer: highest clarity
- Recommended colorful strategy:
  - keep one base hue family
  - allow 1-2 accent hues for variation
  - reserve one emphasis color for focal points
- Per slide, keep one dominant visual focus; avoid multiple competing highlights.
- If a creative choice conflicts with readability or information hierarchy, follow existing hard rules and simplify decoration first.

### 2.5) ThemeAnchorGate (adaptive)

Detect whether the topic is concrete or abstract:

- `concrete_topic`: animal/person/product/place or any subject that should be recognizable at a glance.
- `abstract_topic`: concept/value/framework where symbolic abstraction is acceptable.

For `concrete_topic`, apply adaptive anchor coverage:

- Prefer visible theme anchors on at least `50%` of slides.
- Ensure opening or closing slide contains at least one recognizable theme anchor.
- Anchor forms can be lightweight (not photorealistic):
  - silhouette
  - icon-like symbol
  - keyword + geometric motif combination
- Do not force every slide to include an anchor; keep room for composition rhythm.

For `abstract_topic`, keep current abstract style freedom.

Topic-binding minimum (mandatory):

- `concrete_topic`: at least `max(3 slides, 50% slides)` must contain recognizable theme anchor.
- `abstract_topic`: at least `2` slides must contain explicit topic keywords or symbolic anchors.
- Theme anchor must be topic-relevant; generic circles/lines alone do not count.

Typography adaptation rules (mandatory):

- Theme can change font style, but readability floor cannot be broken.
- Recommended size floors:
  - hero/cta title: `54-72`
  - section title: `32-44`
  - card title / key label: `20-28`
  - body: `16-22`
  - caption/meta: `14-16` (only short auxiliary text)
- `font<=14` is allowed only for short labels/captions, never for core body paragraphs.
- On dark background with muted text colors, increase body size by `+1~2pt`.
- If a slide is content-light, prefer larger type and fewer containers; do not keep tiny text inside large cards.

### 3) ComponentGate (mandatory except PURE_FREEFORM)

After style + outline + per-page intent are fixed, fetch component references.

Source priority:

1. Remote OfficeCLI `COMPONENT_LIBRARY.md` (description-first)
2. Local snapshot fallback:
   - `reference/COMPONENT_LIBRARY.snapshot.md`
3. Built-in layering rules in this skill

Rules:

- Try remote first (with retry chain in `remote-style-source.md`).
- One DNS failure is not final; run retry chain before fallback.
- Template fetch is secondary; component fetch has higher priority.
- For non-`PURE_FREEFORM`, component fetch attempts must be `>=1` before fallback.
- Choose components by topic semantics and slide intent, not by novelty.
- Target per slide: 1 main borrowed technique that directly supports the message.
- Do not parse component scripts by default (`components.py` / template `build.sh` are non-default).

Component admission guardrails (mandatory, anti-copy):

- Admit components by page intent only. If a component does not match slide intent, do not use it.
- Ban instructional/demo components and sample teaching blocks in final deck.
- Do not import component example text verbatim from library docs.
- Do not copy "safe motif bundles" (e.g., repeated cross + giant circle + orbit) across all slides.
- Every selected component must pass this quick check:
  - semantic_fit: high (matches slide objective)
  - readability_risk: low (won't cover title/body)
  - text_origin: user/topic-derived (not library sample copy)
  - clone_risk: low (not a 1:1 structure copy)
  - topic_binding: explicit (supports topic recognition, not generic decoration)

Per-slide component decision output (mandatory in `brief.md`):

- `slide_intent=<...>`
- `anchor_choice=<component-technique or none>`
- `anchor_reason=<one sentence>`
- `clone_safety=<what was changed from source pattern>`

### 4) Build (component anchors + free zone)

Per-slide composition order:

1. Choose 1 borrowed anchor (can be strong or subtle) as structure reference.
2. Add `L0` background texture (1-2).
3. Add `L2` decoration (0-2).
4. Add `L3` content components for data-heavy pages.
5. Add at most 1 `L4` typography effect.
6. Add at most 1 primary Morph technique.

Hard limits:

- Max 1 `L4` per slide.
- Max 1 Morph primary technique per slide.
- If readability drops, reduce in order: `L4` -> `L2`.
- Keep creative freedom in non-anchor zones; do not copy any single template layout.

Template usage policy:

- Template is optional and secondary.
- Enable template calibration only when mode is `TEMPLATE_GUIDED_BRICK` or style consistency is clearly drifting.
- Use template for visual calibration (palette, rhythm, decoration density), not coordinate copy.

Soft-anchor policy (mandatory):

- Anchor does not have to be a large block/card.
- Accept subtle anchors: divider line, light backing plate, corner label, small data tag, low-opacity geometry (`opacity 0.06-0.12`).
- Reject "forced anchor" behavior: do not add a component only to satisfy anchor count.
- If anchor hurts readability or topic tone, downgrade to subtle anchor or remove.

Page-type anchor intensity:

- `hero` / `quote` / `transition`: subtle anchor preferred (or near-none).
- `evidence` / `pillars` / `comparison`: medium anchor preferred (1-2 useful structural anchors).
- `showcase`: one clear anchor around focal content, avoid extra competing anchors.

Information-first rule:

- Anchor must serve content structure first, visual style second.
- If an anchor does not improve reading flow, replace it with a lighter variant.
- Never let decorative anchors cover title/body content zones.

Component recolor rule (mandatory):

- Components are selected by semantics, then recolored into the chosen topic palette.
- Do not keep foreign default colors that conflict with deck tone.
- Keep palette compact (base/accent/emphasis) and consistent across slides.

Adaptive density rule (flex + hard fallback):

- Flex pass (default): estimate content density before finalizing large containers.
  - If a card contains only 1-2 short lines and no sub-structure, prefer half-height/compact card.
  - If multiple cards are low-density, either merge cards or reduce container heights.
  - For low-density pages, prioritize subtle structure over large empty blocks.
- Hard fallback (only when obvious mismatch remains):
  - If `container_height > 2.2x content_height` on a primary card, trigger one re-layout pass.
  - Re-layout must do at least one of: shrink card height, reduce card count, or increase content hierarchy.
  - If still weak after one pass, choose readability-first compact layout and continue.

Borrow-not-clone check (mandatory):

- If generated layout resembles one remote sample too closely, rewrite at least two of:
  - block order
  - spacing rhythm
  - focal hierarchy
  - actor motion path
- Keep idea-level borrowing, not geometry-level replication.

Anti-residue build rule (mandatory):

- Do not implement custom JSON parsing for ghosting in task scripts.
- Always use `reference/morph-helpers.sh` canonical ghost helpers.
- After each `clone -> ghost`, run strict residue check before adding new content.
- If residue check fails once, stop and fix; do not continue to next slide.

Slide composition diversity rule (mandatory):

- Across deck, at least 3 distinct composition rhythms are required (e.g., centered hero, split comparison, card grid, timeline flow).
- A repeated motif can appear globally, but not as the dominant focal element on 3+ consecutive slides.

Content hygiene (mandatory):

- Never keep placeholder/demo/tutorial text in output slides.
- Replace all component sample strings with topic-specific copy before delivery.
- If any text contains teaching/instruction tone (e.g., `小提示`, `示例`, `规则`, `步骤`), remove or rewrite.
- No duplicated giant headings across adjacent slides unless explicitly intended by outline.

Per-slide text sanity check (mandatory before final verify):

- title_count: exactly one primary title block per slide
- overlap_risk: no body text covered by decorative blocks
- language_cleanliness: no garbled/stacked duplicate text
- intent_alignment: text must match current slide brief
- typography_floor: body text is not below readability floor for current page type

### 5) Verify (single-pass strategy)

Avoid duplicate heavy checks.

Use one of these strategies:

- Default (fast): verify key slides during build + one final full check.
- Strict: verify each slide during build and skip duplicated second pass.

Do not run two full deck-wide verification passes.

Add visual sanity verification:

- If slide shows text overlap, stacked duplicates, or off-topic component text, fix first then continue.
- Prioritize readability over decorative completeness; drop problematic `L2/L4` immediately.

Ghost integrity verification (mandatory):

- For slide `N>=2`, previous slide content prefix `#s(N-1)-` must satisfy:
  - matched_count > 0
  - all matched shapes at `x=36cm`
- If either fails, treat as build error (not warning) and stop.

## Build script requirements

- Generate `brief.md` + re-runnable build script + output `.pptx`.
- Use `reference/morph-helpers.sh`.
- Do not define alternative ghost parser functions inside build scripts.
- Before building, remind user not to open target PPT during generation (avoid file lock).

## Delivery requirements

Final reply must include:

- Deck is ready and suggest opening now to preview Morph effects.
- One source line only:
  - `组件借鉴来源：远端描述` or `组件借鉴来源：本地快照描述`
  - `组件借鉴模式：description-only (non-clone)`
  - optionally `theme_anchor_coverage：<x>/<n> slides`
  - optionally `theme_binding_coverage：<x>/<n> slides`
  - optionally `配色策略：<topic-aligned palette summary>`

## References

- `reference/decision-rules.md`
- `reference/pptx-design.md`
- `reference/quality-gates.md`
- `reference/officecli-pptx-min.md`
- `reference/remote-style-source.md`
- `reference/morph-helpers.sh`
