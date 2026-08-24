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
      // A hook's dependency array is evaluated during render, so a `const`
      // declared below the hook is in the temporal dead zone and throws at
      // runtime. Bundlers do not care. This caught exactly that in App.jsx.
      // `functions: false` because function declarations hoist and the data
      // layer relies on it.
      "no-use-before-define": ["error", { functions: false, classes: true, variables: true }],
      "no-dupe-keys": "error",
      "no-unreachable": "error",
    },
  },
];
