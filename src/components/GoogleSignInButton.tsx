import { useState } from "react";
import { signInWithGoogle } from "../lib/auth";
import { authDestinationKey, safeAuthRedirect } from "../lib/authRedirect";

export function GoogleSignInButton({ redirectTo, disabled = false }: { redirectTo: string; disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      sessionStorage.setItem(authDestinationKey, safeAuthRedirect(redirectTo));
      await signInWithGoogle(new URL("/auth/callback", window.location.origin).href);
    } catch {
      setError("Google sign-in could not start. Please try again or use email.");
      setPending(false);
    }
  }
  return <div className="mb-6 space-y-5">
    <button type="button" onClick={handleClick} disabled={disabled || pending}
      className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white px-4 py-3 font-ae-label text-sm font-semibold text-slate-800 shadow-[0_10px_30px_-18px_rgb(255_255_255_/_0.5)] transition duration-200 enabled:hover:-translate-y-0.5 enabled:hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ae-primary disabled:cursor-wait disabled:opacity-60">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.51l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>
      {pending ? "Connecting to Google…" : "Continue with Google"}
    </button>
    {error && <p role="alert" className="rounded-xl border border-ae-error/25 bg-ae-error/10 px-3.5 py-2.5 text-sm text-ae-error">{error}</p>}
    <div className="flex items-center gap-3 font-ae-label text-xs uppercase tracking-[0.12em] text-ae-text-muted"><span className="h-px flex-1 bg-white/10"/>or continue with email<span className="h-px flex-1 bg-white/10"/></div>
  </div>;
}
