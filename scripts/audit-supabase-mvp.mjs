import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const testEmail = process.env.SUPABASE_TEST_EMAIL;
const testPassword = process.env.SUPABASE_TEST_PASSWORD;
const userAEmail = process.env.SUPABASE_TEST_USER_A_EMAIL;
const userAPassword = process.env.SUPABASE_TEST_USER_A_PASSWORD;
const userBEmail = process.env.SUPABASE_TEST_USER_B_EMAIL;
const userBPassword = process.env.SUPABASE_TEST_USER_B_PASSWORD;

const results = [];

function record(name, status, message) {
  results.push({
    message,
    name,
    status,
    timestamp: new Date().toISOString(),
  });
}

function printResults() {
  for (const result of results) {
    const marker =
      result.status === "pass" ? "PASS" : result.status === "warn" ? "WARN" : "FAIL";
    console.log(`[${marker}] ${result.name}: ${result.message}`);
  }
}

function isUuid(value) {
  return Boolean(
    value?.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ),
  );
}

async function signInClient(email, password, label) {
  const client = createClient(url, anonKey);
  const auth = await client.auth.signInWithPassword({ email, password });

  if (auth.error || !auth.data.user) {
    record(`${label} sign in`, "fail", auth.error?.message ?? "No user returned.");
    return null;
  }

  record(`${label} sign in`, "pass", `Signed in as ${auth.data.user.email}.`);
  return {
    client,
    user: auth.data.user,
  };
}

async function ensureProfile(client, user, label, accountType) {
  const profile = await client
    .from("profiles")
    .upsert({
      account_type: accountType,
      display_name: `AE_TEST_${label}`,
      email: user.email,
      user_id: user.id,
    })
    .select("id")
    .single();

  record(
    `${label} profile persists`,
    profile.error ? "fail" : "pass",
    profile.error?.message ?? "Profile upsert succeeded.",
  );

  return profile.data?.id;
}

async function expectBlocked(name, promise) {
  const { error } = await promise;

  record(
    name,
    error ? "pass" : "fail",
    error
      ? `Blocked as expected: ${error.message}`
      : "Unexpectedly succeeded; RLS may be too permissive.",
  );
}

async function runTwoUserWorkflow() {
  if (!userAEmail || !userAPassword || !userBEmail || !userBPassword) {
    return false;
  }

  record("Two-user credentials", "pass", "User A and User B credentials are present.");

  const userA = await signInClient(userAEmail, userAPassword, "User A");
  const userB = await signInClient(userBEmail, userBPassword, "User B");

  if (!userA || !userB) {
    return true;
  }

  const suffix = `AE_TEST_${Date.now()}`;
  const profileAId = await ensureProfile(userA.client, userA.user, "User A", "Organization");
  const profileBId = await ensureProfile(userB.client, userB.user, "User B", "Agent Operator");

  const organization = await userA.client
    .from("organizations")
    .insert({
      industry: "Audit",
      name: `${suffix}_Organization`,
      overview: "Two-user audit organization",
      owner_id: profileAId,
    })
    .select("id")
    .single();
  const organizationId = organization.data?.id;
  record("User A creates organization", organization.error ? "fail" : "pass", organization.error?.message ?? `organization_id UUID: ${isUuid(organizationId)}`);

  const opportunity = await userA.client
    .from("opportunities")
    .insert({
      budget_range: "$5k - $8k",
      category: "Audit",
      description: "Two-user audit opportunity",
      estimated_duration: "2 weeks",
      organization_id: organizationId,
      organization_name: `${suffix}_Organization`,
      owner_id: profileAId,
      required_skills: ["Audit"],
      success_criteria: "Two-user audit passes",
      title: `${suffix}_Opportunity`,
    })
    .select("id, title")
    .single();
  const opportunityId = opportunity.data?.id;
  const opportunityTitle = opportunity.data?.title ?? `${suffix}_Opportunity`;
  record("User A creates opportunity", opportunity.error ? "fail" : "pass", opportunity.error?.message ?? `opportunity_id UUID: ${isUuid(opportunityId)}`);

  const agent = await userB.client
    .from("agents")
    .insert({
      availability: "Available",
      name: `${suffix}_Agent`,
      owner_id: profileBId,
      skills: ["Audit"],
      specialty: "Audit Agent",
      trust_score: 90,
    })
    .select("id, name")
    .single();
  const agentId = agent.data?.id;
  const agentName = agent.data?.name ?? `${suffix}_Agent`;
  record("User B creates agent", agent.error ? "fail" : "pass", agent.error?.message ?? `agent_id UUID: ${isUuid(agentId)}`);

  const saved = await userB.client.from("saved_opportunities").upsert(
    {
      opportunity_id: opportunityId,
      owner_id: profileBId,
    },
    { onConflict: "owner_id,opportunity_id" },
  );
  record("User B saves opportunity", saved.error ? "fail" : "pass", saved.error?.message ?? "Saved opportunity row created.");

  const application = await userB.client
    .from("applications")
    .insert({
      agent_id: agentId,
      agent_name: agentName,
      opportunity_id: opportunityId,
      owner_id: profileBId,
      proposal: "Two-user audit application",
    })
    .select("id")
    .single();
  const applicationId = application.data?.id;
  record("User B applies", application.error ? "fail" : "pass", application.error?.message ?? `application_id UUID: ${isUuid(applicationId)}`);

  const negotiation = await userB.client
    .from("negotiations")
    .insert({
      agent_id: agentId,
      agent_name: agentName,
      milestone_notes: "Two-user audit negotiation",
      opportunity_id: opportunityId,
      owner_id: profileBId,
      rate: "$8k",
      timeline: "2 weeks",
    })
    .select("id")
    .single();
  record("User B negotiates", negotiation.error ? "fail" : "pass", negotiation.error?.message ?? `negotiation_id UUID: ${isUuid(negotiation.data?.id)}`);

  const hireRequest = await userB.client
    .from("hire_requests")
    .insert({
      agent_id: agentId,
      agent_name: agentName,
      opportunity_id: opportunityId,
      opportunity_title: opportunityTitle,
      owner_id: profileBId,
      quick_job_title: "Two-user audit hire",
    })
    .select("id")
    .single();
  record("User B sends hire request", hireRequest.error ? "fail" : "pass", hireRequest.error?.message ?? `hire_request_id UUID: ${isUuid(hireRequest.data?.id)}`);

  const applicationAccept = await userA.client
    .from("applications")
    .update({ status: "accepted" })
    .eq("id", applicationId);
  record("User A accepts application", applicationAccept.error ? "fail" : "pass", applicationAccept.error?.message ?? "Application accepted.");

  const contract = await userA.client
    .from("contracts")
    .insert({
      agent_id: agentId,
      agent_name: agentName,
      organization_id: organizationId,
      organization_name: `${suffix}_Organization`,
      progress: 0,
      source_id: applicationId,
      source_type: "application",
      status: "Active",
      title: `${suffix}_Contract`,
      value: "$8k",
    })
    .select("id")
    .single();
  const contractId = contract.data?.id;
  record("User A creates contract", contract.error ? "fail" : "pass", contract.error?.message ?? `contract_id UUID: ${isUuid(contractId)}`);

  const userAContractRead = await userA.client.from("contracts").select("id").eq("id", contractId).single();
  const userBContractRead = await userB.client.from("contracts").select("id").eq("id", contractId).single();
  record("User A views contract", userAContractRead.error ? "fail" : "pass", userAContractRead.error?.message ?? "User A can read contract.");
  record("User B views contract", userBContractRead.error ? "fail" : "pass", userBContractRead.error?.message ?? "User B can read contract.");

  const messageA = await userA.client.from("contract_messages").insert({
    author: `${suffix}_Organization`,
    body: "Organization message",
    contract_id: contractId,
    sender_type: "Organization",
  });
  const messageB = await userB.client.from("contract_messages").insert({
    author: agentName,
    body: "Agent message",
    contract_id: contractId,
    sender_type: "Agent",
  });
  record("User A sends message", messageA.error ? "fail" : "pass", messageA.error?.message ?? "Organization message inserted.");
  record("User B sends message", messageB.error ? "fail" : "pass", messageB.error?.message ?? "Agent message inserted.");

  const milestone = await userA.client.from("contract_milestones").insert({
    completed: true,
    completed_at: new Date().toISOString(),
    contract_id: contractId,
    notes: "Two-user audit milestone",
    title: `${suffix}_Milestone`,
  });
  record("Milestone persists", milestone.error ? "fail" : "pass", milestone.error?.message ?? "Milestone inserted.");

  const deliverable = await userB.client.from("contract_deliverables").insert({
    contract_id: contractId,
    notes: "Two-user audit deliverable",
    status: "submitted",
    submitted_at: new Date().toISOString(),
    title: `${suffix}_Deliverable`,
  });
  record("Deliverable persists", deliverable.error ? "fail" : "pass", deliverable.error?.message ?? "Deliverable inserted.");

  const review = await userA.client.from("reviews").insert({
    agent_id: agentId,
    agent_name: agentName,
    contract_id: contractId,
    contract_title: `${suffix}_Contract`,
    organization_id: organizationId,
    organization_name: `${suffix}_Organization`,
    rating: 5,
    review: "Two-user audit review",
  });
  record("Review persists", review.error ? "fail" : "pass", review.error?.message ?? "Review inserted.");

  const dispute = await userB.client.from("disputes").insert({
    contract_id: contractId,
    metadata: { source: "two-user-audit" },
    owner_id: profileBId,
    reason: "Two-user audit dispute",
    status: "Open",
  });
  record("Dispute persists", dispute.error ? "fail" : "pass", dispute.error?.message ?? "Dispute inserted.");

  await expectBlocked(
    "User B cannot update User A opportunity",
    userB.client.from("opportunities").update({ title: `${suffix}_Blocked` }).eq("id", opportunityId),
  );
  await expectBlocked(
    "User A cannot update User B agent",
    userA.client.from("agents").update({ name: `${suffix}_Blocked` }).eq("id", agentId),
  );

  return true;
}

async function main() {
  record(
    "Environment",
    url && anonKey ? "pass" : "warn",
    url && anonKey
      ? "Supabase URL and anon key are present."
      : "Supabase env vars are missing; live audit skipped.",
  );

  if (!url || !anonKey) {
    printResults();
    return;
  }

  const supabase = createClient(url, anonKey);

  for (const table of ["profiles", "organizations", "agents", "opportunities"]) {
    const { error } = await supabase.from(table).select("id").limit(1);
    record(
      `Read ${table}`,
      error ? "fail" : "pass",
      error?.message ?? `${table} readable.`,
    );
  }

  if (await runTwoUserWorkflow()) {
    printResults();
    if (results.some((result) => result.status === "fail")) {
      process.exitCode = 1;
    }
    return;
  }

  if (!testEmail || !testPassword) {
    record(
      "Authenticated workflow",
      "warn",
      "SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD are required for write-path validation.",
    );
    printResults();
    return;
  }

  const authResult = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (authResult.error || !authResult.data.user) {
    record(
      "Sign in",
      "fail",
      authResult.error?.message ?? "No user returned from sign-in.",
    );
    printResults();
    process.exitCode = 1;
    return;
  }

  record("Sign in", "pass", `Signed in as ${authResult.data.user.email}.`);

  const suffix = Date.now();
  const profile = await supabase
    .from("profiles")
    .upsert({
      account_type: "Marketplace Admin",
      display_name: "Audit User",
      email: authResult.data.user.email,
      user_id: authResult.data.user.id,
    })
    .select("id")
    .single();
  const profileId = profile.data?.id;
  record("Profile persists", profile.error ? "fail" : "pass", profile.error?.message ?? "Profile upsert succeeded.");

  const organization = await supabase
    .from("organizations")
    .insert({
      industry: "Audit",
      name: `Audit Organization ${suffix}`,
      overview: "Audit organization",
      owner_id: profileId,
    })
    .select("id")
    .single();
  const organizationId = organization.data?.id;
  record("Organization persists", organization.error ? "fail" : "pass", organization.error?.message ?? "Organization created.");

  const agent = await supabase
    .from("agents")
    .insert({
      availability: "Available",
      name: `Audit Agent ${suffix}`,
      owner_id: profileId,
      skills: ["Audit"],
      specialty: "Audit Agent",
      trust_score: 90,
    })
    .select("id, name")
    .single();
  const agentId = agent.data?.id;
  const agentName = agent.data?.name ?? `Audit Agent ${suffix}`;
  record("Agent persists", agent.error ? "fail" : "pass", agent.error?.message ?? "Agent created.");

  const opportunity = await supabase
    .from("opportunities")
    .insert({
      budget_range: "$1k - $2k",
      category: "Audit",
      description: "Audit opportunity",
      estimated_duration: "1 week",
      organization_id: organizationId,
      organization_name: `Audit Organization ${suffix}`,
      owner_id: profileId,
      required_skills: ["Audit"],
      success_criteria: "Audit passes",
      title: `Audit Opportunity ${suffix}`,
    })
    .select("id, title")
    .single();
  const opportunityId = opportunity.data?.id;
  const opportunityTitle = opportunity.data?.title ?? `Audit Opportunity ${suffix}`;
  record("Opportunity persists", opportunity.error ? "fail" : "pass", opportunity.error?.message ?? "Opportunity created.");

  const application = await supabase
    .from("applications")
    .insert({
      agent_id: agentId,
      agent_name: agentName,
      opportunity_id: opportunityId,
      owner_id: profileId,
      proposal: "Audit application",
    })
    .select("id")
    .single();
  record("Application persists", application.error ? "fail" : "pass", application.error?.message ?? "Application created.");

  const savedOpportunity = await supabase.from("saved_opportunities").upsert(
    {
      opportunity_id: opportunityId,
      owner_id: profileId,
    },
    {
      onConflict: "owner_id,opportunity_id",
    },
  );
  record("Saved opportunity persists", savedOpportunity.error ? "fail" : "pass", savedOpportunity.error?.message ?? "Saved opportunity created.");

  const negotiation = await supabase
    .from("negotiations")
    .insert({
      agent_id: agentId,
      agent_name: agentName,
      milestone_notes: "Audit negotiation",
      opportunity_id: opportunityId,
      owner_id: profileId,
      rate: "$2k",
      timeline: "1 week",
    })
    .select("id")
    .single();
  record("Negotiation persists", negotiation.error ? "fail" : "pass", negotiation.error?.message ?? "Negotiation created.");

  const hireRequest = await supabase
    .from("hire_requests")
    .insert({
      agent_id: agentId,
      agent_name: agentName,
      opportunity_id: opportunityId,
      opportunity_title: opportunityTitle,
      owner_id: profileId,
      quick_job_title: "Audit hire",
    })
    .select("id")
    .single();
  record("Hire request persists", hireRequest.error ? "fail" : "pass", hireRequest.error?.message ?? "Hire request created.");

  const contract = await supabase
    .from("contracts")
    .insert({
      agent_id: agentId,
      agent_name: agentName,
      organization_id: organizationId,
      organization_name: `Audit Organization ${suffix}`,
      progress: 0,
      status: "Active",
      title: `Audit Contract ${suffix}`,
      value: "$2k",
    })
    .select("id")
    .single();
  const contractId = contract.data?.id;
  record("Contract persists", contract.error ? "fail" : "pass", contract.error?.message ?? "Contract created.");

  const milestone = await supabase
    .from("contract_milestones")
    .insert({
      contract_id: contractId,
      notes: "Audit milestone",
      title: "Audit milestone",
    })
    .select("id")
    .single();
  record("Milestone persists", milestone.error ? "fail" : "pass", milestone.error?.message ?? "Milestone created.");

  const deliverable = await supabase
    .from("contract_deliverables")
    .insert({
      contract_id: contractId,
      notes: "Audit deliverable",
      status: "submitted",
      title: "Audit deliverable",
    })
    .select("id")
    .single();
  record("Deliverable persists", deliverable.error ? "fail" : "pass", deliverable.error?.message ?? "Deliverable created.");

  const message = await supabase.from("contract_messages").insert({
    author: "Audit Organization",
    body: "Audit message",
    contract_id: contractId,
    sender_type: "Organization",
  });
  record("Message persists", message.error ? "fail" : "pass", message.error?.message ?? "Message created.");

  const review = await supabase.from("reviews").insert({
    agent_id: agentId,
    agent_name: agentName,
    contract_id: contractId,
    contract_title: `Audit Contract ${suffix}`,
    organization_id: organizationId,
    organization_name: `Audit Organization ${suffix}`,
    rating: 5,
    review: "Audit review",
  });
  record("Review persists", review.error ? "fail" : "pass", review.error?.message ?? "Review created.");

  const dispute = await supabase.from("disputes").insert({
    contract_id: contractId,
    metadata: { source: "audit" },
    owner_id: profileId,
    reason: "Audit dispute",
    status: "Open",
  });
  record("Dispute persists", dispute.error ? "fail" : "pass", dispute.error?.message ?? "Dispute created.");

  printResults();

  if (results.some((result) => result.status === "fail")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
