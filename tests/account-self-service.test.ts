import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sb = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn(), updateUser: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ isSupabaseConfigured: true, supabase: { auth: sb } }));
const auth = vi.hoisted(() => ({ user: null as unknown, isSupabaseEnabled: true, isAuthenticated: true }));
vi.mock("../src/state/AuthContext", () => ({ useAuth: () => auth }));

import { hasPasswordSignIn, requestEmailChange, requestPasswordReset } from "../src/lib/auth";
import { downloadName } from "../src/lib/accountApi";
import { emailChangeProblem, readEmailChangeReturn, SignInSettings, YourData } from "../src/components/AccountSelfService";
import { ForgotPasswordPage } from "../src/routes/ForgotPasswordPage";
import { passwordProblem, readRecoveryLink } from "../src/routes/ResetPasswordPage";
import { SignInPage } from "../src/routes/SignInPage";

const passwordUser = { id: "u1", email: "me@example.com", identities: [{ provider: "email" }], app_metadata: { provider: "email", providers: ["email"] } } as unknown as User;
const googleUser = { id: "u2", email: "g@example.com", identities: [{ provider: "google" }], app_metadata: { provider: "google", providers: ["google"] } } as unknown as User;
const render = (node: Parameters<typeof createElement>[0], props: Record<string, unknown> | null = null) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(node, props)));

describe("forgot password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks Supabase for a reset link that returns to /reset-password", async () => {
    sb.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    await requestPasswordReset("me@example.com", "https://www.agentsexchange.ai/reset-password");
    expect(sb.resetPasswordForEmail).toHaveBeenCalledWith("me@example.com", { redirectTo: "https://www.agentsexchange.ai/reset-password" });
  });

  it("surfaces Supabase's refusal, such as the resend rate limit", async () => {
    sb.resetPasswordForEmail.mockResolvedValue({ data: null, error: new Error("For security purposes, you can only request this after 40 seconds.") });
    await expect(requestPasswordReset("me@example.com", "https://x.test/reset-password")).rejects.toThrow("40 seconds");
  });

  it("is linked from sign-in without putting the email in the URL", () => {
    const html = render(SignInPage);
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain("Forgot password?");
  });

  it("renders the request form", () => {
    auth.user = null;
    const html = render(ForgotPasswordPage);
    expect(html).toContain("Send reset link");
    expect(html).toContain('href="/sign-in"');
  });

  it.each([
    ["?code=abc", "", { failed: false, hasCode: true, tokenHash: null }],
    ["?token_hash=th&type=recovery", "", { failed: false, hasCode: false, tokenHash: "th" }],
    ["?token_hash=th&type=signup", "", { failed: false, hasCode: false, tokenHash: null }],
    ["", "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid", { failed: true, hasCode: false, tokenHash: null }],
    ["?error_description=expired", "", { failed: true, hasCode: false, tokenHash: null }],
    ["", "", { failed: false, hasCode: false, tokenHash: null }],
  ])("reads the reset link %s%s", (search, hash, expected) => {
    expect(readRecoveryLink(search, hash)).toEqual(expected);
  });

  it("checks the new password before sending it", () => {
    expect(passwordProblem("short", "short")).toMatch(/at least 8/);
    expect(passwordProblem("long enough 1", "long enough 2")).toMatch(/match/);
    expect(passwordProblem("long enough 1", "long enough 1")).toBeNull();
  });
});

describe("change email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts the change with a confirmation link back to the account page", async () => {
    sb.updateUser.mockResolvedValue({ data: { user: { ...passwordUser, new_email: "new@example.com" } }, error: null });
    const user = await requestEmailChange("new@example.com", "https://www.agentsexchange.ai/account");
    expect(sb.updateUser).toHaveBeenCalledWith({ email: "new@example.com" }, { emailRedirectTo: "https://www.agentsexchange.ai/account" });
    expect(user.new_email).toBe("new@example.com");
  });

  it("rejects the current or an invalid address", () => {
    expect(emailChangeProblem("ME@example.com", "me@example.com")).toMatch(/already/);
    expect(emailChangeProblem("not-an-email", "me@example.com")).toMatch(/valid/);
    expect(emailChangeProblem("new@example.com", "me@example.com")).toBeNull();
  });

  it("knows which accounts have a password sign-in", () => {
    expect(hasPasswordSignIn(passwordUser)).toBe(true);
    expect(hasPasswordSignIn(googleUser)).toBe(false);
    expect(hasPasswordSignIn({ ...googleUser, identities: [{ provider: "google" }, { provider: "email" }] } as unknown as User)).toBe(true);
    expect(hasPasswordSignIn(null)).toBe(false);
  });

  it("maps a confirmation return to fixed copy, never the provider's text", () => {
    expect(readEmailChangeReturn("", "#message=Confirmation+link+accepted")).toBe("confirmed");
    expect(readEmailChangeReturn("?message=anything", "")).toBe("confirmed");
    expect(readEmailChangeReturn("", "#error=access_denied&error_description=Call+this+number")).toBe("failed");
    expect(readEmailChangeReturn("", "#sign-in")).toBeNull();
  });

  it("shows the form for a password account and the pending address while it waits", () => {
    auth.user = { ...passwordUser, new_email: "next@example.com" };
    const html = render(SignInSettings);
    expect(html).toContain("Change email");
    expect(html).toContain("Waiting for you to confirm");
    expect(html).toContain("next@example.com");
    expect(html).toContain('href="/forgot-password"');
  });

  it("explains that a Google account's email comes from Google", () => {
    auth.user = googleUser;
    const html = render(SignInSettings);
    expect(html).not.toContain(">Change email<");
    expect(html).toContain("You sign in with Google");
    expect(html).toContain('href="mailto:support@agentsexchange.ai"');
  });
});

describe("your data", () => {
  it("offers the download and a guarded delete", () => {
    const html = render(YourData, { user: passwordUser });
    expect(html).toContain("Download my data");
    expect(html).toContain("Delete account…");
    expect(html).toContain("a person on our team reviews the request before anything is deleted");
    expect(html).not.toMatch(/within \d+ days/);
    expect(html).not.toContain("Delete my account");
  });

  it("names the download from the server, falling back to a dated name", () => {
    expect(downloadName('attachment; filename="agentexchange-data-2026-11-26.json"')).toBe("agentexchange-data-2026-11-26.json");
    expect(downloadName('attachment; filename="../../evil.sh"', new Date("2026-11-26T00:00:00Z"))).toBe("agentexchange-data-2026-11-26.json");
    expect(downloadName(null, new Date("2026-11-26T00:00:00Z"))).toBe("agentexchange-data-2026-11-26.json");
  });
});
