// Server-side configuration for the Hermes worker integration.
//
// These functions run only inside Vercel Functions (`api/*.ts`); nothing here
// is bundled into the browser. Configuration is fail-closed: with no workers
// configured the MCP endpoint answers 503 and dispatch is a no-op.
import { z } from "zod";

// One entry per Hermes worker on orgo-desktop. The worker authenticates to the
// MCP server with `mcpKey`; the MCP server acts on the marketplace as the
// worker's own AgentExchange account (`email` + `password`, an ordinary
// Supabase user), so Row Level Security and the authority triggers apply to
// every write exactly as they do for a human operator. The product reaches the
// worker's runtime at `turnUrl` with `turnToken`.
export const WorkerSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/),
  mcpKey: z.string().min(24),
  email: z.email(),
  password: z.string().min(8),
  turnUrl: z.url().optional(),
  turnToken: z.string().min(24).optional(),
});
export type Worker = z.infer<typeof WorkerSchema>;

export const WorkersSchema = z.array(WorkerSchema).max(32);

export function parseWorkers(raw: string | undefined): Worker[] {
  if (!raw || !raw.trim()) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("AGENTEXCHANGE_WORKERS is not valid JSON");
  }
  const parsed = WorkersSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `AGENTEXCHANGE_WORKERS is invalid: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  const names = new Set<string>();
  const keys = new Set<string>();
  for (const w of parsed.data) {
    if (names.has(w.name)) throw new Error(`AGENTEXCHANGE_WORKERS: duplicate worker name ${w.name}`);
    if (keys.has(w.mcpKey)) throw new Error(`AGENTEXCHANGE_WORKERS: duplicate mcpKey`);
    names.add(w.name);
    keys.add(w.mcpKey);
  }
  return parsed.data;
}

export interface ServerEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  workers: Worker[];
  /** Stripe is configured and the ledger can be written: contracts must be funded before work. */
  paymentsEnabled: boolean;
  appUrl: string;
}

export function readServerEnv(env: Record<string, string | undefined> = process.env): ServerEnv | null {
  const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return {
    supabaseUrl,
    supabaseAnonKey,
    workers: parseWorkers(env.AGENTEXCHANGE_WORKERS),
    paymentsEnabled: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.SUPABASE_SERVICE_ROLE_KEY),
    appUrl: (env.APP_URL ?? "https://www.agentsexchange.ai").replace(/\/$/, ""),
  };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Map an `Authorization: Bearer …` header to the worker it belongs to. */
export function authenticateWorker(header: string | null, workers: Worker[]): Worker | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return null;
  const presented = m[1].trim();
  let found: Worker | null = null;
  for (const w of workers) {
    // Compare every key so timing does not reveal which prefix matched.
    if (constantTimeEqual(presented, w.mcpKey)) found = w;
  }
  return found;
}
