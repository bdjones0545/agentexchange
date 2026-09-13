#!/usr/bin/env node
/**
 * AgentExchange two-user shared-marketplace journey.
 *
 * This is the automated form of docs/MANUAL_PRODUCTION_VALIDATION.md. It proves
 * the thing that makes Supabase mode a real marketplace instead of a
 * single-browser sandbox: two different users, in two different sessions, see
 * each other's listings and the records they are a party to, and the
 * authorization boundary holds between them.
 *
 * It drives the SAME queries the app's repositories issue (see
 * src/lib/repositories/*), as three authenticated actors:
 *
 *   A  organization / opportunity owner
 *   B  agent operator / applicant
 *   (anon) a signed-out visitor
 *
 * It creates two throwaway users with the admin API, runs the journey, and
 * deletes every row and both users at the end — pass or fail. Point it only at
 * an isolated or throwaway-friendly project; it writes and deletes marketplace
 * rows. Exit code 0 iff every check passed.
 *
 * Run:
 *   SUPABASE_URL="https://<ref>.supabase.co" \
 *   SUPABASE_ANON_KEY="<anon key>" \
 *   SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
 *   RLS_TEST_ALLOW_DESTRUCTIVE=1 \
 *   node scripts/two-user-journey.mjs
 *
 * The service-role key bypasses RLS and can create and delete users, so it is
 * read from the environment and never committed. Get it from the Supabase
 * dashboard (Project Settings -> API) and keep it out of shell history.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const acknowledged = process.env.RLS_TEST_ALLOW_DESTRUCTIVE === "1";
const emailDomain = process.env.E2E_EMAIL_DOMAIN ?? "agentexchange-e2e.test";

function pending(message) {
  console.error(`\nTWO_USER_JOURNEY_PENDING\n${message}\n`);
  process.exit(2);
}

if (!url || !anon || !service) {
  pending(
    [
      "Missing configuration. This harness creates and deletes users and",
      "marketplace rows, so it needs a throwaway-friendly project.",
      "",
      "Required:",
      "  SUPABASE_URL (or VITE_SUPABASE_URL)",
      "  SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)",
      "  SUPABASE_SERVICE_ROLE_KEY   (Dashboard -> Project Settings -> API)",
      "  RLS_TEST_ALLOW_DESTRUCTIVE=1",
      "",
      "Optional:",
      "  E2E_EMAIL_DOMAIN  domain for the two throwaway addresses",
      `                    (default ${emailDomain})`,
    ].join("\n"),
  );
}

if (!acknowledged) {
  pending(
    [
      "Refusing to run without RLS_TEST_ALLOW_DESTRUCTIVE=1.",
      "",
      "This suite creates and deletes auth users and marketplace rows, and",
      "performs authorization ATTACKS. Never point it at a project whose data",
      `you care about. Set RLS_TEST_ALLOW_DESTRUCTIVE=1 only after confirming`,
      `${url} is safe to write to.`,
    ].join("\n"),
  );
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const results = [];
const createdUserIds = [];
const ids = {};

function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` -- ${detail}` : ""}`);
}

async function actor(label, accountType) {
  const email = `e2e-${label}-${run}@${emailDomain}`;
  const password = `${randomUUID()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: accountType, display_name: `E2E ${label.toUpperCase()}` },
  });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  createdUserIds.push(data.user.id);

  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signIn ${label}: ${signIn.error.message}`);

  // The handle_new_user trigger materializes the profile row.
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    throw new Error(
      `actor ${label} has no profile; the handle_new_user trigger must be installed`,
    );
  }
  return { client, email, userId: data.user.id, profileId: profile.id };
}

async function main() {
  const A = await actor("a", "Organization");
  const B = await actor("b", "Agent Operator");
  const anonClient = createClient(url, anon, { auth: { persistSession: false } });
  check("profiles created by trigger for both users", Boolean(A.profileId && B.profileId));

  // --- A posts an organization + opportunity (opportunitiesRepository.createOpportunity)
  const org = await A.client
    .from("organizations")
    .insert({ industry: "Research", name: `E2E Org ${run}`, overview: "e2e", verified: false })
    .select("id, owner_id")
    .single();
  check("A creates an organization owned by A", !org.error && org.data?.owner_id === A.profileId, org.error?.message);
  ids.org = org.data?.id;

  const opp = await A.client
    .from("opportunities")
    .insert({
      budget_range: "$5k", category: "Research", description: "e2e", estimated_duration: "2 weeks",
      organization_id: ids.org, organization_name: `E2E Org ${run}`, required_skills: ["research"],
      status: "open", success_criteria: "memo", title: `E2E opportunity ${run}`,
    })
    .select("id")
    .single();
  check("A posts an opportunity", !opp.error, opp.error?.message);
  ids.opp = opp.data?.id;

  // --- B publishes an agent (agentsRepository.createAgent)
  const agent = await B.client
    .from("agents")
    .insert({
      availability: "Available", description: "e2e", name: `E2E Agent ${run}`, skills: ["research"],
      specialty: "Research", starting_rate: "$100/h", tool_access: [], trust_score: 90,
      verification_status: "Rising Agent",
    })
    .select("id, owner_id")
    .single();
  check("B publishes an agent owned by B", !agent.error && agent.data?.owner_id === B.profileId, agent.error?.message);
  ids.agent = agent.data?.id;

  // --- The shared-visibility guarantees the fix is about
  const bSeesOpp = await B.client.from("opportunities").select("id").eq("id", ids.opp);
  check("B can see A's opportunity (shared marketplace)", bSeesOpp.data?.length === 1);
  const aSeesAgent = await A.client.from("agents").select("id").eq("id", ids.agent);
  check("A can see B's agent", aSeesAgent.data?.length === 1);
  const anonSeesOpp = await anonClient.from("opportunities").select("id").eq("id", ids.opp);
  check("signed-out visitor can browse the opportunity", anonSeesOpp.data?.length === 1);

  // --- B applies (applicationsRepository.createApplication)
  const app = await B.client
    .from("applications")
    .insert({ agent_id: ids.agent, agent_name: `E2E Agent ${run}`, opportunity_id: ids.opp, proposal: "e2e proposal", status: "pending" })
    .select("id")
    .single();
  check("B applies to A's opportunity", !app.error, app.error?.message);
  ids.app = app.data?.id;
  const aSeesApp = await A.client.from("applications").select("id").eq("id", ids.app);
  check("A can see B's application", aSeesApp.data?.length === 1);

  // --- Authorization boundary: B may not self-accept or rewrite ownership
  await B.client.from("applications").update({ status: "accepted" }).eq("id", ids.app);
  const afterSelfAccept = await admin.from("applications").select("status").eq("id", ids.app).single();
  check("B cannot accept B's own application", afterSelfAccept.data?.status === "pending", `status=${afterSelfAccept.data?.status}`);
  await B.client.from("applications").update({ owner_id: A.profileId }).eq("id", ids.app);
  const afterOwnerRewrite = await admin.from("applications").select("owner_id").eq("id", ids.app).single();
  check("B cannot rewrite the application's owner", afterOwnerRewrite.data?.owner_id === B.profileId);
  await B.client.from("contracts").insert({ agent_id: ids.agent, agent_name: "x", organization_id: ids.org, organization_name: "x", title: `forged ${run}` });
  const forged = await admin.from("contracts").select("id").eq("title", `forged ${run}`);
  check("B cannot manufacture a contract naming A's organization", (forged.data?.length ?? 0) === 0);

  // --- A accepts: creates the contract (org side) then moves the application
  const contract = await A.client
    .from("contracts")
    .insert({
      agent_id: ids.agent, agent_name: `E2E Agent ${run}`, due_date: "Oct 03", organization_id: ids.org,
      organization_name: `E2E Org ${run}`, progress: 8, source_id: ids.app, source_type: "application",
      start_date: "Sep 12", status: "Active", title: `E2E opportunity ${run}`, value: "$5k",
    })
    .select("id")
    .single();
  check("A creates the contract as the organization side", !contract.error, contract.error?.message);
  ids.contract = contract.data?.id;
  const acc = await A.client.from("applications").update({ status: "accepted" }).eq("id", ids.app);
  const bSeesAccepted = await B.client.from("applications").select("status").eq("id", ids.app).single();
  check("A accepts the application and B sees it accepted", !acc.error && bSeesAccepted.data?.status === "accepted", acc.error?.message);
  const bSeesContract = await B.client.from("contracts").select("id").eq("id", ids.contract);
  check("B sees the contract", bSeesContract.data?.length === 1);

  // --- Shared contract workspace
  const ms = await B.client.from("contract_milestones").insert({ contract_id: ids.contract, title: "Outline", notes: "", completed: false }).select("id").single();
  check("B adds a milestone to the shared contract", !ms.error, ms.error?.message);
  const aSeesMs = await A.client.from("contract_milestones").select("id").eq("contract_id", ids.contract);
  check("A sees B's milestone", aSeesMs.data?.length === 1);
  const msg = await A.client.from("contract_messages").insert({ contract_id: ids.contract, sender_type: "Organization", author: "E2E Org", body: "hello" });
  check("A messages in the contract", !msg.error, msg.error?.message);

  // --- Public agent activity timeline
  const ev = await B.client.from("activity_events").insert({
    actor_id: ids.agent, actor_type: "agent", entity_id: ids.agent, entity_type: "agent",
    event_type: "application_submitted", message: `E2E Agent ${run} applied.`,
    metadata: { agentId: ids.agent, agentName: `E2E Agent ${run}`, type: "application_submitted", createdAt: new Date().toISOString() },
  });
  check("B records a public agent activity event", !ev.error, ev.error?.message);
  const anonEv = await anonClient.from("activity_events").select("id").eq("actor_type", "agent").eq("actor_id", ids.agent);
  check("signed-out visitor can read the agent timeline event", anonEv.data?.length === 1);
  await B.client.from("activity_events").insert({ owner_id: A.profileId, actor_type: "agent", entity_type: "agent", event_type: "x", message: `forged-ev ${run}` });
  const forgedEv = await admin.from("activity_events").select("id").eq("message", `forged-ev ${run}`);
  check("B cannot write an activity event owned by someone else", (forgedEv.data?.length ?? 0) === 0);

  // --- Hire-request path and the secure materialization RPC
  const hire = await A.client
    .from("hire_requests")
    .insert({ agent_id: ids.agent, agent_name: `E2E Agent ${run}`, opportunity_id: ids.opp, opportunity_title: `E2E opportunity ${run}`, status: "pending" })
    .select("id")
    .single();
  check("A issues a hire request", !hire.error, hire.error?.message);
  ids.hire = hire.data?.id;
  const bSeesHire = await B.client.from("hire_requests").select("id").eq("id", ids.hire);
  check("B sees the hire request", bSeesHire.data?.length === 1);
  await A.client.from("hire_requests").update({ status: "accepted" }).eq("id", ids.hire);
  const afterOrgAccept = await admin.from("hire_requests").select("status").eq("id", ids.hire).single();
  check("A cannot accept the hire request on the agent's behalf", afterOrgAccept.data?.status === "pending", `status=${afterOrgAccept.data?.status}`);
  const hAcc = await B.client.from("hire_requests").update({ status: "accepted" }).eq("id", ids.hire);
  const hState = await admin.from("hire_requests").select("status").eq("id", ids.hire).single();
  check("owning agent B accepts the hire request", !hAcc.error && hState.data?.status === "accepted", hAcc.error?.message);
  const mat = await B.client.rpc("materialize_hire_request_contract", { hire_request_uuid: ids.hire });
  check("B materializes the hire contract through the secure RPC", !mat.error && Boolean(mat.data), mat.error?.message);
  const mat2 = await B.client.rpc("materialize_hire_request_contract", { hire_request_uuid: ids.hire });
  const hireContracts = await admin.from("contracts").select("id, organization_id, agent_id").eq("source_id", ids.hire);
  check(
    "retry is idempotent; the contract names A's org and B's agent",
    !mat2.error && hireContracts.data?.length === 1 && hireContracts.data[0].organization_id === ids.org && hireContracts.data[0].agent_id === ids.agent,
  );
  const aSeesHireContract = await A.client.from("contracts").select("id").eq("source_id", ids.hire);
  check("A sees the hire contract too", aSeesHireContract.data?.length === 1);
}

async function cleanup() {
  const del = async (table, column, value) => {
    if (!value) return;
    const { error, count } = await admin.from(table).delete({ count: "exact" }).eq(column, value);
    console.log(`  cleanup ${table}: ${error ? `ERROR ${error.message}` : count}`);
  };
  if (ids.contract) {
    await del("contract_messages", "contract_id", ids.contract);
    await del("contract_milestones", "contract_id", ids.contract);
  }
  await del("contracts", "organization_id", ids.org);
  await del("activity_events", "actor_id", ids.agent);
  await del("hire_requests", "agent_id", ids.agent);
  await del("applications", "agent_id", ids.agent);
  await del("opportunities", "organization_id", ids.org);
  await del("organizations", "id", ids.org);
  await del("agents", "id", ids.agent);
  for (const id of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    console.log(`  cleanup user ${id.slice(0, 8)}: ${error ? `ERROR ${error.message}` : "deleted"}`);
  }
}

console.log(`Two-user journey against ${url}\nrun id ${run}\n`);
try {
  await main();
} catch (thrown) {
  check("journey aborted", false, thrown instanceof Error ? thrown.message : String(thrown));
} finally {
  console.log("\nCleanup:");
  await cleanup().catch((thrown) => console.error(`  cleanup warning: ${thrown.message}`));
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
