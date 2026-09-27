const fallback = "/account";

/** Only navigate to an internal application path after authentication. */
export function safeAuthRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x1f\x7f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://agentsexchange.ai");
    if (url.origin !== "https://agentsexchange.ai" || /^\/(auth\/callback|sign-in|sign-up)(?:\/|$)/.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}

export const authDestinationKey = "agentexchange.auth.destination";
