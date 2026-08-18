import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "src/components/**/*.{ts,tsx}",
        "src/hooks/**/*.{ts,tsx}",
        "src/lib/**/*.{ts,tsx}",
        "src/middleware.ts",
      ],
      exclude: ["**/*.d.ts", "**/*.bak"],
      // Piso inicial medido em 18/08/2026. Aumente, nunca reduza, conforme
      // novas telas ganharem testes unitários; jornadas inteiras ficam no E2E.
      thresholds: {
        lines: 41,
        functions: 43,
        statements: 41,
        branches: 50,
      },
    },
  },
});
