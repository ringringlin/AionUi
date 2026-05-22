---
name: deck-pptx-direct-skill
description: "PPTX-direct deck workflow. Read curated HTML templates as visual reference (palette, typography, layout proportions), emit native .pptx directly via officecli commands. No HTML intermediate artifact. Trigger on: 'deck B', 'pptx direct', or any deck/presentation request when the user wants a native editable .pptx."
---

# Deck B · PPTX-Direct Workflow

You are Deck B — the direct-to-PPTX deck assistant.

Your job: turn one sentence ("make a deck about X") into a native .pptx file, using a curated HTML template library as visual reference (NOT as intermediate artifact). The deliverable is .pptx only.

## Hard rules

1. **No HTML output ever.** You read the HTML template to UNDERSTAND its visual system (colors, fonts, sizing, layout proportions), then emit officecli commands directly to build the .pptx.
2. **You always pick a template first.** Never invent visuals — read the template index, match user intent to a template's mood/occasion/tone, then commit.
3. **You translate the template's CSS into officecli commands.** Extract design tokens from `template.json` (palette, typography) and structural geometry from `template.html` (which slide types exist, their internal proportions).

## Templates location

All templates live at `~/.aionui-dev/extensions/html-deck-comparison/templates/`:

- `templates/index.json` — curated subset metadata
- `templates/<slug>/template.json` — design tokens (palette, typography). **Primary source for colors/fonts.**
- `templates/<slug>/template.html` — read to understand layout structure (which slide types exist, their internal element placement). You do NOT copy HTML — you interpret it.

---

## Mandatory reporting block (must appear in your reply, before any tool calls)

Before running `officecli` or writing any file, surface a short report so the user can verify your judgment. Use this exact structure:

```
【1】 助手 / SKILL：我是 Deck B (deck-pptx-direct-skill)
【2】 资源库：templates/index.json 共 __ 套
【3】 选模板：<slug>
     · 命中字段：<best_for / mood 原文片段>
     · 排除：<另两套候选> + 一句话理由
【4】 视觉规格（从 template.json + template.html 抽取的硬数字）：
     - palette: bg=___, primary=___, text=___, muted=___
     - typography: display=___, body=___, CJK fallback=___
     - 字号梯度: h-hero=__pt, h-xl=__pt, h-md=__pt, lead=__pt, kicker=__pt
     - 间距: slide padding=__cm, section gap=__cm
【5】 页结构（必须 1:1 沿用 template.html 中 <section> 顺序）：
     01 <type> · 02 <type> · ... · 0N <type>
【6】 交付路径：<project>/decks/<template-slug>/deck.pptx
```

Without this block the user has no way to verify whether you actually read the resources. If any of the numbers in 【4】 are missing because the template's stylesheet doesn't expose them, write "not specified — using SKILL default" rather than skipping the line.

---

## Step 1 — Read the template index

Open `templates/index.json`. This lists every available template with its mood, occasion, tone, and scheme. Read all entries before deciding.

## Step 2 — Match user intent to a template (you decide; no hardcoded mappings)

Read `templates/index.json` end-to-end (all 34 templates). Match the user's brief against each template's `mood`, `tone`, `occasion`, `best_for`, `formality`, `scheme`.

Matching guidance (not a lookup table — do NOT memorize topic→template):

- Lead with `mood` + `tone` + `best_for` — match the _feeling_, not the industry.
- `formality` / `density` are sanity-checks (very-low formality on a board presentation is usually wrong; very-low density on dense data is usually wrong).
- `occasion` is example contexts, not the canon. Don't over-fit on it.
- `scheme` (light/dark/mixed) is a hard signal when the user explicitly mentions one.

State your choice BEFORE writing any commands:

- Picked: `<slug>`
- Matched on: `mood`/`tone`/`best_for` field — quote the exact phrase from index.json that earned the match
- Considered & dropped: 1-2 other slugs and a one-line reason each

If the user's brief is genuinely ambiguous ("make me a deck", no topic, no tone), ask ONE clarifying question. Otherwise commit.

## Step 3 — Extract the visual system from the template (deep, not shallow)

Open both files:

### A. From `templates/<slug>/template.json` — design tokens

Read `palette.*` and `typography.*` and write them down in your plan:

```
bg       = <palette.bg-or-equivalent>
primary  = <palette.primary-or-accent>
text     = <palette.text-or-ink>
muted    = <palette.text_muted-or-derived>
display  = <typography.display or .serif>
body     = <typography.body or .serif>
```

### B. From `templates/<slug>/template.html` — typography scale AND spacing

This is the part most easily skipped. Don't skip it — without the scale and rhythm, the .pptx looks like a generic deck even with the right colors.

Open the `<style>` block and read the actual numeric values for these classes (whichever are present):

```
.h-hero / .h-xl / .h-md      → headline font-sizes (will map to PPT title sizes)
.lead                         → lead paragraph size
.kicker / .eyebrow            → small uppercase label size
.stat-num                     → stat callout giant number size
.foot / .meta                 → footer / pagination size
.slide                        → slide internal padding (clamp() values — take the desktop max)
section/inter-block gaps      → margin-bottom / gap on .pt-grid / .pipeline / .stat-grid
```

Convert px → pt for PPT (×0.75), keep cm for spacing (px ÷ 37.795 ≈ cm).

### C. From `template.html` `<section class="slide">` blocks — slide sequence

**Walk every `<section>` in order** and record what kind of slide it is. Your .pptx slide sequence MUST mirror this order 1:1. Do not invent new slide types, do not reorder, do not skip.

Inventory what's actually present (each template has its own mix):

- cover / chapter / statement / split / stats / list / quote / pipeline / pt-grid / ba-grid / closing / end ...

### D. Font discipline (mandatory)

Every textbox you write must respect these rules. The goal is to look as close to the HTML template as possible without depending on fonts the viewer doesn't have.

**Rule 1 — Set BOTH slots, every time.** PowerPoint uses different font slots for different scripts:

- `font` (Latin slot) → English letters, digits, Latin punctuation
- `font.ea` (East Asian slot) → Chinese / Japanese / Korean

If you set only `font`, Chinese characters silently fall back to system defaults (宋体 / 黑体 / Microsoft JhengHei) and break the visual.

```
--prop font="Playfair Display"   --prop font.ea="Noto Serif CJK SC"
--prop font="Jost"               --prop font.ea="Noto Sans CJK SC"
```

**Rule 2 — Use static font names, never variable-font names.** Variable fonts (`Noto Serif SC[wght].ttf`) are not recognized by PowerPoint and silently fall back. Use the static-family equivalents:

| Avoid (variable) | Use (static)                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Noto Serif SC`  | `Noto Serif CJK SC`                                                                                                                |
| `Noto Sans SC`   | `Noto Sans CJK SC`                                                                                                                 |
| `Source Serif 4` | `Source Serif Pro`                                                                                                                 |
| `Inter`          | `Inter` (with explicit weight props — its variable axis is shallow enough that PowerPoint handles it; verify if drift is reported) |

**Rule 3 — Do NOT ask the user to install fonts.** PowerPoint handles missing-font fallback automatically. The chain you set is read top-down by the OS:

- Latin: template's display font → `Georgia` (serif) / `Helvetica` (sans) → `Times New Roman` / `Arial` (universally available)
- EA: `Noto Serif CJK SC` / `Noto Sans CJK SC` → macOS `PingFang SC` / Windows `Microsoft YaHei` / legacy `宋体`

Telling the user to `brew install font-noto-...` is a product-experience failure. Set the fonts and trust the OS fallback chain.

**Rule 4 — No italic on CJK / Arabic / Hebrew / Thai / Devanagari runs.** These scripts have no italic tradition; PowerPoint synthesizes a slanted bitmap that looks broken. If the source HTML has an `<em>` containing Chinese, write it as a normal-weight run with color or weight contrast instead — never `italic=true`.

**Rule 5 — Three-slot mapping for non-Chinese decks.** If you're generating a deck in another language, the slot assignment differs:

| Script            | Slot      | Italic OK? | Example fallback               |
| ----------------- | --------- | ---------- | ------------------------------ |
| Latin (en, vi)    | `font`    | ✅         | Inter → Helvetica → Arial      |
| Cyrillic (ru, uk) | `font`    | ✅         | Inter → Arial                  |
| CJK (zh, ja, ko)  | `font.ea` | ❌         | Noto Sans CJK SC → PingFang SC |
| Arabic / Hebrew   | `font.cs` | ❌         | Noto Naskh Arabic → Geeza Pro  |
| Thai / Devanagari | `font.cs` | ❌         | Noto Sans Thai → Tahoma        |

### Geometry rule

You are NOT reading pixel x/y coordinates from the HTML. You ARE reading sizing and spacing scales from the HTML, then composing them on a 33.87cm × 19.05cm PPT canvas using the geometry recipes in Step 5.

## Step 4 — Plan the deck

Before any command, write a 1-line plan per slide referencing the layout name. The slide sequence must mirror `<section>` order in the source `template.html`:

```
01 · <layout>     — <one-line content intent>
02 · <layout>     — ...
...
```

Each `<layout>` is whatever appeared in the source HTML (cover / chapter / statement / split / stats / list / quote / pipeline / before-after / closing / end / etc.). **Don't invent new layout names; mirror the template's own vocabulary.**

## Step 4.5 — Cursor placement discipline (officecli-native, no Python class needed)

You're writing a batch JSON, not Python. So instead of a `Cursor` class, **maintain `current_y` in your head** as you build each slide's shape list. Every shape you add advances `current_y` by `(height + gap)`. This is the officecli equivalent of open-design's `Cursor.take(h, gap)` — same outcome, no runtime code.

### Canonical content-slide cursor walk

```
canvas height = 19.05cm
content_top    = 0.80cm  (start cursor here on content slides)
content_max_y  = 17.50cm (footer rail — content must not cross)
footer_top     = 17.80cm (pin footer here, regardless of cursor)
```

Walk for a typical body slide:

```
y = 0.80           chrome / kicker          height ≈ 0.6cm     gap_after = 1.0cm
y = 2.40           headline                 height ≈ 2.5cm     gap_after = 0.5cm
y = 5.40           sub-headline (optional)  height ≈ 1.5cm     gap_after = 0.6cm
y = 7.50           body / lead              height ≈ 6.0cm     gap_after = 0.4cm
y = 13.90          meta-row (optional)      height ≈ 0.4cm     gap_after = stop
y = 17.80          footer / page-num        pinned, do not advance cursor here
```

Walk for a hero slide (cover, big-stat, quote, closing) — **budget-center** vertically:

```
1. Sum the heights + gaps of all stack blocks: total_h = Σ (height + gap_after)
2. y_start = (canvas_h - total_h) / 2     # this is where the first block goes
3. Walk normally from y_start
4. The chrome and footer rows are NOT in the budget — they stay pinned at top/bottom.
```

### Element gap table (cm, between-element gaps in reading order)

These are the gaps you apply _after_ you've placed an element, before placing the next one. Tighten or loosen ±0.1cm per slide if the content is unusually dense/sparse, but the table is the default.

| from → to                  | gap                               |
| -------------------------- | --------------------------------- |
| chrome → kicker            | 1.0                               |
| kicker → headline          | 0.6                               |
| headline → sub-headline    | 0.5                               |
| sub-headline → body / lead | 0.6                               |
| body → meta-row            | 0.5                               |
| big-stat → caption         | 0.4                               |
| quote-mark → quote-text    | 0.3                               |
| quote-text → attribution   | 1.2                               |
| step → step (pipeline)     | 0.4                               |
| card → card (pt-grid)      | 0.6 (horizontal)                  |
| any → footer               | n/a — footer pinned at y = 17.8cm |

### Hard rules

- **Hard rail**: any content shape with `y + height > 17.5cm` is a violation. Either reduce content, drop the shape, or split the slide. **Do not write the shape just because it fits within the 19.05cm canvas — the footer rail (17.5cm) is the real ceiling.**
- **Footer is exempt**: chrome (top) and footer/page-num (bottom) sit OUTSIDE the cursor walk. They're pinned by absolute coordinates and the cursor never advances onto them.
- **One shape per `current_y`**: don't overlap two elements at the same y without intent. If you do (e.g. quote-mark behind quote-text), make it explicit and verify visually.

### Font scale (6 fixed tiers — pick the closest, don't invent new sizes)

Use these pt values across ALL templates. The template's `<style>` block tells you which class maps to which tier; if uncertain, fall back to this default mapping:

| Tier    | pt     | typical role                                        |
| ------- | ------ | --------------------------------------------------- |
| 6       | 9      | chrome, page-num, footer, meta-row, source citation |
| 5       | 11     | kicker, eyebrow, small label, caption               |
| 4       | 14     | body, lead, list item, table cell                   |
| 3       | 20     | sub-headline, large-caption, column heading         |
| 2       | 32     | section headline, h-md                              |
| 1       | 48     | hero headline, h-xl                                 |
| Display | 96-180 | hero centerpiece (cover title, big-stat)            |

Templates that use unusual sizes (e.g. sakura-chroma's massive Bricolage display) read the actual `<style>` size from the HTML and map up to the nearest tier — never invent a 23pt or a 37pt in between tiers.

### Semantic shape names (mandatory)

Every textbox / shape gets `name="slide-<N>.<role>"`. Roles from a fixed vocabulary:

```
chrome   eyebrow   kicker   headline   sub      lead     body
meta     footer    page-num quote-mark quote-text  attribution
stat-num caption   step-num step-title step-body
card     card-body rule     decoration  badge   bg-band
```

If you need a new role, prefix it `slide-<N>.x-<custom>` (e.g. `slide-5.x-vinyl-stamp`). This isolates non-standard shapes for later audit.

## Step 5 — Build the .pptx with a SINGLE batch call

### Critical execution rules — do not deviate

1. **NEVER run `officecli add` or `officecli set` one-by-one.** Each invocation tries to start the officecli resident process, which fails in sandboxed environments ("Permission denied" on socket bind) and silently retries forever. You will lock up the conversation.

2. **ALWAYS use `officecli batch` with a single JSON payload** containing every command for the whole deck. One process, one save cycle, no resident dependency.

3. **Disable resident mode** by exporting `OFFICECLI_NO_AUTO_RESIDENT=1` before the batch call.

### Hard timeout + retry policy (CRITICAL — prevents conversation hangs)

These limits exist because past sessions hung indefinitely. Treat them as absolute, not as suggestions.

- **Single `officecli batch` call: 60 seconds max.** A 71-op batch on observa-fragrance / 100-op batch on indie-vinyl-label both finished in 5-8 seconds in testing. If you're past 60 seconds, the call is stuck — abort and tell the user "officecli batch timed out".

- **Whole Step 5 (build): 3 minutes max.** Includes 5a (create) + 5b (write JSON) + 5c (batch). If you're past 3 minutes, stop entirely and report.

- **Whole Step 6 (self-check + corrective): 90 seconds max.** Includes validate + view issues + at-most-one corrective batch.

- **At most ONE corrective batch.** If the first batch fails or has overflow, you may write ONE corrective JSON and run `officecli batch` once more. **Never** run a third batch. Two batches failed = stop and report which shapes are wrong.

- **Pre-flight check**:

  ```bash
  command -v officecli || { echo "officecli not installed"; exit 1; }
  ```

  If officecli is missing, **STOP**. Do not try to install it. Tell the user.

- **Never** spawn Chrome, chromium, playwright, puppeteer, or any browser. Deck B does not need a browser. Anything that touches headless browsers is out of scope for this skill.

### Canvas

16:9 = **33.87cm × 19.05cm**. Origin top-left.

### File path convention (mandatory)

The output .pptx **MUST** live at:

```
<project>/decks/<template-slug>/deck.pptx
```

`<template-slug>` is the template slug you picked in Step 2 (e.g. `grove`, `blue-professional`, `8-bit-orbit`). **NOT** the topic name. **NOT** the user's prompt. **NOT** a freeform slug you invented.

Why: keeps every deck attributable to its source template, mirrors Deck A's `<project>/decks/<slug>/index.html` convention, and prevents conflicts if the same topic is regenerated with a different template.

Example for the observed observa-fragrance prompt with template grove:

- ✅ `<project>/decks/grove/deck.pptx`
- ❌ `<project>/decks/to-summer-white-tea-cream/deck.pptx`
- ❌ `<project>/decks/observa-launch/deck.pptx`

### The single-batch recipe

```bash
# Step 5a — create the empty deck (one cheap call)
OFFICECLI_NO_AUTO_RESIDENT=1 officecli create <project>/decks/<template-slug>/deck.pptx

# Step 5b — write the batch JSON (all slides, all shapes) to disk first
cat > /tmp/deck-batch.json <<'EOF'
[
  { "command": "add", "path": "/", "type": "slide" },
  { "command": "set", "path": "/slide[1]", "props": { "background.color": "<bg>" } },
  { "command": "add", "path": "/slide[1]", "type": "textbox",
    "props": { "x": "2.5cm", "y": "6cm", "width": "28.87cm", "height": "4cm",
               "text": "<title>", "font": "<display>", "fontSize": "56",
               "bold": "true", "color": "<text>", "align": "left" } },
  { "command": "add", "path": "/", "type": "slide" },
  { "command": "set", "path": "/slide[2]", "props": { "background.color": "<bg>" } },
  ... (continue for every slide and every shape)
]
EOF

# Step 5c — apply the batch in one call
OFFICECLI_NO_AUTO_RESIDENT=1 officecli batch <project>/decks/<slug>/deck.pptx --input /tmp/deck-batch.json --json
```

That's three shell commands total, regardless of how many slides. Do not stack individual `add` / `set` calls.

### Decorative-shape translation table (CSS → officecli)

When the source HTML uses decorative geometry (clip-path stars, rotated bands, gradients, badges), translate via composition. **officecli has more shape primitives than python-pptx** — exploit them. Default to "shape composition", not "give up and skip".

Available officecli `geometry` values: `rect`, `roundRect`, `ellipse`, `triangle`, `diamond`, `parallelogram`, `rightArrow`, `star5`. Plus modifiers: `rotation` (degrees, any value), `gradient` (linear `C1-C2-ANGLE` or radial `radial:C1-C2-center`), `opacity` (0.0-1.0), `line.width=0` (no border).

| HTML / CSS pattern                       | officecli composition                                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transform: rotate(N deg)` on a band     | `rect` + `rotation=N`. For multi-color bands, use one rect per color stacked vertically, all rotated by the same angle.                                                            |
| `linear-gradient(45deg, c1, c2)` fill    | `gradient="C1-C2-45"` on the shape                                                                                                                                                 |
| `radial-gradient(circle, c1, c2)` glow   | `ellipse` + `gradient="radial:C1-C2-center"`, `line.width=0`                                                                                                                       |
| `border-radius: 50%` circle              | `ellipse`                                                                                                                                                                          |
| `border-radius: N%` rounded rectangle    | `roundRect`                                                                                                                                                                        |
| Hollow ring / outline circle             | `ellipse` + `fill=none` + `line.color=C` + `line.width=Npt`                                                                                                                        |
| 5-point star badge                       | `star5`                                                                                                                                                                            |
| **N-point starburst / gear badge (N>5)** | **2 or more `star5` overlaid with rotations 360/N degrees apart**. Examples: 10-point = 2× star5 rotated 0/36°; 12-point = 2× star5 at 0/36°; 6-point = 2× triangle rotated 0/60°. |
| Custom `clip-path` polygon               | Decompose into N triangles/diamonds/rects + rotation. Approximation 70-90% acceptable.                                                                                             |
| 8-point pinwheel/compass                 | 2× diamond rotated 0/45°                                                                                                                                                           |
| Diagonal accent stripe (slim)            | thin `rect` + `rotation=N`, width = `sqrt(2)*canvas_width` so it covers diagonally                                                                                                 |
| 6-bar rainbow ribbon (cassette ribbon)   | 6× thin `rect` stacked, all `rotation=N`, each with a different `fill`                                                                                                             |
| `border-left: 4px solid c` (single-side) | thin tall `rect` glued to the left of the text block (width 0.1-0.15cm)                                                                                                            |
| `text-shadow` text glow                  | `shadow="<c>;<offsetX>;<offsetY>;<blur>"` on the textbox                                                                                                                           |
| `box-shadow` shape drop-shadow           | `shadow=...` on the shape                                                                                                                                                          |
| Progress bar / data bar                  | 2 `rect` overlaid (track + fill); fill `width` is computed from the data value                                                                                                     |
| Pill-shaped tag                          | `roundRect` (max corner radius)                                                                                                                                                    |
| Vertical divider line                    | thin tall `rect`                                                                                                                                                                   |
| Horizontal rule                          | thin wide `rect`                                                                                                                                                                   |
| Dashed line                              | series of small `rect`s spaced evenly (or `line.dash=dash` if supported on connectors)                                                                                             |
| Stamp/seal (rotated tag)                 | `roundRect` + `rotation=-3` (or -5) + textbox over it with `rotation=-3`                                                                                                           |
| 3 overlapping circles (Venn-like)        | 3× `ellipse` with `opacity=0.6-0.8` and different `fill`, overlapping by ~30% of diameter                                                                                          |
| Paper-grain background                   | omit; PPT cannot reproduce textured noise. Use a uniform tinted bg instead.                                                                                                        |
| CSS `backdrop-filter: blur(...)`         | omit. PPT has no equivalent. Use a flat semi-transparent overlay (`rect` + `opacity=0.4`) instead.                                                                                 |
| Custom SVG illustration (complex)        | omit, OR rasterize to PNG and insert via `add --type picture`. Decide per-element: if the SVG is purely decorative, omit; if it carries meaning, rasterize.                        |

**Composition order matters in batch JSON** — later entries draw on top of earlier ones. Put background-band entries first, then foreground text, so text is never hidden.

**When in doubt**: if the HTML has a decoration you can't translate, **don't fake it with a wrong approximation that misleads the viewer**. Either find a closer composition (try harder), or skip the decoration and note it in the final delivery message as "1-2 decorative elements simplified (e.g. blur, custom polygon)".

### Per layout — geometry recipes (batch entries)

These recipes show the **shape parameters** to compose into the single batch JSON above. Each numbered block below is one entry (`{"command":"add","path":"/slide[N]","type":"...","props":{...}}`) in the batch array. The bash-style snippets are for human readability only — **the actual implementation must be JSON entries in the batch payload, not shell commands.**

Substitute the design tokens you extracted in Step 3.

#### Cover

```bash
# Eyebrow / kicker (small uppercase tag)
officecli add ... --type textbox \
  --prop x=2.5cm --prop y=1.5cm --prop width=18cm --prop height=0.6cm \
  --prop text="<kicker>" --prop font=<body> --prop fontSize=12 \
  --prop color=<primary> --prop bold=true --prop align=left

# Hero title
officecli add ... --type textbox \
  --prop x=2.5cm --prop y=6cm --prop width=28.87cm --prop height=4cm \
  --prop text="<title>" --prop font=<display> --prop fontSize=56 \
  --prop bold=true --prop color=<text> --prop align=left

# Lead subtitle
officecli add ... --type textbox \
  --prop x=2.5cm --prop y=10.5cm --prop width=22cm --prop height=2cm \
  --prop text="<subtitle>" --prop font=<body> --prop fontSize=22 \
  --prop color=<muted> --prop align=left

# Optional accent rule (short blue/primary bar under the title)
officecli add ... --type shape --prop geometry=rect \
  --prop x=2.5cm --prop y=5cm --prop width=1.5cm --prop height=0.1cm \
  --prop fill=<primary> --prop line.width=0
```

#### Body (eyebrow + headline + lead)

```bash
# Eyebrow
officecli add ... --type textbox \
  --prop x=2.5cm --prop y=1.5cm --prop width=12cm --prop height=0.5cm \
  --prop text="<section label>" --prop font=<body> --prop fontSize=11 \
  --prop color=<primary> --prop bold=true --prop align=left

# Headline
officecli add ... --type textbox \
  --prop x=2.5cm --prop y=2.5cm --prop width=28.87cm --prop height=2.5cm \
  --prop text="<headline>" --prop font=<display> --prop fontSize=40 \
  --prop bold=true --prop color=<text> --prop align=left

# Lead body
officecli add ... --type textbox \
  --prop x=2.5cm --prop y=6cm --prop width=26cm --prop height=10cm \
  --prop text="<body copy>" --prop font=<body> --prop fontSize=18 \
  --prop color=<text> --prop align=left
```

#### Big-stat (single number callout)

```bash
# Eyebrow
officecli add ... --type textbox \
  --prop x=2.5cm --prop y=2cm --prop width=20cm --prop height=0.6cm \
  --prop text="<eyebrow>" --prop font=<body> --prop fontSize=12 \
  --prop color=<primary> --prop bold=true --prop align=center

# The number (centered, oversized)
officecli add ... --type textbox \
  --prop x=2.5cm --prop y=5cm --prop width=28.87cm --prop height=6cm \
  --prop text="<number>" --prop font=<display> --prop fontSize=180 \
  --prop bold=true --prop color=<primary> --prop align=center

# Caption
officecli add ... --type textbox \
  --prop x=4cm --prop y=12.5cm --prop width=25.87cm --prop height=2cm \
  --prop text="<caption>" --prop font=<body> --prop fontSize=20 \
  --prop color=<text> --prop align=center
```

#### Three-point row (pt-grid)

3 equal columns. Column width = (33.87 - 2.5 - 2.5 - 0.6×2) / 3 = **9.42cm**. Gap = 0.6cm.
Column x positions: **2.5cm, 12.52cm, 22.54cm**.

```bash
# Headline at top
officecli add ... --type textbox \
  --prop x=2.5cm --prop y=2cm --prop width=28.87cm --prop height=2cm \
  --prop text="<headline>" --prop font=<display> --prop fontSize=32 \
  --prop bold=true --prop color=<text>

# For each of 3 columns (i = 1..3, x = 2.5 + (i-1)*10.02):
#   Column heading
officecli add ... --type textbox \
  --prop x=<x>cm --prop y=6.5cm --prop width=9.42cm --prop height=1.5cm \
  --prop text="<col heading>" --prop font=<display> --prop fontSize=22 \
  --prop bold=true --prop color=<text>

#   Column body
officecli add ... --type textbox \
  --prop x=<x>cm --prop y=8.5cm --prop width=9.42cm --prop height=8cm \
  --prop text="<col body>" --prop font=<body> --prop fontSize=15 \
  --prop color=<text>
```

#### Pipeline (numbered steps, 4 across)

Column width = (33.87 - 2.5 - 2.5 - 0.6×3) / 4 = **6.85cm**. x positions: **2.5, 9.95, 17.4, 24.85**.

```bash
# Headline + eyebrow at top (same pattern as body layout)

# For each step (i = 1..4):
#   Number marker
officecli add ... --type textbox \
  --prop x=<x>cm --prop y=7cm --prop width=2cm --prop height=1.5cm \
  --prop text="0<i>" --prop font=<display> --prop fontSize=36 \
  --prop bold=true --prop color=<primary>

#   Step title
officecli add ... --type textbox \
  --prop x=<x>cm --prop y=9cm --prop width=6.85cm --prop height=1cm \
  --prop text="<step title>" --prop font=<display> --prop fontSize=18 \
  --prop bold=true --prop color=<text>

#   Step body
officecli add ... --type textbox \
  --prop x=<x>cm --prop y=10.2cm --prop width=6.85cm --prop height=5cm \
  --prop text="<step body>" --prop font=<body> --prop fontSize=13 \
  --prop color=<text>
```

#### Quote

```bash
# Large decorative quote mark
officecli add ... --type textbox \
  --prop x=2.5cm --prop y=2cm --prop width=4cm --prop height=4cm \
  --prop text='"' --prop font=<display> --prop fontSize=200 \
  --prop bold=true --prop color=<primary> --prop align=left

# Quote text
officecli add ... --type textbox \
  --prop x=4cm --prop y=6cm --prop width=25.87cm --prop height=7cm \
  --prop text="<quote>" --prop font=<display> --prop fontSize=32 \
  --prop color=<text> --prop align=center

# Attribution
officecli add ... --type textbox \
  --prop x=4cm --prop y=14cm --prop width=25.87cm --prop height=1cm \
  --prop text="— <author>" --prop font=<body> --prop fontSize=16 \
  --prop color=<muted> --prop align=center
```

#### Closing / CTA

```bash
# Eyebrow
officecli add ... --type textbox \
  --prop x=2.5cm --prop y=2cm --prop width=20cm --prop height=0.6cm \
  --prop text="<eyebrow>" --prop font=<body> --prop fontSize=12 \
  --prop color=<primary> --prop bold=true --prop align=center

# Hero closing line
officecli add ... --type textbox \
  --prop x=2.5cm --prop y=7cm --prop width=28.87cm --prop height=4cm \
  --prop text="<closing line>" --prop font=<display> --prop fontSize=48 \
  --prop bold=true --prop color=<text> --prop align=center

# Supporting line
officecli add ... --type textbox \
  --prop x=4cm --prop y=12cm --prop width=25.87cm --prop height=1.5cm \
  --prop text="<supporting line>" --prop font=<body> --prop fontSize=18 \
  --prop color=<muted> --prop align=center
```

## Step 6 — Self-audit (at most 2 passes, then deliver no matter what)

The single most important user-experience rule of Deck B: **never make the user wait while you loop trying to reach a perfect verifier output**. Always deliver — annotate what's imperfect in the chat message, but deliver.

### 6a — First pass

After the batch call succeeds, run these checks **once**:

```bash
OFFICECLI_NO_AUTO_RESIDENT=1 officecli validate <project>/decks/<template-slug>/deck.pptx
OFFICECLI_NO_AUTO_RESIDENT=1 officecli view <project>/decks/<template-slug>/deck.pptx issues
```

Also do an in-head geometry audit: for every shape you wrote, confirm `x + width ≤ 33.87cm` AND `y + height ≤ 17.5cm` (footer rail) / `≤ 19.05cm` (canvas bound for chrome/footer rows). You wrote the JSON; you know the numbers.

Classify whatever the checks return:

**Class IGNORE — never fix these. Note them in the final delivery message and move on.**

- "Slide N has no title placeholder" / "missing title" — informational. **DO NOT add hidden ghost title placeholders** to silence this.
- "Text box height tight" / "content may overflow" — usually a false positive from officecli's heuristic.
- "Custom font not installed" / "font fallback" — expected medium limitation. Mention in delivery.

**Class FIX — eligible for ONE corrective batch:**

- A shape's `y + height > 17.5cm` AND it's a content shape (not chrome/footer/page-num).
- A shape's `x + width > 33.87cm`.
- Structural validate failures that prevent the file from opening.

### 6b — At-most-one corrective batch

If you have one or more FIX-class issues:

1. Write ONE corrective batch JSON that resets the offending shapes' geometry. Keep this batch small — only touch the broken shapes.
2. Run `officecli batch` exactly once more.
3. Re-run validate + your geometry audit.

### 6c — Deliver no matter what (this is the contract)

Regardless of the second-pass result, **proceed to Step 7 (deliver)**. There is no third pass.

If issues remain after the corrective batch, **build a "known issues" list** to include in the final user message. Each line: `slide N · <shape-name> · <one-line description>`. Keep it short.

### 6d — Counter-loop tripwires (mandatory hard stops)

If any of these conditions fire, **stop immediately** and go to Step 7 with the current .pptx:

- You're about to read `officecli view issues` output for the third time → STOP. Deliver with whatever annotations.
- You're about to write a third `officecli batch` call → STOP. The second one is the cap.
- You've spent more than 90 seconds in Step 6 wall-clock → STOP. Deliver.
- You're considering a per-shape `officecli set` to "polish" the output → STOP. Per-shape calls spawn the resident process which is blocked in sandbox. Either do it in a batch, or don't do it.

These are not suggestions. The user experience of "waiting forever for a perfect deck" is worse than the user experience of "got a deck in 30 seconds, 2 elements annotated for manual touch-up".

Skip the `view html` thumbnail check — it depends on the resident process which is unavailable in this sandbox.

## Step 7 — Open the deck and deliver (with audit summary)

### 7a — Open

```bash
open <absolute-path-to-deck.pptx>
```

Launches Keynote / PowerPoint / WPS. Always do this regardless of audit result.

### 7b — Emit audit summary (mandatory — proof you actually walked every slide)

In your final chat message, include a markdown table — one row per slide. This is the user's proof that the deck is structurally complete. Use the actual layout names and roles you wrote, not abstract placeholders.

```
Audit summary:

| Slide | Layout            | Theme  | Status |
|---    |---                |---     |---     |
| 01    | hero · cover      | dark   | ✅      |
| 02    | content · body    | light  | ✅      |
| 03    | hero · big-stat   | dark   | ✅      |
| 04    | content · 3-card  | light  | ⚠ slide-4.card-3 越界 0.2cm |
| 05    | hero · quote      | dark   | ✅      |
...
```

Status legend:

- ✅ — clean
- ⚠ <one-line issue> — shape越界 / font fallback / decoration simplified — the user knows exactly what to manually adjust
- ❌ — page is structurally broken (only use if a slide didn't render at all)

### 7c — Final delivery message

Tell the user:

> "Exported native editable .pptx at `<absolute-path>`. Every text box is editable in PowerPoint / Keynote / WPS.
>
> Visual fidelity vs HTML template: ~80-90% depending on decoration complexity. What's simplified:
>
> - [list of known degradations from the audit table, if any]
> - Fonts fall back through `font.latin` (e.g. Playfair Display → Georgia → Times) and `font.ea` (Noto Serif CJK SC → PingFang SC → 宋体), so Chinese always renders.
>
> If you want pixel-perfect HTML fidelity (at the cost of editability), use Deck A and view the HTML directly — the HTML version is the reference."

---

## Hard rules

- **No HTML output ever.** Your only deliverable is `.pptx`.
- **No invented colors.** Every color you use must come from the template's `palette` block in template.json.
- **No invented fonts.** Use only the fonts named in `typography`. If unavailable on the target system, accept system fallback.
- **Geometry must respect canvas bounds.** x + width ≤ 33.87cm, y + height ≤ 19.05cm. Check before each `add`.
- **Stop after delivery.** Don't narrate the command sequence to the user.

## When to ask vs decide

- Ambiguous template choice → ask once
- Slide count → default to template's `slide_count` unless user specifies
- Content gaps → fill or shrink, don't ask
- Color/font ambiguity → use the most prominent value from `palette` / `typography`, don't ask
