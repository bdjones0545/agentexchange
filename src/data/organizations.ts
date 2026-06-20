import type { Agent } from "./agents";
import type { Opportunity } from "./marketplace";
import type { Contract } from "./operations";
import type {
  AgentReview,
  Application,
  HireRequest,
  Negotiation,
} from "../state/marketplaceTypes";

export type Organization = {
  id: string;
  name: string;
  industry: string;
  overview: string;
  verified: boolean;
  baseRating: number;
};

export type OrganizationSummary = Organization & {
  activeAgents: number;
  averageContractValue: string;
  completedSpend: string;
  openOpportunities: number;
  pendingSpend: string;
  rating: number;
  totalSpend: string;
};

export type OrganizationContext = {
  agents: Agent[];
  applications: Application[];
  contracts: Contract[];
  hireRequests: HireRequest[];
  negotiations: Negotiation[];
  opportunities: Opportunity[];
  reviews: AgentReview[];
};

export const seedOrganizations: Organization[] = [
  {
    id: "orbit-dynamics",
    name: "Orbit Dynamics",
    industry: "Aerospace SaaS",
    overview: "Operational software for mission-critical aerospace teams.",
    verified: true,
    baseRating: 4.9,
  },
  {
    id: "helix-capital",
    name: "Helix Capital",
    industry: "Financial Ops",
    overview: "Financial operations group using agents for analysis and controls.",
    verified: true,
    baseRating: 4.8,
  },
  {
    id: "nova-retail",
    name: "Nova Retail",
    industry: "Commerce",
    overview: "Retail operator scaling automated revenue workflows.",
    verified: true,
    baseRating: 4.7,
  },
  {
    id: "meridian-systems",
    name: "Meridian Systems",
    industry: "Enterprise Infrastructure",
    overview: "Infrastructure platform team hiring specialist AI agents.",
    verified: false,
    baseRating: 4.6,
  },
  {
    id: "local-organization",
    name: "Local Organization",
    industry: "Local Workspace",
    overview: "Default local buyer workspace for accepted applications.",
    verified: false,
    baseRating: 4.5,
  },
];

export function slugifyOrganization(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function parseMoney(value: string) {
  const numbers = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];

  if (numbers.length === 0) {
    return 0;
  }

  const average = numbers.reduce((total, number) => total + number, 0) / numbers.length;

  return value.toLowerCase().includes("k") ? average * 1000 : average;
}

function formatMoney(value: number) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `$${Math.round(value / 1000)}k`;
  }

  return `$${Math.round(value)}`;
}

export function getAllOrganizations(opportunities: Opportunity[]) {
  const organizationMap = new Map<string, Organization>();

  seedOrganizations.forEach((organization) => {
    organizationMap.set(organization.id, organization);
  });

  opportunities.forEach((opportunity) => {
    if (!opportunity.organization) {
      return;
    }

    const id = slugifyOrganization(opportunity.organization);

    if (!organizationMap.has(id)) {
      organizationMap.set(id, {
        id,
        name: opportunity.organization,
        industry: opportunity.category,
        overview: `Local organization hiring for ${opportunity.category.toLowerCase()} work.`,
        verified: false,
        baseRating: 4.4,
      });
    }
  });

  return Array.from(organizationMap.values());
}

export function getOrganizationOpportunities(
  organization: Organization,
  opportunities: Opportunity[],
) {
  return opportunities.filter(
    (opportunity) =>
      (opportunity.organization ?? "Local Organization") === organization.name,
  );
}

export function getOrganizationContracts(
  organization: Organization,
  contracts: Contract[],
) {
  return contracts.filter((contract) => contract.organization === organization.name);
}

export function getOrganizationApplications(
  organization: Organization,
  context: OrganizationContext,
) {
  const opportunityIds = new Set(
    getOrganizationOpportunities(organization, context.opportunities).map(
      (opportunity) => opportunity.id,
    ),
  );

  return context.applications.filter((application) =>
    opportunityIds.has(application.opportunityId),
  );
}

export function getOrganizationNegotiations(
  organization: Organization,
  context: OrganizationContext,
) {
  const opportunityIds = new Set(
    getOrganizationOpportunities(organization, context.opportunities).map(
      (opportunity) => opportunity.id,
    ),
  );

  return context.negotiations.filter((negotiation) =>
    opportunityIds.has(negotiation.opportunityId),
  );
}

export function getOrganizationSpendSummary(
  organization: Organization,
  contracts: Contract[],
) {
  const organizationContracts = getOrganizationContracts(organization, contracts);
  const totalSpend = organizationContracts.reduce(
    (total, contract) => total + parseMoney(contract.value),
    0,
  );
  const completedSpend = organizationContracts
    .filter((contract) => contract.status === "Completed")
    .reduce((total, contract) => total + parseMoney(contract.value), 0);
  const pendingSpend = Math.max(0, totalSpend - completedSpend);
  const averageContractValue =
    organizationContracts.length > 0
      ? totalSpend / organizationContracts.length
      : 0;

  return {
    averageContractValue: formatMoney(averageContractValue),
    completedSpend: formatMoney(completedSpend),
    pendingSpend: formatMoney(pendingSpend),
    totalSpend: formatMoney(totalSpend),
  };
}

export function getOrganizationSummary(
  organization: Organization,
  context: OrganizationContext,
): OrganizationSummary {
  const opportunities = getOrganizationOpportunities(
    organization,
    context.opportunities,
  );
  const contracts = getOrganizationContracts(organization, context.contracts);
  const spend = getOrganizationSpendSummary(organization, context.contracts);
  const reviewsGiven = context.reviews.filter(
    (review) => review.organization === organization.name,
  );

  return {
    ...organization,
    ...spend,
    activeAgents: new Set(contracts.map((contract) => contract.agent)).size,
    openOpportunities: opportunities.length,
    rating:
      reviewsGiven.length > 0
        ? Number(
            (
              reviewsGiven.reduce((total, review) => total + review.rating, 0) /
              reviewsGiven.length
            ).toFixed(1),
          )
        : organization.baseRating,
  };
}
