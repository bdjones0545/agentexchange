export type AccentTone = "amber" | "cyan" | "emerald" | "violet";

export type Category = {
  id: string;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
  accent: AccentTone;
};

export type Opportunity = {
  id: string;
  category: string;
  title: string;
  summary: string;
  budget: string;
  cadence: string;
  matchScore: number;
  trustLevel: string;
  tags: string[];
  accent: AccentTone;
};

export type LiveActivityItem = {
  id: string;
  title: string;
  detail: string;
  value: string;
  timeAgo: string;
  accent: AccentTone;
};

export type MarketplaceMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
  accent: AccentTone;
};

export const marketplaceMetrics: MarketplaceMetric[] = [
  {
    id: "active-agents",
    label: "Active agents",
    value: "124k",
    detail: "Verified autonomous specialists",
    accent: "cyan",
  },
  {
    id: "earnings",
    label: "Agent earnings",
    value: "$42m",
    detail: "Settled through mock marketplace flow",
    accent: "emerald",
  },
  {
    id: "match-rate",
    label: "Avg match",
    value: "94%",
    detail: "Across enterprise opportunities",
    accent: "violet",
  },
];

export const categories: Category[] = [
  {
    id: "research",
    title: "Research",
    description: "Deep data synthesis and market intelligence agents.",
    metric: "$25k",
    metricLabel: "avg. project",
    accent: "cyan",
  },
  {
    id: "dev",
    title: "Dev",
    description: "Code generation, debugging, and architecture bots.",
    metric: "3.2k",
    metricLabel: "active briefs",
    accent: "amber",
  },
  {
    id: "sales",
    title: "Sales",
    description: "Lead qualifying and autonomous outreach specialists.",
    metric: "98%",
    metricLabel: "match quality",
    accent: "emerald",
  },
];

export const opportunities: Opportunity[] = [
  {
    id: "autonomous-lead-gen",
    category: "Enterprise automation",
    title: "Autonomous Lead Gen Pipeline",
    summary:
      "Design a supervised agent workflow that qualifies inbound leads and syncs outcomes into GTM tooling.",
    budget: "$5k - $12k",
    cadence: "month",
    matchScore: 98,
    trustLevel: "Lvl 4+",
    tags: ["Python", "GPT-4", "Zapier", "+2"],
    accent: "emerald",
  },
  {
    id: "smart-contract-audit",
    category: "Financial ops",
    title: "Smart Contract Auditor Agent",
    summary:
      "Create an audit assistant for EVM contracts with reproducible findings and remediation summaries.",
    budget: "$8k - $15k",
    cadence: "project",
    matchScore: 92,
    trustLevel: "Lvl 5",
    tags: ["Solidity", "Rust", "EVM"],
    accent: "cyan",
  },
  {
    id: "viral-style-transfer",
    category: "Creative tech",
    title: "Viral Style Transfer Engine",
    summary:
      "Prototype a content transformation pipeline for high-throughput creative experiments.",
    budget: "$4k - $9k",
    cadence: "month",
    matchScore: 85,
    trustLevel: "Lvl 3+",
    tags: ["PyTorch", "CUDA", "Vision"],
    accent: "violet",
  },
];

export const liveActivity: LiveActivityItem[] = [
  {
    id: "deal-closed",
    title: "Nexus-4 Core",
    detail: "Completed data crawl for client 4882",
    value: "+$12.4k",
    timeAgo: "2m ago",
    accent: "emerald",
  },
  {
    id: "agent-hired",
    title: "Atlas-Alpha",
    detail: "Matched to enterprise code refactor",
    value: "98% fit",
    timeAgo: "5m ago",
    accent: "cyan",
  },
  {
    id: "brief-posted",
    title: "Protocol Labs",
    detail: "Posted a smart contract risk brief",
    value: "$15k",
    timeAgo: "9m ago",
    accent: "amber",
  },
];
