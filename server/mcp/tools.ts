// The marketplace as a Hermes worker sees it.
//
// Every tool is a thin wrapper over the same tables the browser uses, executed
// through the worker's own signed-in session (see server/operator.ts). No tool
// re-implements authority: if Postgres refuses a write, the tool returns
// ok=false with the database's reason and changes nothing.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export interface OperatorHandle {
  db: SupabaseClient;
  profileId: string;
}

export interface ToolContext {
  /**
   * The worker's signed-in session, opened only when a tool actually runs so
   * that initialize / tools/list never need the marketplace account.
   */
  open: () => Promise<OperatorHandle>;
  worker: string;
  now: () => string;
}

export interface ToolDef<S extends z.ZodType> {
  name: string;
  description: string;
  schema: S;
  readOnly: boolean;
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<unknown>;
}

function tool<S extends z.ZodType>(t: ToolDef<S>): ToolDef<S> {
  return t;
}

const uuid = z.uuid();

type Row = Record<string, unknown>;

function fail(step: string, error: { message: string } | null): { ok: false; error: string } {
  return { ok: false, error: `${step}: ${error?.message ?? "unknown error"}` };
}

async function ownedAgents(op: OperatorHandle): Promise<Row[]> {
  const { data, error } = await op.db
    .from("agents")
    .select("id,name,specialty,skills,availability,verification_status,trust_score")
    .eq("owner_id", op.profileId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`agents: ${error.message}`);
  return (data ?? []) as Row[];
}

function contractSummary(c: Row) {
  return {
    id: c.id,
    title: c.title,
    organization: c.organization_name,
    organizationId: c.organization_id,
    agent: c.agent_name,
    agentId: c.agent_id,
    value: c.value,
    status: c.status,
    progress: c.progress,
    startDate: c.start_date,
    dueDate: c.due_date,
    sourceType: c.source_type,
    createdAt: c.created_at,
  };
}

export const TOOLS = [
  tool({
    name: "whoami",
    description:
      "Who this worker is on AgentExchange: the operator profile it acts as and the agent listings it owns. Call first; if you own no agent yet, publish one with publish_agent before anything can be hired.",
    schema: z.object({}),
    readOnly: true,
    run: async (_input, ctx) => {
      const op = await ctx.open();
      const { data: profile } = await op.db
        .from("profiles")
        .select("id,display_name,account_type,email")
        .eq("id", op.profileId)
        .maybeSingle();
      const agents = await ownedAgents(op);
      return {
        ok: true,
        worker: ctx.worker,
        profile: profile
          ? { id: profile.id, displayName: profile.display_name, accountType: profile.account_type }
          : { id: op.profileId },
        agents,
      };
    },
  }),
  tool({
    name: "publish_agent",
    description:
      "Publish an agent listing on the marketplace owned by this worker. Trust signals (verification, trust score, success rate, revenue) are platform-managed and start at Unverified; do not try to set them. Returns the new agent. Idempotent on name: an existing listing with the same name is returned instead of duplicated.",
    schema: z.object({
      name: z.string().min(2).max(80),
      specialty: z.string().min(2).max(120),
      description: z.string().max(2000).optional(),
      skills: z.array(z.string().min(1).max(40)).max(20).default([]),
      startingRate: z.string().max(60).optional(),
      availability: z.enum(["Available", "Limited", "Unavailable"]).default("Available"),
      toolAccess: z.array(z.string().min(1).max(60)).max(20).default([]),
    }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const existing = (await ownedAgents(op)).find((a) => a.name === input.name);
      if (existing) return { ok: true, created: false, agent: existing };
      const { data, error } = await op.db
        .from("agents")
        .insert({
          owner_id: op.profileId,
          name: input.name,
          specialty: input.specialty,
          description: input.description ?? null,
          skills: input.skills,
          starting_rate: input.startingRate ?? null,
          availability: input.availability,
          tool_access: input.toolAccess,
        })
        .select("id,name,specialty,skills,availability,verification_status,trust_score")
        .single();
      if (error) return fail("publish_agent", error);
      return { ok: true, created: true, agent: data };
    },
  }),
  tool({
    name: "list_hire_requests",
    description:
      "Hire requests organizations have sent to this worker's agents. Pending ones need a decision via respond_to_hire_request.",
    schema: z.object({
      status: z.enum(["pending", "accepted", "rejected", "all"]).default("pending"),
    }),
    readOnly: true,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const agents = await ownedAgents(op);
      const ids = agents.map((a) => a.id as string);
      if (ids.length === 0) return { ok: true, hireRequests: [] };
      let q = op.db
        .from("hire_requests")
        .select("id,agent_id,agent_name,opportunity_id,opportunity_title,quick_job_title,status,created_at")
        .in("agent_id", ids)
        .order("created_at", { ascending: false });
      if (input.status !== "all") q = q.eq("status", input.status);
      const { data, error } = await q;
      if (error) return fail("list_hire_requests", error);
      const rows = (data ?? []) as Row[];
      const oppIds = [...new Set(rows.map((r) => r.opportunity_id).filter(Boolean))] as string[];
      const opportunities = new Map<string, Row>();
      if (oppIds.length) {
        const { data: opps } = await op.db
          .from("opportunities")
          .select("id,title,organization_name,category,budget_range,estimated_duration,required_skills,description,success_criteria")
          .in("id", oppIds);
        for (const o of (opps ?? []) as Row[]) opportunities.set(o.id as string, o);
      }
      return {
        ok: true,
        hireRequests: rows.map((r) => ({
          id: r.id,
          status: r.status,
          agentId: r.agent_id,
          agentName: r.agent_name,
          title: r.quick_job_title || r.opportunity_title,
          createdAt: r.created_at,
          opportunity: r.opportunity_id ? (opportunities.get(r.opportunity_id as string) ?? null) : null,
        })),
      };
    },
  }),
  tool({
    name: "respond_to_hire_request",
    description:
      "Accept or decline a pending hire request addressed to one of this worker's agents. Accepting creates the contract (the database derives every relationship from the accepted request) and returns it; work then continues on that contract.",
    schema: z.object({
      hireRequestId: uuid,
      decision: z.enum(["accept", "decline"]),
    }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const status = input.decision === "accept" ? "accepted" : "rejected";
      const { data: updated, error } = await op.db
        .from("hire_requests")
        .update({ status })
        .eq("id", input.hireRequestId)
        .eq("status", "pending")
        .select("id,status")
        .maybeSingle();
      if (error) return fail("respond_to_hire_request", error);
      if (!updated) return { ok: false, error: "hire request not found, not pending, or not addressed to this worker" };
      if (status !== "accepted") return { ok: true, hireRequestId: input.hireRequestId, status };
      const { data: contract, error: rpcError } = await op.db.rpc("materialize_hire_request_contract", {
        hire_request_uuid: input.hireRequestId,
      });
      if (rpcError) return fail("materialize_hire_request_contract", rpcError);
      return { ok: true, hireRequestId: input.hireRequestId, status, contract: contractSummary(contract as Row) };
    },
  }),
  tool({
    name: "list_contracts",
    description:
      "Contracts this worker's agents are a party to, newest first, with counts of deliverables and unanswered organization messages so you can see where work is owed.",
    schema: z.object({
      status: z.enum(["Active", "Completed", "Paused", "Disputed", "all"]).default("Active"),
    }),
    readOnly: true,
    run: async (input, ctx) => {
      const op = await ctx.open();
      let q = op.db.from("contracts").select("*").order("created_at", { ascending: false });
      if (input.status !== "all") q = q.eq("status", input.status);
      const { data, error } = await q;
      if (error) return fail("list_contracts", error);
      const rows = (data ?? []) as Row[];
      const ids = rows.map((r) => r.id as string);
      const deliverables = new Map<string, number>();
      const lastMessage = new Map<string, Row>();
      if (ids.length) {
        const { data: dels } = await op.db.from("contract_deliverables").select("contract_id").in("contract_id", ids);
        for (const d of (dels ?? []) as Row[]) {
          const k = d.contract_id as string;
          deliverables.set(k, (deliverables.get(k) ?? 0) + 1);
        }
        const { data: msgs } = await op.db
          .from("contract_messages")
          .select("contract_id,sender_type,created_at")
          .in("contract_id", ids)
          .order("created_at", { ascending: false });
        for (const m of (msgs ?? []) as Row[]) {
          const k = m.contract_id as string;
          if (!lastMessage.has(k)) lastMessage.set(k, m);
        }
      }
      return {
        ok: true,
        contracts: rows.map((c) => {
          const last = lastMessage.get(c.id as string);
          return {
            ...contractSummary(c),
            deliverables: deliverables.get(c.id as string) ?? 0,
            lastMessageFrom: last ? last.sender_type : null,
            awaitingReply: last ? last.sender_type === "Organization" : true,
          };
        }),
      };
    },
  }),
  tool({
    name: "get_contract",
    description:
      "Everything about one contract: terms, the opportunity it came from (scope, success criteria), milestones, deliverables with the organization's decisions, and the full message thread in order.",
    schema: z.object({ contractId: uuid }),
    readOnly: true,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const { data: c, error } = await op.db.from("contracts").select("*").eq("id", input.contractId).maybeSingle();
      if (error) return fail("get_contract", error);
      if (!c) return { ok: false, error: "contract not found or not visible to this worker" };
      const [milestones, deliverables, messages] = await Promise.all([
        op.db.from("contract_milestones").select("id,title,notes,completed,completed_at,created_at").eq("contract_id", c.id).order("created_at"),
        op.db.from("contract_deliverables").select("id,title,notes,status,decisions,submitted_at,approved_at,created_at").eq("contract_id", c.id).order("created_at"),
        op.db.from("contract_messages").select("id,sender_type,author,body,created_at").eq("contract_id", c.id).order("created_at"),
      ]);
      let opportunity: Row | null = null;
      if (c.source_type && c.source_id) {
        const table = c.source_type === "application" ? "applications" : c.source_type === "negotiation" ? "negotiations" : c.source_type === "hire-request" ? "hire_requests" : null;
        if (table) {
          const { data: src } = await op.db.from(table).select("opportunity_id").eq("id", c.source_id).maybeSingle();
          if (src?.opportunity_id) {
            const { data: opp } = await op.db
              .from("opportunities")
              .select("id,title,organization_name,category,budget_range,estimated_duration,required_skills,description,success_criteria")
              .eq("id", src.opportunity_id)
              .maybeSingle();
            opportunity = (opp as Row) ?? null;
          }
        }
      }
      return {
        ok: true,
        contract: contractSummary(c as Row),
        opportunity,
        milestones: milestones.data ?? [],
        deliverables: deliverables.data ?? [],
        messages: (messages.data ?? []).map((m) => ({ id: m.id, from: m.sender_type, author: m.author, body: m.body, createdAt: m.created_at })),
      };
    },
  }),
  tool({
    name: "post_message",
    description:
      "Post a message in the contract thread as the agent. Use it to acknowledge a new contract with a short plan, ask one precise question when the scope is genuinely ambiguous, or announce a deliverable.",
    schema: z.object({ contractId: uuid, body: z.string().min(1).max(4000) }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const { data: c } = await op.db.from("contracts").select("id,agent_name").eq("id", input.contractId).maybeSingle();
      if (!c) return { ok: false, error: "contract not found or not visible to this worker" };
      const { data, error } = await op.db
        .from("contract_messages")
        .insert({ contract_id: c.id, sender_type: "Agent", author: c.agent_name, body: input.body })
        .select("id,created_at")
        .single();
      if (error) return fail("post_message", error);
      return { ok: true, messageId: data.id, createdAt: data.created_at };
    },
  }),
  tool({
    name: "submit_deliverable",
    description:
      "Submit a deliverable for the organization's review. `notes` IS the work product (markdown is fine): the memo, plan, analysis, copy, code or report the contract asked for, complete and self-contained. Only the organization can approve it; you cannot.",
    schema: z.object({
      contractId: uuid,
      title: z.string().min(2).max(160),
      notes: z.string().min(1).max(60000),
    }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const { data, error } = await op.db
        .from("contract_deliverables")
        .insert({
          contract_id: input.contractId,
          title: input.title,
          notes: input.notes,
          status: "submitted",
          submitted_at: ctx.now(),
        })
        .select("id,title,status,submitted_at")
        .single();
      if (error) return fail("submit_deliverable", error);
      // A submitted deliverable puts the contract in review; the organization's
      // decision moves it on from there (the product writes that transition).
      const { error: statusError } = await op.db
        .from("contracts")
        .update({ status: "In Review" })
        .eq("id", input.contractId)
        .eq("status", "Active");
      return { ok: true, deliverable: data, contractStatus: statusError ? "unchanged" : "In Review" };
    },
  }),
  tool({
    name: "update_progress",
    description: "Set the contract's progress percentage (0-100) after meaningful work lands.",
    schema: z.object({ contractId: uuid, progress: z.number().int().min(0).max(100) }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const { data, error } = await op.db
        .from("contracts")
        .update({ progress: input.progress })
        .eq("id", input.contractId)
        .select("id,progress")
        .maybeSingle();
      if (error) return fail("update_progress", error);
      if (!data) return { ok: false, error: "contract not found or not visible to this worker" };
      return { ok: true, contractId: data.id, progress: data.progress };
    },
  }),
];

export type AnyTool = (typeof TOOLS)[number];

export function toolList() {
  return TOOLS.map((t) => {
    const js = z.toJSONSchema(t.schema, { target: "draft-7", io: "input" }) as Record<string, unknown>;
    delete js["$schema"];
    return {
      name: t.name,
      description: t.description,
      inputSchema: js,
      annotations: { readOnlyHint: t.readOnly },
    };
  });
}
