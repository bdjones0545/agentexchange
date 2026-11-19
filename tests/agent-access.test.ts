// What an AI agent reads before it registers or hires: robots.txt must let it
// reach the registration and MCP endpoints that llms.txt sends it to, and the
// registration notes must say which account types exist and how paying works.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const robots = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");
const llms = readFileSync(new URL("../public/llms.txt", import.meta.url), "utf8");

/** RFC 9309 for the `*` group: the longest matching rule wins, and Allow wins a tie. */
function allowedForAnyAgent(path: string): boolean {
  const rules: { allow: boolean; prefix: string }[] = [];
  let inStarGroup = false;
  for (const raw of robots.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const field = m[1].toLowerCase();
    if (field === "user-agent") inStarGroup = m[2].trim() === "*";
    else if (inStarGroup && m[2].trim()) rules.push({ allow: field === "allow", prefix: m[2].trim() });
  }
  let best: { allow: boolean; prefix: string } | null = null;
  for (const r of rules) {
    if (!path.startsWith(r.prefix)) continue;
    if (!best || r.prefix.length > best.prefix.length || (r.prefix.length === best.prefix.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

describe("robots.txt for agents", () => {
  it("lets agents reach the pages and endpoints llms.txt points them to", () => {
    for (const path of ["/", "/llms.txt", "/.well-known/agent.json", "/for-agents", "/sign-up", "/marketplace", "/pricing", "/api/auth-config", "/api/mcp", "/api/og?kind=agent&id=x"]) {
      expect(allowedForAnyAgent(path), path).toBe(true);
    }
  });

  it("keeps private pages and the other API routes out of crawls", () => {
    for (const path of ["/account", "/wallet", "/contracts/1", "/owner/revenue", "/api/agent-keys", "/api/billing", "/api/checkout", "/api/release"]) {
      expect(allowedForAnyAgent(path), path).toBe(false);
    }
  });

  it("still lists the sitemap", () => {
    expect(robots).toContain("Sitemap: https://www.agentsexchange.ai/sitemap.xml");
  });

  it("allows search and AI answers but asks that the site not be used for AI training", () => {
    const starGroup = robots.split(/^User-agent:\s*\*\s*$/m)[1] ?? "";
    const signal = starGroup.match(/^Content-Signal:\s*(.+)$/m)?.[1] ?? "";
    const values = Object.fromEntries(signal.split(",").map((pair) => pair.trim().split("=")));
    expect(values).toEqual({ search: "yes", "ai-input": "yes", "ai-train": "no" });
  });
});

describe("llms.txt for agents", () => {
  it("puts account creation under For agents and explains paying and payouts", () => {
    const forAgents = llms.split("## For agents")[1].split("\n## ")[0];
    expect(forAgents).toContain("https://www.agentsexchange.ai/api/auth-config");
    expect(llms).toContain("get_owner_setup_link");
    expect(llms).toContain("get_payment_setup_status");
    expect(llms).toMatch(/## Getting paid/);
    expect(llms).not.toContain("same key");
  });
});

describe("GET /api/auth-config", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../server/config.js");
  });

  it("names the account types and how a key gets permission to pay", async () => {
    vi.doMock("../server/config.js", () => ({
      readServerEnv: () => ({ supabaseUrl: "https://db.example.test", supabaseAnonKey: "anon", workers: [], paymentsEnabled: true, appUrl: "https://example.test" }),
    }));
    const { GET } = await import("../api/auth-config");
    const body = (await (await GET()).json()) as Record<string, unknown>;
    expect(body.enabled).toBe(true);
    expect(body.accountTypes).toEqual(["Agent Operator", "Organization"]);
    expect(body.signUp).toBe("https://db.example.test/auth/v1/signup");
    const notes = String(body.notes);
    expect(notes).toContain('"Agent Operator"');
    expect(notes).toContain('"Organization"');
    expect(notes).toContain("get_owner_setup_link");
    expect(notes).toContain("get_payment_setup_status");
  });

  it("stays off when the server is not configured", async () => {
    vi.doMock("../server/config.js", () => ({ readServerEnv: () => null }));
    const { GET } = await import("../api/auth-config");
    expect(await (await GET()).json()).toEqual({ enabled: false });
  });
});
