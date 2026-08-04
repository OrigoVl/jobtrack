---
name: i18n-check
description: Verify jobtrack's i18n namespace registration and en/uk key parity — every namespace under client/src/i18n/locales/{en,uk} registered in both index.ts and i18next.d.ts, with matching keys between locales. Use after adding/editing i18n JSON files, or when translations seem to silently not resolve.
---

# Check jobtrack i18n registration + parity

CLAUDE.md requires a new namespace to be registered in BOTH `client/src/i18n/index.ts` (the
`resources` object) and `client/src/i18n/i18next.d.ts` (the type augmentation), or `t()` won't
resolve at runtime / won't typecheck. This skill checks that mechanically instead of by eye.

## Important: plural suffixes are not a parity violation

i18next pluralization uses CLDR plural categories as key suffixes: `_zero`, `_one`, `_two`,
`_few`, `_many`, `_other`. English only has `one`/`other`. **Ukrainian (Slavic) has `one`/`few`/
`many`/`other`** — so a `uk` namespace legitimately has `_few`/`_many` keys with no `en`
counterpart. That is correct, not a bug. Any parity check must strip these suffixes before
comparing key sets, or it produces false positives on every plural string. Do not report a
missing `_few`/`_many` counterpart in `en` as a problem.

## Run the check

Run this from the repo root (it already normalizes plural suffixes before comparing):

```bash
node -e '
const fs = require("fs");
const path = require("path");
const dir = "client/src/i18n/locales";
const enDir = path.join(dir, "en");
const ukDir = path.join(dir, "uk");
const namespaces = fs.readdirSync(enDir).filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""));

const PLURAL_SUFFIXES = ["_zero","_one","_two","_few","_many","_other"];
function normalize(key) {
  for (const suf of PLURAL_SUFFIXES) if (key.endsWith(suf)) return key.slice(0, -suf.length);
  return key;
}
function flatten(obj, prefix = "") {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (obj[k] && typeof obj[k] === "object" && !Array.isArray(obj[k])) keys = keys.concat(flatten(obj[k], full));
    else keys.push(normalize(full));
  }
  return keys;
}

const indexTs = fs.readFileSync("client/src/i18n/index.ts", "utf8");
const dtsTs = fs.readFileSync("client/src/i18n/i18next.d.ts", "utf8");
let anyProblem = false;
for (const ns of namespaces) {
  const enPath = path.join(enDir, `${ns}.json`);
  const ukPath = path.join(ukDir, `${ns}.json`);
  const problems = [];
  if (!fs.existsSync(ukPath)) {
    problems.push("missing uk/" + ns + ".json");
  } else {
    const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
    const uk = JSON.parse(fs.readFileSync(ukPath, "utf8"));
    const enKeys = new Set(flatten(en));
    const ukKeys = new Set(flatten(uk));
    const missingInUk = [...enKeys].filter(k => !ukKeys.has(k));
    const extraInUk = [...ukKeys].filter(k => !enKeys.has(k));
    if (missingInUk.length) problems.push("uk missing keys: " + missingInUk.join(", "));
    if (extraInUk.length) problems.push("uk has extra keys not in en: " + extraInUk.join(", "));
  }
  if (!indexTs.includes(`locales/en/${ns}.json`)) problems.push("not imported in i18n/index.ts");
  if (!dtsTs.includes(`locales/en/${ns}.json`)) problems.push("not imported in i18next.d.ts");
  if (problems.length) { anyProblem = true; console.log(ns + ":"); problems.forEach(p => console.log("  - " + p)); }
}
if (!anyProblem) console.log("all " + namespaces.length + " namespaces OK (registration + en/uk key parity, plural-suffix aware)");
'
```

## Reporting

- If it prints "all N namespaces OK", say so briefly.
- If it lists problems per namespace, report each one with the concrete fix:
  - "not imported in i18n/index.ts" → add `import en<Ns> from "./locales/en/<ns>.json"` +
    `import uk<Ns> from "./locales/uk/<ns>.json"` and add both to the `resources` object.
  - "not imported in i18next.d.ts" → add `import <ns> from "./locales/en/<ns>.json"` and add it
    to `CustomTypeOptions.resources`.
  - "uk missing keys: ..." → those keys need a Ukrainian translation added to
    `locales/uk/<ns>.json` at the same path.
  - "missing uk/<ns>.json" → the namespace has no Ukrainian file at all; create one with the same
    key shape as the `en` file, translated.
