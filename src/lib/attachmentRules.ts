// Deliverable file attachments: the limits and path rules shared by the MCP
// server, the browser and the database.
//
// The database is the authority. The same numbers, types and path pattern are
// written into supabase/migrations/20261015120000_deliverable_attachments.sql
// (bucket limits, storage policies and the attachment trigger), and
// tests/deliverable-attachments.test.ts fails if the two drift apart. The copies
// here exist so a worker gets a clear refusal before it uploads anything.

/** The private Storage bucket. Only a contract's two sides can read its files. */
export const ATTACHMENT_BUCKET = "deliverable-attachments";

/** Per-file cap, also the bucket's file_size_limit. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Files one deliverable can carry. */
export const MAX_ATTACHMENTS_PER_DELIVERABLE = 10;

/** Uploads one contract can hold in storage, attached or not (bounds abandoned uploads). */
export const MAX_UPLOADS_PER_CONTRACT = 100;

/** Download links are minted on click and expire quickly. */
export const DOWNLOAD_URL_TTL_SECONDS = 60;

/** Fixed by Supabase Storage for createSignedUploadUrl. */
export const UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

/**
 * Allowed content types and the file extensions each may carry; the first is
 * used when a name's extension does not match its type. No HTML, SVG, scripts
 * or executables: nothing a browser would run if the file were opened inline.
 */
export const ATTACHMENT_TYPES: Readonly<Record<string, readonly string[]>> = {
  "application/pdf": ["pdf"],
  "text/csv": ["csv"],
  "text/plain": ["txt", "log"],
  "text/markdown": ["md", "markdown"],
  "application/json": ["json"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.oasis.opendocument.spreadsheet": ["ods"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "application/zip": ["zip"],
  "application/gzip": ["gz", "tgz"],
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** The stored file name: starts alphanumeric, then [A-Za-z0-9._-], at most 120 characters, never "..". */
export const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const MAX_NAME = 120;
/** {contractId}/{uploadId}/{fileName}; uploadId is minted by the server per upload. */
const PATH = new RegExp(`^(${UUID})/(${UUID})/([^/]+)$`);

/** "text/csv; charset=utf-8" → "text/csv". */
export function normalizeContentType(value: string): string {
  return value.split(";")[0].trim().toLowerCase();
}

export function isAllowedContentType(value: string): boolean {
  return Object.hasOwn(ATTACHMENT_TYPES, normalizeContentType(value));
}

/**
 * A name that is safe as a storage key and in a Content-Disposition header:
 * no directories, no traversal, no hidden files, ASCII only, and an extension
 * that matches the declared content type.
 */
export function sanitizeFileName(raw: string, contentType: string): string {
  const exts = ATTACHMENT_TYPES[normalizeContentType(contentType)];
  if (!exts) throw new Error(`content type not allowed: ${contentType}`);
  const trim = (s: string) => s.replace(/^[._-]+/, "").replace(/[._-]+$/, "");
  const base = (raw.split(/[\\/]/).pop() ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const dot = base.lastIndexOf(".");
  const given = dot >= 0 ? base.slice(dot + 1).trim().toLowerCase() : "";
  const matches = exts.includes(given);
  const ext = matches ? given : exts[0];
  // A mismatched extension stays visible in the stem but no longer decides the type.
  const stemSource = matches ? base.slice(0, dot) : base.replace(/\./g, "-");
  const cleaned = trim(stemSource.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/\.{2,}/g, ".").replace(/-{2,}/g, "-"));
  const stem = trim(cleaned.slice(0, MAX_NAME - ext.length - 1)) || "file";
  return `${stem}.${ext}`;
}

export function attachmentPath(contractId: string, uploadId: string, fileName: string): string {
  return `${contractId.toLowerCase()}/${uploadId.toLowerCase()}/${fileName}`;
}

/** The parts of a storage path, or null when it is not a well-formed attachment path. */
export function parseAttachmentPath(path: string): { contractId: string; uploadId: string; fileName: string } | null {
  const m = PATH.exec(path);
  if (!m || !SAFE_FILE_NAME.test(m[3]) || m[3].includes("..")) return null;
  return { contractId: m[1], uploadId: m[2], fileName: m[3] };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
