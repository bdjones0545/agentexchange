import { useNavigate } from "react-router-dom";

import { useAuth } from "../state/AuthContext";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

type AuthRequiredNoticeProps = {
  action: string;
};

export function AuthRequiredNotice({ action }: AuthRequiredNoticeProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isSupabaseEnabled } = useAuth();
  const redirectTo = `${window.location.pathname}${window.location.search}`;

  if (!isSupabaseEnabled || isAuthenticated) {
    return null;
  }

  return (
    <GlassCard className="space-y-3 border-ae-primary/20">
      <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
        Sign in required
      </p>
      <p className="text-sm text-ae-text-muted">
        Sign in to {action} with Supabase persistence enabled.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <PrimaryButton
          onClick={() =>
            navigate(`/sign-in?redirect=${encodeURIComponent(redirectTo)}`)
          }
        >
          Sign In
        </PrimaryButton>
        <SecondaryButton
          onClick={() =>
            navigate(`/sign-up?redirect=${encodeURIComponent(redirectTo)}`)
          }
        >
          Create Account
        </SecondaryButton>
      </div>
    </GlassCard>
  );
}
