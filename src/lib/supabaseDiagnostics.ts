import {
  isSupabaseConfigured,
  supabase,
  supabaseEnvDiagnostics,
  getSupabaseErrorMessage,
} from "./supabase";

export type SupabaseDiagnosticStatus = "fail" | "pass" | "warn";

export type SupabaseDiagnosticResult = {
  name: string;
  status: SupabaseDiagnosticStatus;
  message: string;
  timestamp: string;
};

function result(
  name: string,
  status: SupabaseDiagnosticStatus,
  message: string,
): SupabaseDiagnosticResult {
  return {
    message,
    name,
    status,
    timestamp: new Date().toISOString(),
  };
}

async function checkReadable(tableName: string) {
  if (!supabase) {
    return result(tableName, "fail", "Supabase client is not available.");
  }

  const { error } = await supabase.from(tableName).select("id").limit(1);

  return error
    ? result(tableName, "fail", getSupabaseErrorMessage(error))
    : result(tableName, "pass", `${tableName} table is reachable.`);
}

export async function runSupabaseDiagnostics(): Promise<SupabaseDiagnosticResult[]> {
  const results: SupabaseDiagnosticResult[] = [
    result(
      "has VITE_SUPABASE_URL",
      supabaseEnvDiagnostics.hasUrl ? "pass" : "warn",
      `has VITE_SUPABASE_URL: ${supabaseEnvDiagnostics.hasUrl}`,
    ),
    result(
      "has VITE_SUPABASE_ANON_KEY",
      supabaseEnvDiagnostics.hasAnonKey ? "pass" : "warn",
      `has VITE_SUPABASE_ANON_KEY: ${supabaseEnvDiagnostics.hasAnonKey}`,
    ),
    result(
      "URL starts with https",
      supabaseEnvDiagnostics.urlStartsWithHttps ? "pass" : "warn",
      `URL starts with https: ${supabaseEnvDiagnostics.urlStartsWithHttps}`,
    ),
    result(
      "Environment variables",
      isSupabaseConfigured ? "pass" : "warn",
      isSupabaseConfigured
        ? "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present."
        : "Supabase env vars are missing. App will use local demo mode.",
    ),
    result(
      "Supabase client",
      supabase ? "pass" : "warn",
      supabase
        ? "Supabase client was created."
        : "Supabase client was not created because env vars are missing.",
    ),
  ];

  if (!isSupabaseConfigured || !supabase) {
    return results;
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  const session = sessionData.session;

  results.push(
    sessionError
      ? result("Auth session", "fail", getSupabaseErrorMessage(sessionError))
      : session
        ? result("Auth session", "pass", "Authenticated session is available.")
        : result(
            "Auth session",
            "warn",
            "No authenticated session. Read checks will run; write probes are skipped.",
          ),
  );

  results.push(await checkReadable("profiles"));
  results.push(await checkReadable("organizations"));
  results.push(await checkReadable("agents"));
  results.push(await checkReadable("opportunities"));

  if (!session?.user) {
    results.push(
      result(
        "Authenticated write probes",
        "warn",
        "Skipped because no user is signed in.",
      ),
    );
    return results;
  }

  const suffix = Date.now();
  const profilePayload = {
    account_type: "Marketplace Admin",
    display_name: "Diagnostics User",
    email: session.user.email,
    user_id: session.user.id,
  };
  const profileResult = await supabase
    .from("profiles")
    .upsert(profilePayload)
    .select("id")
    .single();
  const profileId = profileResult.data?.id as string | undefined;

  results.push(
    profileResult.error
      ? result("Create profile", "fail", getSupabaseErrorMessage(profileResult.error))
      : result("Create profile", "pass", "Profile upsert succeeded."),
  );

  const orgResult = await supabase
    .from("organizations")
    .insert({
      industry: "Diagnostics",
      name: `Diagnostics Org ${suffix}`,
      overview: "Temporary diagnostics organization.",
      owner_id: profileId,
      verified: false,
    })
    .select("id")
    .single();
  const organizationId = orgResult.data?.id as string | undefined;

  results.push(
    orgResult.error
      ? result("Create organization", "fail", getSupabaseErrorMessage(orgResult.error))
      : result("Create organization", "pass", "Organization insert succeeded."),
  );

  const agentResult = await supabase
    .from("agents")
    .insert({
      availability: "Available",
      name: `Diagnostics Agent ${suffix}`,
      owner_id: profileId,
      skills: ["Diagnostics"],
      specialty: "Diagnostics Agent",
      trust_score: 90,
    })
    .select("id, name")
    .single();
  const agentId = agentResult.data?.id as string | undefined;
  const agentName = (agentResult.data?.name as string | undefined) ?? "Diagnostics Agent";

  results.push(
    agentResult.error
      ? result("Create agent", "fail", getSupabaseErrorMessage(agentResult.error))
      : result("Create agent", "pass", "Agent insert succeeded."),
  );

  const opportunityResult = await supabase
    .from("opportunities")
    .insert({
      budget_range: "$1k - $2k",
      category: "Diagnostics",
      description: "Temporary diagnostics opportunity.",
      estimated_duration: "1 week",
      organization_id: organizationId,
      organization_name: `Diagnostics Org ${suffix}`,
      owner_id: profileId,
      required_skills: ["Diagnostics"],
      success_criteria: "Diagnostics passes.",
      title: `Diagnostics Opportunity ${suffix}`,
    })
    .select("id, title")
    .single();
  const opportunityId = opportunityResult.data?.id as string | undefined;
  const opportunityTitle =
    (opportunityResult.data?.title as string | undefined) ??
    "Diagnostics Opportunity";

  results.push(
    opportunityResult.error
      ? result(
          "Create opportunity",
          "fail",
          getSupabaseErrorMessage(opportunityResult.error),
        )
      : result("Create opportunity", "pass", "Opportunity insert succeeded."),
  );

  const applicationResult = await supabase.from("applications").insert({
    agent_id: agentId,
    agent_name: agentName,
    opportunity_id: opportunityId,
    owner_id: profileId,
    proposal: "Diagnostics application.",
  });

  results.push(
    applicationResult.error
      ? result(
          "Create application",
          "fail",
          getSupabaseErrorMessage(applicationResult.error),
        )
      : result("Create application", "pass", "Application insert succeeded."),
  );

  const negotiationResult = await supabase.from("negotiations").insert({
    agent_id: agentId,
    agent_name: agentName,
    milestone_notes: "Diagnostics negotiation.",
    opportunity_id: opportunityId,
    owner_id: profileId,
    rate: "$2k",
    timeline: "1 week",
  });

  results.push(
    negotiationResult.error
      ? result(
          "Create negotiation",
          "fail",
          getSupabaseErrorMessage(negotiationResult.error),
        )
      : result("Create negotiation", "pass", "Negotiation insert succeeded."),
  );

  const hireRequestResult = await supabase.from("hire_requests").insert({
    agent_id: agentId,
    agent_name: agentName,
    opportunity_id: opportunityId,
    opportunity_title: opportunityTitle,
    owner_id: profileId,
    quick_job_title: "Diagnostics hire request",
  });

  results.push(
    hireRequestResult.error
      ? result(
          "Create hire request",
          "fail",
          getSupabaseErrorMessage(hireRequestResult.error),
        )
      : result("Create hire request", "pass", "Hire request insert succeeded."),
  );

  const contractResult = await supabase
    .from("contracts")
    .insert({
      agent_id: agentId,
      agent_name: agentName,
      organization_id: organizationId,
      organization_name: `Diagnostics Org ${suffix}`,
      progress: 0,
      status: "Active",
      title: `Diagnostics Contract ${suffix}`,
      value: "$2k",
    })
    .select("id")
    .single();
  const contractId = contractResult.data?.id as string | undefined;

  results.push(
    contractResult.error
      ? result("Create contract", "fail", getSupabaseErrorMessage(contractResult.error))
      : result("Create contract", "pass", "Contract insert succeeded."),
  );

  const messageResult = await supabase.from("contract_messages").insert({
    author: "Diagnostics",
    body: "Diagnostics message.",
    contract_id: contractId,
    sender_type: "Organization",
  });

  results.push(
    messageResult.error
      ? result("Create message", "fail", getSupabaseErrorMessage(messageResult.error))
      : result("Create message", "pass", "Message insert succeeded."),
  );

  return results;
}
