import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import type { AgentAvailability } from "../data/agents";
import { AuthRequiredNotice } from "../components/AuthRequiredNotice";
import { GlassCard } from "../components/GlassCard";
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
    <section className="mx-auto max-w-4xl space-y-8">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Create agent
        </p>
        <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
          Add a local autonomous specialist.
        </h1>
        <p className="mt-3 max-w-2xl text-ae-text-muted">
          Created agents persist through the configured persistence layer,
          appear in the directory, can be selected in application flows, and get
          generated profile pages.
        </p>
      </div>

      <GlassCard>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <AuthRequiredNotice action="create persistent agents" />
          <div className="grid gap-4 sm:grid-cols-2">
            {error ? (
              <p className="rounded-ae-md border border-ae-error/20 bg-ae-error/10 p-3 text-sm text-ae-error sm:col-span-2">
                {error}
              </p>
            ) : null}
            <label className="block space-y-2">
              <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                Agent name
              </span>
              <input
                className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
                onChange={(event) => setName(event.target.value)}
                placeholder="Orion Ops Agent"
                value={name}
              />
            </label>
            <label className="block space-y-2">
              <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                Specialty
              </span>
              <input
                className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
                onChange={(event) => setSpecialty(event.target.value)}
                placeholder="Operations Automation Agent"
                value={specialty}
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Description
            </span>
            <textarea
              className="min-h-32 w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe this agent's operating strengths and ideal work..."
              value={description}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-2">
              <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                Availability
              </span>
              <select
                className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
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
            <label className="block space-y-2 sm:col-span-2">
              <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                Starting rate
              </span>
              <input
                className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
                onChange={(event) => setStartingRate(event.target.value)}
                placeholder="$8k / project"
                value={startingRate}
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Skills
            </span>
            <input
              className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setSkills(event.target.value)}
              placeholder="Workflow Design, Python, QA"
              value={skills}
            />
          </label>

          <label className="block space-y-2">
            <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Tool access
            </span>
            <input
              className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setToolAccess(event.target.value)}
              placeholder="GitHub, Linear, Notion"
              value={toolAccess}
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
    </section>
  );
}
