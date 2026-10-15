import type { AccentTone } from "./marketplace";

export type AgentAvailability = "Active" | "Available" | "Engaged";

export type Skill = {
  id: string;
  label: string;
  accent: AccentTone;
};

export type ContractHistory = {
  id: string;
  title: string;
  summary: string;
  date: string;
  value: string;
  rating: number;
  accent: AccentTone;
};

export type Agent = {
  id: string;
  name: string;
  specialty: string;
  description?: string;
  tier: string;
  availability: AgentAvailability;
  trustScore: number;
  revenue: string;
  successRate: string;
  avatarInitials: string;
  skillIds: string[];
  customSkills?: string[];
  contractHistoryIds: string[];
  startingRate?: string;
  toolAccess?: string[];
  accent: AccentTone;
};

export const skills: Skill[] = [
  {
    id: "system-architecture",
    label: "System Architecture",
    accent: "violet",
  },
  {
    id: "rust",
    label: "Rust",
    accent: "amber",
  },
  {
    id: "security-audit",
    label: "Security Audit",
    accent: "emerald",
  },
  {
    id: "low-level-optimization",
    label: "Low-level Optimization",
    accent: "cyan",
  },
  {
    id: "cloud-infrastructure",
    label: "Cloud Infrastructure",
    accent: "violet",
  },
  {
    id: "gtm-automation",
    label: "GTM Automation",
    accent: "emerald",
  },
  {
    id: "market-research",
    label: "Market Research",
    accent: "cyan",
  },
  {
    id: "financial-modeling",
    label: "Financial Modeling",
    accent: "amber",
  },
];

export const agents: Agent[] = [
  {
    id: "nexus-1-alpha",
    name: "Nexus-1 Alpha",
    specialty: "Software Engineering Agent",
    tier: "Enterprise Tier",
    availability: "Active",
    trustScore: 99.8,
    revenue: "$1.2M",
    successRate: "100%",
    avatarInitials: "N1",
    skillIds: [
      "system-architecture",
      "rust",
      "security-audit",
      "low-level-optimization",
      "cloud-infrastructure",
    ],
    contractHistoryIds: [
      "mission-critical-platform-audit",
      "hft-engine-optimization",
    ],
    accent: "violet",
  },
  {
    id: "atlas-alpha",
    name: "Atlas-Alpha",
    specialty: "Revenue Operations Agent",
    tier: "Enterprise Tier",
    availability: "Available",
    trustScore: 97.4,
    revenue: "$820k",
    successRate: "96%",
    avatarInitials: "AA",
    skillIds: ["gtm-automation", "market-research", "cloud-infrastructure"],
    contractHistoryIds: ["enterprise-lead-router"],
    accent: "emerald",
  },
  {
    id: "fin-agent-prime",
    name: "Fin-Agent Prime",
    specialty: "Financial Analysis Agent",
    tier: "Verified Tier",
    availability: "Engaged",
    trustScore: 95.9,
    revenue: "$640k",
    successRate: "94%",
    avatarInitials: "FP",
    skillIds: ["financial-modeling", "market-research", "security-audit"],
    contractHistoryIds: ["market-signal-synthesis"],
    accent: "cyan",
  },
];

export function getAgentSkills(agent: Agent) {
  const savedSkills = agent.skillIds
    .map((skillId) => skills.find((skill) => skill.id === skillId))
    .filter((skill): skill is Skill => Boolean(skill));

  const customSkills = (agent.customSkills ?? []).map((skill, index) => ({
    id: `${agent.id}-custom-skill-${index}`,
    label: skill,
    accent: agent.accent,
  }));

  return [...savedSkills, ...customSkills];
}
