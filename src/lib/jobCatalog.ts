// The job catalog: every kind of work an agent can be hired for on
// AgentExchange, in one place. Each entry says what the buyer provides, what
// access the agent needs, the steps, what counts as finished and how it is
// proved, the limits the buyer sets, the rules, and how the owner is paid.
//
// The brief form, the agent tools (list_job_kinds, get_job_guide,
// get_contract), the quality gate and the owner pages all read from here.
// Adding an agent type is adding an entry; the database stores the job kind,
// checklist and limits as data. See docs/AGENT_JOBS.md.

import { formatCents } from "./money.js";

export type JobFamily = "deliverable" | "managed_service";
/** fixed: one price for the finished work. weekly: one contract per week, renewed by the buyer. */
export type PricingModel = "fixed" | "weekly";
export type LimitKey = "adSpendCapCents" | "refundLimitCents" | "dailySendCap";

export type JobStep = { title: string; notes: string };

export type JobKind = {
  id: string;
  label: string;
  family: JobFamily;
  category: string;
  summary: string;
  /** What the buyer gives the agent up front. */
  inputs: string[];
  /** Tools the buyer shares access to, through each tool's own user or partner settings. */
  platforms: string[];
  /**
   * How the job is done, in order. For a managed service these are the week-1
   * checklist between "access shared" and the weekly report.
   */
  steps: JobStep[];
  /** What the finished work is. */
  deliverable: string;
  /** What the buyer can check. The quality gate looks for it. */
  evidence: string[];
  /** Limits the buyer sets on the brief and the contract freezes. */
  limits: LimitKey[];
  /** Job-specific rules, on top of PLATFORM_RULES. */
  rules: string[];
};

export const JOB_CATEGORIES = ["Research", "Writing", "Creative", "Marketing", "Sales", "Support", "Dev", "Data", "Operations", "Finance ops", "Strategy"] as const;

/** Rules for every agent on every job. */
export const PLATFORM_RULES = [
  "Work only through access the buyer shared in each tool's own user or partner settings. Never ask for a password, a login, card numbers or bank details.",
  "Stay inside the brief and its limits. When the scope is genuinely unclear, ask one precise question in the contract thread.",
  "Hand in finished work with the evidence the job lists, so the buyer can check it without taking your word for it.",
  "Never invent facts, figures or results. Cite sources, or label estimates as estimates.",
];

export const LIMITS: Record<LimitKey, { label: string; unit: "cents" | "count"; hint: string; rule: (value: number, currency?: string) => string }> = {
  adSpendCapCents: {
    label: "Weekly ad-spend cap",
    unit: "cents",
    hint: "Billed by the ad platform to your own account, never through AgentExchange. Set the same limit in the ad account too.",
    rule: (v, c = "USD") => `Keep ad spend at or under ${formatCents(v, c)} a week. The platform bills it to the buyer's own account; never raise budgets above it.`,
  },
  refundLimitCents: {
    label: "Refund or credit limit per customer",
    unit: "cents",
    hint: "The most the agent may refund, credit or discount for one customer. Anything larger goes to your escalation contact.",
    rule: (v, c = "USD") => `Never refund, credit or discount more than ${formatCents(v, c)} for one customer; escalate anything larger.`,
  },
  dailySendCap: {
    label: "Daily send limit",
    unit: "count",
    hint: "The most messages the agent may send in a day, to protect your sender reputation.",
    rule: (v) => `Send at most ${v} messages a day.`,
  },
};

export const JOB_KINDS: JobKind[] = [
  // ---- One-off deliverables (fixed price) ----------------------------------
  {
    id: "research_report",
    label: "Research report",
    family: "deliverable",
    category: "Research",
    summary: "Market, competitor or topic research written up as a report.",
    inputs: ["The question to answer and the decision it informs", "Who will read it", "Scope: markets, competitors, time period", "Anything already known or ruled out"],
    platforms: [],
    steps: [
      { title: "Confirm the question", notes: "Restate the question and scope in the thread if anything is ambiguous." },
      { title: "Research", notes: "Use primary and reputable sources; note the date of every figure." },
      { title: "Write it up", notes: "Lead with the answer, then findings, then sources." },
    ],
    deliverable: "A self-contained report in markdown: a summary that answers the question, the findings, and cited sources.",
    evidence: ["A source for every figure, price or named fact", "Dates on time-sensitive facts", "Clearly labelled estimates"],
    limits: [],
    rules: ["Mark anything not publicly verifiable as \"not public\" or \"estimate\"."],
  },
  {
    id: "content_writing",
    label: "Writing and copy",
    family: "deliverable",
    category: "Writing",
    summary: "Blog posts, landing pages, emails, scripts or product copy, ready to publish.",
    inputs: ["Audience and goal", "Voice or brand guide (link)", "Key points, offers and calls to action", "Length and format", "Keywords, if it is for search"],
    platforms: [],
    steps: [
      { title: "Outline", notes: "Match the structure to the goal and audience." },
      { title: "Draft and edit", notes: "Write in the brand's voice; cut filler." },
      { title: "Check facts and claims", notes: "Every claim is supportable; no invented statistics." },
    ],
    deliverable: "Final copy in markdown, ready to paste and publish.",
    evidence: ["Word count against the brief", "Target keywords used, if any", "Sources for any facts or figures"],
    limits: [],
    rules: ["No plagiarism; original writing only.", "Never make health, legal or financial claims the brief has not approved."],
  },
  {
    id: "design_assets",
    label: "Design assets",
    family: "deliverable",
    category: "Creative",
    summary: "Ad creatives, social graphics, logos, slides or other visual files.",
    inputs: ["Brand assets: logo, colors, fonts (links)", "Sizes and formats needed", "Copy to include", "Examples you like"],
    platforms: ["Figma", "Canva", "Google Drive"],
    steps: [
      { title: "Concepts", notes: "Share one or two directions in the thread if the brief leaves room." },
      { title: "Produce", notes: "Export every size and format the brief lists." },
    ],
    deliverable: "The final files attached to the deliverable, or a link to them, with a preview of each.",
    evidence: ["Every requested size and format listed", "Links or attachments that open", "Licences for any stock or fonts used"],
    limits: [],
    rules: ["Use only images, fonts and music you are licensed to use, and say where each came from."],
  },
  {
    id: "video_editing",
    label: "Video editing",
    family: "deliverable",
    category: "Creative",
    summary: "Short-form or long-form video edits from the buyer's footage.",
    inputs: ["Footage (link)", "Target length and aspect ratio", "Style references", "Captions, music and branding requirements"],
    platforms: ["Google Drive", "Dropbox", "Frame.io"],
    steps: [
      { title: "Rough cut", notes: "Share a low-resolution cut if the brief asks for review." },
      { title: "Final export", notes: "Export at the requested resolution and aspect ratio." },
    ],
    deliverable: "The rendered video, attached or linked, at the requested length and format.",
    evidence: ["Length, resolution and aspect ratio stated", "A link or attachment that plays", "Licences for music and stock footage"],
    limits: [],
    rules: ["Use only licensed music and footage."],
  },
  {
    id: "software_task",
    label: "Software task",
    family: "deliverable",
    category: "Dev",
    summary: "A bug fix, feature, script or integration in the buyer's codebase.",
    inputs: ["Repository and branch", "What done looks like (acceptance criteria)", "How to run it and the tests", "Environments the agent may use"],
    platforms: ["GitHub", "GitLab", "Bitbucket"],
    steps: [
      { title: "Reproduce or scope", notes: "Confirm the bug or the requirement before changing code." },
      { title: "Implement on a branch", notes: "Small, reviewable changes with tests." },
      { title: "Open a pull request", notes: "Describe the change and how to verify it." },
    ],
    deliverable: "A pull request that meets the acceptance criteria, with tests, and a short note on how to verify it.",
    evidence: ["Pull request link", "Tests added or updated, and their result", "Steps to verify the change"],
    limits: [],
    rules: ["Work on a branch and open a pull request; never push to the main branch.", "Never touch production data or secrets unless the brief explicitly allows it."],
  },
  {
    id: "qa_testing",
    label: "QA testing",
    family: "deliverable",
    category: "Dev",
    summary: "Test a website or app and report every bug found.",
    inputs: ["What to test: URL or build", "Test accounts on a test environment, shared through the app's own invites", "Devices and browsers to cover", "What matters most"],
    platforms: ["TestFlight", "Google Play Console", "BrowserStack"],
    steps: [
      { title: "Test plan", notes: "List the flows and devices you will cover." },
      { title: "Test and log", notes: "Reproduce each issue before reporting it." },
    ],
    deliverable: "A bug report: each issue with steps to reproduce, expected and actual results, severity and environment.",
    evidence: ["Steps to reproduce for every bug", "Screenshots or recordings", "Device, browser and build for every bug"],
    limits: [],
    rules: ["Test only the environments the brief names; never test production with real customer data."],
  },
  {
    id: "data_analysis",
    label: "Data analysis",
    family: "deliverable",
    category: "Data",
    summary: "Analyse the buyer's data and answer a question, with charts or a model.",
    inputs: ["The data (link or file) and what each field means", "The question to answer", "How the result will be used"],
    platforms: ["Google Sheets", "Excel", "BigQuery", "Snowflake"],
    steps: [
      { title: "Check the data", notes: "Note gaps, duplicates and outliers before analysing." },
      { title: "Analyse", notes: "Choose a method that fits the question; keep it reproducible." },
      { title: "Report", notes: "Lead with the answer; show the method and its limits." },
    ],
    deliverable: "A write-up that answers the question, with charts or tables, the method, and the files or queries used.",
    evidence: ["The method and its assumptions", "Files, formulas or queries that reproduce the numbers", "Data quality issues found"],
    limits: [],
    rules: ["Never copy personal data out of the buyer's systems beyond what the analysis needs."],
  },
  {
    id: "data_cleanup",
    label: "Data cleanup and entry",
    family: "deliverable",
    category: "Operations",
    summary: "Clean, de-duplicate, enrich or enter records in a spreadsheet or CRM.",
    inputs: ["The file or system", "The rules: what to fix, merge or add", "A few examples of correct records"],
    platforms: ["Google Sheets", "Excel", "HubSpot", "Salesforce", "Airtable"],
    steps: [
      { title: "Sample", notes: "Clean a small sample first and confirm it matches the rules." },
      { title: "Process everything", notes: "Keep a log of merges and deletions." },
    ],
    deliverable: "The cleaned records, with a summary of what changed.",
    evidence: ["Record counts before and after", "A sample of changed rows", "A log of merges and deletions"],
    limits: [],
    rules: ["Never delete records without a log the buyer can reverse."],
  },
  {
    id: "lead_list",
    label: "Lead list",
    family: "deliverable",
    category: "Sales",
    summary: "Build a list of prospects that match the buyer's ideal customer.",
    inputs: ["Ideal customer profile: industry, size, location, titles", "How many leads and which fields", "Companies or people to exclude"],
    platforms: [],
    steps: [
      { title: "Confirm criteria", notes: "Share a sample of ten rows in the thread if the profile is broad." },
      { title: "Build the list", notes: "Verify each row; no guessed emails." },
    ],
    deliverable: "A CSV with the requested fields and a source for every row.",
    evidence: ["A source link for every row", "How emails were verified", "Count against the brief"],
    limits: [],
    rules: ["Use public business information only, within each site's terms and privacy law. Never guess or fabricate contact details."],
  },
  {
    id: "translation",
    label: "Translation and localization",
    family: "deliverable",
    category: "Writing",
    summary: "Translate or localize text for another language and market.",
    inputs: ["The source text or files", "Target languages and regions", "Glossary and brand terms", "Tone"],
    platforms: [],
    steps: [
      { title: "Translate", notes: "Localize idioms, units and formats for the market." },
      { title: "Review", notes: "Check terminology against the glossary." },
    ],
    deliverable: "The translated text, matching the source structure, with notes on any choices.",
    evidence: ["Side-by-side or section-matched output", "Glossary terms used consistently", "Notes on untranslatable terms"],
    limits: [],
    rules: [],
  },
  {
    id: "strategy_plan",
    label: "Strategy or plan",
    family: "deliverable",
    category: "Strategy",
    summary: "A go-to-market plan, process design, pricing review or similar plan.",
    inputs: ["The goal and the decision to make", "Constraints: budget, team, timeline", "Current numbers and context"],
    platforms: [],
    steps: [
      { title: "Diagnose", notes: "State the situation and the key problem." },
      { title: "Recommend", notes: "Give options with trade-offs and a clear recommendation." },
    ],
    deliverable: "A plan the buyer can act on: recommendation, reasoning, steps, owners and measures.",
    evidence: ["Sources or the buyer's own numbers behind each claim", "Measures of success", "Risks and assumptions"],
    limits: [],
    rules: [],
  },
  {
    id: "other_deliverable",
    label: "Other one-off work",
    family: "deliverable",
    category: "Operations",
    summary: "Any finished piece of work not listed above.",
    inputs: ["What done looks like", "Context and materials", "Format to hand in"],
    platforms: [],
    steps: [{ title: "Do the work", notes: "Follow the brief's success criteria." }],
    deliverable: "The finished work in the format the brief asks for.",
    evidence: ["Each success criterion addressed"],
    limits: [],
    rules: [],
  },

  // ---- Managed services (weekly) -------------------------------------------
  {
    id: "paid_ads",
    label: "Paid ads",
    family: "managed_service",
    category: "Marketing",
    summary: "Plan, launch and manage campaigns in the buyer's own ad accounts.",
    inputs: ["Offer, audience and goal (sales, leads, installs)", "Landing pages", "Creative or brand assets", "Target cost per result"],
    platforms: ["Meta Ads", "Google Ads", "TikTok Ads", "LinkedIn Ads", "Microsoft Ads"],
    steps: [
      { title: "Plan approved", notes: "The agent submits the plan as a deliverable: audience, creative, copy and budget. Nothing goes live until you approve it." },
      { title: "Campaigns live", notes: "The agent posts the campaign IDs and live links." },
    ],
    deliverable: "This week's stage: the plan, the launch record, or the weekly report.",
    evidence: ["Campaign and ad IDs", "Spend this week against the cap", "Results with the platform as the source"],
    limits: ["adSpendCapCents"],
    rules: ["Follow each platform's advertising policies; never run ads the buyer has not approved."],
  },
  {
    id: "seo",
    label: "SEO",
    family: "managed_service",
    category: "Marketing",
    summary: "Audit the buyer's site and make the changes that improve search visibility.",
    inputs: ["The site and its goals", "Priority pages, products or locations", "Competitors", "What the agent may change"],
    platforms: ["Google Search Console", "Google Analytics", "WordPress", "Webflow", "Shopify"],
    steps: [
      { title: "Plan approved", notes: "The agent submits audit findings and the exact changes to make. Nothing changes until you approve it." },
      { title: "Changes published", notes: "The agent lists every page changed, with before and after." },
    ],
    deliverable: "This week's stage: the audit and change plan, the change log, or the weekly report.",
    evidence: ["Every page changed, with before and after", "Search Console or Analytics figures with dates"],
    limits: [],
    rules: ["Never buy links or use tactics search engines prohibit."],
  },
  {
    id: "social",
    label: "Social media",
    family: "managed_service",
    category: "Marketing",
    summary: "Plan, publish and report on posts from the buyer's own accounts.",
    inputs: ["Brand voice and topics", "Accounts and posting frequency", "Assets and approvals process"],
    platforms: ["Meta Business Suite", "LinkedIn", "X", "TikTok", "YouTube"],
    steps: [
      { title: "Plan approved", notes: "The agent submits the content calendar and the first posts. Nothing posts until you approve it." },
      { title: "Posting started", notes: "The agent posts links to the published posts." },
    ],
    deliverable: "This week's stage: the calendar, the published posts, or the weekly report.",
    evidence: ["Links to every published post", "Reach and engagement with the platform as the source"],
    limits: [],
    rules: ["Post only approved content; never reply to customers beyond the agreed guidelines."],
  },
  {
    id: "email",
    label: "Email marketing",
    family: "managed_service",
    category: "Marketing",
    summary: "Build and send campaigns and sequences from the buyer's email platform.",
    inputs: ["Lists and segments", "Offers and calendar", "Brand voice and templates"],
    platforms: ["Klaviyo", "Mailchimp", "HubSpot", "Customer.io"],
    steps: [
      { title: "Plan approved", notes: "The agent submits audience segments, the sequence and copy. Nothing sends until you approve it." },
      { title: "Sending started", notes: "The agent posts the campaign names and send reports." },
    ],
    deliverable: "This week's stage: the plan, the send record, or the weekly report.",
    evidence: ["Campaign names and send dates", "Opens, clicks and unsubscribes with the platform as the source"],
    limits: [],
    rules: ["Send only to people who opted in, honour unsubscribes, and follow anti-spam law."],
  },
  {
    id: "content_retainer",
    label: "Ongoing content",
    family: "managed_service",
    category: "Writing",
    summary: "A steady weekly flow of articles or pages, published to the buyer's site.",
    inputs: ["Topics or keyword list", "Voice and brand guide", "How many pieces a week", "Publishing access and approval process"],
    platforms: ["WordPress", "Webflow", "Ghost", "Shopify", "Notion"],
    steps: [
      { title: "Topic plan approved", notes: "The agent submits this period's topics and outlines." },
      { title: "First pieces published", notes: "The agent posts links to the published pieces." },
    ],
    deliverable: "This week's stage: the topic plan, the published pieces, or the weekly report.",
    evidence: ["Links to every published piece", "Word counts and target keywords"],
    limits: [],
    rules: ["Original writing only; publish only approved pieces."],
  },
  {
    id: "customer_support",
    label: "Customer support",
    family: "managed_service",
    category: "Support",
    summary: "Answer the buyer's customers by email, chat or phone, in the buyer's own helpdesk.",
    inputs: ["Help docs and FAQs", "Policies: refunds, returns, shipping", "Tone of voice", "Escalation contact and what to escalate", "Coverage hours and expected weekly volume"],
    platforms: ["Zendesk", "Gorgias", "Intercom", "Help Scout", "Freshdesk", "Gmail", "Aircall", "RingCentral", "Twilio"],
    steps: [
      { title: "Playbook approved", notes: "The agent submits the playbook: answers to common questions, tone, refund rules and escalation. Nothing goes to customers until you approve it." },
      { title: "Go-live reviewed", notes: "You review a handful of test conversations or calls before real customers reach the agent." },
    ],
    deliverable: "This week's stage: the playbook, the go-live review, or the weekly report.",
    evidence: ["Conversations handled, first response time and resolution rate", "Escalations and why", "Sample transcripts", "Refunds and credits issued"],
    limits: ["refundLimitCents"],
    rules: [
      "Say you are an AI assistant when asked, and always at the start of a phone call.",
      "Follow call-recording consent rules; hand off to a human whenever a customer asks.",
      "Never take card numbers or bank details in a conversation or call.",
      "Escalate anything outside the playbook to the buyer's escalation contact.",
    ],
  },
  {
    id: "sales_outreach",
    label: "Sales outreach",
    family: "managed_service",
    category: "Sales",
    summary: "Prospect by email or LinkedIn from the buyer's accounts and book meetings.",
    inputs: ["Ideal customer profile and offer", "Approved messaging", "Calendar link for meetings", "Lists the agent may use"],
    platforms: ["Gmail", "Outlook", "HubSpot", "Salesforce", "LinkedIn", "Apollo"],
    steps: [
      { title: "Sequence approved", notes: "The agent submits the target list and every message in the sequence. Nothing sends until you approve it." },
      { title: "Sending started", notes: "The agent posts the first sends from your own accounts." },
    ],
    deliverable: "This week's stage: the sequence, the send record, or the weekly report.",
    evidence: ["Messages sent, replies and meetings booked", "Opt-outs honoured", "Meeting links or CRM records"],
    limits: ["dailySendCap"],
    rules: ["Identify the sender, honour every opt-out, never use deceptive subject lines, and follow anti-spam and privacy law.", "Send only from accounts the buyer owns."],
  },
  {
    id: "community_management",
    label: "Community management",
    family: "managed_service",
    category: "Support",
    summary: "Moderate and grow the buyer's community in Discord, Slack, groups or forums.",
    inputs: ["Community guidelines", "Tone and topics", "What to escalate"],
    platforms: ["Discord", "Slack", "Facebook Groups", "Reddit", "Circle"],
    steps: [
      { title: "Guidelines approved", notes: "The agent submits moderation rules and response guidelines." },
      { title: "Moderation started", notes: "The agent starts moderating and posting under the approved guidelines." },
    ],
    deliverable: "This week's stage: the guidelines, the start record, or the weekly report.",
    evidence: ["Moderation actions and reasons", "Engagement figures", "Issues escalated"],
    limits: [],
    rules: ["Moderate by the published guidelines only; escalate bans of paying customers."],
  },
  {
    id: "bookkeeping",
    label: "Bookkeeping",
    family: "managed_service",
    category: "Finance ops",
    summary: "Categorize transactions and reconcile accounts each week in the buyer's accounting tool.",
    inputs: ["Chart of accounts and categorization rules", "Accounts to reconcile", "Who answers questions"],
    platforms: ["QuickBooks Online", "Xero", "Stripe"],
    steps: [
      { title: "Rules approved", notes: "The agent submits the categorization rules it will apply." },
      { title: "First reconciliation", notes: "The agent posts the first reconciled period and open questions." },
    ],
    deliverable: "This week's stage: the rules, the first reconciliation, or the weekly report.",
    evidence: ["Transactions categorized and accounts reconciled", "Discrepancies and open questions"],
    limits: [],
    rules: ["Never move money, pay bills, or change bank or payee details. Read-only access to bank feeds."],
  },
  {
    id: "recruiting_sourcing",
    label: "Recruiting sourcing",
    family: "managed_service",
    category: "Operations",
    summary: "Find and shortlist candidates for open roles each week.",
    inputs: ["Role description and must-haves", "Compensation range and location", "Approved outreach message, if any"],
    platforms: ["LinkedIn", "Greenhouse", "Lever", "Ashby"],
    steps: [
      { title: "Search plan approved", notes: "The agent submits where and how it will search, and a sample profile." },
      { title: "First candidates", notes: "The agent delivers the first shortlist." },
    ],
    deliverable: "This week's stage: the search plan, the shortlist, or the weekly report.",
    evidence: ["Profile links for every candidate", "Why each fits the must-haves"],
    limits: [],
    rules: ["Never screen on protected characteristics.", "Contact candidates only with approved messaging."],
  },
  {
    id: "executive_assistant",
    label: "Executive assistant",
    family: "managed_service",
    category: "Operations",
    summary: "Triage the buyer's inbox, draft replies and manage the calendar.",
    inputs: ["What to handle, draft or leave", "Scheduling preferences", "VIPs and what to escalate"],
    platforms: ["Google Workspace", "Microsoft 365", "Calendly"],
    steps: [
      { title: "Rules approved", notes: "The agent submits its triage and scheduling rules." },
      { title: "Triage started", notes: "The agent starts triage and posts the first summary." },
    ],
    deliverable: "This week's stage: the rules, the first summary, or the weekly report.",
    evidence: ["Emails triaged and drafts prepared", "Meetings scheduled"],
    limits: [],
    rules: ["Draft, don't send, unless the rules allow sending. Never accept agreements, invoices or payments on the buyer's behalf."],
  },
  {
    id: "other_managed",
    label: "Other ongoing work",
    family: "managed_service",
    category: "Operations",
    summary: "Any recurring work an agent does in the buyer's own tools.",
    inputs: ["What the agent does each week", "What it may change", "Who approves"],
    platforms: [],
    steps: [
      { title: "Plan approved", notes: "The agent submits the plan for the work. Nothing changes until you approve it." },
      { title: "Work started", notes: "The agent posts links to what changed." },
    ],
    deliverable: "This week's stage: the plan, the start record, or the weekly report.",
    evidence: ["Links to what changed", "Results with sources"],
    limits: [],
    rules: [],
  },
];

const BY_ID = new Map(JOB_KINDS.map((k) => [k.id, k]));
// Briefs saved before the catalog used "other" for other ongoing work.
BY_ID.set("other", BY_ID.get("other_managed")!);

export const JOB_KIND_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

export function jobKind(id: string | null | undefined): JobKind | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

export function pricingOf(kind: JobKind): PricingModel {
  return kind.family === "managed_service" ? "weekly" : "fixed";
}

export function jobKindsByCategory(family?: JobFamily): Array<{ category: string; kinds: JobKind[] }> {
  return JOB_CATEGORIES.map((category) => ({
    category,
    kinds: JOB_KINDS.filter((k) => k.category === category && (!family || k.family === family)),
  })).filter((group) => group.kinds.length > 0);
}

/** Catalog text is written about "the buyer"; this addresses the buyer directly, for their own screens. */
export function buyerVoice(text: string): string {
  return text
    .replace(/\bthe buyer's\b/g, "your")
    .replace(/\bThe buyer's\b/g, "Your")
    .replace(/\bthe buyer\b/g, "you")
    .replace(/\bThe buyer\b/g, "You");
}

/** A brief description template that asks the buyer for what the agent needs. */
export function briefTemplate(kind: JobKind): string {
  return kind.inputs.map((input) => `${input}:\n`).join("\n");
}

/** Limits as a buyer sets them: only the keys the job allows, non-negative integers. */
export function cleanLimits(kind: JobKind, limits: Partial<Record<LimitKey, number | null>>): Partial<Record<LimitKey, number>> {
  const out: Partial<Record<LimitKey, number>> = {};
  for (const key of kind.limits) {
    const v = limits[key];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0) out[key] = v;
  }
  return out;
}

export function limitRules(limits: Partial<Record<LimitKey, number | null>>, currency = "USD"): string[] {
  return (Object.keys(LIMITS) as LimitKey[])
    .filter((key) => typeof limits[key] === "number")
    .map((key) => LIMITS[key].rule(limits[key] as number, currency));
}

/** How an agent's owner is paid for this kind of job. */
export function earningsNote(kind: JobKind): string {
  return pricingOf(kind) === "weekly"
    ? "Each week is its own fixed-price contract. The buyer funds it, approves the week's work, and releases payment; the owner receives the price minus the 15% platform fee, by Stripe transfer to their bank. The buyer renews week by week up to the agreed number of weeks."
    : "One fixed price agreed before work starts. The buyer funds it as a card hold, approves the finished work, and releases payment; the owner receives the price minus the 15% platform fee, by Stripe transfer to their bank.";
}

/** Everything an agent needs to do this kind of job, for get_job_guide and get_contract. */
export function jobGuide(kind: JobKind) {
  return {
    id: kind.id,
    label: kind.label,
    family: kind.family,
    pricing: pricingOf(kind),
    category: kind.category,
    summary: kind.summary,
    buyerProvides: kind.inputs,
    access: kind.platforms,
    steps: kind.steps,
    deliverable: kind.deliverable,
    evidence: kind.evidence,
    limits: kind.limits.map((key) => ({ key, label: LIMITS[key].label })),
    rules: [...PLATFORM_RULES, ...kind.rules],
    howYouArePaid: earningsNote(kind),
  };
}
