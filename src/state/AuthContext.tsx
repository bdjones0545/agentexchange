import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import {
  type AccountType,
  getCurrentUser,
  onAuthStateChange,
  signInWithEmail,
  signOut as signOutWithSupabase,
  signUpWithEmail,
} from "../lib/auth";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type AuthContextValue = {
  error: string | null;
  isAuthenticated: boolean;
  isSupabaseEnabled: boolean;
  loading: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    accountType: AccountType,
  ) => Promise<void>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) {
          return;
        }

        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (isMounted) {
          setError("Unable to load auth session.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    getCurrentUser().then((currentUser) => {
      if (isMounted) {
        setUser(currentUser);
      }
    });

    const subscription = onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const data = await signInWithEmail(email, password);
    setSession(data.session);
    setUser(data.user);
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      accountType: AccountType,
    ) => {
      setError(null);
      const data = await signUpWithEmail(
        email,
        password,
        displayName,
        accountType,
      );
      setSession(data.session);
      setUser(data.user);
    },
    [],
  );

  const signOut = useCallback(async () => {
    setError(null);
    await signOutWithSupabase();
    setSession(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      error,
      isAuthenticated: Boolean(user),
      isSupabaseEnabled: isSupabaseConfigured,
      loading,
      session,
      signIn,
      signOut,
      signUp,
      user,
    }),
    [error, loading, session, signIn, signOut, signUp, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
