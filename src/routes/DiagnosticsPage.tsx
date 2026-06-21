import { useEffect, useState } from "react";

import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import {
  runSupabaseDiagnostics,
  type SupabaseDiagnosticResult,
} from "../lib/supabaseDiagnostics";
import { supabaseEnvDiagnostics } from "../lib/supabase";
import { useAuth } from "../state/AuthContext";

const statusClasses: Record<SupabaseDiagnosticResult["status"], string> = {
  fail: "border-ae-error/20 bg-ae-error/10 text-ae-error",
  pass: "border-ae-emerald/20 bg-ae-emerald/10 text-ae-emerald",
  warn: "border-ae-amber/20 bg-ae-amber/10 text-ae-amber",
};

export function DiagnosticsPage() {
  const { isAuthenticated, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<SupabaseDiagnosticResult[]>([]);

  async function runDiagnostics() {
    setLoading(true);
    setError(null);

    try {
      setResults(await runSupabaseDiagnostics());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Diagnostics failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runDiagnostics();
  }, []);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Diagnostics
          </p>
          <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
            Supabase connectivity checks.
          </h1>
          <p className="mt-3 max-w-2xl text-ae-text-muted">
            Validate environment configuration, auth session, table reads, and
            authenticated write probes.
          </p>
        </div>
        <PrimaryButton disabled={loading} onClick={() => void runDiagnostics()}>
          {loading ? "Running..." : "Retry"}
        </PrimaryButton>
      </div>

      {error ? (
        <GlassCard className="border-ae-error/20 text-ae-error">{error}</GlassCard>
      ) : null}

      <GlassCard className="space-y-5">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Manual Production Validation
          </p>
          <h2 className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
            Read-only checklist for live two-user testing
          </h2>
          <p className="mt-2 text-sm leading-6 text-ae-text-muted">
            Authenticated two-user validation must be performed with real test
            accounts. Do not paste credentials into screenshots or reports.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Supabase configured", supabaseEnvDiagnostics.hasUrl && supabaseEnvDiagnostics.hasAnonKey],
            ["Authenticated session", isAuthenticated],
            ["Current user id present", Boolean(user?.id)],
          ].map(([label, value]) => (
            <div
              className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4"
              key={String(label)}
            >
              <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                {label}
              </p>
              <p className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
                {value ? "Yes" : "No"}
              </p>
            </div>
          ))}
        </div>

        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            Tables expected during validation
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "profiles",
              "organizations",
              "agents",
              "opportunities",
              "saved_opportunities",
              "applications",
              "negotiations",
              "hire_requests",
              "contracts",
              "contract_milestones",
              "contract_deliverables",
              "contract_messages",
              "reviews",
              "disputes",
              "activity_events",
            ].map((table) => (
              <span
                className="rounded-full border border-white/[0.06] bg-white/[0.05] px-3 py-1 font-ae-label text-xs font-semibold text-ae-text-muted"
                key={table}
              >
                {table}
              </span>
            ))}
          </div>
        </div>

        <p className="rounded-ae-md border border-ae-amber/20 bg-ae-amber/10 p-4 text-sm leading-6 text-ae-amber">
          Follow docs/MANUAL_PRODUCTION_VALIDATION.md in the repository for the
          full User A / User B workflow, RLS expectations, refresh checks, and
          pass/fail checklist.
        </p>
      </GlassCard>

      <div className="grid gap-4">
        {results.map((check) => (
          <GlassCard className="space-y-3" key={`${check.name}-${check.timestamp}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-ae-display text-xl font-semibold text-ae-text">
                  {check.name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-ae-text-muted">
                  {check.message}
                </p>
              </div>
              <span
                className={[
                  "rounded-full border px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em]",
                  statusClasses[check.status],
                ].join(" ")}
              >
                {check.status}
              </span>
            </div>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text-muted">
              {new Date(check.timestamp).toLocaleString()}
            </p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
