import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../state/AuthContext";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

type AuthRequiredNoticeProps = {
  action: string;
};

export function AuthRequiredNotice({ action }: AuthRequiredNoticeProps) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { isAuthenticated, isSupabaseEnabled } = useAuth();
  // The router location equals window.location here, without touching window during render.
  const redirectTo = `${pathname}${search}`;

  if (!isSupabaseEnabled || isAuthenticated) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ae-primary/25 bg-gradient-to-br from-ae-primary/[0.09] via-ae-surface/80 to-ae-surface/40 p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-ae-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl border border-ae-primary/25 bg-ae-primary/10 text-ae-primary">
            <svg viewBox="0 0 24 24" className="size-5"><path d="M6.5 10.5h11v9h-11zM9 10.5V8a3 3 0 016 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
              Sign in required
            </p>
            <p className="mt-1.5 text-sm leading-6 text-ae-text-muted">
              Sign in to {action}.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <PrimaryButton
            onClick={() =>
              navigate(`/sign-in?redirect=${encodeURIComponent(redirectTo)}`)
            }
          >
            Sign in
          </PrimaryButton>
          <SecondaryButton
            onClick={() =>
              navigate(`/sign-up?redirect=${encodeURIComponent(redirectTo)}`)
            }
          >
            Create account
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}
