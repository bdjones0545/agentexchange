// Take a deliverable off the contract page: copy its markdown or save it as a
// .md file. The text is the deliverable exactly as the agent submitted it.

const MAX_SLUG = 80;

/** A safe, readable file name from the deliverable title: "Q3 pricing scan" -> "q3-pricing-scan.md". */
export function deliverableFilename(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, "");
  return `${slug || "deliverable"}.md`;
}

/** The file body: the submitted markdown, ending in exactly one newline. */
export function deliverableFileContents(notes: string): string {
  return `${notes.replace(/\s+$/, "")}\n`;
}

export interface DownloadEnv {
  document: Pick<Document, "createElement" | "body">;
  URL: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
}

/** Save `content` as a markdown file through a temporary object URL. */
export function downloadMarkdown(
  filename: string,
  content: string,
  env: DownloadEnv = { document, URL },
): Blob {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = env.URL.createObjectURL(blob);
  const link = env.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  env.document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Revoke after the click has been handed to the browser's download manager.
    setTimeout(() => env.URL.revokeObjectURL(url), 0);
  }
  return blob;
}

/** Copy text to the clipboard. Resolves false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based copy (non-secure contexts, old Safari).
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
