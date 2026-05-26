import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "src/generated/**",
    "next-env.d.ts",
    // Expo / Metro / NativeWind config files must be CJS — Metro loads them
    // with require() at bundle start, before any TS/ESM transform runs.
    "mobile/metro.config.js",
    "mobile/tailwind.config.js",
    "mobile/babel.config.js",
    "mobile/.expo/**",
    "mobile/node_modules/**",
  ]),
  // Metro requires literal `require()` calls for static asset paths so it
  // can statically analyse + bundle the asset. Allow require() in mobile
  // app entrypoints where fonts/images are wired up.
  {
    files: ["mobile/app/_layout.tsx"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
