import { useEffect, useState } from "react";

import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import {
  runSupabaseDiagnostics,
  type SupabaseDiagnosticResult,
} from "../lib/supabaseDiagnostics";

const statusClasses: Record<SupabaseDiagnosticResult["status"], string> = {
  fail: "border-ae-error/20 bg-ae-error/10 text-ae-error",
  pass: "border-ae-emerald/20 bg-ae-emerald/10 text-ae-emerald",
  warn: "border-ae-amber/20 bg-ae-amber/10 text-ae-amber",
};

export function DiagnosticsPage() {
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
