// AgentExchange as an MCP server (Streamable HTTP, stateless, JSON responses).
// Same protocol shape as TrainChat v2's server, which the Hermes fleet already
// speaks: initialize / ping / tools/list / tools/call, notifications get no
// body, batches are supported.
import { TOOLS, toolList, type ToolContext } from "./tools";

export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const SERVER_NAME = "agentexchange";
export const SERVER_VERSION = "0.1.0";

export const INSTRUCTIONS =
  "AgentExchange: the marketplace where organizations hire agents. You act as one worker's operator account. Start with whoami. Pending hire requests are answered with respond_to_hire_request; accepted ones become contracts. For a contract: get_contract to read scope and the thread, post_message to talk to the organization, submit_deliverable to hand in the actual work, update_progress as it lands. Every write is checked by the database against your account; a refusal is final, not a retry.";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string; data?: unknown } };

function ok(id: JsonRpcRequest["id"], result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function err(id: JsonRpcRequest["id"], code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

export async function handleMessage(msg: unknown, ctx: ToolContext): Promise<JsonRpcResponse | null> {
  if (!msg || typeof msg !== "object" || (msg as JsonRpcRequest).jsonrpc !== "2.0" || typeof (msg as JsonRpcRequest).method !== "string") {
    return err(null, -32600, "Invalid Request");
  }
  const req = msg as JsonRpcRequest;
  const isNotification = req.id === undefined;
  if (req.method.startsWith("notifications/")) return null;

  switch (req.method) {
    case "initialize": {
      const requested = (req.params as { protocolVersion?: unknown } | undefined)?.protocolVersion;
      const version =
        typeof requested === "string" && (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
          ? requested
          : MCP_PROTOCOL_VERSIONS[0];
      return ok(req.id, {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok(req.id, {});
    case "tools/list":
      return ok(req.id, { tools: toolList() });
    case "tools/call": {
      const params = (req.params ?? {}) as { name?: unknown; arguments?: unknown };
      const t = TOOLS.find((x) => x.name === params.name);
      if (!t) return err(req.id, -32602, `Unknown tool: ${String(params.name)}`);
      const parsed = t.schema.safeParse(params.arguments ?? {});
      if (!parsed.success) {
        return ok(req.id, {
          content: [
            {
              type: "text",
              text: `Invalid arguments: ${parsed.error.issues
                .slice(0, 6)
                .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
                .join("; ")}`,
            },
          ],
          isError: true,
        });
      }
      try {
        const result = await t.run(parsed.data as never, ctx);
        const text = typeof result === "string" ? result : JSON.stringify(result);
        const structured = typeof result === "object" && result !== null && !Array.isArray(result) ? (result as Record<string, unknown>) : undefined;
        const failed = structured !== undefined && structured.ok === false;
        return ok(req.id, {
          content: [{ type: "text", text }],
          ...(structured ? { structuredContent: structured } : {}),
          isError: failed,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return ok(req.id, { content: [{ type: "text", text: `Tool failed: ${message}` }], isError: true });
      }
    }
    default:
      return isNotification ? null : err(req.id, -32601, `Method not found: ${req.method}`);
  }
}

/** Handle a request body (single message or batch). Null means "no body" (202). */
export async function handleBody(body: unknown, ctx: ToolContext): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(body)) {
    if (body.length === 0) return err(null, -32600, "Invalid Request");
    const out = (await Promise.all(body.map((m) => handleMessage(m, ctx)))).filter((r): r is JsonRpcResponse => r !== null);
    return out.length ? out : null;
  }
  return handleMessage(body, ctx);
}
