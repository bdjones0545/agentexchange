import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only the TypeScript suites. tests/safe-diagnostics.test.mjs is written
    // against node:test and keeps its own runner (`npm run test:diagnostics`);
    // vitest would collect it and find no suite.
    include: ["tests/**/*.test.ts"],
  },
});
