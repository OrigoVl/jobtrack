#!/usr/bin/env bash
# PreToolUse hook (Write|Edit): CLAUDE.md - "never read process.env directly outside
# server/src/config/env.ts - add new vars to the Zod schema there". Inspects the content
# being written/edited, not just the path, so it catches new process.env reads anywhere
# in server/src except env.ts itself.
set -euo pipefail

input="$(cat)"
tool="$(echo "$input" | jq -r '.tool_name // empty')"
file="$(echo "$input" | jq -r '.tool_input.file_path // empty')"
[ -z "$file" ] && exit 0

case "$file" in
  *server/src/config/env.ts) exit 0 ;;
  *server/src/*.ts) ;;
  *) exit 0 ;;
esac

content=""
case "$tool" in
  Write) content="$(echo "$input" | jq -r '.tool_input.content // empty')" ;;
  Edit) content="$(echo "$input" | jq -r '.tool_input.new_string // empty')" ;;
  *) exit 0 ;;
esac

if echo "$content" | grep -q 'process\.env'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "CLAUDE.md: never read process.env directly outside server/src/config/env.ts. Add the new variable to the Zod schema in server/src/config/env.ts and import the validated `env` object here instead."
    }
  }'
  exit 0
fi
exit 0
