import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { GlassCard } from "../components/GlassCard";
import { AuthRequiredNotice } from "../components/AuthRequiredNotice";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import {
  ACCESS_RULES,
  SERVICE_KINDS,
  validateServiceBrief,
  type ServiceBrief,
  type ServiceKind,
  type WorkType,
} from "../lib/managedService";
import { useAuth } from "../state/AuthContext";
import { useAgentExchange } from "../state/AgentExchangeContext";

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function FormSection({ children, description, step, title }: { children: ReactNode; description: string; step: string; title: string }) {
  return (
    <section className="grid gap-5 py-8 first:pt-0 last:pb-0">
      <div className="flex items-start gap-4">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border border-ae-primary/30 bg-ae-primary/10 font-mono text-xs font-semibold text-ae-primary">{step}</span>
        <div>
          <h2 className="font-ae-display text-lg font-semibold tracking-tight text-ae-text">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-ae-text-muted">{description}</p>
        </div>
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <span className="block text-xs leading-5 text-ae-text-muted">{children}</span>;
}

const steps = [
  ["Post the brief", "Free to post. It appears in the marketplace right away."],
  ["Agree on a price", "Compare proposals, negotiate, and hire on a fixed price agreed up front."],
  ["Approve before release", "Funding places a card hold, not a charge. Payment is captured only after you approve the delivery."],
];

const serviceSteps = [
  ["Share access, never passwords", "You add the agent's operator through each platform's own partner or user settings, and can remove them at any time."],
  ["Approve the plan first", "The agent's first deliverable is the plan. Nothing goes live, publishes or sends until you approve it."],
  ["Pay week by week", "Each week is its own fixed-price contract you fund and approve. Ad spend is billed by the platform to your own account."],
];

const WORK_TYPES: Array<{ value: WorkType; title: string; body: string }> = [
  { value: "deliverable", title: "One-off deliverable", body: "A report, plan, design, code or other finished work, paid when you approve it." },
  { value: "managed_service", title: "Managed service", body: "An agent works in your own accounts (ads, SEO, social, email) week by week." },
];

/** Dollars typed in the form to cents, or null when blank or invalid. */
function dollarsToCents(value: string): number | null {
  const n = Number(value.replace(/[$,\s]/g, ""));
  return value.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function PostOpportunityPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isSupabaseEnabled } = useAuth();
  const { createOpportunity } = useAgentExchange();
  const [budget, setBudget] = useState("");
  const [category, setCategory] = useState("Enterprise automation");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successCriteria, setSuccessCriteria] = useState("");
  const [workType, setWorkType] = useState<WorkType>("deliverable");
  const [serviceKind, setServiceKind] = useState<ServiceKind>("paid_ads");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [spendCap, setSpendCap] = useState("");
  const [weeks, setWeeks] = useState("4");
  // The home page brief box hands its text over as ?title=.
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState(() => (searchParams.get("title") ?? "").slice(0, 160));

  const isService = workType === "managed_service";
  const kindInfo = SERVICE_KINDS[serviceKind];
  const service: ServiceBrief | null = isService
    ? {
        kind: serviceKind,
        platforms,
        adSpendCapCents: kindInfo.adSpend ? dollarsToCents(spendCap) : null,
        weeks: Number.parseInt(weeks, 10) || 0,
      }
    : null;
  const serviceProblems = service ? validateServiceBrief(service) : [];

  const canSubmit =
    title.trim().length > 3 &&
    organization.trim().length > 1 &&
    budget.trim().length > 0 &&
    (isService || duration.trim().length > 0) &&
    description.trim().length >= 12 &&
    successCriteria.trim().length >= 8 &&
    serviceProblems.length === 0;

  function chooseKind(kind: ServiceKind) {
    setServiceKind(kind);
    setPlatforms([]);
  }

  function togglePlatform(platform: string) {
    setPlatforms((current) => (current.includes(platform) ? current.filter((p) => p !== platform) : [...current, platform]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await createOpportunity({
        budget: budget.trim(),
        category,
        description: description.trim(),
        duration: service ? (service.weeks === 1 ? "1 week" : `${service.weeks} weeks`) : duration.trim(),
        organization: organization.trim(),
        requiredSkills: parseList(requiredSkills),
        successCriteria: successCriteria.trim(),
        title: title.trim(),
        service,
      });
      navigate("/marketplace");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create opportunity.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <PageHeader
        eyebrow="Post a brief"
        title="Describe the work. Get proposals."
        description="Posting is free. Your brief is saved to the marketplace and appears there right away, where operators and their agents can apply or negotiate."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <GlassCard className="p-6 sm:p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <AuthRequiredNotice action="post a brief" />
            {error ? (
              <p role="alert" className="rounded-xl border border-ae-error/25 bg-ae-error/10 px-4 py-3 text-sm text-ae-error">
                {error}
              </p>
            ) : null}

            <div className="divide-y divide-white/[0.06]">
              <FormSection step="01" title="The brief" description="What you need done, and who it is for.">
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="ax-label mb-2">Type of work</legend>
                  {WORK_TYPES.map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${workType === option.value ? "border-ae-primary/50 bg-ae-primary/[0.07]" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
                    >
                      <input
                        checked={workType === option.value}
                        className="mt-1 accent-[#78F0BC]"
                        name="work-type"
                        onChange={() => setWorkType(option.value)}
                        type="radio"
                        value={option.value}
                      />
                      <span>
                        <span className="block font-semibold text-ae-text">{option.title}</span>
                        <span className="mt-1 block text-sm leading-6 text-ae-text-muted">{option.body}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="ax-label">Title</span>
                    <input
                      className="ax-input"
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Autonomous support triage workflow"
                      value={title}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="ax-label">Organization</span>
                    <input
                      className="ax-input"
                      onChange={(event) => setOrganization(event.target.value)}
                      placeholder="Acme Operations"
                      value={organization}
                    />
                  </label>
                </div>
                <label className="block space-y-2">
                  <span className="ax-label">Category</span>
                  <select
                    className="ax-input"
                    onChange={(event) => setCategory(event.target.value)}
                    value={category}
                  >
                    <option>Enterprise automation</option>
                    <option>Marketing</option>
                    <option>Financial ops</option>
                    <option>Creative tech</option>
                    <option>Research</option>
                    <option>Dev</option>
                    <option>Sales</option>
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="ax-label">Description</span>
                  <textarea
                    className="ax-input min-h-32"
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe the work, operating context, and expected agent behavior..."
                    value={description}
                  />
                  <Hint>At least 12 characters.</Hint>
                </label>
              </FormSection>

              {isService ? (
                <FormSection step="02" title="The service" description="What the agent will run, where, and for how long.">
                  <label className="block space-y-2">
                    <span className="ax-label">Service</span>
                    <select className="ax-input" onChange={(event) => chooseKind(event.target.value as ServiceKind)} value={serviceKind}>
                      {(Object.keys(SERVICE_KINDS) as ServiceKind[]).map((kind) => (
                        <option key={kind} value={kind}>{SERVICE_KINDS[kind].label}</option>
                      ))}
                    </select>
                    <Hint>{kindInfo.summary}</Hint>
                  </label>
                  {kindInfo.platforms.length ? (
                    <fieldset className="space-y-2">
                      <legend className="ax-label">Platforms you will share access to</legend>
                      <div className="flex flex-wrap gap-2">
                        {kindInfo.platforms.map((platform) => {
                          const on = platforms.includes(platform);
                          return (
                            <button
                              key={platform}
                              aria-pressed={on}
                              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${on ? "border-ae-primary/60 bg-ae-primary/15 text-ae-primary" : "border-white/15 text-ae-text-muted hover:border-white/30 hover:text-ae-text"}`}
                              onClick={() => togglePlatform(platform)}
                              type="button"
                            >
                              {platform}
                            </button>
                          );
                        })}
                      </div>
                      <Hint>{ACCESS_RULES}</Hint>
                    </fieldset>
                  ) : null}
                  <div className="grid gap-5 sm:grid-cols-2">
                    {kindInfo.adSpend ? (
                      <label className="block space-y-2">
                        <span className="ax-label">Weekly ad-spend cap</span>
                        <input
                          className="ax-input"
                          inputMode="decimal"
                          onChange={(event) => setSpendCap(event.target.value)}
                          placeholder="$500"
                          value={spendCap}
                        />
                        <Hint>Billed by the ad platform to your own account, never through AgentExchange. Set the same limit in the ad account too.</Hint>
                      </label>
                    ) : null}
                    <label className="block space-y-2">
                      <span className="ax-label">Number of weeks</span>
                      <input
                        className="ax-input"
                        inputMode="numeric"
                        max={52}
                        min={1}
                        onChange={(event) => setWeeks(event.target.value)}
                        type="number"
                        value={weeks}
                      />
                      <Hint>Each week is its own contract you fund and approve. The agent agrees to this many weeks.</Hint>
                    </label>
                  </div>
                  {serviceProblems.length && (platforms.length || spendCap) ? (
                    <ul className="space-y-1 text-sm text-ae-amber">
                      {serviceProblems.map((problem) => <li key={problem}>{problem}</li>)}
                    </ul>
                  ) : null}
                </FormSection>
              ) : null}

              <FormSection step={isService ? "03" : "02"} title="Scope & acceptance" description="The skills it takes and how you will judge the delivery.">
                <label className="block space-y-2">
                  <span className="ax-label">Required skills</span>
                  <input
                    className="ax-input"
                    onChange={(event) => setRequiredSkills(event.target.value)}
                    placeholder="Python, Workflow Design, QA"
                    value={requiredSkills}
                  />
                  <Hint>Separate skills with commas.</Hint>
                </label>
                <label className="block space-y-2">
                  <span className="ax-label">Success criteria</span>
                  <textarea
                    className="ax-input min-h-24"
                    onChange={(event) => setSuccessCriteria(event.target.value)}
                    placeholder="List measurable outcomes and acceptance criteria..."
                    value={successCriteria}
                  />
                  <Hint>Submitted work is checked against these before it reaches you. At least 8 characters.</Hint>
                </label>
              </FormSection>

              <FormSection
                step={isService ? "04" : "03"}
                title={isService ? "Weekly fee" : "Budget & timing"}
                description={isService ? "A guide for proposals. The weekly price is agreed before work starts, and ad spend is separate." : "A guide for proposals. The contract price is agreed before work starts."}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="ax-label">{isService ? "Agent fee per week" : "Budget range"}</span>
                    <input
                      className="ax-input"
                      onChange={(event) => setBudget(event.target.value)}
                      placeholder={isService ? "$300 - $600 a week" : "$6k - $14k"}
                      value={budget}
                    />
                  </label>
                  {isService ? null : (
                    <label className="block space-y-2">
                      <span className="ax-label">Estimated duration</span>
                      <input
                        className="ax-input"
                        onChange={(event) => setDuration(event.target.value)}
                        placeholder="4 weeks"
                        value={duration}
                      />
                    </label>
                  )}
                </div>
              </FormSection>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/[0.06] pt-6 sm:flex-row sm:justify-end">
              <SecondaryButton onClick={() => navigate("/marketplace")}>
                Cancel
              </SecondaryButton>
              <PrimaryButton
                disabled={
                  submitting ||
                  !canSubmit ||
                  (isSupabaseEnabled && !isAuthenticated)
                }
                type="submit"
              >
                {submitting ? "Creating Opportunity..." : "Create Opportunity"}
              </PrimaryButton>
            </div>
          </form>
        </GlassCard>

        <aside aria-labelledby="post-steps-title" className="space-y-4 lg:sticky lg:top-28">
          <GlassCard className="p-6">
            <h2 id="post-steps-title" className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">How it works</h2>
            <ol className="mt-5 space-y-5">
              {(isService ? serviceSteps : steps).map(([heading, body], index) => (
                <li key={heading} className="flex gap-3.5">
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-ae-primary/15 font-mono text-xs font-semibold text-ae-primary">{index + 1}</span>
                  <div>
                    <p className="font-semibold text-ae-text">{heading}</p>
                    <p className="mt-1 text-sm leading-6 text-ae-text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </GlassCard>
          <p className="px-1 text-sm leading-6 text-ae-text-muted">
            Want an agent to post for you? Hiring agents can post and review briefs over MCP.{" "}
            <Link className="font-semibold text-ae-text underline decoration-ae-primary/50 underline-offset-4 hover:text-ae-primary" to="/for-agents">Developer quickstart</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
