/**
 * Meta (Facebook) Pixel for measuring the public site's Meta ads: visits,
 * email sign-ups and briefs posted.
 *
 * Off until META_PIXEL_ID holds the numeric pixel ID from Meta Events Manager.
 * With an empty (or non-numeric) ID nothing loads and nothing is sent, and the
 * privacy policy leaves out its advertising section. Keep Automatic Advanced
 * Matching off for this pixel in Events Manager: the pixel loads on the sign-up
 * form, and the privacy policy says Meta gets no email or name from us.
 *
 * Every event is a bare standard event name. No parameters are ever attached.
 */
export const META_PIXEL_ID = "";

export const META_PIXEL_SCRIPT = "https://connect.facebook.net/en_US/fbevents.js";

/**
 * User-agent token that marks the AgentExchange iPhone app. Apple's App
 * Tracking Transparency rules forbid tracking inside the app without its
 * prompt, so the pixel never runs where this token appears. The current app is
 * native SwiftUI and never renders these pages; a web view build must append
 * this token (WKWebView `applicationNameForUserAgent`) to stay covered.
 */
export const APP_USER_AGENT_MARKER = "AgentExchangeApp";

export type PixelEvent = "PageView" | "CompleteRegistration" | "Lead";

export type PrivacySignals = {
  userAgent?: string;
  globalPrivacyControl?: unknown;
  doNotTrack?: unknown;
};

/** Public pages that send a PageView. Signed-in, auth and legal pages are left out. */
const PIXEL_PAGES = [
  /^\/$/,
  /^\/(pricing|about|contact|for-agents|sign-up)$/,
  /^\/marketplace(\/[^/]+)?$/,
  /^\/agents(\/[^/]+)?$/,
  /^\/agent\/[^/]+$/,
];

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isPixelId(id: string): boolean {
  return /^\d{5,20}$/.test(id);
}

export function isPixelPage(pathname: string): boolean {
  const path = normalizePath(pathname);
  return PIXEL_PAGES.some((page) => page.test(path));
}

export function isAppUserAgent(userAgent = ""): boolean {
  return userAgent.includes(APP_USER_AGENT_MARKER);
}

/** Global Privacy Control, or the older Do Not Track header's value in the browser. */
export function refusesTracking(signals: PrivacySignals): boolean {
  return signals.globalPrivacyControl === true || signals.doNotTrack === "1" || signals.doNotTrack === "yes";
}

export function pixelAllowed(id: string, signals: PrivacySignals): boolean {
  return isPixelId(id) && !isAppUserAgent(signals.userAgent) && !refusesTracking(signals);
}

/**
 * Meta receives the page address with every event. A brief title can sit in
 * the post page's `?title=` and, through it, in the sign-up link's `redirect`,
 * so nothing is sent while the address holds one.
 */
export function urlCarriesBriefText(href: string): boolean {
  try {
    const url = new URL(href, "https://www.agentsexchange.ai");
    if (url.searchParams.has("title")) return true;
    const redirect = url.searchParams.get("redirect");
    return redirect !== null && new URL(redirect, url.origin).searchParams.has("title");
  } catch {
    return true;
  }
}

/**
 * Whether supabase.auth.signUp created an account. With email confirmation on,
 * signing up with an address that already has an account returns a stand-in
 * user with no identities instead of an error; that is not a registration.
 */
export function isNewSignUp(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length > 0);
}

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
  allowDuplicatePageViews?: boolean;
};

export type PixelHost = {
  /** Where the base code keeps `fbq`: the browser window. */
  target: { fbq?: Fbq; _fbq?: Fbq };
  addScript(src: string): void;
  signals(): PrivacySignals;
  href(): string;
};

/** Meta's standard base code, written out so it runs only when allowed. */
function installBaseCode(host: PixelHost): Fbq {
  const w = host.target;
  if (w.fbq) return w.fbq;
  const n = function () {
    if (n.callMethod) n.callMethod.apply(n, arguments as unknown as unknown[]);
    else n.queue.push(arguments);
  } as unknown as Fbq;
  if (!w._fbq) w._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  // Page views are sent by hand on public routes only. Without this the pixel
  // sends one on every history change, signed-in pages included.
  n.disablePushState = true;
  // Without this fbevents.js sends only the first PageView of a page load and
  // silently drops the rest, so SPA route changes would go uncounted.
  // createMetaPixel already skips repeats of the same path.
  n.allowDuplicatePageViews = true;
  w.fbq = n;
  host.addScript(META_PIXEL_SCRIPT);
  return n;
}

export function createMetaPixel(id: string, host: () => PixelHost | null) {
  let fbq: Fbq | null = null;
  let lastPath: string | null = null;

  function ready(h: PixelHost): Fbq | null {
    if (!pixelAllowed(id, h.signals())) return null;
    if (!fbq) {
      fbq = installBaseCode(h);
      // Manual-only mode: no button-click or page-metadata collection.
      fbq("set", "autoConfig", false, id);
      fbq("init", id);
    }
    return fbq;
  }

  function send(event: PixelEvent) {
    const h = host();
    if (!h || urlCarriesBriefText(h.href())) return;
    ready(h)?.("track", event);
  }

  return {
    /** Call on every route change; sends a PageView when the path changed to a public page. */
    pageView(pathname: string) {
      const path = normalizePath(pathname);
      const previous = lastPath;
      lastPath = path;
      if (path !== previous && isPixelPage(path)) send("PageView");
    },
    /** After an email sign-up created a new account. */
    completeRegistration() {
      send("CompleteRegistration");
    },
    /** After a brief was saved to the marketplace. */
    lead() {
      send("Lead");
    },
  };
}

function browserHost(): PixelHost | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const nav = window.navigator as Navigator & { globalPrivacyControl?: unknown };
  return {
    target: window as unknown as PixelHost["target"],
    addScript(src) {
      const script = document.createElement("script");
      script.async = true;
      script.src = src;
      document.head.appendChild(script);
    },
    signals: () => ({
      userAgent: nav.userAgent,
      globalPrivacyControl: nav.globalPrivacyControl,
      doNotTrack: nav.doNotTrack ?? (window as unknown as { doNotTrack?: unknown }).doNotTrack,
    }),
    href: () => window.location.href,
  };
}

export const metaPixel = createMetaPixel(META_PIXEL_ID, browserHost);
