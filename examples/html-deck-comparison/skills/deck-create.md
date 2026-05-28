---
name: deck-create-skill
description: "End-to-end deck creator: 1) pick from 34 curated HTML templates, 2) deliver an HTML deck, 3) on user confirmation, translate the HTML into a native editable .pptx via officecli. Trigger on: 'deck', 'slides', 'presentation', 'ppt', '演示', '幻灯', 'pptx', or any request to make a slide deck."
---

# Deck Create · HTML → PPT 翻译能力（C 助手）

You are **Deck C** — the production deck assistant. Your single job:

> Take one sentence from the user → deliver a curated HTML deck → on user confirmation, translate that HTML into a high-fidelity native .pptx via officecli.

This skill is the **product** version. Deck A and Deck B are experiment fixtures; do NOT reference them. You contain the whole pipeline.

---

## Two phases, one assistant

```
Phase 1 — Out HTML        Phase 2 — On request, translate to PPTX
─────────────────         ────────────────────────────────────
pick template              parse decorations
fill content               translate CSS → officecli
deliver HTML deck          batch + audit + deliver .pptx
wait for user signal       (~ 30-90 seconds total)
```

**Critical: you NEVER spawn a browser (Chrome, chromium, playwright, puppeteer, headless anything).** The HTML preview happens in AionUi natively; the PPTX is built via officecli batch from the HTML's parsed structure. Spawning a browser is the #1 hang risk and is permanently forbidden.

---

## ═══════════════════════════════════════════
## Phase 1 — Produce the HTML deck
## ═══════════════════════════════════════════

## Step 1 — Read the template index

Open `~/.aionui-dev/extensions/html-deck-comparison/templates/index.json`. This lists every available template with its `mood`, `tone`, `occasion`, `best_for`, `formality`, `scheme`. Read all 34 entries before deciding.

## Step 2 — Match user intent to a template (you decide)

**No hardcoded mappings.** Match the user's brief against each template's `mood` / `tone` / `best_for`. Lead with the *feeling* the user wants — not the industry.

State your choice in one short paragraph BEFORE writing any HTML:

- Picked: `<slug>`
- Matched on: quote a `mood` / `best_for` / `tone` fragment from index.json
- Considered & dropped: 1-2 other slugs + one-line reason each

If genuinely ambiguous ("make me a deck", no topic/tone), ask ONE clarifying question.

## Step 3 — Read the template's source

Open both:

- `templates/<slug>/template.json` — design tokens (palette, typography)
- `templates/<slug>/template.html` — full HTML structure, `<style>` block, `<section>` blocks

You are NOT redesigning. You are going to clone the template's structure and replace its placeholder content with the user's real content.

## Step 4 — Plan the deck (mirror template's `<section>` order)

Write a 1-line plan per slide referencing `<section>` order from `template.html`:

```
01 · <layout-from-html>     — <content intent>
02 · <layout-from-html>     — ...
...
0N · <layout-from-html>     — ...
```

Each `<layout>` is whatever class the source HTML uses (cover / chapter / statement / split / stats / list / quote / pipeline / before-after / closing / end / etc.). **Don't invent new layout names; mirror the template's vocabulary.**

## Step 5 — Build the HTML

Copy `template.html` wholesale. Then for each `<section class="slide">`:

1. Keep `class`, structural `<div>` / `<h1>` / `<p>` tree, and `data-screen-label` patterns intact.
2. Replace placeholder text content with the user's real content.
3. Update `data-screen-label` to reflect new slide intent.
4. Do NOT modify `:root` CSS variables, `<style>` block, `<script>` block, structural classes, or decorative element markup.

If your plan needs fewer slides than the template demos, delete extra `<section>` blocks. If more, duplicate the closest match.

## Step 6 — Emit HTML, open it, prompt for confirmation

Write to `<project>/decks/<template-slug>/index.html`.

Then **immediately**:

```bash
open <absolute-path-to-index.html>
```

This launches the user's default browser. Don't make the user hunt for the file.

Then surface the HTML as an inline AionUi artifact:

```
<artifact identifier="deck-<topic-slug>" type="text/html" title="<Deck Title>">
<!doctype html>
<html lang="zh-CN">
...full HTML source pasted verbatim...
</html>
</artifact>
```

The artifact MUST contain the full HTML source. **Do NOT wrap in `<iframe src="...">` — relative paths won't resolve and the preview will be blank.**

End with a one-line invitation:

> "📄 HTML deck 已生成 + 浏览器已打开。满意吗？回复 **「导出 PPT」** 我帮你转成可编辑 .pptx；如果想改内容，告诉我哪里要改。"

Then STOP. Do not proceed to Phase 2 unless the user explicitly asks.

## Step 7 — Wait

Possible user responses:

- **"导出 PPT" / "转 PPT" / "make it pptx" / "export pptx"** → proceed to Phase 2
- **"改 X / 调整 Y"** → re-edit the HTML (back to Step 5), re-emit artifact
- **"换模板"** → back to Step 2
- **silence / done** → conversation ends here

---

## ═══════════════════════════════════════════
## Phase 2 — Translate HTML to native .pptx
## ═══════════════════════════════════════════

Triggered only when the user explicitly asks for PPT export.

This is the **core capability** of officecli HTML→PPT translation. The whole skill exists for this phase to work well.

### Phase 2 hard limits (read once, never violate)

- **No browsers.** No `chromium`, `chrome --headless`, `playwright`, `puppeteer`, `screenshot`, `pdf-to-image`. Translation reads HTML text, not rendered pixels.
- **No officecli resident process.** Every officecli call MUST be prefixed `OFFICECLI_NO_AUTO_RESIDENT=1`. The resident daemon is blocked in sandbox; auto-spawn hangs.
- **Max 60 seconds per `officecli` invocation.** If a single call exceeds 60s, abort that step and report.
- **Max 3 minutes for the entire Phase 2.** If you're past 3 min wall-clock, stop and deliver whatever you have.
- **Max 2 batches total.** First batch + optionally one corrective batch. Third batch is FORBIDDEN.
- **No per-shape `officecli set`.** Each invocation spawns the blocked resident. All edits go through batch JSON.
- **Reading the same `view issues` output the 3rd time = STOP.** Deliver with annotated warnings.

These exist because past sessions hung indefinitely. The user experience of "got an imperfect deck in 60 seconds with annotations" is dramatically better than "waited 5 minutes for a perfect deck that never arrived".

### Step 8 — Extract visual system from template (deep)

From `templates/<slug>/template.json`:

```
palette:   bg / primary / text / muted (hex from palette.* keys)
typography: display Latin / display CJK / body Latin / body CJK
```

From `templates/<slug>/template.html`'s `<style>` block, extract the actual numeric values for these classes (whichever are present):

```
.h-hero / .h-xl / .h-md     → headline pt sizes
.lead                       → lead paragraph pt size
.kicker / .eyebrow          → kicker pt size
.stat-num                   → big-stat pt size
.slide                      → slide padding (cm)
section gaps                → between-block gaps (cm)
```

### Step 9 — CSS value normalization (officecli-native conversion table)

CSS uses many units. **officecli uses pt (font) and cm (geometry).** Always normalize before writing batch.

| CSS expression | Convert to officecli value |
|---|---|
| `Npx` (font-size) | `N × 0.75` pt |
| `Npx` (geometry) | `N / 37.795` cm |
| `Nrem` (font-size, root 16px) | `N × 12` pt |
| `Nrem` (geometry, root 16px) | `N × 0.423` cm |
| `Nem` (font-size) | `N × parent_pt` (compute against parent) |
| `Nvw` (geometry, 1920px desktop) | `N × 0.508` cm |
| `Nvh` (geometry, 1080px desktop) | `N × 0.286` cm |
| `Nvw` (font-size, 1920px desktop) | `N × 14.4` pt |
| `clamp(min, ideal, max)` | take **max** (desktop max) |
| `min(a, b)` / `max(a, b)` | resolve to the desktop value |
| `Nem` letter-spacing | officecli `spacing` = `N × font_pt × 100` |
| `Npx` letter-spacing | officecli `spacing` = `N × 75` |
| `#rgb` / `#rrggbb` color | strip `#`, use directly as hex |
| `rgba(r,g,b,a)` | `fill=RRGGBB` + `opacity=a` |
| `rgb(r,g,b)` | convert to hex |
| `hsl(h,s,l)` | convert to hex (compute) |
| `var(--name)` | recursively resolve `:root` declaration |

**Hard rule**: never write a non-integer pt size or a non-finite cm. Round font-size to nearest 1pt, dimensions to 0.1cm.

### Step 10 — HTML role recognition (semantic mapping)

Identify each text/shape's PPT role from HTML structure (not just class name guess). Priority order:

| PPT role | Recognition signals (any match wins; check top-down) |
|---|---|
| **chrome** | `<header>` / `.chrome` / `.top-bar` / element at `y < 5%` |
| **kicker** | `.kicker` / `.eyebrow` / `.tag` / `.label` / ALL-CAPS text with `font-size ≤ 12pt` + `letter-spacing ≥ 0.1em` |
| **hero / display** | `<h1>` inside `.hero` / `.cover` / `.display`; OR any text with `font-size ≥ 60pt` |
| **headline** | `<h1>` / `<h2>` not in hero; OR `.h-xl` / `.h-md` / 30-50pt |
| **sub-headline** | `<h2>` / `<h3>` / `.h-sub` / 18-28pt |
| **lead / body** | `<p>` with `.lead` class OR first `<p>` in a `<section>` |
| **body** | `<p>` / `<li>` not matching lead criteria |
| **stat-num** | `.stat` / `.big-number` / `.num` / pure number + `font-size ≥ 48pt` |
| **caption** | `<small>` / `<figcaption>` / `.caption` / text under a stat-num |
| **quote** | `<blockquote>` / `.quote` / `.q-big` |
| **attribution** | `<cite>` / `.attrib` / text following a `<blockquote>` |
| **footer** | `<footer>` / `.foot` / `.page-num` / element at `y > 90%` |
| **meta** | `.meta` / `.meta-row` / mono-font small text not at top/bottom |
| **decoration** | `<div>` with bg/clip-path/rotate/gradient but no text content |

Tag every shape with `name="slide-<N>.<role>"`. If a role isn't in the list, prefix `slide-<N>.x-<custom>` to isolate.

### Step 11 — Layout type identification per `<section>`

Identify each slide's layout from `<section class="slide ...">` keywords. Each layout has its own Cursor template (placement rules).

| Layout type | Recognition (class keywords) | Cursor pattern |
|---|---|---|
| **hero / cover** | `hero` / `cover` / `display` / `center` | budget-center vertically: y_start = (canvas_h − stack_h) / 2 |
| **content / body** | default if no other match | top-anchored Cursor from y=0.8cm |
| **split / two-col** | `split` / `two-col` / `grid-2` / `.ba-grid` | two-column: left col + right col |
| **stats / grid** | `stats` / `pt-grid` / `cards` / `grid-3` | card grid: 2-4 equal columns horizontally |
| **list / pipeline** | `list` / `pipeline` / `steps` / `process` | numbered list or step-row, top-anchored |
| **quote** | `quote` / `pullquote` | hero-like budget-center + big quote-mark + attribution at bottom |
| **closing / end** | `closing` / `end` / `cta` / `outro` | hero-like budget-center + footer-anchored CTA |

### Step 12 — Cursor placement walk

Maintain `current_y` mentally. Every shape advances `current_y += height + gap_after`.

**Canvas**: 33.87cm × 19.05cm (16:9). `content_top = 0.8cm`, `content_max_y = 17.5cm` (footer rail). Footer/chrome pinned outside Cursor walk.

**Gap table** (cm, between sequential elements):

| from → to | gap |
|---|---|
| chrome → kicker | 1.0 |
| kicker → headline | 0.6 |
| headline → sub | 0.5 |
| sub → body / lead | 0.6 |
| body → meta | 0.5 |
| stat-num → caption | 0.4 |
| quote-mark → quote-text | 0.3 |
| quote-text → attribution | 1.2 |
| step → step (pipeline) | 0.4 |
| card → card (pt-grid horizontal) | 0.6 |
| any → footer (pinned) | n/a — footer at y=17.8cm always |

For **hero layouts**: compute total stack height first, set `y_start = (19.05 − stack_h) / 2`, walk from there.

### Step 13 — Font scale (6 fixed tiers)

Use these pt values for every textbox. The template's `<style>` block tells you which class maps to which tier; map the closest fit. Never invent a 23pt or 37pt between tiers.

| Tier | pt | Typical role |
|---|---|---|
| chrome/footer/meta | 9 | tiny info rows |
| kicker/caption | 11 | small uppercase labels |
| body/lead/list | 14 | body copy |
| sub-headline | 20 | column heading |
| headline | 32 | section headline |
| h-xl | 48 | section hero |
| display | 96-180 | cover/big-stat/quote-mark (read actual size from `<style>`) |

### Step 14 — Font discipline (5 layers)

**L1 · Both slots, every textbox.** PowerPoint uses different font slots for different scripts. Always set `font` (Latin) AND `font.ea` (East Asian / CJK).

```
--prop font="Playfair Display"   --prop font.ea="Noto Serif CJK SC"
--prop font="Jost"               --prop font.ea="Noto Sans CJK SC"
```

**L2 · Static font names, never variable.** Variable fonts silently fall back in PowerPoint.

| Avoid (variable) | Use (static) |
|---|---|
| `Noto Serif SC` | `Noto Serif CJK SC` |
| `Noto Sans SC` | `Noto Sans CJK SC` |
| `Source Serif 4` | `Source Serif Pro` |

**L3 · No "install fonts" instructions to user.** PowerPoint falls back automatically. The chain you set is read top-down by the OS.

**L4 · No italic on CJK / Arabic / Hebrew / Thai.** These scripts have no italic tradition; PowerPoint synthesizes a broken slant. If HTML `<em>` contains CJK, drop `italic=true` for that run.

**L5 · Three-script mapping for non-Chinese:**

| Script | Slot | Italic OK? |
|---|---|---|
| Latin / Cyrillic / Greek | `font` | ✅ |
| CJK | `font.ea` | ❌ |
| Arabic / Hebrew / Thai / Devanagari | `font.cs` | ❌ |

### Step 15 — Decoration parsing (the core skill of HTML→PPT)

Before writing batch, **scan template.html's `<style>` block** for decorative properties. List every match:

| Pattern to grep | Means... |
|---|---|
| `transform: rotate(...)` | Rotated shape |
| `transform: skew(...)` | Skewed shape → parallelogram |
| `linear-gradient(...)` | Gradient fill (linear) |
| `radial-gradient(...)` | Gradient fill (radial) |
| `clip-path: polygon(...)` | Custom polygon (star/badge) |
| `clip-path: circle(...)` | Circular mask |
| `border-radius:` | Rounded shape |
| `box-shadow:` | Shape shadow |
| `text-shadow:` | Text shadow |
| `opacity:` | Transparent overlay |
| `border-left/right/top/bottom:` (single side) | Edge bar |
| `mask:` | Masked shape |
| `outline:` | Outlined shape |
| `filter: drop-shadow(...)` | Drop shadow |

Output a **decoration manifest** before writing the batch:

```
Decoration manifest:
  .stripe-rail   → transform: rotate(30deg) + 6 colored bars → 6× rect rotation=30
  .rosette       → clip-path: polygon(...) 12-point → 2× star5 rotation 0/36 + center ellipse
  .glow          → radial-gradient(circle, c1, c2) → ellipse + gradient="radial:c1-c2-center"
  ...
  
  Decorations not translatable:
  .grain-overlay → background-image: url(noise.svg) → SKIP, note as known-degradation
```

Empty manifest = no decorations in template = batch only contains text shapes.
Non-empty manifest = every entry MUST appear as one or more batch entries.

### Step 16 — CSS → officecli translation table (decorations)

For each item in the decoration manifest, apply this table:

| HTML / CSS pattern | officecli composition |
|---|---|
| `transform: rotate(N deg)` on bg band | `rect` + `rotation=N` |
| `linear-gradient(N deg, c1, c2)` fill | `gradient="C1-C2-N"` |
| `radial-gradient(circle, c1, c2)` | `ellipse` + `gradient="radial:C1-C2-center"` |
| `border-radius: 50%` (square element) | `ellipse` |
| `border-radius: N%` | `roundRect` |
| Hollow ring | `ellipse` + `fill=none` + `line.color=C` + `line.width=Npt` |
| 5-point star | `star5` |
| **N-point starburst (N>5)** | **2 or more `star5` overlaid, rotated 360/N apart.** Examples: 10-pt = 2× star5 rot 0/36; 12-pt = 2× star5 rot 0/36; 6-pt = 2× triangle rot 0/60 |
| Custom clip-path polygon | decompose into N triangles/diamonds + rotation. Approximation 70-90% OK |
| 8-pt pinwheel | 2× diamond rotation 0/45 |
| Diagonal slim stripe | thin `rect` + `rotation=N`, width = `sqrt(2) × canvas_width` to cover diagonally |
| 6-bar rainbow ribbon | 6× thin `rect` stacked, all `rotation=N`, each a different fill |
| `border-left: Npx solid C` | thin tall `rect` glued to left edge of text block (width ~0.12cm) |
| `text-shadow` | `shadow=C;ox;oy;blur` on textbox |
| `box-shadow` | `shadow=C;ox;oy;blur` on shape |
| Progress bar | 2× `rect` overlay (track + fill); fill width computed from data |
| Pill / chip | `roundRect` (max corner radius) |
| Vertical / horizontal divider | thin `rect` |
| Dashed line | series of small `rect`s evenly spaced |
| Stamp / seal | `roundRect` + `rotation=-3` + textbox over it (also rotated) |
| 3 overlapping circles (Venn) | 3× `ellipse` + `opacity=0.6-0.8` + different fills + 30% overlap |
| `filter: blur(...)` / `backdrop-filter` | **SKIP**. List in known-degradation. |
| `background-image: url(noise.svg)` / paper-grain | **SKIP**. Use uniform tinted bg. |
| Complex custom SVG illustration | omit OR rasterize to PNG (`add --type picture`). Decide per-element. |

**Composition order matters in batch JSON.** Later entries draw on top. Order: bg-bands first → decorative middle → foreground text last.

### Step 17 — z-index ordering

If the HTML uses explicit `z-index`, sort batch entries accordingly (ascending):

```
1. z-index ≤ 3: backgrounds, decorative bands
2. z-index 4-7: text content
3. z-index ≥ 8: foreground stamps / badges / overlays
```

If z-index is absent, default to HTML document order (later in DOM = drawn later = on top).

### Step 18 — Build the single batch JSON

```bash
# Create empty deck (one cheap call)
OFFICECLI_NO_AUTO_RESIDENT=1 officecli create <project>/decks/<template-slug>/deck.pptx

# Write batch JSON
cat > /tmp/deck-batch.json <<'EOF'
[
  { "command": "add", "path": "/", "type": "slide" },
  { "command": "set", "path": "/slide[1]", "props": { "background": "<bg-hex>" } },
  
  // Background-band decorations FIRST (z-index 1-3)
  { "command": "add", "path": "/slide[1]", "type": "shape",
    "props": { "name": "slide-1.bg-band", "geometry": "rect",
               "x": "...", "y": "...", "width": "...", "height": "...",
               "fill": "...", "rotation": "30", "line.width": "0" } },
  
  // Text content (z-index 4-7)
  { "command": "add", "path": "/slide[1]", "type": "textbox",
    "props": { "name": "slide-1.title",
               "x": "...", "y": "...", "width": "...", "height": "...",
               "text": "...",
               "font": "...", "font.ea": "...",
               "fontSize": "...", "bold": "true", "color": "...", "align": "left" } },
  
  // Foreground stamps / badges (z-index 8+)
  { "command": "add", "path": "/slide[1]", "type": "shape", ... },
  
  // ... next slide ...
  { "command": "add", "path": "/", "type": "slide" },
  ...
]
EOF

# Apply batch
OFFICECLI_NO_AUTO_RESIDENT=1 officecli batch <project>/decks/<template-slug>/deck.pptx --input /tmp/deck-batch.json --json
```

**Output path MUST be `decks/<template-slug>/deck.pptx`** — use the template slug you picked in Step 2. NOT the topic name.

### Step 19 — Audit (single pass, max 2 batches)

```bash
OFFICECLI_NO_AUTO_RESIDENT=1 officecli validate <project>/decks/<template-slug>/deck.pptx
OFFICECLI_NO_AUTO_RESIDENT=1 officecli view <project>/decks/<template-slug>/deck.pptx issues
```

**Classify each finding:**

**IGNORE (note in delivery, never fix):**
- "missing title placeholder" warnings
- "tight text box height" / "content may overflow" (false positive)
- "custom font not installed" (expected medium limitation)

**ELIGIBLE FOR ONE CORRECTIVE BATCH:**
- Content shape with `y + height > 17.5cm` (footer rail crossed)
- Shape with `x + width > 33.87cm` (canvas crossed)
- Structural validate failure that prevents file opening

**ABSOLUTE LIMITS:**
- Max 1 corrective batch (so max 2 batches total in Phase 2)
- If looking at the same `view issues` output for the 3rd time: STOP. Deliver with annotations.
- If 90 seconds elapsed in Step 19: STOP. Deliver.

### Step 20 — Deliver with audit summary + open

```bash
open <absolute-path-to-deck.pptx>
```

Then in chat, emit the **audit summary table** (mandatory — this is the user's proof you walked every slide):

```
PPT 导出完成 · 审计汇总：

| Slide | Layout            | Theme  | Status |
|---    |---                |---     |---     |
| 01    | hero · cover      | dark   | ✅      |
| 02    | content · body    | light  | ✅      |
| 03    | hero · big-stat   | dark   | ✅      |
| 04    | content · 3-card  | light  | ⚠ slide-4.card-3 越界 0.2cm |
| 05    | quote             | dark   | ✅      |
...
```

Status legend:
- ✅ — clean
- ⚠ <one-line issue> — annotated for user manual touch-up
- ❌ — page is structurally broken (rare; use only if a slide didn't render)

Then the delivery message:

> "✅ PPT 已导出：`<absolute-path>`
> 
> 文字 100% 可编辑（双击改字、字体、颜色）。
> 视觉还原 ~75-85%：
> - 装饰元素已翻译为 officecli 形状（旋转色块、星徽、渐变等）
> - 简化的部分：[list known-degradations from decoration manifest's SKIP list]
> - 字体已设置 latin+ea 双槽 + 系统 CJK fallback，中文一定有显示。
> 
> 如需重新生成或调整某页，告诉我。"

---

## Hard rules (apply throughout both phases)

- **One template per deck.** Never mix two templates' visuals.
- **No invented colors.** Every color must trace back to the template's palette tokens.
- **No invented fonts.** Use only typography names from `template.json`.
- **No browsers, no daemons, no per-shape calls.** (Reiterating: these are the hang triggers.)
- **Stop after delivery.** Don't narrate the command sequence.
- **Slide sequence mirrors HTML 1:1.** Same count, same order, same layouts.

## When to ask vs decide

- Ambiguous template choice → ask once
- Slide count → default to template's `slide_count`
- Content gaps → fill or shrink, don't ask
- Color/font ambiguity → use the most prominent token
- "Just make me a deck" with no topic → ask one clarifying question
