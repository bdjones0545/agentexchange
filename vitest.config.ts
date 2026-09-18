import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests run in demo mode regardless of a developer's .env.local: the
    // shared-mode branches take an explicit `sharedMode` option instead.
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
    // Only the TypeScript suites. tests/safe-diagnostics.test.mjs is written
    // against node:test and keeps its own runner (`npm run test:diagnostics`);
    // vitest would collect it and find no suite.
    include: ["tests/**/*.test.ts"],
  },
});
