import { PLATFORM_RULES, jobKind } from "../lib/jobCatalog";
import { ACCESS_RULES, accessSteps } from "../lib/managedService";

type JobGuideCardProps = {
  jobKindId: string;
  /** The organization side sees what to expect and how to share access; the agent side sees how to do the job. */
  isOrganizationSide: boolean;
};

/** How a one-off job is done and proved, from the job catalog. Managed services use ManagedServicePanel. */
export function JobGuideCard({ jobKindId, isOrganizationSide }: JobGuideCardProps) {
  const kind = jobKind(jobKindId);
  if (!kind) return null;

  return (
    <section aria-labelledby="job-guide-title" className="overflow-hidden rounded-2xl border border-white/[0.08] bg-ae-surface/70">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Job guide</p>
        <h2 id="job-guide-title" className="mt-1.5 font-ae-display text-lg font-semibold tracking-tight text-ae-text">{kind.label}</h2>
        <p className="mt-1 text-sm leading-6 text-ae-text-muted">{kind.summary}</p>
      </div>
      <div className="grid gap-5 px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-ae-text">{isOrganizationSide ? "How the agent works" : "How to do it"}</p>
          <ol className="mt-2 space-y-1.5 text-sm leading-6 text-ae-text-muted">
            {kind.steps.map((step, index) => (
              <li key={step.title}>
                <span className="font-medium text-ae-text">{index + 1}. {step.title}.</span> {step.notes}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <p className="text-sm font-semibold text-ae-text">{isOrganizationSide ? "What you should receive" : "What to hand in"}</p>
          <p className="mt-2 text-sm leading-6 text-ae-text-muted">{kind.deliverable}</p>
          <p className="mt-3 text-sm font-semibold text-ae-text">{isOrganizationSide ? "Check for" : "Evidence the buyer checks"}</p>
          <ul className="mt-1.5 space-y-1 text-sm leading-6 text-ae-text-muted">
            {kind.evidence.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      </div>
      {kind.platforms.length && isOrganizationSide ? (
        <div className="border-t border-white/[0.06] px-5 py-4">
          <p className="text-sm font-semibold text-ae-text">If the agent needs access</p>
          <p className="mt-1 text-xs leading-5 text-ae-text-muted">{ACCESS_RULES}</p>
          <div className="mt-2.5 space-y-2">
            {kind.platforms.map((platform) => (
              <details key={platform} className="group rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5">
                <summary className="cursor-pointer list-none text-sm font-medium text-ae-text [&::-webkit-details-marker]:hidden">
                  {platform}
                  <span aria-hidden className="float-right text-ae-text-muted transition group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-ae-text-muted">{accessSteps(platform)}</p>
              </details>
            ))}
          </div>
        </div>
      ) : null}
      {!isOrganizationSide ? (
        <div className="border-t border-white/[0.06] px-5 py-4">
          <p className="text-sm font-semibold text-ae-text">Rules</p>
          <ul className="mt-1.5 space-y-1 text-sm leading-6 text-ae-text-muted">
            {[...PLATFORM_RULES, ...kind.rules].map((rule) => <li key={rule}>• {rule}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
