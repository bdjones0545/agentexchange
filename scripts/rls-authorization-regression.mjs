#!/usr/bin/env node
/**
 * AgentExchange RLS authorization regression harness.
 *
 * Exercises the real Supabase stack (GoTrue auth -> PostgREST -> Postgres RLS)
 * with three authenticated actors:
 *
 *   Actor A - organization / opportunity owner
 *   Actor B - agent operator / applicant
 *   Actor C - unrelated authenticated user
 *
 * Attack tests assert that the forbidden state is UNCHANGED afterwards, not
 * merely that an error came back: PostgREST returns a silent zero-row result
 * when an RLS USING clause filters the row out, so an absent error proves
 * nothing. Every assertion re-reads ground truth with the service-role client.
 *
 * Positive tests assert the resulting database state, not the HTTP status.
 *
 * Exit codes: 0 = all required tests passed
 *             1 = at least one required test failed
 *             2 = environment not configured (verification pending)
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const acknowledgedNonProduction = process.env.RLS_TEST_ALLOW_DESTRUCTIVE === "1";

function pending(message) {
  console.error(`\nRUNTIME_RLS_VERIFICATION_PENDING\n${message}\n`);
  process.exit(2);
}

if (!url || !anonKey || !serviceKey) {
  pending(
    [
      "Missing configuration. This harness needs an isolated, non-production",
      "Supabase project and will create and delete users and marketplace rows.",
      "",
      "Required:",
      "  SUPABASE_URL (or VITE_SUPABASE_URL)",
      "  SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)",
      "  SUPABASE_SERVICE_ROLE_KEY",
      "  RLS_TEST_ALLOW_DESTRUCTIVE=1",
    ].join("\n"),
  );
}

if (!acknowledgedNonProduction) {
  pending(
    [
      "Refusing to run without RLS_TEST_ALLOW_DESTRUCTIVE=1.",
      "",
      "This suite performs authorization ATTACKS and writes marketplace rows.",
      "Never point it at a production project. Set RLS_TEST_ALLOW_DESTRUCTIVE=1",
      `only after confirming ${url} is an isolated test project.`,
    ].join("\n"),
  );
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const password = `Rls-Test-${runId}-Aa1!`;

const results = [];
const created = { users: [], contracts: [], applications: [], negotiations: [], hireRequests: [], opportunities: [], organizations: [], agents: [] };

function record(name, kind, passed, detail) {
  results.push({ detail, kind, name, passed });
  const tag = passed ? "PASS" : "FAIL";
  const what = kind === "attack" ? (passed ? "attack blocked" : "ATTACK SUCCEEDED") : passed ? "legit allowed" : "LEGIT BLOCKED";
  console.log(`  ${tag}  [${what}] ${name}${detail ? ` -- ${detail}` : ""}`);
}

async function createActor(label) {
  const email = `rls-${label}-${runId}@agentexchange-test.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { account_type: label === "a" ? "Organization" : "Agent Operator", display_name: `Actor ${label.toUpperCase()}` },
  });
  if (error) throw new Error(`Unable to create actor ${label}: ${error.message}`);
  created.users.push(data.user.id);

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`Unable to sign in actor ${label}: ${signIn.error.message}`);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", data.user.id)
    .single();
  if (profileError) {
    throw new Error(
      `Actor ${label} has no profile row. The handle_new_user trigger must be installed: ${profileError.message}`,
    );
  }

  return { client, email, profileId: profile.id, userId: data.user.id };
}

/** Read ground truth with the service-role client (bypasses RLS). */
async function truth(table, id, column) {
  const { data, error } = await admin.from(table).select(column).eq("id", id).maybeSingle();
  if (error) throw new Error(`Ground-truth read failed on ${table}.${column}: ${error.message}`);
  return data ? data[column] : null;
}

async function countWhere(table, column, value) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  if (error) throw new Error(`Ground-truth count failed on ${table}: ${error.message}`);
  return count ?? 0;
}

/** Attack: run the attempt, then require the protected state to be unchanged. */
async function attack(name, attempt, verify, expected) {
  let outcome = "no error";
  try {
    const { error } = await attempt();
    if (error) outcome = `rejected (${error.code ?? "no code"})`;
  } catch (thrown) {
    outcome = `threw (${thrown.message})`;
  }
  const actual = await verify();
  const passed = String(actual) === String(expected);
  record(name, "attack", passed, passed ? `state unchanged: ${actual} [${outcome}]` : `state=${actual} expected=${expected} [${outcome}]`);
}

/** Legitimate: run the action, then require the resulting state to be correct. */
async function legit(name, action, verify, expected) {
  let outcome = "ok";
  try {
    const { error } = await action();
    if (error) outcome = `rejected (${error.message})`;
  } catch (thrown) {
    outcome = `threw (${thrown.message})`;
  }
  const actual = await verify();
  const passed = String(actual) === String(expected);
  record(name, "legit", passed, passed ? `state=${actual}` : `state=${actual} expected=${expected} [${outcome}]`);
}

async function seedRow(table, row, bucket) {
  const { data, error } = await admin.from(table).insert(row).select("id").single();
  if (error) throw new Error(`Seed failed on ${table}: ${error.message}`);
  created[bucket].push(data.id);
  return data.id;
}

async function cleanup() {
  for (const [table, bucket] of [
    ["contracts", "contracts"],
    ["applications", "applications"],
    ["negotiations", "negotiations"],
    ["hire_requests", "hireRequests"],
    ["opportunities", "opportunities"],
    ["agents", "agents"],
    ["organizations", "organizations"],
  ]) {
    const ids = [...new Set(created[bucket])];
    if (ids.length) await admin.from(table).delete().in("id", ids);
  }
  for (const userId of created.users) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
}

async function main() {
  console.log(`AgentExchange RLS authorization regression\ntarget: ${url}\nrun id: ${runId}\n`);

  const A = await createActor("a");
  const B = await createActor("b");
  const C = await createActor("c");

  // ---- fixtures -----------------------------------------------------------
  const orgA = await seedRow("organizations", { name: `Org A ${runId}`, owner_id: A.profileId }, "organizations");
  const orgC = await seedRow("organizations", { name: `Org C ${runId}`, owner_id: C.profileId }, "organizations");
  const oppA = await seedRow("opportunities", { category: "automation", organization_id: orgA, owner_id: A.profileId, title: `Opp A ${runId}` }, "opportunities");
  const oppC = await seedRow("opportunities", { category: "automation", organization_id: orgC, owner_id: C.profileId, title: `Opp C ${runId}` }, "opportunities");
  const agentB = await seedRow("agents", { name: `Agent B ${runId}`, owner_id: B.profileId, specialty: "ops" }, "agents");
  const agentC = await seedRow("agents", { name: `Agent C ${runId}`, owner_id: C.profileId, specialty: "ops" }, "agents");

  // Re-seeded before each attack so tests are order-independent.
  let appId, negId, hireId;
  async function resetTargets() {
    if (appId) await admin.from("applications").delete().eq("id", appId);
    if (negId) await admin.from("negotiations").delete().eq("id", negId);
    if (hireId) await admin.from("hire_requests").delete().eq("id", hireId);
    appId = await seedRow("applications", { agent_id: agentB, agent_name: "Agent B", opportunity_id: oppA, owner_id: B.profileId, proposal: "baseline proposal", status: "pending" }, "applications");
    negId = await seedRow("negotiations", { agent_id: agentB, agent_name: "Agent B", opportunity_id: oppA, owner_id: B.profileId, rate: "100", status: "pending" }, "negotiations");
    hireId = await seedRow("hire_requests", { agent_id: agentB, agent_name: "Agent B", opportunity_id: oppA, owner_id: A.profileId, status: "pending" }, "hireRequests");
  }

  console.log("=== ATTACK COVERAGE (every one must be blocked) ===");

  // 1. Applicant self-acceptance.
  await resetTargets();
  await attack("A1  B cannot accept B's own application",
    () => B.client.from("applications").update({ status: "accepted" }).eq("id", appId),
    () => truth("applications", appId, "status"), "pending");

  // 2-4. Relationship keys are immutable.
  await resetTargets();
  await attack("A2  B cannot rewrite application owner_id",
    () => B.client.from("applications").update({ owner_id: C.profileId }).eq("id", appId),
    () => truth("applications", appId, "owner_id"), B.profileId);

  await resetTargets();
  await attack("A3  B cannot rewrite application agent_id",
    () => B.client.from("applications").update({ agent_id: agentC }).eq("id", appId),
    () => truth("applications", appId, "agent_id"), agentB);

  await resetTargets();
  await attack("A4  B cannot rewrite application opportunity_id",
    () => B.client.from("applications").update({ opportunity_id: oppC }).eq("id", appId),
    () => truth("applications", appId, "opportunity_id"), oppA);

  // 5. Unrelated third party.
  await resetTargets();
  await attack("A5  C cannot mutate the A/B application",
    () => C.client.from("applications").update({ proposal: "pwned", status: "accepted" }).eq("id", appId),
    () => truth("applications", appId, "proposal"), "baseline proposal");

  // 6. Agent side cannot perform organization-side acceptance.
  await resetTargets();
  await attack("A6  B cannot perform org-side negotiation acceptance",
    () => B.client.from("negotiations").update({ status: "accepted" }).eq("id", negId),
    () => truth("negotiations", negId, "status"), "pending");

  // 7. Negotiation relationship keys are immutable (asserted per field).
  await resetTargets();
  await attack("A7a B cannot rewrite negotiation owner_id",
    () => B.client.from("negotiations").update({ owner_id: C.profileId }).eq("id", negId),
    () => truth("negotiations", negId, "owner_id"), B.profileId);

  await resetTargets();
  await attack("A7b B cannot rewrite negotiation agent_id",
    () => B.client.from("negotiations").update({ agent_id: agentC }).eq("id", negId),
    () => truth("negotiations", negId, "agent_id"), agentB);

  await resetTargets();
  await attack("A7c B cannot rewrite negotiation opportunity_id",
    () => B.client.from("negotiations").update({ opportunity_id: oppC }).eq("id", negId),
    () => truth("negotiations", negId, "opportunity_id"), oppA);

  // 8. Unrelated third party.
  await resetTargets();
  await attack("A8  C cannot mutate the negotiation",
    () => C.client.from("negotiations").update({ rate: "0", status: "accepted" }).eq("id", negId),
    () => truth("negotiations", negId, "rate"), "100");

  // 9. Hire-request relationship keys are immutable (asserted per field).
  await resetTargets();
  await attack("A9a B cannot rewrite hire-request owner_id",
    () => B.client.from("hire_requests").update({ owner_id: B.profileId }).eq("id", hireId),
    () => truth("hire_requests", hireId, "owner_id"), A.profileId);

  await resetTargets();
  await attack("A9b B cannot rewrite hire-request agent_id",
    () => B.client.from("hire_requests").update({ agent_id: agentC }).eq("id", hireId),
    () => truth("hire_requests", hireId, "agent_id"), agentB);

  await resetTargets();
  await attack("A9c B cannot rewrite hire-request opportunity_id",
    () => B.client.from("hire_requests").update({ opportunity_id: oppC }).eq("id", hireId),
    () => truth("hire_requests", hireId, "opportunity_id"), oppA);

  // 10. Organization cannot impersonate agent-side acceptance.
  await resetTargets();
  await attack("A10 A cannot impersonate agent-side hire acceptance",
    () => A.client.from("hire_requests").update({ status: "accepted" }).eq("id", hireId),
    () => truth("hire_requests", hireId, "status"), "pending");

  // 11. Unrelated third party.
  await resetTargets();
  await attack("A11 C cannot mutate the hire request",
    () => C.client.from("hire_requests").update({ status: "accepted" }).eq("id", hireId),
    () => truth("hire_requests", hireId, "status"), "pending");

  // 12-13. Direct contract forgery.
  const forgedByB = `forged-by-b-${runId}`;
  await attack("A12 B cannot manufacture a contract against an unrelated org",
    () => B.client.from("contracts").insert({ agent_id: agentB, agent_name: "Agent B", organization_id: orgA, organization_name: "Org A", title: forgedByB }),
    () => countWhere("contracts", "title", forgedByB), 0);

  const forgedByC = `forged-by-c-${runId}`;
  await attack("A13 C cannot manufacture a contract against A",
    () => C.client.from("contracts").insert({ agent_id: agentC, agent_name: "Agent C", organization_id: orgA, organization_name: "Org A", title: forgedByC }),
    () => countWhere("contracts", "title", forgedByC), 0);

  console.log("\n=== SECURE MATERIALIZATION ATTACK COVERAGE ===");

  // A hire request legitimately issued by A, left pending.
  async function issuedByA(status = "pending") {
    await admin.from("contracts").delete().eq("source_type", "hire-request");
    if (hireId) await admin.from("hire_requests").delete().eq("id", hireId);
    hireId = await seedRow("hire_requests", { agent_id: agentB, agent_name: "Agent B", opportunity_id: oppA, opportunity_title: "Opp A", owner_id: A.profileId, status }, "hireRequests");
    return hireId;
  }
  const contractsForHire = async (hireRequestId) => countWhere("contracts", "source_id", hireRequestId);

  await issuedByA("pending");
  await attack("M2  B cannot materialize from an UNACCEPTED hire request",
    () => B.client.rpc("materialize_hire_request_contract", { hire_request_uuid: hireId }),
    () => contractsForHire(hireId), 0);

  await issuedByA("pending");
  await attack("M3  A cannot fake agent acceptance then materialize",
    async () => {
      await A.client.from("hire_requests").update({ status: "accepted" }).eq("id", hireId);
      return A.client.rpc("materialize_hire_request_contract", { hire_request_uuid: hireId });
    },
    () => truth("hire_requests", hireId, "status"), "pending");

  await issuedByA("accepted");
  await attack("M4  C cannot materialize an accepted hire request",
    () => C.client.rpc("materialize_hire_request_contract", { hire_request_uuid: hireId }),
    () => contractsForHire(hireId), 0);

  // B self-issues a hire request naming its own agent against A's opportunity,
  // accepts it, and materializes. This must not yield a contract against Org A.
  await admin.from("contracts").delete().eq("source_type", "hire-request");
  let selfIssued = null;
  await attack("M5  B cannot swap organization by self-issuing a hire request",
    async () => {
      const inserted = await B.client.from("hire_requests").insert({ agent_id: agentB, agent_name: "Agent B", opportunity_id: oppA, opportunity_title: "Opp A" }).select("id").single();
      if (inserted.data) { selfIssued = inserted.data.id; created.hireRequests.push(selfIssued); }
      if (!selfIssued) return inserted;
      await B.client.from("hire_requests").update({ status: "accepted" }).eq("id", selfIssued);
      return B.client.rpc("materialize_hire_request_contract", { hire_request_uuid: selfIssued });
    },
    () => countWhere("contracts", "organization_id", orgA), 0);

  await issuedByA("accepted");
  await attack("M6  B cannot swap agent before materialization",
    () => B.client.from("hire_requests").update({ agent_id: agentC }).eq("id", hireId),
    () => truth("hire_requests", hireId, "agent_id"), agentB);

  await attack("M9  generic contract INSERT is still denied to the agent",
    () => B.client.from("contracts").insert({ agent_id: agentB, agent_name: "Agent B", organization_id: orgA, organization_name: "Org A", source_id: hireId, source_type: "hire-request", title: `direct-insert-${runId}` }),
    () => countWhere("contracts", "title", `direct-insert-${runId}`), 0);

  console.log("\n=== LEGITIMATE COVERAGE (every one must succeed) ===");

  // Fresh rows so the legitimate lifecycle is independent of the attack fixtures.
  await admin.from("applications").delete().eq("id", appId);
  await admin.from("negotiations").delete().eq("id", negId);
  await admin.from("hire_requests").delete().eq("id", hireId);

  const proposal = `legit-proposal-${runId}`;
  let legitAppId = null;
  await legit("L1  B can apply to A's opportunity",
    async () => {
      const res = await B.client.from("applications").insert({ agent_id: agentB, agent_name: "Agent B", opportunity_id: oppA, proposal }).select("id").single();
      if (res.data) { legitAppId = res.data.id; created.applications.push(res.data.id); }
      return res;
    },
    () => countWhere("applications", "proposal", proposal), 1);

  await legit("L2  A can accept B's application",
    () => A.client.from("applications").update({ status: "accepted" }).eq("id", legitAppId),
    () => truth("applications", legitAppId, "status"), "accepted");

  const rate = `legit-rate-${runId}`;
  let legitNegId = null;
  await legit("L3  legitimate negotiation creation works",
    async () => {
      const res = await B.client.from("negotiations").insert({ agent_id: agentB, agent_name: "Agent B", opportunity_id: oppA, rate, status: "pending" }).select("id").single();
      if (res.data) { legitNegId = res.data.id; created.negotiations.push(res.data.id); }
      return res;
    },
    () => countWhere("negotiations", "rate", rate), 1);

  await legit("L4  A can perform legitimate negotiation acceptance",
    () => A.client.from("negotiations").update({ status: "accepted" }).eq("id", legitNegId),
    () => truth("negotiations", legitNegId, "status"), "accepted");

  const hireTitle = `legit-hire-${runId}`;
  let legitHireId = null;
  await legit("L5  A can create a hire request",
    async () => {
      const res = await A.client.from("hire_requests").insert({ agent_id: agentB, agent_name: "Agent B", opportunity_id: oppA, opportunity_title: hireTitle }).select("id").single();
      if (res.data) { legitHireId = res.data.id; created.hireRequests.push(res.data.id); }
      return res;
    },
    () => countWhere("hire_requests", "opportunity_title", hireTitle), 1);

  await legit("L6  owning agent B can accept the hire request",
    () => B.client.from("hire_requests").update({ status: "accepted" }).eq("id", legitHireId),
    () => truth("hire_requests", legitHireId, "status"), "accepted");

  const contractTitle = `legit-contract-${runId}`;
  await legit("L7  A can create a legitimate contract for A's organization",
    async () => {
      const res = await A.client.from("contracts").insert({ agent_id: agentB, agent_name: "Agent B", organization_id: orgA, organization_name: "Org A", title: contractTitle }).select("id").single();
      if (res.data) created.contracts.push(res.data.id);
      return res;
    },
    () => countWhere("contracts", "title", contractTitle), 1);

  console.log("\n=== SECURE MATERIALIZATION LEGITIMATE PATH ===");

  await admin.from("contracts").delete().eq("source_type", "hire-request");
  if (hireId) await admin.from("hire_requests").delete().eq("id", hireId);
  if (selfIssued) await admin.from("hire_requests").delete().eq("id", selfIssued);

  let matHireId = null;
  await legit("L8  A creates a hire request for B's agent",
    async () => {
      const res = await A.client.from("hire_requests").insert({ agent_id: agentB, agent_name: "Agent B", opportunity_id: oppA, opportunity_title: `mat-hire-${runId}` }).select("id").single();
      if (res.data) { matHireId = res.data.id; created.hireRequests.push(matHireId); }
      return res;
    },
    () => countWhere("hire_requests", "opportunity_title", `mat-hire-${runId}`), 1);

  await legit("L9  owning agent B accepts it (durable)",
    () => B.client.from("hire_requests").update({ status: "accepted" }).eq("id", matHireId),
    () => truth("hire_requests", matHireId, "status"), "accepted");

  let materializedId = null;
  await legit("L10 B materializes the contract through the secure path",
    async () => {
      const res = await B.client.rpc("materialize_hire_request_contract", { hire_request_uuid: matHireId });
      const row = Array.isArray(res.data) ? res.data[0] : res.data;
      if (row) { materializedId = row.id; created.contracts.push(row.id); }
      return res;
    },
    () => countWhere("contracts", "source_id", matHireId), 1);

  await legit("L11 contract references the correct organization",
    async () => ({ error: null }),
    () => truth("contracts", materializedId, "organization_id"), orgA);

  await legit("L12 contract references the correct agent",
    async () => ({ error: null }),
    () => truth("contracts", materializedId, "agent_id"), agentB);

  await legit("L13 contract references the accepted hire request",
    async () => ({ error: null }),
    () => truth("contracts", materializedId, "source_id"), matHireId);

  await legit("L14 retry is idempotent (no duplicate contract)",
    async () => {
      await B.client.rpc("materialize_hire_request_contract", { hire_request_uuid: matHireId });
      return B.client.rpc("materialize_hire_request_contract", { hire_request_uuid: matHireId });
    },
    () => countWhere("contracts", "source_id", matHireId), 1);

  await attack("M8  a different hire request cannot hijack the contract",
    () => B.client.from("contracts").update({ source_id: matHireId === appId ? negId : appId }).eq("id", materializedId),
    () => truth("contracts", materializedId, "source_id"), matHireId);
}

let exitCode = 0;
try {
  await main();
} catch (thrown) {
  console.error(`\nHarness error: ${thrown.message}`);
  exitCode = 1;
} finally {
  await cleanup().catch((thrown) => console.error(`Cleanup warning: ${thrown.message}`));
}

const failed = results.filter((result) => !result.passed);
const attacks = results.filter((result) => result.kind === "attack");
const legits = results.filter((result) => result.kind === "legit");

console.log(
  `\n=== RESULT: ${results.length - failed.length}/${results.length} passed ` +
    `(attack ${attacks.filter((r) => r.passed).length}/${attacks.length}, ` +
    `legitimate ${legits.filter((r) => r.passed).length}/${legits.length}), skipped 0 ===`,
);

if (failed.length || exitCode === 1 || results.length === 0) {
  console.error("\nRUNTIME_RLS_VERIFICATION_FAILED");
  process.exit(1);
}
console.log("\nRUNTIME_RLS_VERIFICATION_COMPLETE");
process.exit(0);
