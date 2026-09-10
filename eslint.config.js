import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

// Added after `setAccentColor is not defined` took the live site down: the
// accent feature was deleted, one restore call in App's hydration effect was
// left behind, and `vite build` has no reason to care. no-undef catches that
// class of bug for free, before it ships.
export default [
  // design/ holds the handoff's source-of-truth files, kept verbatim so the
  // check scripts can diff against them. They are reference, not source: some
  // carry CSS inside a .js file, and none of them are built or imported.
  { ignores: ["design/**"] },
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
  // The reader's chrome, generated verbatim out of docs/reader/v6/reader.js by
  // scripts/build-reader-v6.mjs. It is a COPY, not source: HANDOVER's one rule
  // is that it is finished and gets copied, so a lint rule here would only
  // ever be an argument for editing it. `npm run check:paper` checks the thing
  // that actually matters instead — that these files are still what the
  // handed-over file produces, byte for byte.
  //
  // Two of the four rules genuinely do not apply to it: the parts read
  // `window.WM` as a bare global, which is the interface the handover
  // documents, and they call hoisted consts the way the file was written.
  {
    files: ["src/components/paper/v6/part*.js"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-use-before-define": "off",
    },
  },
];
