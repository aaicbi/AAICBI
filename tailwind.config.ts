import type { Config } from "tailwindcss";

// AAICBI / Futybills brand palette — the four core hexes stay exactly
// as they are everywhere else in AAICBI's materials (lesson notes,
// decks, workbooks). Extended here, not replaced: warm ink instead of
// generic gray-900 for text, warm sand instead of stark white for
// alternating backgrounds, and one genuinely new idea — a warm gold
// for achievement moments (certificates, badges) and a warm rose for
// errors, deliberately distinct from the near-black+neon and
// cream+terracotta looks that read as templated AI-generated design.
//
// M46 — every brand color now resolves through a CSS custom property
// instead of a hardcoded hex, specifically so dark mode doesn't
// require touching the 369 existing `bg-brand-*`/`text-brand-*`/
// `border-brand-*` usages already spread across this app's
// components. The light-mode values (defined in globals.css's `:root`)
// are the exact hexes this project has always used; dark mode's
// values are a separate set in globals.css's `.dark` block. Every
// component that already writes `bg-brand-teal` keeps working
// completely unchanged in both themes — only the token DEFINITION
// became theme-aware, not the hundreds of places that reference it.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: "rgb(var(--brand-teal) / <alpha-value>)",
          tealDeep: "rgb(var(--brand-teal-deep) / <alpha-value>)",
          green: "rgb(var(--brand-green) / <alpha-value>)",
          mint: "rgb(var(--brand-mint) / <alpha-value>)",
          gray: "rgb(var(--brand-gray) / <alpha-value>)",
          ink: "rgb(var(--brand-ink) / <alpha-value>)",
          sand: "rgb(var(--brand-sand) / <alpha-value>)",
          surface: "rgb(var(--brand-surface) / <alpha-value>)",
          gold: "rgb(var(--brand-gold) / <alpha-value>)",
          goldLight: "rgb(var(--brand-gold-light) / <alpha-value>)",
          goldText: "rgb(var(--brand-gold-text) / <alpha-value>)",
          rose: "rgb(var(--brand-rose) / <alpha-value>)",
          roseLight: "rgb(var(--brand-rose-light) / <alpha-value>)",
        },
        // Audit finding, closed here: 376 uses of Tailwind's own
        // default gray scale across 77 files, none of it theme-aware
        // — see the full reasoning in globals.css's own comment right
        // above these variables' definitions. `extend.colors.gray`
        // merges with (not replaces) Tailwind's built-in gray object,
        // so any shade not listed here (confirmed none are used
        // anywhere in this codebase) simply falls through to
        // Tailwind's own untouched default, exactly as before.
        gray: {
          50: "rgb(var(--gray-50) / <alpha-value>)",
          100: "rgb(var(--gray-100) / <alpha-value>)",
          300: "rgb(var(--gray-300) / <alpha-value>)",
          400: "rgb(var(--gray-400) / <alpha-value>)",
          500: "rgb(var(--gray-500) / <alpha-value>)",
          600: "rgb(var(--gray-600) / <alpha-value>)",
          700: "rgb(var(--gray-700) / <alpha-value>)",
          800: "rgb(var(--gray-800) / <alpha-value>)",
          900: "rgb(var(--gray-900) / <alpha-value>)",
        },
      },
      fontFamily: {
        // Display: Fraunces — a warm soft-serif with real personality,
        // used sparingly for headings and hero moments. It reads as
        // "credential" and "crafted," which is exactly the register a
        // certificate or a course-completion moment should carry.
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        // Body/UI: Manrope — a clean, friendly geometric sans for
        // everything else. Distinctive enough not to read as the
        // default system font, functional enough for dense UI.
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
