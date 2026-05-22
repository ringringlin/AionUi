#!/usr/bin/env bash
#
# Install the two deck-comparison assistants as user-source presets.
#
# Why this script: AionUi's backend treats `source=extension` assistants as
# read-only (PUT /api/assistants/<id> returns 403), so the UI cannot switch
# agents on them. By POSTing them via /api/assistants we get `source=user`,
# which IS user-editable — including the agent-switcher dropdown.
#
# Skills + templates remain registered through the extension manifest
# (`aion-extension.json`); only the assistant rows are injected here.
#
# Usage:
#   AIONUI_PORT=<port> bash scripts/install.sh
#
# If AIONUI_PORT is not set, the script will try to auto-detect from the
# running aionui-backend process.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# --- Detect backend port -----------------------------------------------------
if [[ -z "${AIONUI_PORT:-}" ]]; then
  PORT=$(ps -axo command | grep -E 'aionui-backend.*--port' | grep -v grep | head -1 \
    | sed -E 's/.*--port +([0-9]+).*/\1/' || true)
  if [[ -z "$PORT" ]]; then
    echo "ERROR: cannot detect aionui-backend port. Start AionUi first, or pass AIONUI_PORT=<port>." >&2
    exit 1
  fi
else
  PORT="$AIONUI_PORT"
fi

BASE="http://localhost:${PORT}"
echo "Using backend at ${BASE}"

# --- Sanity: backend is up ---------------------------------------------------
if ! curl -sf "${BASE}/api/assistants" > /dev/null; then
  echo "ERROR: ${BASE} not reachable. Is AionUi running?" >&2
  exit 1
fi

# --- Upsert helper -----------------------------------------------------------
upsert_assistant() {
  local id="$1"
  local payload="$2"
  local rule_file="$3"

  # If the assistant already exists, update; otherwise create.
  if curl -sf "${BASE}/api/assistants" | python3 -c "
import sys, json
data = json.load(sys.stdin)['data']
sys.exit(0 if any(a['id'] == '${id}' for a in data) else 1)
"; then
    echo "  • updating ${id}"
    curl -sS -X PUT "${BASE}/api/assistants/${id}" \
      -H "Content-Type: application/json" \
      -d "${payload}" > /dev/null
  else
    echo "  • creating ${id}"
    curl -sS -X POST "${BASE}/api/assistants" \
      -H "Content-Type: application/json" \
      -d "${payload}" > /dev/null
  fi

  # Write the rule (context) for the assistant.
  local rule_content
  rule_content=$(cat "${rule_file}")
  python3 -c "
import json, sys
print(json.dumps({
  'assistant_id': '${id}',
  'content': sys.stdin.read(),
}))
" <<< "${rule_content}" | curl -sS -X POST "${BASE}/api/skills/assistant-rule/write" \
    -H "Content-Type: application/json" \
    -d @- > /dev/null
  echo "    rule written"
}

# --- Deck A · HTML First -----------------------------------------------------
echo "Installing Deck A · HTML First …"
upsert_assistant "deck-html-first" '{
  "id": "deck-html-first",
  "name": "Deck A · HTML First",
  "name_i18n": {
    "en-US": "Deck A · HTML First",
    "zh-CN": "演示稿 A · HTML 优先"
  },
  "description": "Picks a curated HTML template, fills content, delivers an HTML deck. Exports to .pptx on request (raster-faithful).",
  "description_i18n": {
    "en-US": "Picks a curated HTML template, fills content, delivers an HTML deck. Exports to .pptx on request (raster-faithful).",
    "zh-CN": "选模板 → 填内容 → 输出 HTML deck；按需高保真转 .pptx。"
  },
  "avatar": "🎨",
  "preset_agent_type": "gemini",
  "enabled_skills": ["deck-html-first-skill"],
  "prompts": [
    "用 blue-professional 模板做一份 SaaS 项目 Q2 进展演示",
    "Make an 8-slide cyberpunk hackathon pitch using the 8-bit-orbit template",
    "做一份 editorial-forest 风格的季度回顾，6 页"
  ],
  "prompts_i18n": {
    "zh-CN": [
      "用 blue-professional 模板做一份 SaaS 项目 Q2 进展演示",
      "用 8-bit-orbit 模板做一份赛博朋克 hackathon 路演 8 页",
      "做一份 editorial-forest 风格的季度回顾，6 页"
    ]
  }
}' "${EXT_DIR}/assistants/deck-html-first-context.md"

# --- Deck B · PPTX Direct ----------------------------------------------------
echo "Installing Deck B · PPTX Direct …"
upsert_assistant "deck-pptx-direct" '{
  "id": "deck-pptx-direct",
  "name": "Deck B · PPTX Direct",
  "name_i18n": {
    "en-US": "Deck B · PPTX Direct",
    "zh-CN": "演示稿 B · 直出 PPTX"
  },
  "description": "Reads HTML templates as visual spec, emits native .pptx directly via officecli. No HTML intermediate.",
  "description_i18n": {
    "en-US": "Reads HTML templates as visual spec, emits native .pptx directly via officecli. No HTML intermediate.",
    "zh-CN": "读 HTML 模板提取视觉规格 → 直接用 officecli 生成 .pptx，无 HTML 中间产物。"
  },
  "avatar": "📊",
  "preset_agent_type": "gemini",
  "enabled_skills": ["deck-pptx-direct-skill"],
  "prompts": [
    "用 blue-professional 模板做一份 SaaS 项目 Q2 进展演示",
    "Make an 8-slide cyberpunk hackathon pitch using the 8-bit-orbit template",
    "做一份 editorial-forest 风格的季度回顾，6 页"
  ],
  "prompts_i18n": {
    "zh-CN": [
      "用 blue-professional 模板做一份 SaaS 项目 Q2 进展演示",
      "用 8-bit-orbit 模板做一份赛博朋克 hackathon 路演 8 页",
      "做一份 editorial-forest 风格的季度回顾，6 页"
    ]
  }
}' "${EXT_DIR}/assistants/deck-pptx-direct-context.md"

echo
echo "Done. Open AionUi; the two assistants are in the assistant list with"
echo "switchable agents. Skills + templates load from ~/.aionui-dev/extensions/html-deck-comparison/."
