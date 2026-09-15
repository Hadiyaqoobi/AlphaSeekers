/**
 * ESLint flat config.
 *
 * Next 16 removed the `next lint` command, and eslint-config-next 16 requires
 * ESLint 9, which reads `eslint.config.*` rather than `.eslintrc.json`. That
 * package ships native flat-config arrays now, so they spread in directly —
 * FlatCompat does not work on it.
 *
 * The preset list is the same as the old .eslintrc.json. The adjustments below
 * exist because eslint-config-next 16 turns on rules that did not exist in 14;
 * each one is explained rather than blanket-disabled.
 *
 * Run with `npm run lint`.
 */
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "design-drafts/**",
      "next-env.d.ts",
      // Standalone CommonJS utilities run directly with `node`, not part of the
      // app bundle. `require()` is correct in them.
      "scripts/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Pages Router rule: it flags any <a> whose href matches a route and tells
      // you to use <Link>. This app is App Router and has no pages/ directory,
      // and its one hit is src/app/[locale]/error.tsx, where a plain <a href="/">
      // is deliberate — an error boundary must force a full document reload
      // rather than client-route through a React tree that has just crashed.
      "@next/next/no-html-link-for-pages": "off",

      // ── React 19 / compiler-era rules, new in eslint-config-next 16 ──────────
      // 17 real findings across the app, mostly setState called synchronously
      // inside an effect. They are worth fixing, but doing it as part of a
      // security upgrade would mean rewriting effect timing in working
      // production screens — a separate change with its own testing. Left at
      // "warn" so they stay visible and `npm run lint` stays usable.
      // TODO: work these down and restore them to "error".
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];
