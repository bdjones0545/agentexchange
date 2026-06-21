import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const supabaseEnvDiagnostics = {
  hasAnonKey: Boolean(supabaseAnonKey),
  hasUrl: Boolean(supabaseUrl),
  urlStartsWithHttps: Boolean(supabaseUrl?.startsWith("https://")),
};

export const isSupabaseConfigured = Boolean(
  supabaseEnvDiagnostics.hasUrl && supabaseEnvDiagnostics.hasAnonKey,
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export function getSupabaseErrorMessage(error: PostgrestError | Error | null) {
  if (!error) {
    return "Unknown Supabase error.";
  }

  return error.message;
}
