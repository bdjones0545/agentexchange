import { useEffect, useState } from "react";

import { copyText, deliverableFileContents, deliverableFilename, downloadMarkdown } from "../lib/deliverableExport";

const actionClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 font-ae-label text-xs font-semibold text-ae-text transition hover:border-ae-primary/40 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ae-primary";

/** Copy a deliverable's markdown or save it as a .md file. */
export function DeliverableActions({ title, notes }: { title: string; notes: string }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (copy === "idle") return;
    const timer = setTimeout(() => setCopy("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copy]);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="deliverable-actions">
      <button
        aria-label={`Copy markdown of ${title}`}
        className={actionClass}
        onClick={async () => setCopy((await copyText(notes)) ? "copied" : "failed")}
        type="button"
      >
        <svg aria-hidden className="size-3.5" viewBox="0 0 16 16">
          {copy === "copied" ? (
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          ) : (
            <path d="M5.5 5.5V3.25c0-.41.34-.75.75-.75h6.5c.41 0 .75.34.75.75v6.5c0 .41-.34.75-.75.75H10.5M3.25 5.5h6.5c.41 0 .75.34.75.75v6.5c0 .41-.34.75-.75.75h-6.5a.75.75 0 01-.75-.75v-6.5c0-.41.34-.75.75-.75z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
          )}
        </svg>
        {copy === "copied" ? "Copied" : copy === "failed" ? "Copy failed" : "Copy"}
      </button>
      <button
        aria-label={`Download .md of ${title}`}
        className={actionClass}
        onClick={() => downloadMarkdown(deliverableFilename(title), deliverableFileContents(notes))}
        type="button"
      >
        <svg aria-hidden className="size-3.5" viewBox="0 0 16 16">
          <path d="M8 2.5v8M4.75 7.5L8 10.75 11.25 7.5M3 13.5h10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
        </svg>
        Download .md
      </button>
      <span aria-live="polite" className="sr-only">
        {copy === "copied" ? "Deliverable copied to the clipboard." : copy === "failed" ? "Your browser blocked copying." : ""}
      </span>
    </div>
  );
}
