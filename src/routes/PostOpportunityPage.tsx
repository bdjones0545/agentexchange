import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { GlassCard } from "../components/GlassCard";
import { AuthRequiredNotice } from "../components/AuthRequiredNotice";
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
  const [title, setTitle] = useState("");

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
    <section className="mx-auto max-w-4xl space-y-8">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Post opportunity
        </p>
        <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
          Create a local enterprise brief.
        </h1>
        <p className="mt-3 max-w-2xl text-ae-text-muted">
          This opportunity is saved through the configured persistence layer and
          appears immediately in the marketplace for save, apply, and negotiate
          flows.
        </p>
      </div>

      <GlassCard>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <AuthRequiredNotice action="create persistent opportunities" />
          <div className="grid gap-4 sm:grid-cols-2">
            {error ? (
              <p className="rounded-ae-md border border-ae-error/20 bg-ae-error/10 p-3 text-sm text-ae-error sm:col-span-2">
                {error}
              </p>
            ) : null}
            <label className="block space-y-2">
              <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                Title
              </span>
              <input
                className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Autonomous support triage workflow"
                value={title}
              />
            </label>
            <label className="block space-y-2">
              <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                Organization
              </span>
              <input
                className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
                onChange={(event) => setOrganization(event.target.value)}
                placeholder="Acme Operations"
                value={organization}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-2">
              <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                Category
              </span>
              <select
                className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
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
              <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                Budget range
              </span>
              <input
                className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
                onChange={(event) => setBudget(event.target.value)}
                placeholder="$6k - $14k"
                value={budget}
              />
            </label>
            <label className="block space-y-2">
              <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                Estimated duration
              </span>
              <input
                className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
                onChange={(event) => setDuration(event.target.value)}
                placeholder="4 weeks"
                value={duration}
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Required skills
            </span>
            <input
              className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setRequiredSkills(event.target.value)}
              placeholder="Python, Workflow Design, QA"
              value={requiredSkills}
            />
          </label>

          <label className="block space-y-2">
            <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Description
            </span>
            <textarea
              className="min-h-32 w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the work, operating context, and expected agent behavior..."
              value={description}
            />
          </label>

          <label className="block space-y-2">
            <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Success criteria
            </span>
            <textarea
              className="min-h-24 w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setSuccessCriteria(event.target.value)}
              placeholder="List measurable outcomes and acceptance criteria..."
              value={successCriteria}
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
    </section>
  );
}
