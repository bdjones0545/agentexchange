// Managed services: agents that work inside the buyer's own accounts for a
// number of weeks, paid one week at a time. The kinds, platforms, checklists,
// limits and rules come from the job catalog (./jobCatalog). The database
// freezes the terms on each contract (contracts.service_terms) and enforces who
// may renew a week. See docs/MANAGED_SERVICES.md and docs/AGENT_JOBS.md.

import {
  JOB_KINDS,
  LIMITS,
  PLATFORM_RULES,
  cleanLimits,
  jobKind,
  limitRules,
  type JobKind,
  type JobStep,
  type LimitKey,
} from "./jobCatalog.js";
import { formatCents } from "./money.js";

export type WorkType = "deliverable" | "managed_service";
/** The id of a managed-service kind in the job catalog, e.g. "paid_ads". */
export type ServiceKind = string;
export type ServiceLimits = Partial<Record<LimitKey, number>>;

/** What a managed-service brief asks for. */
export type ServiceBrief = {
  kind: ServiceKind;
  /** Platforms the buyer will share access to, by display name. */
  platforms: string[];
  /** Weekly ad spend the buyer pays the platform directly; null when the work has no ad spend. */
  adSpendCapCents: number | null;
  weeks: number;
  /** Other limits the job allows, such as a refund limit per customer or a daily send limit. */
  limits?: ServiceLimits;
};

/** The terms frozen on one contract, which covers one week of the service. */
export type ServiceTerms = ServiceBrief & {
  week: number;
  opportunityId: string | null;
  renewedFrom: string | null;
  /** Week-1 checklist between "access shared" and the report, from the catalog at brief time. */
  checklist: JobStep[];
  limits: ServiceLimits;
};

export const MAX_SERVICE_WEEKS = 52;
export const MAX_SERVICE_PLATFORMS = 12;

function serviceKindInfo(kind: JobKind) {
  return { label: kind.label, summary: kind.summary, platforms: kind.platforms, adSpend: kind.limits.includes("adSpendCapCents") };
}

const SERVICE_KIND_INFO = Object.fromEntries(
  JOB_KINDS.filter((k) => k.family === "managed_service").map((k) => [k.id, serviceKindInfo(k)]),
);

/** Managed-service kinds by id, for display. Unknown ids read as "Other ongoing work". */
export const SERVICE_KINDS: Record<string, ReturnType<typeof serviceKindInfo>> = new Proxy(SERVICE_KIND_INFO, {
  get: (target, key) =>
    typeof key === "string" ? (target[key] ?? serviceKindInfo(jobKind(key) ?? jobKind("other_managed")!)) : undefined,
});

export function isServiceKind(id: string): boolean {
  return jobKind(id)?.family === "managed_service";
}

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
  Shopify: "Under Settings → Users, add a staff account with only the permissions the work needs.",
  Ghost: "Invite the operator as a Contributor or Editor, not Administrator.",
  Notion: "Share only the pages or teamspace the work needs, with edit access.",
  "Meta Business Suite": "In Business Settings, add the operator's business as a Partner and share your Page with content access only.",
  LinkedIn: "In your Page's admin tools, add the operator as a Content admin. For outreach from a personal profile, the profile owner sends; never share the login.",
  X: "Use X's delegate access in Settings rather than sharing the password.",
  TikTok: "Add the operator in TikTok Business Center with posting access only.",
  YouTube: "In YouTube Studio → Settings → Permissions, invite the operator as an Editor (limited).",
  Klaviyo: "Invite the operator as a user with the Manager or Analyst role, not Owner.",
  Mailchimp: "Invite the operator with the Author or Manager role, not Admin or Owner.",
  HubSpot: "Invite the operator as a user with only the tools the work needs; no billing or account settings.",
  "Customer.io": "Invite the operator to the workspace with a role that excludes billing and account settings.",
  Salesforce: "Create a user for the operator with a profile limited to the objects the work needs.",
  Apollo: "Invite the operator to your team with a member seat, not admin.",
  Gmail: "Delegate access to the support mailbox only (Settings → Accounts → Grant access), or use a shared support address in Google Workspace; never share the password.",
  Outlook: "Grant mailbox delegate or Send As permission to the operator's account; never share the password.",
  Zendesk: "Add the operator as an agent seat with a non-admin role, limited to the groups it handles.",
  Gorgias: "Invite the operator as an agent seat, not an admin, limited to the views it handles.",
  Intercom: "Invite the operator as a teammate seat with permissions limited to the inboxes it handles.",
  "Help Scout": "Invite the operator as a User (not Administrator) with access to the mailboxes it handles only.",
  Freshdesk: "Add the operator as an agent seat with a non-admin role, limited to the groups it handles.",
  Aircall: "Forward the number to the operator, or add a non-admin user on that number only.",
  RingCentral: "Forward the number to the operator, or add a non-admin user with call handling on that number only.",
  Twilio: "Forward the number to the operator's line, or create a subaccount and add the operator to it with the Developer role. Never share your account's auth token.",
  Discord: "Give the operator a moderator role with only the permissions it needs.",
  Slack: "Invite the operator as a member (or guest) of the right channels; give admin rights only if moderation needs them.",
  "Facebook Groups": "Make the operator a moderator of the group, not an admin.",
  Reddit: "Add the operator as a moderator with limited permissions.",
  Circle: "Add the operator as a moderator of the right spaces.",
  "QuickBooks Online": "Invite the operator as an accountant user or a standard user without payment or bank-detail permissions.",
  Xero: "Invite the operator as a standard or adviser user; do not give payment or bank-detail permissions.",
  Stripe: "Invite the operator as a team member with the View only role.",
  Greenhouse: "Add the operator as a user with access to the right jobs only.",
  Lever: "Invite the operator with limited team member access on the right postings.",
  Ashby: "Invite the operator with access to the right jobs only.",
  "Google Workspace": "Grant mail delegation and calendar edit access to the operator's account; never share the password.",
  "Microsoft 365": "Grant mailbox delegate and calendar edit access to the operator's account; never share the password.",
  Calendly: "Add the operator to your Calendly team with the least role that manages events.",
  GitHub: "Add the operator as a collaborator on the repository with Write access, and protect the main branch.",
  GitLab: "Add the operator to the project with the Developer role, and protect the main branch.",
  Bitbucket: "Give the operator Write access to the repository, and require pull requests for the main branch.",
  Figma: "Share the file or project with the operator with edit access.",
  Canva: "Invite the operator to your team or share the design with edit access.",
  "Google Drive": "Share only the folder the work needs.",
  Dropbox: "Share only the folder the work needs.",
  "Frame.io": "Invite the operator to the project as a collaborator.",
  TestFlight: "Add the operator as an external tester on the build.",
  "Google Play Console": "Add the operator to an internal testing track.",
  BrowserStack: "Invite the operator to your team, or let them use their own account.",
  "Google Sheets": "Share only the sheets the work needs.",
  Excel: "Share only the workbook the work needs.",
  BigQuery: "Grant read access to the datasets the work needs.",
  Snowflake: "Create a role with read access to the tables the work needs.",
  Airtable: "Invite the operator to the base as an editor, not owner.",
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
  return typeof value === "string" && isServiceKind(value) ? value : null;
}

function asPlatforms(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((p): p is string => typeof p === "string" && p.trim() !== "") : [];
}

function asLimits(value: unknown): ServiceLimits {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: ServiceLimits = {};
  for (const key of Object.keys(LIMITS) as LimitKey[]) {
    const v = asInt((value as Record<string, unknown>)[key]);
    if (v !== null && v >= 0) out[key] = v;
  }
  return out;
}

function asChecklist(value: unknown): JobStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({ title: String(s.title ?? ""), notes: String(s.notes ?? "") }))
    .filter((s) => s.title.trim() !== "");
}

/** The service a brief row asks for, or null for an ordinary deliverable brief. */
export function serviceBriefFromRow(row: Record<string, unknown>): ServiceBrief | null {
  if (row.work_type !== "managed_service") return null;
  const kind = asKind(row.service_kind);
  const weeks = asInt(row.service_weeks);
  if (!kind || !weeks) return null;
  return {
    kind,
    platforms: asPlatforms(row.service_platforms),
    adSpendCapCents: asInt(row.ad_spend_cap_cents),
    weeks,
    limits: asLimits(row.service_limits),
  };
}

/** contracts.service_terms as written by the database, or null. */
export function serviceTermsFromJson(value: unknown): ServiceTerms | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const kind = asKind(v.kind);
  const weeks = asInt(v.weeks);
  if (!kind || !weeks) return null;
  const limits = asLimits(v.limits);
  const adSpendCapCents = asInt(v.adSpendCapCents) ?? limits.adSpendCapCents ?? null;
  return {
    kind,
    platforms: asPlatforms(v.platforms),
    adSpendCapCents,
    weeks,
    week: asInt(v.week) ?? 1,
    opportunityId: typeof v.opportunityId === "string" ? v.opportunityId : null,
    renewedFrom: typeof v.renewedFrom === "string" ? v.renewedFrom : null,
    checklist: asChecklist(v.checklist),
    limits: adSpendCapCents === null ? limits : { ...limits, adSpendCapCents },
  };
}

/** Columns for an opportunities insert: the job kind for every brief, plus the service terms for a managed service. */
export function serviceBriefColumns(service: ServiceBrief | null | undefined, jobKindId?: string | null) {
  if (!service) return { work_type: "deliverable" as const, ...(jobKindId ? { job_kind: jobKindId } : {}) };
  const kind = jobKind(service.kind);
  const limits = kind ? cleanLimits(kind, { ...service.limits, adSpendCapCents: service.adSpendCapCents }) : {};
  const { adSpendCapCents, ...otherLimits } = limits;
  return {
    work_type: "managed_service" as const,
    job_kind: service.kind,
    service_kind: service.kind,
    service_platforms: service.platforms,
    ad_spend_cap_cents: adSpendCapCents ?? null,
    service_weeks: service.weeks,
    service_checklist: kind?.steps ?? [],
    service_limits: otherLimits,
  };
}

/** Problems with a brief's service terms, for the form. Empty when it is valid. */
export function validateServiceBrief(service: ServiceBrief): string[] {
  const kind = jobKind(service.kind);
  if (!kind || kind.family !== "managed_service") return ["Choose a kind of ongoing work."];
  const problems: string[] = [];
  if (!Number.isInteger(service.weeks) || service.weeks < 1 || service.weeks > MAX_SERVICE_WEEKS) {
    problems.push(`Choose between 1 and ${MAX_SERVICE_WEEKS} weeks.`);
  }
  if (kind.platforms.length > 0 && service.platforms.length === 0) problems.push("Pick at least one platform you will share access to.");
  if (service.platforms.length > MAX_SERVICE_PLATFORMS) problems.push(`Pick at most ${MAX_SERVICE_PLATFORMS} platforms.`);
  for (const key of kind.limits) {
    const value = key === "adSpendCapCents" ? service.adSpendCapCents : service.limits?.[key];
    if (value === null || value === undefined) {
      problems.push(key === "adSpendCapCents" ? "Set a weekly ad-spend cap." : `Set the ${LIMITS[key].label.toLowerCase()}.`);
    } else if (!Number.isInteger(value) || value < 0) {
      problems.push(`${LIMITS[key].label} must be a positive amount.`);
    }
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
  if (typeof service.limits?.refundLimitCents === "number") parts.push(`refunds up to ${formatCents(service.limits.refundLimitCents, currency)} each`);
  if (typeof service.limits?.dailySendCap === "number") parts.push(`up to ${service.limits.dailySendCap} sends a day`);
  return parts.join(" · ");
}

/** The week-1 checklist: frozen on the contract, or from the catalog for contracts made before it was frozen. */
function checklistOf(terms: ServiceTerms): JobStep[] {
  return terms.checklist?.length ? terms.checklist : (jobKind(terms.kind)?.steps ?? []);
}

/** Every limit on the terms, including the ad-spend cap stored on its own field. */
export function termsLimits(terms: ServiceBrief): ServiceLimits {
  return terms.adSpendCapCents === null ? { ...terms.limits } : { ...terms.limits, adSpendCapCents: terms.adSpendCapCents };
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** What this week's work is, from the agent's side. Mirrors the milestones the database seeds. */
export function weekStages(terms: ServiceTerms): string[] {
  const report = `submit the week ${terms.week} of ${terms.weeks} report: spend, results and next steps, with links the buyer can check`;
  if (terms.week > 1) return [report];
  const steps = checklistOf(terms).map((step, index) =>
    index === 0
      ? `${lowerFirst(step.title)}: submit it as a deliverable and wait for approval; nothing goes live before that`
      : `${lowerFirst(step.title)}: ${lowerFirst(step.notes)}`,
  );
  return [
    ...(terms.platforms.length ? ["wait until the buyer has shared access on each platform (the Access shared milestones)"] : []),
    ...steps,
    report,
  ];
}

/** How this week works, from the buyer's side. */
export function buyerStages(terms: ServiceTerms): string[] {
  const report = `Review the week ${terms.week} report, approve it, then release this week's payment.`;
  if (terms.week > 1) return [report];
  const steps = checklistOf(terms).map((step, index) =>
    index === 0
      ? `Approve the agent's ${lowerFirst(step.title.replace(/ approved$/i, ""))}. Nothing goes live until you do.`
      : `${step.title}: ${step.notes}`,
  );
  return [
    ...(terms.platforms.length ? ["Share access on each platform, then tick its Access shared milestone."] : []),
    ...steps,
    report,
  ];
}

/** The rules an agent must follow on a managed-service contract, for get_contract. */
export function agentRules(terms: ServiceTerms, currency = "USD"): string[] {
  const kind = jobKind(terms.kind);
  return [
    `This is week ${terms.week} of ${terms.weeks} of a ${SERVICE_KINDS[terms.kind].label.toLowerCase()} service. Each week is its own contract; the buyer renews it.`,
    "Nothing goes live, is published or is sent until the buyer approves the first checklist item's deliverable.",
    ...limitRules(termsLimits(terms), currency),
    ...PLATFORM_RULES,
    ...(kind?.rules ?? []),
  ];
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
