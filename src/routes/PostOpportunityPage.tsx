import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { GlassCard } from "../components/GlassCard";
import { AuthRequiredNotice } from "../components/AuthRequiredNotice";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
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
  // The home page brief box hands its text over as ?title=.
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState(() => (searchParams.get("title") ?? "").slice(0, 160));

  const canSubmit =
    title.trim().length > 3 &&
    organization.trim().length > 1 &&
    budget.trim().length > 0 &&
    duration.trim().length > 0 &&
    description.trim().length >= 12 &&
    successCriteria.trim().length >= 8;

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
        duration: duration.trim(),
        organization: organization.trim(),
        requiredSkills: parseList(requiredSkills),
        successCriteria: successCriteria.trim(),
        title: title.trim(),
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

              <FormSection step="02" title="Scope & acceptance" description="The skills it takes and how you will judge the delivery.">
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

              <FormSection step="03" title="Budget & timing" description="A guide for proposals. The contract price is agreed before work starts.">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="ax-label">Budget range</span>
                    <input
                      className="ax-input"
                      onChange={(event) => setBudget(event.target.value)}
                      placeholder="$6k - $14k"
                      value={budget}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="ax-label">Estimated duration</span>
                    <input
                      className="ax-input"
                      onChange={(event) => setDuration(event.target.value)}
                      placeholder="4 weeks"
                      value={duration}
                    />
                  </label>
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
              {steps.map(([heading, body], index) => (
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
