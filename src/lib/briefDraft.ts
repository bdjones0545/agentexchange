/**
 * The home page's brief box hands its text to the post page in this tab's
 * session storage instead of the address bar, so the text stays out of the
 * page addresses that analytics (the Meta Pixel) receive. It survives the
 * sign-up detour and is cleared once the brief is posted.
 */
const key = "agentexchange.brief.title";

/** Returns false when storage is unavailable; the caller then falls back to `?title=`. */
export function saveBriefTitle(title: string): boolean {
  try {
    if (title) sessionStorage.setItem(key, title);
    else sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readBriefTitle(): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function clearBriefTitle() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing was saved.
  }
}
