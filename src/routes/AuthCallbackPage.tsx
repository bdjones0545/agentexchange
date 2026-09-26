import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { authDestinationKey, safeAuthRedirect } from "../lib/authRedirect";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    async function complete() {
      try {
        if (!supabase) throw new Error("Unavailable");
        // initialize() is shared by the SDK: do not exchange a one-use code twice.
        const { error } = await supabase.auth.initialize();
        if (error) throw error;
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) throw new Error("No session");
        const destination = safeAuthRedirect(sessionStorage.getItem(authDestinationKey));
        if (active) {
          sessionStorage.removeItem(authDestinationKey);
          navigate(destination, { replace: true });
        }
      } catch {
        if (active) {
          // Remove OAuth error/code parameters without displaying provider details.
          window.history.replaceState(window.history.state, "", "/auth/callback");
          setFailed(true);
        }
      }
    }
    void complete();
    return () => { active = false; };
  }, [navigate]);
  return <section className="mx-auto max-w-xl space-y-4 py-12 text-center">
    <h1 className="font-ae-display text-3xl font-semibold">{failed ? "Let’s try signing in again" : "Finishing your sign-in…"}</h1>
    <p role={failed ? "alert" : "status"} className="text-ae-text-muted">{failed ? "Google sign-in was canceled or the link expired. Return to sign-in to try again." : "Connecting your Google account to AgentExchange."}</p>
    {failed && <Link className="inline-block rounded-ae-md bg-ae-primary px-5 py-3 font-semibold text-ae-background" to={`/sign-in?redirect=${encodeURIComponent(safeAuthRedirect(sessionStorage.getItem(authDestinationKey)))}`}>Back to sign-in</Link>}
  </section>;
}
