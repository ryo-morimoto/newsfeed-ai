import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // React Hooks rules - detect issues that can cause hydration problems
      ...reactHooks.configs.recommended.rules,
      // Downgrade to warn: setMounted(true) pattern is valid for SSR hydration
      "react-hooks/set-state-in-effect": "warn",

      // Disable rules already covered by oxlint
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      "**/dist/**",
      "**/.wrangler/**",
      "**/build/**",
      "bun.lock",
      "**/*.test.ts",
      "**/__tests__/**",
    ],
  }
);
