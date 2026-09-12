/**
 * Supabase-backed hydration of the AgentExchange state.
 *
 * In Supabase mode the normalized marketplace tables ARE the state. Every
 * signed-in user reads the same opportunities, agents and reviews (public
 * read policies) and the applications, negotiations, hire requests and
 * contracts they are a party to (participant read policies). Nothing here is
 * scoped to "my browser": that is what makes the marketplace two-sided.
 *
 * The mapping from rows to the persisted-state shape is kept as pure
 * functions so it can be unit tested without a Supabase client.
 */
import type { Agent } from "../../data/agents";
import type { AccentTone } from "../../data/marketplace";
import type { ContractStatus } from "../../data/operations";
import type {
  AgentActivityEvent,
  AgentExchangePersistedState,
  AgentReview,
  Application,
  ContractActivityEvent,
  ContractDeliverable,
  ContractDispute,
  ContractMessage,
  ContractMilestone,
  ContractWorkspace,
  CreatedAgent,
  CreatedOpportunity,
  HireRequest,
  LocalContract,
  Negotiation,
  SavedOpportunity,
} from "../../state/marketplaceTypes";
import { getSupabaseErrorMessage, isSupabaseConfigured, supabase } from "../supabase";
import { emptyAgentExchangeState } from "./localStateRepository";

type Row = Record<string, unknown>;

export type SupabaseStateRows = {
  activityEvents: Row[];
  agents: Row[];
  applications: Row[];
  contractDeliverables: Row[];
  contractMessages: Row[];
  contractMilestones: Row[];
  contracts: Row[];
  disputes: Row[];
  hireRequests: Row[];
  negotiations: Row[];
  opportunities: Row[];
  reviews: Row[];
  savedOpportunities: Row[];
};

export type SupabaseHydratedState = AgentExchangePersistedState & {
  /** The signed-in user's profiles.id, or null when signed out. */
  currentProfileId: string | null;
};

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function number(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sortByCreatedAt<T extends { createdAt: string }>(items: T[], direction: "asc" | "desc") {
  return [...items].sort((a, b) =>
    direction === "asc"
      ? a.createdAt.localeCompare(b.createdAt)
      : b.createdAt.localeCompare(a.createdAt),
  );
}

export function mapOpportunityRow(row: Row): CreatedOpportunity {
  const requiredSkills = textArray(row.required_skills);
  return {
    accent: "violet",
    budget: text(row.budget_range, "Custom budget"),
    cadence: text(row.estimated_duration, "project"),
    category: text(row.category, "General"),
    createdAt: text(row.created_at),
    duration: optionalText(row.estimated_duration),
    id: text(row.id),
    matchScore: 90,
    organization: optionalText(row.organization_name),
    organizationId: optionalText(row.organization_id),
    ownerId: optionalText(row.owner_id),
    requiredSkills,
    successCriteria: optionalText(row.success_criteria),
    summary: text(row.description),
    tags: requiredSkills.length > 0 ? requiredSkills : ["Custom"],
    title: text(row.title, "Opportunity"),
    trustLevel: "Verified",
  };
}

export function mapAgentRow(row: Row): CreatedAgent {
  const name = text(row.name, "Agent");
  return {
    accent: "violet",
    availability: (optionalText(row.availability) ?? "Available") as Agent["availability"],
    avatarInitials:
      name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "AI",
    contractHistoryIds: [],
    createdAt: text(row.created_at),
    customSkills: textArray(row.skills),
    description: text(row.description),
    id: text(row.id),
    name,
    ownerId: optionalText(row.owner_id),
    revenue: text(row.revenue, "$0"),
    skillIds: [],
    specialty: text(row.specialty, "Generalist"),
    startingRate: text(row.starting_rate),
    successRate: text(row.success_rate, "New"),
    tier: text(row.verification_status, "Unverified"),
    toolAccess: textArray(row.tool_access),
    trustScore: number(row.trust_score),
  };
}

function titleFor(opportunities: Map<string, CreatedOpportunity>, opportunityId: unknown, fallback: string) {
  const id = optionalText(opportunityId);
  return (id && opportunities.get(id)?.title) || fallback;
}

export function mapApplicationRow(row: Row, opportunities: Map<string, CreatedOpportunity>): Application {
  return {
    agentId: text(row.agent_id),
    agentName: text(row.agent_name, "Agent"),
    createdAt: text(row.created_at),
    id: text(row.id),
    opportunityId: text(row.opportunity_id),
    opportunityTitle: titleFor(opportunities, row.opportunity_id, "Opportunity"),
    ownerId: optionalText(row.owner_id),
    proposal: text(row.proposal),
    status: (optionalText(row.status) ?? "pending") as Application["status"],
  };
}

export function mapNegotiationRow(row: Row, opportunities: Map<string, CreatedOpportunity>): Negotiation {
  return {
    agentId: optionalText(row.agent_id),
    agentName: optionalText(row.agent_name),
    counterNote: optionalText(row.counter_note),
    counterRate: optionalText(row.counter_rate),
    counterTimeline: optionalText(row.counter_timeline),
    createdAt: text(row.created_at),
    id: text(row.id),
    milestoneNotes: text(row.milestone_notes),
    opportunityId: text(row.opportunity_id),
    opportunityTitle: titleFor(opportunities, row.opportunity_id, "Opportunity"),
    ownerId: optionalText(row.owner_id),
    rate: text(row.rate),
    status: (optionalText(row.status) ?? "pending") as Negotiation["status"],
    timeline: text(row.timeline),
  };
}

export function mapHireRequestRow(row: Row, opportunities: Map<string, CreatedOpportunity>): HireRequest {
  return {
    agentId: text(row.agent_id),
    agentName: text(row.agent_name, "Agent"),
    createdAt: text(row.created_at),
    id: text(row.id),
    opportunityId: optionalText(row.opportunity_id),
    opportunityTitle:
      optionalText(row.opportunity_title) ??
      titleFor(opportunities, row.opportunity_id, optionalText(row.quick_job_title) ?? "Hire request"),
    ownerId: optionalText(row.owner_id),
    quickJobTitle: optionalText(row.quick_job_title),
    status: (optionalText(row.status) ?? "pending") as HireRequest["status"],
  };
}

export function mapContractRow(row: Row): LocalContract {
  const sourceType = optionalText(row.source_type);
  return {
    accent: (sourceType === "hire-request" ? "emerald" : "violet") as AccentTone,
    agent: text(row.agent_name, "Agent"),
    agentId: optionalText(row.agent_id),
    dueDate: text(row.due_date),
    id: text(row.id),
    organization: text(row.organization_name, "Organization"),
    organizationId: text(row.organization_id),
    progress: number(row.progress),
    sourceId: text(row.source_id),
    sourceType: (sourceType ?? "application") as LocalContract["sourceType"],
    startDate: text(row.start_date),
    status: (optionalText(row.status) ?? "Active") as ContractStatus,
    title: text(row.title, "Contract"),
    value: text(row.value, "Custom scope"),
  };
}

export function mapMilestoneRow(row: Row): ContractMilestone {
  return {
    completed: Boolean(row.completed),
    completedAt: optionalText(row.completed_at),
    createdAt: text(row.created_at),
    id: text(row.id),
    notes: text(row.notes),
    title: text(row.title, "Milestone"),
  };
}

export function mapDeliverableRow(row: Row): ContractDeliverable {
  const decisions = Array.isArray(row.decisions) ? (row.decisions as ContractDeliverable["decisions"]) : [];
  return {
    approvedAt: optionalText(row.approved_at),
    createdAt: text(row.created_at),
    decisions,
    id: text(row.id),
    notes: text(row.notes),
    status: (optionalText(row.status) ?? "draft") as ContractDeliverable["status"],
    submittedAt: optionalText(row.submitted_at),
    title: text(row.title, "Deliverable"),
  };
}

export function mapMessageRow(row: Row): ContractMessage {
  return {
    author: text(row.author, "Participant"),
    body: text(row.body),
    createdAt: text(row.created_at),
    id: text(row.id),
    senderType: (optionalText(row.sender_type) ?? "Organization") as ContractMessage["senderType"],
  };
}

export function mapReviewRow(row: Row): AgentReview {
  return {
    agentId: optionalText(row.agent_id),
    agentName: text(row.agent_name, "Agent"),
    contractId: text(row.contract_id),
    contractTitle: text(row.contract_title, "Contract"),
    createdAt: text(row.created_at),
    id: text(row.id),
    organization: text(row.organization_name, "Organization"),
    rating: number(row.rating, 5),
    review: text(row.review),
  };
}

export function mapDisputeRow(row: Row): ContractDispute {
  return {
    contractId: text(row.contract_id),
    createdAt: text(row.created_at),
    id: text(row.id),
    reason: text(row.reason),
    resolutionNotes: optionalText(row.resolution_notes),
    status: (optionalText(row.status) ?? "Open") as ContractDispute["status"],
    updatedAt: text(row.updated_at, text(row.created_at)),
  };
}

export function mapSavedOpportunityRow(row: Row): SavedOpportunity {
  return {
    opportunityId: text(row.opportunity_id),
    savedAt: text(row.created_at),
  };
}

export function mapAgentActivityRow(row: Row): AgentActivityEvent | null {
  const metadata = (row.metadata ?? {}) as Row;
  const agentId = optionalText(metadata.agentId) ?? optionalText(row.actor_id);
  const agentName = optionalText(metadata.agentName);
  const type = optionalText(metadata.type) ?? optionalText(row.event_type);
  if (!agentId || !agentName || !type) {
    return null;
  }
  return {
    agentId,
    agentName,
    createdAt: text(metadata.createdAt) || text(row.created_at),
    id: text(row.id),
    message: text(row.message),
    type: type as AgentActivityEvent["type"],
  };
}

/**
 * Builds one workspace per contract from its child rows. Activity is derived
 * from the rows themselves so the timeline survives a reload.
 */
export function buildWorkspaces(
  contracts: LocalContract[],
  milestoneRows: Row[],
  deliverableRows: Row[],
  messageRows: Row[],
): ContractWorkspace[] {
  return contracts.map((contract) => {
    const milestones = sortByCreatedAt(
      milestoneRows.filter((row) => row.contract_id === contract.id).map(mapMilestoneRow),
      "asc",
    );
    const deliverables = sortByCreatedAt(
      deliverableRows.filter((row) => row.contract_id === contract.id).map(mapDeliverableRow),
      "asc",
    );
    const messages = sortByCreatedAt(
      messageRows.filter((row) => row.contract_id === contract.id).map(mapMessageRow),
      "asc",
    );

    const activity: ContractActivityEvent[] = [
      ...milestones.map((milestone) => ({
        createdAt: milestone.completedAt ?? milestone.createdAt,
        id: `activity-milestone-${milestone.id}`,
        message: milestone.completed
          ? `Completed milestone: ${milestone.title}.`
          : `Milestone added: ${milestone.title}.`,
        type: milestone.completed ? ("milestone_completed" as const) : ("workspace" as const),
      })),
      ...deliverables.map((deliverable) => ({
        createdAt: deliverable.approvedAt ?? deliverable.submittedAt ?? deliverable.createdAt,
        id: `activity-deliverable-${deliverable.id}`,
        message:
          deliverable.status === "approved"
            ? `Deliverable approved: ${deliverable.title}.`
            : deliverable.status === "submitted"
              ? `Deliverable submitted: ${deliverable.title}.`
              : `Deliverable added: ${deliverable.title}.`,
        type:
          deliverable.status === "approved"
            ? ("deliverable_approved" as const)
            : deliverable.status === "submitted"
              ? ("deliverable_submitted" as const)
              : ("workspace" as const),
      })),
      ...messages.map((message) => ({
        createdAt: message.createdAt,
        id: `activity-message-${message.id}`,
        message: `${message.senderType} message sent by ${message.author}.`,
        type: "message_sent" as const,
      })),
    ];

    const updatedAt =
      [...milestones, ...deliverables, ...messages]
        .map((item) => item.createdAt)
        .sort()
        .at(-1) ?? "";

    return {
      activity: sortByCreatedAt(activity, "desc"),
      contractId: contract.id,
      deliverables,
      messages,
      milestones,
      updatedAt,
    };
  });
}

export function mapRowsToState(rows: SupabaseStateRows): AgentExchangePersistedState {
  const createdOpportunities = sortByCreatedAt(rows.opportunities.map(mapOpportunityRow), "desc");
  const opportunityIndex = new Map(createdOpportunities.map((opportunity) => [opportunity.id, opportunity]));
  const localContracts = sortByCreatedAt(
    rows.contracts.map((row) => ({ ...mapContractRow(row), createdAt: text(row.created_at) })),
    "asc",
  ).map(({ createdAt: _createdAt, ...contract }) => contract);

  return {
    agentActivities: sortByCreatedAt(
      rows.activityEvents.map(mapAgentActivityRow).filter((event): event is AgentActivityEvent => event !== null),
      "desc",
    ),
    agentReviews: sortByCreatedAt(rows.reviews.map(mapReviewRow), "desc"),
    applications: sortByCreatedAt(rows.applications.map((row) => mapApplicationRow(row, opportunityIndex)), "asc"),
    contractDisputes: sortByCreatedAt(rows.disputes.map(mapDisputeRow), "desc"),
    contractWorkspaces: buildWorkspaces(
      localContracts,
      rows.contractMilestones,
      rows.contractDeliverables,
      rows.contractMessages,
    ),
    createdAgents: sortByCreatedAt(rows.agents.map(mapAgentRow), "desc"),
    createdOpportunities,
    hireRequests: sortByCreatedAt(rows.hireRequests.map((row) => mapHireRequestRow(row, opportunityIndex)), "asc"),
    localContracts,
    negotiations: sortByCreatedAt(rows.negotiations.map((row) => mapNegotiationRow(row, opportunityIndex)), "asc"),
    savedOpportunities: rows.savedOpportunities.map(mapSavedOpportunityRow),
  };
}

async function selectAll(table: string, query?: (builder: ReturnType<NonNullable<typeof supabase>["from"]>) => unknown): Promise<Row[]> {
  if (!supabase) {
    return [];
  }
  const builder = supabase.from(table);
  const request = query ? query(builder) : builder.select("*");
  const { data, error } = (await request) as { data: Row[] | null; error: { message: string } | null };
  if (error) {
    throw new Error(`Unable to load ${table}: ${getSupabaseErrorMessage(error as never)}`);
  }
  return data ?? [];
}

export async function loadCurrentProfileId(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    return null;
  }
  const { data, error } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  if (error) {
    throw new Error(`Unable to load profile: ${getSupabaseErrorMessage(error)}`);
  }
  return (data?.id as string | undefined) ?? null;
}

/**
 * Loads the marketplace as the current session sees it. Public tables load
 * for everyone; participant-scoped tables come back empty for a signed-out
 * session because their policies are restricted to `authenticated`.
 */
export async function loadSupabaseState(): Promise<SupabaseHydratedState> {
  if (!isSupabaseConfigured || !supabase) {
    return { ...emptyAgentExchangeState, currentProfileId: null };
  }

  const [
    currentProfileId,
    opportunities,
    agents,
    reviews,
    activityEvents,
    applications,
    negotiations,
    hireRequests,
    contracts,
    savedOpportunities,
    disputes,
  ] = await Promise.all([
    loadCurrentProfileId(),
    selectAll("opportunities"),
    selectAll("agents"),
    selectAll("reviews"),
    selectAll("activity_events", (builder) =>
      builder
        .select("*")
        .eq("actor_type", "agent")
        .order("created_at", { ascending: false })
        .limit(200),
    ),
    selectAll("applications"),
    selectAll("negotiations"),
    selectAll("hire_requests"),
    selectAll("contracts"),
    selectAll("saved_opportunities"),
    selectAll("disputes"),
  ]);

  const [contractMilestones, contractDeliverables, contractMessages] =
    contracts.length > 0
      ? await Promise.all([
          selectAll("contract_milestones"),
          selectAll("contract_deliverables"),
          selectAll("contract_messages"),
        ])
      : [[], [], []];

  return {
    ...mapRowsToState({
      activityEvents,
      agents,
      applications,
      contractDeliverables,
      contractMessages,
      contractMilestones,
      contracts,
      disputes,
      hireRequests,
      negotiations,
      opportunities,
      reviews,
      savedOpportunities,
    }),
    currentProfileId,
  };
}
