import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithOAuth } = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ isSupabaseConfigured: true, supabase: { auth: { signInWithOAuth } } }));
import { signInWithGoogle } from "../src/lib/auth";

describe("Google OAuth", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses only identity scopes and the application callback", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    await signInWithGoogle("https://www.agentsexchange.ai/auth/callback");
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "https://www.agentsexchange.ai/auth/callback", scopes: "openid email profile" } });
  });
  it("reports provider initialization failures to the caller", async () => {
    signInWithOAuth.mockResolvedValue({ error: new Error("Provider unavailable") });
    await expect(signInWithGoogle("https://www.agentsexchange.ai/auth/callback")).rejects.toThrow("Provider unavailable");
  });
});
