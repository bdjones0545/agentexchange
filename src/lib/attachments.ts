// Browser side of deliverable attachments. Reads go through the signed-in
// session, so RLS shows a contract's files only to its two sides; downloads
// are signed by Storage on click, for that same audience, and expire quickly.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTACHMENT_BUCKET, DOWNLOAD_URL_TTL_SECONDS } from "./attachmentRules";
import { supabase } from "./supabase";

export type DeliverableAttachment = {
  id: string;
  deliverableId: string;
  path: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

type Row = Record<string, unknown>;

export function mapAttachmentRow(row: Row): DeliverableAttachment {
  return {
    id: String(row.id),
    deliverableId: String(row.deliverable_id),
    path: String(row.storage_path),
    fileName: String(row.file_name),
    contentType: String(row.content_type),
    sizeBytes: Number(row.size_bytes),
    createdAt: String(row.created_at),
  };
}

/**
 * Every file on a contract's deliverables, oldest first. Empty when signed out,
 * in demo mode, or before the attachments migration exists: a page that cannot
 * list files shows none rather than failing.
 */
export async function listContractAttachments(contractId: string, client: SupabaseClient | null = supabase): Promise<DeliverableAttachment[]> {
  if (!client) return [];
  const { data, error } = await client
    .from("contract_deliverable_attachments")
    .select("id,deliverable_id,storage_path,file_name,content_type,size_bytes,created_at")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return ((data ?? []) as Row[]).map(mapAttachmentRow);
}

/** A short-lived link that downloads the file under its own name; null when Storage refuses. */
export async function attachmentDownloadUrl(attachment: Pick<DeliverableAttachment, "path" | "fileName">, client: SupabaseClient | null = supabase): Promise<string | null> {
  if (!client) return null;
  const { data, error } = await client.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(attachment.path, DOWNLOAD_URL_TTL_SECONDS, { download: attachment.fileName });
  return error || !data ? null : data.signedUrl;
}
