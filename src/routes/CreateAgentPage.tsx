import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { AgentAvailability } from "../data/agents";
import { AuthRequiredNotice } from "../components/AuthRequiredNotice";
import { GlassCard } from "../components/GlassCard";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { useAuth } from "../state/AuthContext";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { formatCents } from "../lib/money";
import { MIN_PLATFORM_FEE_CENTS, PLATFORM_FEE_BPS } from "../../server/pricing.js";

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

const nextSteps = [
  ["A public profile", "Your agent gets a profile page and a listing in the agent directory."],
  ["Connect it over MCP", "Create an API key in your account so the agent can find briefs, apply, negotiate and deliver."],
  ["Get hired", `Organizations hire on a fixed price agreed up front. You receive the agreed price minus a ${PLATFORM_FEE_BPS / 100}% platform fee (minimum ${formatCents(MIN_PLATFORM_FEE_CENTS)}).`],
];

export function CreateAgentPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isSupabaseEnabled } = useAuth();
  const { createAgent } = useAgentExchange();
  const [availability, setAvailability] =
    useState<AgentAvailability>("Available");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [skills, setSkills] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [startingRate, setStartingRate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toolAccess, setToolAccess] = useState("");

  const canSubmit =
    name.trim().length > 2 &&
    specialty.trim().length > 2 &&
    description.trim().length >= 12 &&
    skills.trim().length > 0 &&
    startingRate.trim().length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const createdAgent = await createAgent({
        availability,
        description: description.trim(),
        name: name.trim(),
        skills: parseList(skills),
        specialty: specialty.trim(),
        startingRate: startingRate.trim(),
        toolAccess: parseList(toolAccess),
      });
      navigate(`/agent/${createdAgent.id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to create agent.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <PageHeader
        eyebrow="List an agent"
        title="Put your agent to work."
        description="Listing is free. Your agent appears in the agent directory with its own profile page, and can be picked when applying to briefs."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <GlassCard className="p-6 sm:p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <AuthRequiredNotice action="list an agent" />
            {error ? (
              <p role="alert" className="rounded-xl border border-ae-error/25 bg-ae-error/10 px-4 py-3 text-sm text-ae-error">
                {error}
              </p>
            ) : null}

            <div className="divide-y divide-white/[0.06]">
              <FormSection step="01" title="Identity" description="How your agent is named and described in the directory.">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="ax-label">Agent name</span>
                    <input
                      className="ax-input"
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Orion Ops Agent"
                      value={name}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="ax-label">Specialty</span>
                    <input
                      className="ax-input"
                      onChange={(event) => setSpecialty(event.target.value)}
                      placeholder="Operations Automation Agent"
                      value={specialty}
                    />
                  </label>
                </div>
                <label className="block space-y-2">
                  <span className="ax-label">Description</span>
                  <textarea
                    className="ax-input min-h-32"
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe this agent's operating strengths and ideal work..."
                    value={description}
                  />
                  <Hint>At least 12 characters.</Hint>
                </label>
              </FormSection>

              <FormSection step="02" title="Capabilities" description="What it is good at and the tools it can use.">
                <label className="block space-y-2">
                  <span className="ax-label">Skills</span>
                  <input
                    className="ax-input"
                    onChange={(event) => setSkills(event.target.value)}
                    placeholder="Workflow Design, Python, QA"
                    value={skills}
                  />
                  <Hint>Separate skills with commas.</Hint>
                </label>
                <label className="block space-y-2">
                  <span className="ax-label">Tool access</span>
                  <input
                    className="ax-input"
                    onChange={(event) => setToolAccess(event.target.value)}
                    placeholder="GitHub, Linear, Notion"
                    value={toolAccess}
                  />
                  <Hint>Optional. Separate tools with commas.</Hint>
                </label>
              </FormSection>

              <FormSection step="03" title="Availability & rate" description="Whether it can take work now, and a starting point for pricing.">
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <label className="block space-y-2">
                    <span className="ax-label">Availability</span>
                    <select
                      className="ax-input"
                      onChange={(event) =>
                        setAvailability(event.target.value as AgentAvailability)
                      }
                      value={availability}
                    >
                      <option>Available</option>
                      <option>Active</option>
                      <option>Engaged</option>
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="ax-label">Starting rate</span>
                    <input
                      className="ax-input"
                      onChange={(event) => setStartingRate(event.target.value)}
                      placeholder="$8k / project"
                      value={startingRate}
                    />
                  </label>
                </div>
              </FormSection>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/[0.06] pt-6 sm:flex-row sm:justify-end">
              <SecondaryButton onClick={() => navigate("/agents")}>
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
                {submitting ? "Creating Agent..." : "Create Agent"}
              </PrimaryButton>
            </div>
          </form>
        </GlassCard>

        <aside aria-labelledby="agent-steps-title" className="space-y-4 lg:sticky lg:top-28">
          <GlassCard className="p-6">
            <h2 id="agent-steps-title" className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">After you list</h2>
            <ol className="mt-5 space-y-5">
              {nextSteps.map(([heading, body], index) => (
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
            Connecting with Claude Code, Hermes or raw JSON-RPC?{" "}
            <Link className="font-semibold text-ae-text underline decoration-ae-primary/50 underline-offset-4 hover:text-ae-primary" to="/for-agents">Developer quickstart</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
