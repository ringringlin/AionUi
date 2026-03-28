#!/bin/bash

# Morph PPT Helper Functions (5.0)
# Canonical anti-residue implementation:
# - Use lowercase officecli json keys: children/format/path
# - Fail fast when ghosting match count is zero or any residue remains

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

morph_clone_slide() {
  local deck=$1
  local from_slide=$2
  local to_slide=$3

  echo -e "${BLUE}Cloning slide $from_slide -> $to_slide${NC}"
  officecli add "$deck" '/' --from "/slide[$from_slide]"
  officecli set "$deck" "/slide[$to_slide]" --prop transition=morph

  if ! officecli get "$deck" "/slide[$to_slide]" --json 2>/dev/null | grep -q '"transition": "morph"'; then
    echo -e "${RED}ERROR: transition=morph missing on slide $to_slide${NC}"
    exit 1
  fi
}

morph_ghost_content() {
  local deck=$1
  local slide=$2
  shift 2
  local shapes=("$@")

  if [ ${#shapes[@]} -eq 0 ]; then
    echo -e "${YELLOW}No shapes to ghost${NC}"
    return 0
  fi

  for shape_idx in "${shapes[@]}"; do
    officecli set "$deck" "/slide[$slide]/shape[$shape_idx]" --prop x=36cm >/dev/null
  done
}

_morph_extract_prefix_paths() {
  local deck=$1
  local slide=$2
  local prefix=$3

  local slide_json
  slide_json="$(officecli get "$deck" "/slide[$slide]" --json)"

  printf '%s' "$slide_json" | python3 -c "
import json, sys
prefix = sys.argv[1]
doc = json.load(sys.stdin)
out = []

def walk(nodes):
    for node in nodes or []:
        fmt = node.get('format', {})
        name = fmt.get('name', '')
        if prefix in name and node.get('path'):
            out.append(node['path'])
        walk(node.get('children', []))

walk(doc.get('data', {}).get('children', []))
print('\n'.join(out))
" "$prefix"
}

_morph_assert_prefix_ghosted() {
  local deck=$1
  local slide=$2
  local prefix=$3
  local require_non_zero=$4

  local slide_json
  slide_json="$(officecli get "$deck" "/slide[$slide]" --json)"

  local check
  check="$(printf '%s' "$slide_json" | python3 -c "
import json, sys
prefix = sys.argv[1]
require_non_zero = sys.argv[2] == 'true'
doc = json.load(sys.stdin)

matched = []
bad = []

def walk(nodes):
    for node in nodes or []:
        fmt = node.get('format', {})
        name = fmt.get('name', '')
        if prefix in name:
            matched.append(node)
            if fmt.get('x') != '36cm':
                bad.append((node.get('path', ''), name, fmt.get('x', '')))
        walk(node.get('children', []))

walk(doc.get('data', {}).get('children', []))

if require_non_zero and len(matched) == 0:
    print('ERROR_NO_MATCH')
    sys.exit(2)

if bad:
    for p, n, x in bad:
        print(f'{p}\t{n}\t{x}')
    sys.exit(1)

print(f'OK\t{len(matched)}')
" "$prefix" "$require_non_zero" 2>/dev/null)"
  local status=$?

  if [ $status -eq 2 ]; then
    echo -e "${RED}ERROR: No matched shapes for prefix '${prefix}' on slide $slide${NC}"
    return 2
  fi
  if [ $status -eq 1 ]; then
    echo -e "${RED}ERROR: Residue found for prefix '${prefix}' on slide $slide:${NC}"
    echo "$check" | sed 's/^/  /'
    return 1
  fi
  echo -e "${GREEN}Ghost verified for prefix '${prefix}' on slide $slide (${check})${NC}"
  return 0
}

morph_ghost_prev_by_prefix() {
  local deck=$1
  local slide=$2
  local prev=$3

  local prefix="#s${prev}-"
  local paths
  paths="$(_morph_extract_prefix_paths "$deck" "$slide" "$prefix")"

  if [ -z "$paths" ]; then
    echo -e "${RED}ERROR: No shapes found to ghost for ${prefix} on slide $slide${NC}"
    return 2
  fi

  while IFS= read -r path; do
    [ -z "$path" ] && continue
    officecli set "$deck" "$path" --prop x=36cm >/dev/null
  done <<<"$paths"

  _morph_assert_prefix_ghosted "$deck" "$slide" "$prefix" true
}

morph_verify_slide() {
  local deck=$1
  local slide=$2
  local has_error=0

  echo -e "${BLUE}Verifying slide $slide${NC}"

  if ! officecli get "$deck" "/slide[$slide]" --json 2>/dev/null | grep -q '"transition": "morph"'; then
    echo -e "${RED}  Missing transition=morph${NC}"
    has_error=1
  fi

  local prev_slide=$((slide - 1))
  if [ "$prev_slide" -ge 1 ]; then
    local prefix="#s${prev_slide}-"
    if ! _morph_assert_prefix_ghosted "$deck" "$slide" "$prefix" true; then
      has_error=1
    fi
  fi

  if [ "$has_error" -eq 0 ]; then
    echo -e "${GREEN}Slide $slide verification passed${NC}"
    return 0
  fi

  echo -e "${RED}Slide $slide verification failed${NC}"
  return 1
}

morph_final_check() {
  local deck=$1
  local root_json
  root_json="$(officecli get "$deck" '/' --json 2>/dev/null)"
  local total_slides
  total_slides="$(printf '%s' "$root_json" | python3 -c "import json,sys;print(json.load(sys.stdin).get('data',{}).get('childCount',0))" 2>/dev/null)"

  if [ -z "$total_slides" ] || [ "$total_slides" -le 1 ]; then
    echo -e "${RED}ERROR: Invalid slide count${NC}"
    return 1
  fi

  local has_error=0
  local i=2
  while [ "$i" -le "$total_slides" ]; do
    if ! morph_verify_slide "$deck" "$i"; then
      has_error=1
    fi
    i=$((i + 1))
  done

  if [ "$has_error" -ne 0 ]; then
    echo -e "${RED}Final check failed${NC}"
    return 1
  fi

  echo -e "${GREEN}All slides verified successfully${NC}"
  return 0
}

morph_help() {
  echo "Morph 5.0 helper functions:"
  echo "  morph_clone_slide <deck> <from> <to>"
  echo "  morph_ghost_content <deck> <slide> <shape_idx...>"
  echo "  morph_ghost_prev_by_prefix <deck> <slide> <prev_slide>"
  echo "  morph_verify_slide <deck> <slide>"
  echo "  morph_final_check <deck>"
}
