---
name: verify-ready
description: Run jobtrack's "before considering any change done" checklist (lint, typecheck, test, build, and e2e when relevant) in order, stopping and reporting clearly at the first failure. Use before telling the user a change is finished, or when asked "is this ready" / "run the checks".
---

# Verify a jobtrack change is actually ready

CLAUDE.md is explicit: don't declare a task finished on the basis of "it should work" — actually
run the checklist. This skill runs it, in order, from the repo root:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`
5. `pnpm test:e2e` — conditionally (see below)

## Rules

- **Stop at the first failure.** Report it with the actual command output (trimmed to the
  relevant error, not the full scrollback) and don't run later steps — a codebase that fails
  typecheck will also produce noisy, uninformative test/build failures.
- **Decide e2e inclusion from what changed**, not by default:
  - Run `pnpm test:e2e` (which needs `pnpm build` to have already succeeded, and resets the e2e
    DB via `pretest:e2e`) if the diff touches a flow already covered by an existing spec under
    `e2e/*.spec.ts`, or the user explicitly asked for e2e coverage.
  - Otherwise, skip it and say so explicitly, along with why (e.g. "no existing e2e spec covers
    this backend-only change, skipping e2e"). Never run the full e2e suite silently by default —
    it's the slowest step by far.
  - If the change added a new critical user-facing flow with no e2e spec yet, that's a signal a
    new spec should be written (test-writer agent), not that this step should be skipped.
- **Use the actual command, not a cached memory of a previous run.** If the user says they already
  ran `pnpm test`, rerun it anyway unless you can see the literal output — these commands are fast
  enough that rerunning costs nothing next to reporting a stale/wrong result.
- If `pnpm test:coverage` is what's actually being asked for (coverage numbers specifically,
  not just pass/fail), substitute it for step 3 rather than running both.

## Reporting

- All green: one short line naming which steps ran and passed. Mention explicitly if e2e was
  skipped and why.
- Any red: name the exact step, the relevant error text, and the implicated file(s)/line(s) if
  the output makes that clear. Don't silently fix the failure as part of this skill — surface it;
  fixing is a separate, deliberate step the user should see happen.
