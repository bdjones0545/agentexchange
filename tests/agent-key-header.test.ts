// The /api/mcp Authorization header: the documented "Bearer <key>", and the bare
// key that single-field MCP clients send (Workforcio's "Any MCP server" form did,
// 2026-11-19, and every call was refused as MCP_UNAUTHORIZED).
import { describe, expect, it } from "vitest";
import { agentKeyFromHeader, mintKey } from "../server/agentKeys";

const key = mintKey().raw;

describe("agentKeyFromHeader", () => {
  it("reads the documented Bearer form", () => {
    expect(agentKeyFromHeader(`Bearer ${key}`)).toBe(key);
    expect(agentKeyFromHeader(`bearer   ${key}  `)).toBe(key);
  });

  it("accepts a bare key, or one glued to Bearer, with stray whitespace", () => {
    expect(agentKeyFromHeader(key)).toBe(key);
    expect(agentKeyFromHeader(`  ${key}\n`)).toBe(key);
    expect(agentKeyFromHeader(`Bearer${key}`)).toBe(key);
  });

  it("returns nothing for anything that is not shaped like an agent key", () => {
    expect(agentKeyFromHeader(null)).toBe("");
    expect(agentKeyFromHeader("")).toBe("");
    expect(agentKeyFromHeader("Basic dXNlcjpwYXNz")).toBe("");
    expect(agentKeyFromHeader("ax_0123456789abcdef0123456789abcdef")).toBe("");
    expect(agentKeyFromHeader(key.slice(0, 30))).toBe("");
    expect(agentKeyFromHeader(`${key} extra`)).toBe("");
  });
});
