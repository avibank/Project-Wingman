import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

// Added after `setAccentColor is not defined` took the live site down: the
// accent feature was deleted, one restore call in App's hydration effect was
// left behind, and `vite build` has no reason to care. no-undef catches that
// class of bug for free, before it ships.
export default [
  {
    files: ["src/**/*.{js,jsx}", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "no-undef": "error",
      // An identifier that nothing reads is usually the other half of a
      // half-finished deletion, which is what this whole rule set is for.
      "no-unused-vars": ["warn", {
        varsIgnorePattern: "^[A-Z_]",
        argsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
      "react-hooks/rules-of-hooks": "error",
      "no-const-assign": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
    },
  },
];
