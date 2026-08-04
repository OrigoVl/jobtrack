#!/usr/bin/env bash
# PreToolUse hook (Write|Edit): committed drizzle-kit migrations must never be hand-edited
# (CLAUDE.md: "drizzle-kit migrations committed under server/drizzle/") - hand edits desync
# the migration journal. Point the agent at drizzle-kit generate instead.
set -euo pipefail

input="$(cat)"
file="$(echo "$input" | jq -r '.tool_input.file_path // empty')"
[ -z "$file" ] && exit 0

case "$file" in
  *server/drizzle/*.sql)
    jq -n '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "server/drizzle/**/*.sql migrations are drizzle-kit generated output and are committed as-is (CLAUDE.md) - hand-editing them desyncs the migration journal. Change the schema in server/src/db/schema/ and run `pnpm --filter jobtrack-server exec drizzle-kit generate` to produce a new migration instead."
      }
    }'
    exit 0
    ;;
  *) exit 0 ;;
esac
