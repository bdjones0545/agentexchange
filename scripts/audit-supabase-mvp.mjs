#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;
const expectedProjectRef = process.env.SUPABASE_PROJECT_REF;

const tables = [
  "profiles",
  "organizations",
  "agents",
  "opportunities",
  "applications",
  "negotiations",
  "hire_requests",
  "saved_opportunities",
  "contracts",
  "contract_milestones",
  "contract_deliverables",
  "contract_messages",
  "reviews",
  "disputes",
  "activity_events",
];

function fail(message) {
  console.error(`SAFE_OPERATOR_VALIDATION_REFUSED\n${message}`);
  process.exit(2);
}

function projectRefFromUrl(value) {
  try {
    const parsed = new URL(value);
    const match = parsed.hostname.match(/^([a-z0-9]+)\.supabase\.co$/);
    return parsed.protocol === "https:" ? match?.[1] ?? null : null;
  } catch {
    return null;
  }
}

if (!url || !publishableKey || !expectedProjectRef) {
  fail(
    [
      "Read-only operator validation requires explicit configuration:",
      "  SUPABASE_URL (or VITE_SUPABASE_URL)",
      "  SUPABASE_PUBLISHABLE_KEY (or a compatible anon key)",
      "  SUPABASE_PROJECT_REF",
      "No default project is used.",
    ].join("\n"),
  );
}

const actualProjectRef = projectRefFromUrl(url);
if (!actualProjectRef || actualProjectRef !== expectedProjectRef) {
  fail(
    `Target mismatch: the HTTPS Supabase URL does not match SUPABASE_PROJECT_REF=${expectedProjectRef}.`,
  );
}

const supabase = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("AgentExchange read-only Supabase operator validation");
console.log(`project ref: ${actualProjectRef}`);
console.log("mode: read-only (no fixtures, profile changes, or cleanup required)\n");

let failed = 0;
for (const table of tables) {
  const { error } = await supabase.from(table).select("id").limit(1);
  if (error) {
    failed += 1;
    console.log(`FAIL ${table}: ${error.message}`);
  } else {
    console.log(`PASS ${table}: reachable`);
  }
}

console.log(
  `\nSAFE_OPERATOR_VALIDATION_COMPLETE ${tables.length - failed}/${tables.length} passed`,
);
if (failed > 0) {
  process.exitCode = 1;
}
