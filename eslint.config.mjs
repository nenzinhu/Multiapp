import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".cline-home/**",
    ".next/**",
    "dist/**",
    ".vinext/**",
    ".wrangler/**",
    ".sites-runtime/**",
    "outputs/**",
    "work/**",
  ]),
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/page.tsx"],
    rules: {
      // The collection is hydrated from localStorage on mount, so the initial
      // state is set inside an effect that reads an external system.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["components/vault/**/*.{ts,tsx}"],
    rules: {
      // The vault reads its encrypted envelope from localStorage on mount and
      // resets the dialog drafts when it opens.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
