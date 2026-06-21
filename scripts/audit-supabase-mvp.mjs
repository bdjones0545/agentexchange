import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const testEmail = process.env.SUPABASE_TEST_EMAIL;
const testPassword = process.env.SUPABASE_TEST_PASSWORD;

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
