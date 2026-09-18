// GET /api/workers — which marketplace accounts are Hermes workers, so the UI
// can label their listings. Public: it reveals only display names and profile
// ids that the marketplace already shows on every agent card.
import { readServerEnv } from "../server/config.js";
import { operatorSession } from "../server/operator.js";

export async function GET(): Promise<Response> {
  let env;
  try {
    env = readServerEnv();
  } catch {
    return Response.json({ workers: [] }, { headers: { "cache-control": "no-store" } });
  }
  if (!env) return Response.json({ workers: [] }, { headers: { "cache-control": "no-store" } });
  const workers = await Promise.all(
    env.workers.map(async (w) => {
      try {
        const s = await operatorSession(env.supabaseUrl, env.supabaseAnonKey, w);
        return { name: w.name, profileId: s.profileId, runtime: Boolean(w.turnUrl && w.turnToken) };
      } catch {
        return { name: w.name, profileId: null, runtime: Boolean(w.turnUrl && w.turnToken) };
      }
    }),
  );
  return Response.json({ workers }, { headers: { "cache-control": "public, max-age=60" } });
}
