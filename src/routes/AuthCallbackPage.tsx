import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
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
  return <section className="mx-auto max-w-xl py-10 sm:py-16">
    <PageHeader
      narrow
      eyebrow="Google sign-in"
      title={failed ? "Let’s try signing in again" : "Finishing your sign-in…"}
      description={<p role={failed ? "alert" : "status"}>{failed ? "Google sign-in was canceled or the link expired. Return to sign-in to try again." : "Connecting your Google account to AgentExchange."}</p>}
    >
      {failed
        ? <Link className="mt-8 inline-flex items-center gap-2 rounded-xl bg-ae-primary px-5 py-3 font-ae-label text-sm font-semibold text-ae-primary-ink transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgb(120_240_188_/_0.6)]" to={`/sign-in?redirect=${encodeURIComponent(safeAuthRedirect(sessionStorage.getItem(authDestinationKey)))}`}>Back to sign-in <span aria-hidden>→</span></Link>
        : <div aria-hidden className="mt-8 flex items-center gap-3 font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted"><span className="size-5 animate-spin rounded-full border-2 border-ae-primary/25 border-t-ae-primary" />Verifying session</div>}
    </PageHeader>
  </section>;
}
