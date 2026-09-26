import { describe, expect, it } from "vitest";
import { safeAuthRedirect } from "../src/lib/authRedirect";

describe("authentication return paths", () => {
  it("preserves agent setup and internal deep links", () => {
    expect(safeAuthRedirect("/account?agentSetup=key-id")).toBe("/account?agentSetup=key-id");
    expect(safeAuthRedirect("/contracts/123#payment")).toBe("/contracts/123#payment");
  });
  it.each([null, "", "https://evil.test", "//evil.test", "/\\evil.test", "/\n/evil.test", "javascript:alert(1)", "/auth/callback", "/sign-in", "/sign-up?redirect=/sign-in", "/a/../auth/callback"])("rejects unsafe or looping destination %s", value => {
    expect(safeAuthRedirect(value)).toBe("/account");
  });
});
