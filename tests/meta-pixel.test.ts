import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  APP_USER_AGENT_MARKER,
  META_PIXEL_ID,
  META_PIXEL_SCRIPT,
  createMetaPixel,
  isNewSignUp,
  isPixelId,
  isPixelPage,
  pixelAllowed,
  refusesTracking,
  urlCarriesBriefText,
  type PixelHost,
  type PrivacySignals,
} from "../src/lib/metaPixel";

const ID = "123456789012345";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,2; iOS 18_1; en_US)";
const FACEBOOK = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0]";
const APP_SHELL = `${SAFARI.replace(" Safari/604.1", "")} ${APP_USER_AGENT_MARKER}/1.0`;

/** A fake browser that records every fbq call and script tag instead of loading Meta's code. */
function fakeHost(options: { signals?: PrivacySignals; href?: string } = {}) {
  const scripts: string[] = [];
  const target: PixelHost["target"] = {};
  let href = options.href ?? "https://www.agentsexchange.ai/";
  const host: PixelHost = {
    target,
    addScript: (src) => { scripts.push(src); },
    signals: () => options.signals ?? { userAgent: SAFARI },
    href: () => href,
  };
  const calls = () => (target.fbq?.queue ?? []).map((args) => Array.from(args as ArrayLike<unknown>));
  return { host, scripts, target, calls, go: (path: string) => { href = new URL(path, "https://www.agentsexchange.ai").href; } };
}

function pixelFor(id: string, options?: Parameters<typeof fakeHost>[0]) {
  const fake = fakeHost(options);
  const pixel = createMetaPixel(id, () => fake.host);
  const visit = (path: string) => { fake.go(path); pixel.pageView(new URL(path, "https://x.test").pathname); };
  return { ...fake, pixel, visit };
}

describe("Meta Pixel switch", () => {
  it("is either off (empty) or a numeric pixel ID, so a typo can't half-enable it", () => {
    expect(META_PIXEL_ID === "" || isPixelId(META_PIXEL_ID)).toBe(true);
  });

  it("treats an empty or malformed ID as off", () => {
    expect(isPixelId("")).toBe(false);
    expect(isPixelId("abc123")).toBe(false);
    expect(isPixelId("1234'); alert(1);//")).toBe(false);
    expect(isPixelId(ID)).toBe(true);
  });

  it("loads nothing and sends nothing without an ID", () => {
    const { pixel, visit, scripts, target } = pixelFor("");
    visit("/");
    visit("/sign-up");
    pixel.completeRegistration();
    pixel.lead();
    expect(scripts).toEqual([]);
    expect(target.fbq).toBeUndefined();
  });

  it("stays off when there is no browser (server rendering)", () => {
    const pixel = createMetaPixel(ID, () => null);
    expect(() => { pixel.pageView("/"); pixel.lead(); pixel.completeRegistration(); }).not.toThrow();
  });
});

describe("where the pixel may run", () => {
  it("never runs inside the AgentExchange iPhone app", () => {
    expect(pixelAllowed(ID, { userAgent: APP_SHELL })).toBe(false);
    const { visit, scripts } = pixelFor(ID, { signals: { userAgent: APP_SHELL } });
    visit("/");
    expect(scripts).toEqual([]);
  });

  it("runs in iPhone Safari and in Meta's own in-app browsers, where ad clicks open", () => {
    for (const userAgent of [SAFARI, INSTAGRAM, FACEBOOK]) expect(pixelAllowed(ID, { userAgent })).toBe(true);
  });

  it("honours Global Privacy Control and Do Not Track", () => {
    expect(refusesTracking({ globalPrivacyControl: true })).toBe(true);
    expect(refusesTracking({ doNotTrack: "1" })).toBe(true);
    expect(refusesTracking({ doNotTrack: "yes" })).toBe(true);
    expect(refusesTracking({ globalPrivacyControl: false, doNotTrack: "0" })).toBe(false);
    expect(refusesTracking({ doNotTrack: "unspecified" })).toBe(false);
    for (const signals of [{ userAgent: SAFARI, globalPrivacyControl: true }, { userAgent: SAFARI, doNotTrack: "1" }]) {
      const { pixel, visit, scripts, target } = pixelFor(ID, { signals });
      visit("/");
      pixel.completeRegistration();
      pixel.lead();
      expect(scripts).toEqual([]);
      expect(target.fbq).toBeUndefined();
    }
  });

  it.each(["/", "/pricing", "/about", "/contact", "/for-agents", "/marketplace", "/marketplace/0b7c1c9e-brief", "/agents", "/agents/a-1", "/agent/a-1", "/sign-up", "/pricing/"])("sends page views on public page %s", (path) => {
    expect(isPixelPage(path)).toBe(true);
  });

  it.each([
    "/account", "/wallet", "/settings", "/contracts", "/contracts/c-1", "/applications", "/hub", "/saved",
    "/organizations", "/organization/o-1", "/organization-dashboard", "/post-opportunity", "/create-agent",
    "/owner/revenue", "/owner/moderation", "/sign-in", "/auth/callback", "/forgot-password", "/reset-password",
    "/terms", "/privacy", "/refunds", "/acceptable-use", "/missing", "/marketplace/a/b", "/agents/a/edit",
  ])("sends no page view on %s", (path) => {
    expect(isPixelPage(path)).toBe(false);
  });

  it("covers every private title in the page metadata", () => {
    const source = readFileSync(new URL("../src/content/metadata.ts", import.meta.url), "utf8");
    const privatePaths = [...source.match(/const privateTitles[^\n]*/)![0].matchAll(/'(\/[^']*)':/g)].map((m) => m[1]);
    expect(privatePaths.length).toBeGreaterThan(10);
    // /sign-up is the one listed private title that is meant to count visits from ads.
    for (const path of privatePaths) expect(isPixelPage(path)).toBe(path === "/sign-up");
  });
});

describe("page views", () => {
  it("loads Meta's script once, in manual-only mode, and tracks each public route change", () => {
    const { visit, scripts, target, calls } = pixelFor(ID);
    visit("/?utm_source=meta&utm_medium=paid_social&utm_campaign=nexthire_30s_1x1");
    visit("/");
    visit("/pricing");
    visit("/account");
    visit("/wallet");
    visit("/");
    expect(scripts).toEqual([META_PIXEL_SCRIPT]);
    expect(target.fbq?.disablePushState).toBe(true);
    expect(target.fbq?.allowDuplicatePageViews).toBe(true);
    expect(calls()).toEqual([
      ["set", "autoConfig", false, ID],
      ["init", ID],
      ["track", "PageView"],
      ["track", "PageView"],
      ["track", "PageView"],
    ]);
  });

  it("does not load the pixel for a visit that starts on a signed-in page", () => {
    const { visit, scripts, target } = pixelFor(ID);
    visit("/account");
    visit("/contracts/c-1");
    expect(scripts).toEqual([]);
    expect(target.fbq).toBeUndefined();
  });

  it("sends nothing while the address holds a brief title", () => {
    expect(urlCarriesBriefText("https://www.agentsexchange.ai/post-opportunity?title=Clean%20my%20CRM")).toBe(true);
    expect(urlCarriesBriefText("https://www.agentsexchange.ai/sign-up?redirect=%2Fpost-opportunity%3Ftitle%3DClean%2520my%2520CRM")).toBe(true);
    expect(urlCarriesBriefText("https://www.agentsexchange.ai/sign-up?redirect=%2Fpost-opportunity")).toBe(false);
    expect(urlCarriesBriefText("https://www.agentsexchange.ai/?utm_source=meta")).toBe(false);
    const { pixel, visit, scripts } = pixelFor(ID);
    visit("/sign-up?redirect=%2Fpost-opportunity%3Ftitle%3DClean%2520my%2520CRM");
    pixel.completeRegistration();
    expect(scripts).toEqual([]);
  });
});

describe("conversions", () => {
  it("sends CompleteRegistration and Lead as bare event names", () => {
    const { pixel, visit, calls } = pixelFor(ID);
    visit("/sign-up");
    pixel.completeRegistration();
    expect(calls().slice(2)).toEqual([["track", "PageView"], ["track", "CompleteRegistration"]]);
  });

  it("loads the pixel for Lead on the private post page without a page view there", () => {
    const { pixel, visit, go, scripts, calls } = pixelFor(ID);
    visit("/post-opportunity");
    go("/marketplace");
    pixel.lead();
    expect(scripts).toEqual([META_PIXEL_SCRIPT]);
    expect(calls()).toEqual([["set", "autoConfig", false, ID], ["init", ID], ["track", "Lead"]]);
  });

  it("never sends personal data or brief details", () => {
    const { pixel, visit, go, calls } = pixelFor(ID);
    visit("/");
    visit("/sign-up?redirect=%2Fpost-opportunity");
    pixel.completeRegistration();
    visit("/post-opportunity");
    go("/marketplace");
    pixel.lead();
    const allowed = new Set(["set", "autoConfig", false, "init", "track", ID, "PageView", "CompleteRegistration", "Lead"]);
    for (const call of calls()) {
      expect(call.length).toBeLessThanOrEqual(4);
      for (const value of call) expect(allowed.has(value as string)).toBe(true);
    }
    expect(JSON.stringify(calls())).not.toMatch(/@|\$|title|budget|email/i);
  });

  it("counts only sign-ups that created an account", () => {
    expect(isNewSignUp({ identities: [{ provider: "email" }] })).toBe(true);
    // Supabase's stand-in for an address that already has an account.
    expect(isNewSignUp({ identities: [] })).toBe(false);
    expect(isNewSignUp({ identities: null })).toBe(false);
    expect(isNewSignUp({})).toBe(false);
    expect(isNewSignUp(null)).toBe(false);
  });
});
