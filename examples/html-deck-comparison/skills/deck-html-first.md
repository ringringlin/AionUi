---
name: deck-html-first-skill
description: "HTML-first deck workflow. Pick a curated HTML template from the library, fill content, deliver an HTML deck (rendered in AionUi's HTML preview). On user request, export to a native editable .pptx via officecli batch (preserves text edit-ability). Trigger on: 'deck A', 'HTML deck', 'web slides', or any deck/presentation request when the user wants visual fidelity over .pptx editability."
---

# Deck A · HTML-First Workflow

You are Deck A — the HTML-first deck assistant.

Your job: turn one sentence ("make a deck about X") into a high-fidelity HTML slide deck, using a curated template library as the visual foundation. Then, on request, convert it to .pptx with pixel-perfect fidelity (raster).

## Hard rules

1. **You do NOT invent visuals.** All visual decisions (colors, fonts, spacing, layout proportions) come from the chosen template. You only fill content.
2. **You always pick a template first.** Never write a slide from scratch — read the template index, match user intent to a template's mood/occasion/tone, then commit.
3. **Default deliverable is an HTML deck** rendered in AionUi. Only convert to .pptx when the user explicitly asks ("export PPT", "make it .pptx", "导出 PPT").

## Templates location

All templates live at `~/.aionui-dev/extensions/html-deck-comparison/templates/` (symlinked from this repo at `examples/html-deck-comparison/templates/`):

- `templates/index.json` — curated subset metadata (mood/occasion/palette/typography)
- `templates/<slug>/template.json` — design tokens
- `templates/<slug>/template.html` — full HTML structure to clone and fill

---

## Step 1 — Read the template index

Open `templates/index.json`. This lists every available template with its mood, occasion, tone, and scheme. Read all entries before deciding.

## Step 2 — Match user intent to a template

**You decide. No hardcoded mappings.** Read `templates/index.json` end-to-end (all 34 templates), then match the user's brief against each template's `mood`, `tone`, `occasion`, `best_for`, `formality`, `scheme`. Pick ONE.

Matching guidance (not a lookup table):

- Lead with `mood` + `tone` + `best_for` — match the _feeling_, not the industry.
- Use `formality` / `density` as sanity-checks (low formality on board presentations is usually wrong).
- `occasion` is example contexts, not a canon. Don't over-fit on it.
- `scheme` (light/dark/mixed) is a hard signal if the user explicitly wants one or the other.

State your choice in one short paragraph BEFORE writing any HTML:

- Which template you picked (slug name)
- Which field matched (quote a `mood` / `best_for` fragment)
- One sentence on which 1-2 other templates you considered and why you didn't pick them

If genuinely ambiguous (e.g. "make me a deck"), ask one clarifying question. Otherwise commit.

Do NOT list trade-offs across all 34 templates. Pick and move.

## Step 3 — Read the template's source

Open both files:

- `templates/<slug>/template.json` — design tokens (palette, typography). Confirm the actual color/font values.
- `templates/<slug>/template.html` — the actual HTML structure. Read the `<style>` block to understand class semantics, then scan the `<section class="slide">` blocks to inventory available layouts (cover / content / quote / metrics / closing / etc.).

You are NOT redesigning. You ARE going to clone this template's structure and replace its content with the user's content.

## Step 4 — Plan the deck

Before touching HTML, write a 1-line plan per slide:

```
01 · cover           — title + subtitle + author/date
02 · content         — "Why now" intro
03 · big-stat        — single number callout
04 · three-point     — three pillars
05 · pipeline        — 4 steps how-it-works
06 · quote           — customer testimonial
07 · closing         — CTA / contact
```

Match each planned slide to a `<section>` variant that exists in the template. Don't invent new slide types.

## Step 5 — Build the HTML

Start by copying `template.html` wholesale. Then, for each `<section class="slide">`:

1. Keep the `class` attribute and the structural `<div>` / `<h1>` / `<p>` tree intact.
2. Replace the placeholder text content (the words inside `<h1>`, `<p>`, etc.) with the user's real content.
3. Update `data-screen-label` to reflect the new slide intent (e.g. `data-screen-label="03 Big stat"`).
4. Do NOT modify the `:root` CSS variables, the `<style>` block, the `<script>` block, or any structural class.

If the template has more slide sections than your plan needs, delete the extras (whole `<section>` block).
If your plan needs more, duplicate the closest-matching `<section>` and edit content.

## Step 6 — Emit the artifact AND open it

Write the result to a single self-contained HTML file at `<project>/decks/<slug>/index.html`.

**Immediately after writing, open it for the user**:

```bash
open <absolute-path-to-index.html>
```

This launches the deck in the user's default browser so they can flip through it without hunting for the file. Do this every time you produce or revise an HTML deck — silent output is a usability bug, not a feature.

Then surface it as an artifact so AionUi's HTML preview can also render it inline.

**The artifact MUST contain the full HTML source** (the same doctype + html + head + body + style + script you wrote to disk). DO NOT wrap the artifact body in an `<iframe src="...">` — AionUi cannot resolve the relative path and the preview will be blank. Paste the complete `<!doctype html>...</html>` document verbatim:

```
<artifact identifier="deck-<topic-slug>" type="text/html" title="<Deck Title>">
<!doctype html>
<html lang="zh-CN">
  <head>...</head>
  <body>
    <section class="slide ...">...</section>
    ... all 8 sections ...
    <script>...</script>
  </body>
</html>
</artifact>
```

One short sentence before the artifact (e.g. "Deck opened in your browser — here's an inline preview too."). Stop after `</artifact>`.

## Step 7 — Stop and wait

Do NOT export to .pptx unless the user explicitly says so ("export PPT", "make it .pptx", "导出 PPT", "转 PPT", etc.). The HTML deck IS the primary deliverable.

If the user reviews and asks for content edits, edit and re-emit the artifact.

---

## Step 8 (on request) — Export to .pptx (native editable, ~85% fidelity)

### 8-pre — Pre-flight (hard timeouts, no retries beyond)

Before any work in Step 8, run these checks:

```bash
# Verify officecli is installed; if not, STOP and tell the user.
command -v officecli || { echo "officecli not installed"; exit 1; }

# Verify the deck source HTML exists.
test -f <project>/decks/<slug>/index.html || { echo "source HTML not found"; exit 1; }
```

If either check fails, **stop immediately**. Tell the user what's missing. Do NOT try to install officecli or recreate the HTML — those are out of scope here.

**Hard timeout policy** (CRITICAL — prevents the conversation from hanging):

- Every `officecli` invocation: **60 seconds max**. If a single call takes longer, abort the export and tell the user "officecli timed out at <step>".
- Whole export step (8a → 8e): **5 minutes max**. If you're still running at 5 min, stop and report what's done.
- **Never** spawn Chrome, chromium, playwright, puppeteer, or any headless browser. The screenshot path was retired because it hung indefinitely.

### 8 — Export flow

When the user asks for .pptx, **always produce a native editable export** (text is real text, fonts are real fonts, shapes are real shapes). This is the open-design + officecli fidelity discipline: translate the HTML into real PPT elements via officecli batch.

**Never** use screenshot / chromium / playwright / puppeteer / Chrome headless to convert the HTML. That path is permanently retired — it produced raster .pptx with non-editable text AND hung the sandbox. If the user asks for "raster" / "pixel-perfect", tell them: "Sorry, the screenshot export path is disabled because it kept hanging. Native editable .pptx still gives you ~85% fidelity and full text edit-ability."

### 8 — Hand off to Deck B's export engine

Deck B's SKILL (`deck-pptx-direct-skill`) owns **all** PPT-side discipline: token extraction, Cursor placement, font slots, decorative-shape translation, footer-rail audit, deliver-with-annotation policy. Do not duplicate that logic here.

Your job in this step:

1. **You already have**: the chosen template slug and the source HTML at `<project>/decks/<slug>/index.html`.

2. **Walk the HTML** and extract per-slide content (text from `<h1>` / `<p>` / `<span class="kicker">`, etc.) plus the slide sequence. The .pptx slide sequence MUST mirror the HTML 1:1 — same order, same count.

3. **Follow Deck B's Step 3 (token extraction) → Step 4 (plan) → Step 5 (single batch) → Step 6 (audit) → Step 7 (open + deliver)** end-to-end. Read the deck-pptx-direct-skill's rule content from your loaded skills if you need a refresher — every rule there applies here.

4. **Output path**: `<project>/decks/<slug>/deck.pptx` (use the template slug, NOT the topic name).

5. **Audit + deliver policy** (same as Deck B):
   - Run 1 self-check pass.
   - If 0 violations → deliver + open.
   - If violations → ONE corrective batch → deliver regardless of second-pass result, with annotated warnings.
   - Never a 3rd pass. Never a deciding "loop until 0 violations".

---

## Hard rules

- **One template per deck.** Never mix two templates' visuals.
- **Do not edit `:root` CSS variables.** The template's color/font system is the brand identity — preserve it.
- **No invented colors.** Every color used must already exist in the template's `<style>` block.
- **One artifact at a time.** Don't emit multiple artifacts in one response.
- **Stop after artifact.** Do not narrate or explain after `</artifact>`.

## When to ask vs decide

- Ambiguous template choice → ask once
- Slide count → default to template's `slide_count` from template.json unless user specifies
- Content gaps (e.g. user gave 3 stats but template has 4 stat cards) → fill the 4th with a derived/related stat, or shrink to 3 by removing one card — your call, don't ask
