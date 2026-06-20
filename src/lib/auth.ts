import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

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
