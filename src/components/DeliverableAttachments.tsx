import { useState } from "react";
import { formatBytes } from "../lib/attachmentRules";
import { attachmentDownloadUrl, type DeliverableAttachment } from "../lib/attachments";

function typeLabel(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toUpperCase() : "File";
}

/**
 * The files an agent delivered with a deliverable. Each download link is signed
 * on click and expires within a minute, so nothing durable is ever in the page.
 */
export function DeliverableAttachments({
  attachments,
  getDownloadUrl = attachmentDownloadUrl,
}: {
  attachments: DeliverableAttachment[];
  getDownloadUrl?: (attachment: DeliverableAttachment) => Promise<string | null>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  async function download(attachment: DeliverableAttachment) {
    setPending(attachment.id);
    setFailed(null);
    const url = await getDownloadUrl(attachment).catch(() => null);
    setPending(null);
    if (url) {
      window.location.assign(url);
    } else {
      setFailed(attachment.fileName);
    }
  }

  return (
    <div className="mt-4" data-testid="deliverable-attachments">
      <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
        {attachments.length === 1 ? "1 file" : `${attachments.length} files`}
      </p>
      <ul className="mt-2 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08] bg-ae-background-deep/40">
        {attachments.map((attachment) => (
          <li className="flex items-center gap-3 px-3 py-2.5 sm:px-4" key={attachment.id}>
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] font-ae-label text-[9px] font-semibold tracking-[0.04em] text-ae-text-muted">
              {typeLabel(attachment.fileName).slice(0, 4)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ae-text" title={attachment.fileName}>
                {attachment.fileName}
              </p>
              <p className="text-xs tabular-nums text-ae-text-muted">
                {typeLabel(attachment.fileName)} · {formatBytes(attachment.sizeBytes)}
              </p>
            </div>
            <button
              aria-label={`Download ${attachment.fileName}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] p-2 font-ae-label sm:px-3 sm:py-1.5 text-xs font-semibold text-ae-text transition enabled:hover:border-ae-primary/40 enabled:hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ae-primary disabled:cursor-wait disabled:opacity-60"
              disabled={pending === attachment.id}
              onClick={() => void download(attachment)}
              type="button"
            >
              <svg aria-hidden className="size-3.5" viewBox="0 0 16 16">
                <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
              </svg>
              {/* Icon-only on phones so the file name keeps the width; the aria-label names it. */}
              <span className="hidden sm:inline">{pending === attachment.id ? "Preparing" : "Download"}</span>
            </button>
          </li>
        ))}
      </ul>
      {failed ? (
        <p className="mt-2 text-xs leading-5 text-ae-amber" role="alert">
          Couldn't create a download link for {failed}. Try again.
        </p>
      ) : null}
    </div>
  );
}
