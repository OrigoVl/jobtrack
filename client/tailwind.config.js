/** @type {import('tailwindcss').Config} */
// Zorya design tokens — shared with the (external) marketing landing page. Colors are CSS
// custom properties (see src/index.css :root / :root[data-theme="dark"]) stored as space-separated
// RGB triplets, wrapped here with Tailwind's `<alpha-value>` placeholder — this is what lets
// utilities like `bg-signal/10` or `border-grid/60` work (a plain `var(--signal)` reference
// wouldn't support the opacity modifier). The app defaults to the LIGHT token set; the dark-mode
// toggle only needs to flip `data-theme` on the root element, every utility below already points
// at the right variable automatically.
const withOpacity = (varName) => `rgb(var(${varName}) / <alpha-value>)`;

export default {
  // Most colors are CSS variables (above) that already flip with `data-theme`, no `dark:` variant
  // needed. A handful of semantic colors deliberately stay on Tailwind's raw palette (danger/rose,
  // and the vacancy-pipeline sky/violet/fuchsia/zinc stage colors — see status-tone.ts) since
  // they're not part of the brand token system; those DO need an explicit `dark:` variant, and
  // without this line Tailwind's default "media" strategy would follow the OS preference instead
  // of our own toggle (shared/theme.ts sets `data-theme` directly, not a `dark` class).
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: withOpacity("--bg"),
        surface: withOpacity("--surface"),
        "surface-2": withOpacity("--surface-2"),
        grid: withOpacity("--grid"),
        ink: withOpacity("--ink"),
        "ink-dim": withOpacity("--ink-dim"),
        signal: withOpacity("--signal"),
        alert: withOpacity("--alert"),
        "on-signal": withOpacity("--on-signal"),
        star: withOpacity("--star"),
        horizon: withOpacity("--horizon"),
        good: withOpacity("--good"),
        progress: withOpacity("--progress"),
        chart1: withOpacity("--chart-1"),
        chart2: withOpacity("--chart-2"),
      },
      // Glossary vs. the landing page's own token names: app `signal`/`alert` ≡ landing
      // `accent-ink` (deep indigo, text/thin-border role), app `star`/`horizon` ≡ landing
      // `accent` (indigo, solid-fill role), app `grid` ≡ landing `line`. `alert`/`horizon`
      // are kept as distinct token NAMES (not deleted) so existing call sites don't all need
      // touching, but resolve to the exact same value as `signal`/`star` — the landing has one
      // accent color, not two ("One card. One accent. Reused everywhere on purpose" — its own
      // comment). `good` is new: a third, genuinely distinct hue for contexts that need a
      // stoplight/score tier the single accent can't cover (see index.css's token comment).
      // `chart1`/`chart2` are also new: dedicated, dataviz-skill-validated categorical colors for
      // a 2-series chart (see the skill radar) where two *identities* must read apart, not a
      // score tier — see index.css's token comments for the validation notes.
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        // System stack only — the landing has no mono role at all, so there's no self-hosted face
        // to name here; see index.css's font comment for why that's fine.
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
        // Deliberately NO `display` key here — Tailwind would generate a `.font-display` utility
        // that collides with the hand-written `.font-display` class in index.css (same
        // specificity, ambiguous cascade). The hand-written class is the display-type system.
      },
      // The landing page's cards later grew a permanent resting shadow and an 18px radius (this
      // token system was synced back when the landing was still flat/hairline-only — see the
      // `.card-shadow` utility in index.css for why the shadow itself is a hand-written class
      // there, not a Tailwind `boxShadow` token: it needs different opacity per `data-theme`,
      // which Tailwind's static theme values can't express). `card` sits between the default
      // `xl` (12px) and `2xl` (16px) steps — matches the landing's `.card { border-radius: 18px }`
      // exactly, used only by Card/Section (shared/ui.tsx), not a blanket replacement for every
      // `rounded-lg`/`rounded-full` control elsewhere (buttons, chips, pills are a different,
      // smaller-scale part of the type system and unaffected by this).
      borderRadius: {
        card: "18px",
      },
    },
  },
  plugins: [],
};
