import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the application router cannot mount browser diagnostics", () => {
  const app = read("src/App.tsx");

  assert.doesNotMatch(app, /DiagnosticsPage/);
  assert.doesNotMatch(app, /path=["']diagnostics["']/);
  assert.equal(
    existsSync(new URL("../src/routes/DiagnosticsPage.tsx", import.meta.url)),
    false,
  );
});

test("normal application pages expose no diagnostics navigation", () => {
  const account = read("src/routes/AccountPage.tsx");
  const settings = read("src/routes/SettingsPage.tsx");

  assert.doesNotMatch(account, /\/diagnostics/);
  assert.doesNotMatch(settings, /\/diagnostics/);
});

test("browser code contains no destructive diagnostics helper or fixtures", () => {
  const app = read("src/App.tsx");
  const account = read("src/routes/AccountPage.tsx");
  const settings = read("src/routes/SettingsPage.tsx");
  const browserSurface = `${app}\n${account}\n${settings}`;

  assert.equal(
    existsSync(new URL("../src/lib/supabaseDiagnostics.ts", import.meta.url)),
    false,
  );
  assert.doesNotMatch(browserSurface, /runSupabaseDiagnostics/);
  assert.doesNotMatch(browserSurface, /Diagnostics (Org|Agent|Opportunity|User)/);
  assert.doesNotMatch(browserSurface, /Marketplace Admin/);
});

test("operator validation is explicit, target-bound, and read-only", () => {
  const audit = read("scripts/audit-supabase-mvp.mjs");

  assert.match(audit, /SUPABASE_PROJECT_REF/);
  assert.match(audit, /SAFE_OPERATOR_VALIDATION_REFUSED/);
  assert.match(audit, /mode: read-only/);
  assert.doesNotMatch(audit, /\.(insert|upsert|update|delete)\s*\(/);
  assert.doesNotMatch(audit, /SUPABASE_TEST_.*PASSWORD/);
  assert.doesNotMatch(audit, /Diagnostics (Org|Agent|Opportunity|User)/);
});

test("operator validation fails closed without explicit configuration", () => {
  const result = spawnSync(process.execPath, ["scripts/audit-supabase-mvp.mjs"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {},
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /SAFE_OPERATOR_VALIDATION_REFUSED/);
  assert.match(result.stderr, /No default project is used/);
});

test("operator validation rejects a URL and project-reference mismatch", () => {
  const result = spawnSync(process.execPath, ["scripts/audit-supabase-mvp.mjs"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {
      SUPABASE_PROJECT_REF: "expectedproject",
      SUPABASE_PUBLISHABLE_KEY: "not-a-real-key",
      SUPABASE_URL: "https://differentproject.supabase.co",
    },
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Target mismatch/);
});
