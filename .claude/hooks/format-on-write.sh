#!/usr/bin/env bash
# PostToolUse hook (Write|Edit): instant prettier feedback while editing.
# lint-staged/husky already formats on commit; this just closes the loop sooner.
set -euo pipefail

input="$(cat)"
file="$(echo "$input" | jq -r '.tool_input.file_path // empty')"
[ -z "$file" ] && exit 0

case "$file" in
  *.ts | *.tsx | *.json) ;;
  *) exit 0 ;;
esac

case "$file" in
  */client/* | */server/*) ;;
  *) exit 0 ;;
esac

[ -f "$file" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
"$root/node_modules/.bin/prettier" --write "$file" >/dev/null 2>&1 || true
exit 0
