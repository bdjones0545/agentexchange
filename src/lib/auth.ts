import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

import { isNewSignUp, metaPixel } from "./metaPixel";
import { isSupabaseConfigured, supabase } from "./supabase";

export type AccountType =
  | "Agent Operator"
  | "Marketplace Admin"
  | "Organization";

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  accountType: AccountType,
) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        account_type: accountType,
        display_name: displayName,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data.user) {
    await supabase.from("profiles").upsert({
      account_type: accountType,
      display_name: displayName,
      email: data.user.email,
      user_id: data.user.id,
    });
  }

  // Meta ad measurement: the event name only, never the email or name.
  if (isNewSignUp(data.user)) metaPixel.completeRegistration();

  return data;
}

export async function signInWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      unsubscribe: () => undefined,
    };
  }

  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription;
}

/** Supabase completes the PKCE exchange when the browser returns to the callback. */
export async function signInWithGoogle(redirectTo: string) {
  if (!supabase) throw new Error("Sign-in is temporarily unavailable.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, scopes: "openid email profile" },
  });
  if (error) throw error;
}

/**
 * Emails a password reset link. Supabase answers the same way whether or not
 * the address has an account, so the page must not say which it was. With the
 * PKCE flow the link only works in the browser that asked for it.
 */
export async function requestPasswordReset(email: string, redirectTo: string) {
  if (!supabase) throw new Error("Password reset is unavailable right now.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

/** Sets a new password for the signed-in (or just-recovered) session. */
export async function updatePassword(password: string) {
  if (!supabase) throw new Error("Password reset is unavailable right now.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/**
 * Starts an email change. Supabase emails a confirmation link (to both the old
 * and the new address when secure email change is on); the sign-in email only
 * changes once that is confirmed. Until then the user carries `new_email`.
 */
export async function requestEmailChange(email: string, redirectTo: string): Promise<User> {
  if (!supabase) throw new Error("Email changes are unavailable right now.");
  const { data, error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: redirectTo });
  if (error) throw error;
  return data.user;
}

/** Whether the account has an email-and-password sign-in (Google-only accounts take their email from Google). */
export function hasPasswordSignIn(user: User | null): boolean {
  if (!user) return false;
  if ((user.identities ?? []).some((identity) => identity.provider === "email")) return true;
  const providers: unknown = user.app_metadata?.providers;
  if (Array.isArray(providers)) return providers.includes("email");
  return user.app_metadata?.provider === "email";
}

/** Keeps the profile's copy of the email in step after a confirmed change. Writes nothing when it already matches. */
export async function syncProfileEmail(userId: string, email: string) {
  if (!supabase) return;
  await supabase.from("profiles").update({ email }).eq("user_id", userId).neq("email", email);
}
