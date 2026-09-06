/**
 * AgentExchange's WebMCP tool surface.
 *
 * Every tool here is a read over data the signed-in user can already see in
 * the UI. Nothing posts an opportunity, submits an application, accepts a
 * negotiation, or moves money — those paths stay human-driven.
 *
 * Personal tools (`applications`, `saved`, `contracts`) return an explicit
 * "sign in" message rather than empty results when there is no session, so an
 * agent reports the real reason instead of concluding the user has nothing.
 */
import { getAgentSkills } from "../data/agents";
import { getAllAgents, getAllOpportunities } from "../data/localSelectors";
import type { AgentExchangePersistedState } from "../state/marketplaceTypes";
import { defineReadOnlyTool, type WebMcpTool } from "@bdjones/webmcp-kit";

export type AgentExchangeSnapshot = {
  state: AgentExchangePersistedState;
  isAuthenticated: boolean;
};

const SIGN_IN_REQUIRED =
  "No signed-in user. Ask the person to sign in to AgentExchange before requesting their own applications, saved opportunities, or contracts.";

function matches(haystack: readonly (string | undefined)[], needle: string): boolean {
  const query = needle.trim().toLowerCase();
  if (!query) return true;
  return haystack.some((value) => value?.toLowerCase().includes(query));
}

export function buildAgentExchangeTools(
  getSnapshot: () => AgentExchangeSnapshot,
): readonly WebMcpTool[] {
  return [
    defineReadOnlyTool<{ query?: string; category?: string; limit?: number }>({
      name: "agentexchange_search_opportunities",
      title: "Search opportunities",
      description:
        "Search the AgentExchange marketplace for open opportunities. Matches the query against title, summary, organization, tags and required skills. Returns budget, cadence, match score and trust level for each result.",
      untrustedContent: true,
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Free-text search over title, summary, organization, tags and skills.",
          },
          category: {
            type: "string",
            description: "Restrict to a single marketplace category, e.g. 'Research'.",
          },
          limit: {
            type: "number",
            description: "Maximum results to return. Defaults to 20.",
          },
        },
      },
      read({ query = "", category, limit = 20 }) {
        const { state } = getSnapshot();
        const results = getAllOpportunities(state.createdOpportunities)
          .filter((opportunity) => !category || opportunity.category === category)
          .filter((opportunity) =>
            matches(
              [
                opportunity.title,
                opportunity.summary,
                opportunity.organization,
                opportunity.category,
                ...opportunity.tags,
                ...(opportunity.requiredSkills ?? []),
              ],
              query,
            ),
          )
          .slice(0, Math.max(1, limit))
          .map((opportunity) => ({
            id: opportunity.id,
            title: opportunity.title,
            organization: opportunity.organization,
            category: opportunity.category,
            summary: opportunity.summary,
            budget: opportunity.budget,
            cadence: opportunity.cadence,
            duration: opportunity.duration,
            requiredSkills: opportunity.requiredSkills,
            matchScore: opportunity.matchScore,
            trustLevel: opportunity.trustLevel,
            tags: opportunity.tags,
          }));

        return { count: results.length, opportunities: results };
      },
    }),

    defineReadOnlyTool<{ query?: string; availability?: string; limit?: number }>({
      name: "agentexchange_search_agents",
      title: "Search agents",
      description:
        "Search the AgentExchange agent roster. Matches the query against name, specialty, description and skills, and returns tier, availability, trust score and success rate.",
      untrustedContent: true,
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Free-text search over name, specialty, description and skills.",
          },
          availability: {
            type: "string",
            enum: ["Active", "Available", "Engaged"],
            description: "Restrict to agents with this availability.",
          },
          limit: {
            type: "number",
            description: "Maximum results to return. Defaults to 20.",
          },
        },
      },
      read({ query = "", availability, limit = 20 }) {
        const { state } = getSnapshot();
        const results = getAllAgents(state.createdAgents)
          .filter((agent) => !availability || agent.availability === availability)
          .filter((agent) => {
            const skills = getAgentSkills(agent).map((skill) => skill.label);
            return matches(
              [
                agent.name,
                agent.specialty,
                agent.description,
                agent.tier,
                ...skills,
                ...(agent.customSkills ?? []),
              ],
              query,
            );
          })
          .slice(0, Math.max(1, limit))
          .map((agent) => ({
            id: agent.id,
            name: agent.name,
            specialty: agent.specialty,
            tier: agent.tier,
            availability: agent.availability,
            trustScore: agent.trustScore,
            successRate: agent.successRate,
            startingRate: agent.startingRate,
            skills: getAgentSkills(agent).map((skill) => skill.label),
          }));

        return { count: results.length, agents: results };
      },
    }),

    defineReadOnlyTool({
      name: "agentexchange_list_my_applications",
      title: "List my applications and negotiations",
      description:
        "List the signed-in user's opportunity applications, negotiations and hire requests, with the current status of each. Read-only: it never accepts, rejects or counters anything.",
      untrustedContent: true,
      read() {
        const { state, isAuthenticated } = getSnapshot();
        if (!isAuthenticated) return { error: SIGN_IN_REQUIRED };

        return {
          applications: state.applications.map((application) => ({
            id: application.id,
            opportunityTitle: application.opportunityTitle,
            agentName: application.agentName,
            status: application.status,
            createdAt: application.createdAt,
          })),
          negotiations: state.negotiations.map((negotiation) => ({
            id: negotiation.id,
            opportunityTitle: negotiation.opportunityTitle,
            rate: negotiation.rate,
            timeline: negotiation.timeline,
            status: negotiation.status,
            counterRate: negotiation.counterRate,
            counterTimeline: negotiation.counterTimeline,
            createdAt: negotiation.createdAt,
          })),
          hireRequests: state.hireRequests.map((request) => ({
            id: request.id,
            agentName: request.agentName,
            opportunityTitle: request.opportunityTitle,
            status: request.status,
            createdAt: request.createdAt,
          })),
        };
      },
    }),

    defineReadOnlyTool({
      name: "agentexchange_list_saved_opportunities",
      title: "List saved opportunities",
      description:
        "List the opportunities the signed-in user has saved, resolved to their full marketplace detail.",
      untrustedContent: true,
      read() {
        const { state, isAuthenticated } = getSnapshot();
        if (!isAuthenticated) return { error: SIGN_IN_REQUIRED };

        const catalog = getAllOpportunities(state.createdOpportunities);
        const saved = state.savedOpportunities.map((entry) => {
          const opportunity = catalog.find((item) => item.id === entry.opportunityId);
          return {
            opportunityId: entry.opportunityId,
            savedAt: entry.savedAt,
            title: opportunity?.title ?? "(no longer listed)",
            organization: opportunity?.organization,
            budget: opportunity?.budget,
            category: opportunity?.category,
          };
        });

        return { count: saved.length, saved };
      },
    }),

    defineReadOnlyTool({
      name: "agentexchange_list_my_contracts",
      title: "List my contracts",
      description:
        "List the signed-in user's contracts with status, value, progress and due date, plus any open disputes. Read-only: it never approves deliverables, completes milestones or resolves disputes.",
      untrustedContent: true,
      read() {
        const { state, isAuthenticated } = getSnapshot();
        if (!isAuthenticated) return { error: SIGN_IN_REQUIRED };

        return {
          contracts: state.localContracts.map((contract) => ({
            id: contract.id,
            title: contract.title,
            organization: contract.organization,
            agent: contract.agent,
            status: contract.status,
            value: contract.value,
            progress: contract.progress,
            startDate: contract.startDate,
            dueDate: contract.dueDate,
          })),
          openDisputes: state.contractDisputes
            .filter((dispute) => dispute.status !== "Resolved")
            .map((dispute) => ({
              id: dispute.id,
              contractId: dispute.contractId,
              status: dispute.status,
              reason: dispute.reason,
            })),
        };
      },
    }),
  ];
}
