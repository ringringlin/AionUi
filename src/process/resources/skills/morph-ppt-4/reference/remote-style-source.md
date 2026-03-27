---
name: remote-style-source
description: Discover and fetch style and component references from OfficeCli remote repository (one-shot, no persistent cache)
---

# OfficeCli Remote Style + Component Source (4.0)

This guide defines how to use OfficeCli `Styles/` as the remote source of truth, with a description-first component borrowing strategy.

## Goal

- Discover component library references from OfficeCli remote repository (default path)
- Discover style templates from OfficeCli remote repository (optional path)
- Download only the selected style/component files
- Use temporary local files only for the current task
- Delete temporary files after generation

## Local Snapshot Baseline (for fallback)

Morph PPT 4.0 keeps a local baseline copy of component docs:

- `reference/COMPONENT_LIBRARY.snapshot.md`
- `reference/components.snapshot.py` (optional helper, non-default)

Use these only when remote component fetch attempts fail.

## Repository Defaults

```bash
STYLE_REPO_OWNER="ringringlin"
STYLE_REPO_NAME="OfficeCLI"
STYLE_REPO_REF="feat/style-index-test"
STYLE_REPO_DIR="Styles"
STYLE_TEMPLATE_DIR="template"
STYLE_COMPONENT_DIR="component"
```

If your team uses another repo/ref, override these variables.

## Robust Fetch Strategy (recommended)

Network/DNS failures are common in agent sandboxes. Do not treat one failed `curl` as final failure.

Use this retry order for raw file fetches:

1. `raw.githubusercontent.com` (primary)
2. `cdn.jsdelivr.net/gh/...@ref/...` (secondary CDN mirror)
3. Mark fetch failure and continue workflow fallback (do not block generation)

Example helper:

```bash
fetch_text_with_retry() {
  local rel_path="$1"
  local out_file="$2"
  local url_raw="https://raw.githubusercontent.com/${STYLE_REPO_OWNER}/${STYLE_REPO_NAME}/${STYLE_REPO_REF}/${rel_path}"
  local url_jsd="https://cdn.jsdelivr.net/gh/${STYLE_REPO_OWNER}/${STYLE_REPO_NAME}@${STYLE_REPO_REF}/${rel_path}"

  curl -fsSL --connect-timeout 6 --max-time 12 "$url_raw" -o "$out_file" && return 0
  sleep 1
  curl -fsSL --connect-timeout 6 --max-time 12 "$url_raw" -o "$out_file" && return 0
  sleep 1
  curl -fsSL --connect-timeout 6 --max-time 12 "$url_jsd" -o "$out_file" && return 0
  return 1
}
```

Preflight check (recommended, 3-5s budget):

```bash
curl -fsSIL --connect-timeout 3 --max-time 5 "https://raw.githubusercontent.com/${STYLE_REPO_OWNER}/${STYLE_REPO_NAME}/${STYLE_REPO_REF}/${STYLE_REPO_DIR}/index.json" >/dev/null && echo "remote_raw=ok" || echo "remote_raw=fail"
curl -fsSIL --connect-timeout 3 --max-time 5 "https://cdn.jsdelivr.net/gh/${STYLE_REPO_OWNER}/${STYLE_REPO_NAME}@${STYLE_REPO_REF}/${STYLE_REPO_DIR}/index.json" >/dev/null && echo "remote_jsdelivr=ok" || echo "remote_jsdelivr=fail"
curl -fsSIL --connect-timeout 3 --max-time 5 "https://api.github.com/repos/${STYLE_REPO_OWNER}/${STYLE_REPO_NAME}/contents/${STYLE_REPO_DIR}?ref=${STYLE_REPO_REF}" >/dev/null && echo "remote_api=ok" || echo "remote_api=fail"
```

If raw fails but jsdelivr/api succeeds, treat this as DNS/CDN issue, not repository/index issue.

## Default Mode (Recommended)

Use topic-driven custom style + remote component library.

Template discovery/fetch is optional and should run only when user explicitly asks for a template style (or strong keyword match requires inspiration).

## Step 1: Discover style candidates (optional, remote index first)

Try in this order:

1. `Styles/index.json` (preferred, machine-readable)
2. `Styles/INDEX.md` (fallback if JSON index does not exist)
3. GitHub Contents API directory listing (last fallback)

Examples:

```bash
# 1) Preferred: JSON index (raw -> jsdelivr retry chain)
fetch_text_with_retry "${STYLE_REPO_DIR}/index.json" /tmp/style-index.json || true

# 2) Markdown fallback (raw -> jsdelivr retry chain)
fetch_text_with_retry "${STYLE_REPO_DIR}/INDEX.md" /tmp/style-index.md || true

# 3) Contents API fallback (directory metadata)
curl -fsSL --connect-timeout 6 --max-time 12 \
  "https://api.github.com/repos/${STYLE_REPO_OWNER}/${STYLE_REPO_NAME}/contents/${STYLE_REPO_DIR}?ref=${STYLE_REPO_REF}" \
  -o /tmp/style-contents.json || true
```

## Step 2: Download only the selected style template (optional)

After selecting `<style-id>`, fetch only needed files:

```bash
SESSION_STYLE_DIR="$(mktemp -d /tmp/aionui-morph-style.XXXXXX)"

# Always fetch style.md first
fetch_text_with_retry "${STYLE_REPO_DIR}/${STYLE_TEMPLATE_DIR}/<style-id>/style.md" "${SESSION_STYLE_DIR}/style.md"

# Do not fetch build.sh by default in 4.0
# Fetch build.sh only when user explicitly requests template-locked reconstruction
if [ "${ALLOW_TEMPLATE_SCRIPT_FETCH:-false}" = "true" ]; then
  fetch_text_with_retry "${STYLE_REPO_DIR}/${STYLE_TEMPLATE_DIR}/<style-id>/build.sh" "${SESSION_STYLE_DIR}/build.sh" || true
fi
```

Do not download all style template directories. Do not mirror the whole repo.

## Step 3: Fetch component library references (description-first, on demand)

When component composition is needed, fetch only component docs you will actually use:

```bash
SESSION_COMPONENT_DIR="$(mktemp -d /tmp/aionui-morph-component.XXXXXX)"

# Preferred: component library description source
fetch_text_with_retry "${STYLE_REPO_DIR}/${STYLE_COMPONENT_DIR}/COMPONENT_LIBRARY.md" "${SESSION_COMPONENT_DIR}/COMPONENT_LIBRARY.md"

# Do not fetch components.py by default in 4.0
# Fetch only if user explicitly asks script-level component reconstruction
if [ "${ALLOW_COMPONENT_SCRIPT_FETCH:-false}" = "true" ]; then
  fetch_text_with_retry "${STYLE_REPO_DIR}/${STYLE_COMPONENT_DIR}/components.py" "${SESSION_COMPONENT_DIR}/components.py" || true
fi
```

If component docs are unavailable, continue with built-in layering constraints in `SKILL.md`.

Fallback source order for component docs:

1. Remote fetched docs in `SESSION_COMPONENT_DIR`
2. Local snapshot `reference/COMPONENT_LIBRARY.snapshot.md`
3. Built-in layering rules in `SKILL.md`

## Step 4: Borrow ideas, do not clone geometry

- Learn semantic fit and visual language (palette, hierarchy, morph rhythm)
- Follow this skill's design/quality rules (`pptx-design.md`, `quality-gates.md`)
- Do not copy all coordinates and dimensions verbatim
- Prefer description-driven re-composition over script replay

## Step 5: Clean up after completion

```bash
rm -rf "${SESSION_STYLE_DIR}"
rm -rf "${SESSION_COMPONENT_DIR}"
```

No persistent cache by default.

## Failure Handling

- For `BRICK_COMPOSE` / `TEMPLATE_GUIDED_BRICK`, component fetch should be attempted before giving up to local-only composition.
- One failed host resolution is not enough to fallback; run the retry chain first.
- Record concise fetch evidence in brief/build notes:
  - `component_fetch_attempts=<n>`
  - `component_fetch_source=raw|jsdelivr|api|fallback`
  - `component_fetch_reason=<dns|timeout|404|auth|unknown>`
- If remote style template fetch fails, continue immediately with topic-driven custom style + component composition. Do not block generation.
- If remote component fetch fails, load local snapshot component docs first (`reference/COMPONENT_LIBRARY.snapshot.md`), then continue generation.
- If local snapshot is also unavailable, continue with built-in component layering rules in `SKILL.md`.
- If both `style.md` and `build.sh` unavailable for chosen style, pick another candidate
- Do not block the whole PPT workflow due to one missing style directory
- Even in fallback mode, all local hard requirements remain mandatory: Morph naming conventions, ghosting, `transition=morph`, readability/spacing rules, per-slide checks, and final `validate + outline` verification
