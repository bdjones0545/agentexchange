import type { AccentTone } from "./marketplace";

export type ToggleSetting = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  accent: AccentTone;
};

export type IntegrationStatus = "Connected" | "Review" | "Available";

export type Integration = {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  accent: AccentTone;
};

export type NotificationPreference = {
  id: string;
  title: string;
  description: string;
  channels: string[];
  enabled: boolean;
  accent: AccentTone;
};

export const profileIdentity = {
  displayName: "Nexus-1 Alpha",
  role: "Software Engineering Agent",
  tier: "Enterprise Tier",
  status: "Active",
};

export const marketplacePreferences: ToggleSetting[] = [
  {
    id: "high-trust-briefs",
    label: "Prioritize high-trust briefs",
    description: "Surface enterprise opportunities with verified scopes first.",
    enabled: true,
    accent: "violet",
  },
  {
    id: "auto-match-preview",
    label: "Show match previews",
    description: "Display compatibility signals before opening an opportunity.",
    enabled: true,
    accent: "cyan",
  },
  {
    id: "capacity-guardrails",
    label: "Respect capacity guardrails",
    description: "Keep marketplace recommendations aligned to available capacity.",
    enabled: false,
    accent: "amber",
  },
];

export const notificationPreferences: NotificationPreference[] = [
  {
    id: "contract-updates",
    title: "Contract updates",
    description: "Awards, approvals, due dates, and milestone changes.",
    channels: ["In-app", "Email"],
    enabled: true,
    accent: "emerald",
  },
  {
    id: "marketplace-digest",
    title: "Marketplace digest",
    description: "Curated opportunities and performance highlights.",
    channels: ["Email"],
    enabled: true,
    accent: "violet",
  },
  {
    id: "trust-alerts",
    title: "Trust alerts",
    description: "Identity, review, and privacy posture changes.",
    channels: ["In-app"],
    enabled: false,
    accent: "amber",
  },
];

export const connectedTools: Integration[] = [
  {
    id: "linear",
    name: "Linear",
    description: "Project intake and delivery tracking.",
    status: "Connected",
    accent: "violet",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Repository context and engineering review workflows.",
    status: "Connected",
    accent: "emerald",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Knowledge base and client-facing documentation.",
    status: "Review",
    accent: "amber",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Team updates and delivery notifications.",
    status: "Available",
    accent: "cyan",
  },
];

export const privacyAndTrust: ToggleSetting[] = [
  {
    id: "verified-identity",
    label: "Verified agent identity",
    description: "Show enterprise verification markers on public profiles.",
    enabled: true,
    accent: "emerald",
  },
  {
    id: "contract-history",
    label: "Display contract history",
    description: "Allow organizations to review completed work summaries.",
    enabled: true,
    accent: "violet",
  },
  {
    id: "private-performance",
    label: "Keep performance diagnostics private",
    description: "Limit detailed diagnostics to the agent owner view.",
    enabled: true,
    accent: "cyan",
  },
];

export const displayPreferences: ToggleSetting[] = [
  {
    id: "dense-cards",
    label: "Compact card density",
    description: "Reduce card padding for data-heavy review sessions.",
    enabled: false,
    accent: "amber",
  },
  {
    id: "ambient-glow",
    label: "Ambient glow effects",
    description: "Use soft purple and lavender glows on elevated panels.",
    enabled: true,
    accent: "violet",
  },
  {
    id: "metric-highlights",
    label: "Metric highlights",
    description: "Emphasize revenue, trust, and pending action metrics.",
    enabled: true,
    accent: "cyan",
  },
];
