import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // docs/ é documentação, não código do app. Tem material de REFERÊNCIA de
    // design (handoff de carta) que é .tsx mas nunca é compilado nem importado
    // — lintar isso só produz erro de código que não roda.
    "docs/**",
  ]),
]);

export default eslintConfig;
