// Managed services: agents that work inside the buyer's own accounts (paid ads,
// SEO, social, email) for a number of weeks, paid one week at a time. The
// database freezes the terms on each contract (contracts.service_terms) and
// enforces who may renew a week; this module describes those terms for the app,
// the agent tools and the quality gate. See docs/MANAGED_SERVICES.md.

import { formatCents } from "./money.js";

export type WorkType = "deliverable" | "managed_service";
export type ServiceKind = "paid_ads" | "seo" | "social" | "email" | "other";

/** What a managed-service brief asks for. */
export type ServiceBrief = {
  kind: ServiceKind;
  /** Platforms the buyer will share access to, by display name. */
  platforms: string[];
  /** Weekly ad spend the buyer pays the platform directly; null when the work has no ad spend. */
  adSpendCapCents: number | null;
  weeks: number;
};

/** The terms frozen on one contract, which covers one week of the service. */
export type ServiceTerms = ServiceBrief & {
  week: number;
  opportunityId: string | null;
  renewedFrom: string | null;
};

export const MAX_SERVICE_WEEKS = 52;
export const MAX_SERVICE_PLATFORMS = 8;

export const SERVICE_KINDS: Record<ServiceKind, { label: string; summary: string; platforms: string[]; adSpend: boolean }> = {
  paid_ads: {
    label: "Paid ads",
    summary: "Plan, launch and manage campaigns in your own ad accounts.",
    platforms: ["Meta Ads", "Google Ads", "TikTok Ads", "LinkedIn Ads", "Microsoft Ads"],
    adSpend: true,
  },
  seo: {
    label: "SEO",
    summary: "Audit your site and make the changes that improve search visibility.",
    platforms: ["Google Search Console", "Google Analytics", "WordPress", "Webflow", "Shopify"],
    adSpend: false,
  },
  social: {
    label: "Social media",
    summary: "Plan, publish and report on posts from your own accounts.",
    platforms: ["Meta Business Suite", "LinkedIn", "X", "TikTok", "YouTube"],
    adSpend: false,
  },
  email: {
    label: "Email marketing",
    summary: "Build and send campaigns and sequences from your email platform.",
    platforms: ["Klaviyo", "Mailchimp", "HubSpot", "Customer.io"],
    adSpend: false,
  },
  other: {
    label: "Other ongoing work",
    summary: "Any recurring work an agent does in your own tools.",
    platforms: [],
    adSpend: false,
  },
};

const ACCESS_STEPS: Record<string, string> = {
  "Meta Ads": "In Meta Business Settings, add the operator's business as a Partner and share only your ad account, with permission to manage campaigns. Billing stays on your account.",
  "Google Ads": "Accept a manager-account link from the operator, or invite their email with Standard access (Admin → Access and security). Billing stays on your account.",
  "TikTok Ads": "In TikTok Business Center, share the ad account with the operator's Business Center as a partner with operator access.",
  "LinkedIn Ads": "In Campaign Manager, open the account's Manage access and add the operator as Campaign manager.",
  "Microsoft Ads": "Under Accounts → Users, invite the operator with the Standard user role.",
  "Google Search Console": "Under Settings → Users and permissions, add the operator with Full permission (not Owner).",
  "Google Analytics": "Under Admin → Property access management, add the operator as Viewer, or Analyst if they build reports.",
  WordPress: "Create a user for the operator with the Editor role. Use Administrator only if plugins must change.",
  Webflow: "Invite the operator to the site with the least role that can edit pages, not as the site owner.",
  Shopify: "Under Settings → Users, add a staff account with only the Online Store permissions the work needs.",
  "Meta Business Suite": "In Business Settings, add the operator's business as a Partner and share your Page with content access only.",
  LinkedIn: "In your Page's admin tools, add the operator as a Content admin.",
  X: "Use X's delegate access in Settings rather than sharing the password.",
  TikTok: "Add the operator in TikTok Business Center with posting access only.",
  YouTube: "In YouTube Studio → Settings → Permissions, invite the operator as an Editor (limited).",
  Klaviyo: "Invite the operator as a user with the Manager or Analyst role, not Owner.",
  Mailchimp: "Invite the operator with the Author or Manager role, not Admin or Owner.",
  HubSpot: "Invite the operator as a user with Marketing access only, no billing or account settings.",
  "Customer.io": "Invite the operator to the workspace with a role that excludes billing and account settings.",
};

/** How the buyer shares one platform with the operator. Menus move; the principle does not. */
export function accessSteps(platform: string): string {
  return (
    ACCESS_STEPS[platform] ??
    `Invite the agent's operator through ${platform}'s own user or partner settings, with the least access the work needs.`
  );
}

export const ACCESS_RULES =
  "Never share a password or a login. Use each platform's own partner or user access, so you keep ownership, billing and the power to remove access at any time.";

function asInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isInteger(n) ? n : null;
}

function asKind(value: unknown): ServiceKind | null {
  return typeof value === "string" && value in SERVICE_KINDS ? (value as ServiceKind) : null;
}

function asPlatforms(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((p): p is string => typeof p === "string" && p.trim() !== "") : [];
}

/** The service a brief row asks for, or null for an ordinary deliverable brief. */
export function serviceBriefFromRow(row: Record<string, unknown>): ServiceBrief | null {
  if (row.work_type !== "managed_service") return null;
  const kind = asKind(row.service_kind);
  const weeks = asInt(row.service_weeks);
  if (!kind || !weeks) return null;
  return { kind, platforms: asPlatforms(row.service_platforms), adSpendCapCents: asInt(row.ad_spend_cap_cents), weeks };
}

/** contracts.service_terms as written by the database, or null. */
export function serviceTermsFromJson(value: unknown): ServiceTerms | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const kind = asKind(v.kind);
  const weeks = asInt(v.weeks);
  if (!kind || !weeks) return null;
  return {
    kind,
    platforms: asPlatforms(v.platforms),
    adSpendCapCents: asInt(v.adSpendCapCents),
    weeks,
    week: asInt(v.week) ?? 1,
    opportunityId: typeof v.opportunityId === "string" ? v.opportunityId : null,
    renewedFrom: typeof v.renewedFrom === "string" ? v.renewedFrom : null,
  };
}

/** Columns for an opportunities insert. */
export function serviceBriefColumns(service: ServiceBrief | null | undefined) {
  if (!service) return { work_type: "deliverable" as const };
  return {
    work_type: "managed_service" as const,
    service_kind: service.kind,
    service_platforms: service.platforms,
    ad_spend_cap_cents: SERVICE_KINDS[service.kind].adSpend ? service.adSpendCapCents : null,
    service_weeks: service.weeks,
  };
}

/** Problems with a brief's service terms, for the form. Empty when it is valid. */
export function validateServiceBrief(service: ServiceBrief): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(service.weeks) || service.weeks < 1 || service.weeks > MAX_SERVICE_WEEKS) {
    problems.push(`Choose between 1 and ${MAX_SERVICE_WEEKS} weeks.`);
  }
  if (service.kind !== "other" && service.platforms.length === 0) problems.push("Pick at least one platform you will share access to.");
  if (service.platforms.length > MAX_SERVICE_PLATFORMS) problems.push(`Pick at most ${MAX_SERVICE_PLATFORMS} platforms.`);
  if (SERVICE_KINDS[service.kind].adSpend) {
    if (service.adSpendCapCents === null) problems.push("Set a weekly ad-spend cap.");
    else if (!Number.isInteger(service.adSpendCapCents) || service.adSpendCapCents < 0) problems.push("The ad-spend cap must be a positive amount.");
  }
  return problems;
}

export function formatSpendCap(cents: number | null, currency = "USD"): string | null {
  return cents === null ? null : `${formatCents(cents, currency)} a week`;
}

/** One line, e.g. "Paid ads · Meta Ads, Google Ads · 4 weeks · ad spend up to $500 a week". */
export function serviceSummary(service: ServiceBrief, currency = "USD"): string {
  const parts = [SERVICE_KINDS[service.kind].label];
  if (service.platforms.length) parts.push(service.platforms.join(", "));
  parts.push(service.weeks === 1 ? "1 week" : `${service.weeks} weeks`);
  const cap = formatSpendCap(service.adSpendCapCents, currency);
  if (cap) parts.push(`ad spend up to ${cap}`);
  return parts.join(" · ");
}

/** What this week's work is, in order. Mirrors the milestones the database seeds. */
export function weekStages(terms: ServiceTerms): string[] {
  const launch: Record<ServiceKind, string> = {
    paid_ads: "launch the approved campaigns and post the campaign IDs and live links",
    seo: "publish the approved changes and list every page changed, with before and after",
    social: "publish the approved posts and post their links",
    email: "send the approved campaigns and post the send reports",
    other: "start the approved work and post links to what changed",
  };
  const report = `submit the week ${terms.week} of ${terms.weeks} report: spend, results and next steps, with links the buyer can check`;
  if (terms.week > 1) return [report];
  return [
    "wait until the buyer has shared access on each platform (the Access shared milestones)",
    "submit the plan as a deliverable and wait for approval; nothing goes live before that",
    launch[terms.kind],
    report,
  ];
}

/** How this week works, from the buyer's side. */
export function buyerStages(terms: ServiceTerms): string[] {
  const check: Record<ServiceKind, string> = {
    paid_ads: "Check the campaign IDs and live links once the campaigns launch.",
    seo: "Check the list of pages changed, with before and after.",
    social: "Check the links to the published posts.",
    email: "Check the campaign names and send reports.",
    other: "Check the links to what changed.",
  };
  const report = `Review the week ${terms.week} report, approve it, then release this week's payment.`;
  if (terms.week > 1) return [report];
  return [
    "Share access on each platform, then tick its Access shared milestone.",
    "Approve the agent's plan. Nothing goes live until you do.",
    check[terms.kind],
    report,
  ];
}

/** The rules an agent must follow on a managed-service contract, for get_contract. */
export function agentRules(terms: ServiceTerms, currency = "USD"): string[] {
  const rules = [
    `This is week ${terms.week} of ${terms.weeks} of a ${SERVICE_KINDS[terms.kind].label.toLowerCase()} service. Each week is its own contract; the buyer renews it.`,
    "Work only through the access the buyer shared on the platform. Never ask for a password, a login or payment details.",
    "Nothing goes live, is published or is sent until the buyer approves the plan deliverable.",
  ];
  const cap = formatSpendCap(terms.adSpendCapCents, currency);
  if (cap) {
    rules.push(
      `Ad spend is billed by the platform to the buyer's own account, never through AgentExchange. Keep this week's spend at or under ${cap}; never raise budgets above it.`,
    );
  }
  rules.push("Every report cites evidence the buyer can check: campaign or change IDs, live links, and figures with their source.");
  return rules;
}

export type RenewalCheck = { ok: true; nextWeek: number } | { ok: false; reason: string };

/**
 * Whether the buyer may start the next week. Mirrors the database rule in
 * contract_source_consents('renewal', …); the database is the authority.
 */
export function renewalCheck(contract: {
  serviceTerms?: ServiceTerms | null;
  paymentStatus?: string;
  status?: string;
}): RenewalCheck {
  const terms = contract.serviceTerms;
  if (!terms) return { ok: false, reason: "Only a managed service renews week by week." };
  if (terms.week >= terms.weeks) return { ok: false, reason: `This was the last of the ${terms.weeks} agreed weeks.` };
  if (contract.status === "Cancelled" || contract.status === "Disputed") {
    return { ok: false, reason: "A cancelled or disputed week cannot be renewed." };
  }
  if (!["authorized", "captured", "paid_out"].includes(contract.paymentStatus ?? "unfunded")) {
    return { ok: false, reason: "Fund this week before starting the next one." };
  }
  return { ok: true, nextWeek: terms.week + 1 };
}
