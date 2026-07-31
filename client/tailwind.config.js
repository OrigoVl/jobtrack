/** @type {import('tailwindcss').Config} */
// DevRadar design tokens — shared with the (external) marketing landing page. Colors are CSS
// custom properties (see src/index.css :root / :root[data-theme="dark"]) stored as space-separated
// RGB triplets, wrapped here with Tailwind's `<alpha-value>` placeholder — this is what lets
// utilities like `bg-signal/10` or `border-grid/60` work (a plain `var(--signal)` reference
// wouldn't support the opacity modifier). The app defaults to the LIGHT token set; a future
// dark-mode toggle only needs to flip `data-theme` on the root element, every utility below
// already points at the right variable automatically.
const withOpacity = (varName) => `rgb(var(${varName}) / <alpha-value>)`;

export default {
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
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(14, 22, 19, 0.04), 0 12px 28px -18px rgba(14, 22, 19, 0.25)",
        soft: "0 1px 3px rgba(14, 22, 19, 0.06)",
      },
    },
  },
  plugins: [],
};
