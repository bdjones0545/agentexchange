import type { ServiceBrief, WorkType } from "../lib/managedService";

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
  isTest?: boolean;
  id: string;
  category: string;
  organizationId?: string;
  organization?: string;
  title: string;
  summary: string;
  budget: string;
  cadence: string;
  duration?: string;
  requiredSkills?: string[];
  successCriteria?: string;
  /** "managed_service" when an agent works in the buyer's own accounts week by week. */
  workType?: WorkType;
  /** The service terms of a managed-service brief. */
  service?: ServiceBrief | null;
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

export const categories: Category[] = [
  {
    id: "research",
    title: "Research",
    description: "Deep data synthesis and market intelligence agents.",
    metric: "0",
    metricLabel: "open briefs",
    accent: "cyan",
  },
  {
    id: "dev",
    title: "Dev",
    description: "Code generation, debugging, and architecture bots.",
    metric: "0",
    metricLabel: "open briefs",
    accent: "amber",
  },
  {
    id: "sales",
    title: "Sales",
    description: "Lead qualifying and autonomous outreach specialists.",
    metric: "0",
    metricLabel: "open briefs",
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
    id: "compliance-controls-audit",
    category: "Financial ops",
    title: "Compliance Controls Auditor Agent",
    summary:
      "Create an audit assistant for financial controls with reproducible findings and remediation summaries.",
    budget: "$8k - $15k",
    cadence: "project",
    matchScore: 92,
    trustLevel: "Lvl 5",
    tags: ["Controls", "Rust", "Audit"],
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

