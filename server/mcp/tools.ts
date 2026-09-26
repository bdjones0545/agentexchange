import { isTestListing } from "../../src/lib/publicListings.js";
import { setupLink, setupStatus } from '../agentSetup.js';
import { serviceClient } from '../service.js';
import { sellerGateway } from '../connect.js';
import { MoneyOperationError, operationStore } from "../moneyOperations.js";
// The marketplace as a Hermes worker sees it.
//
// Every tool is a thin wrapper over the same tables the browser uses, executed
// through the worker's own signed-in session (see server/operator.ts). No tool
// re-implements authority: if Postgres refuses a write, the tool returns
// ok=false with the database's reason and changes nothing.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { FundingError, fundWithSavedCard, releaseFunds } from "../funding.js";
import { decide, type Brief, type DeliverableEvaluator, type GateResult } from "../gate/deliverableGate.js";
import { supabaseLedger } from "../ledger.js";
import { realStripe } from "../stripe.js";

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
  paymentsAllowed?: boolean;
  agentKeyId?: string;
  now: () => string;
  /** When true, a contract must be funded (payment_status authorized) before work starts. */
  paymentsEnabled: boolean;
  /** Tell workers something happened (identifiers only). Best-effort. */
  notify?: (event: { event: "contract_funded" | "deliverable_decision"; contractId: string }) => Promise<unknown>;
  /**
   * Quality gate for submit_deliverable (server/gate/deliverableGate.ts). null or
   * undefined means no evaluator is configured: deliverables are accepted and
   * stamped "unavailable" rather than blocked.
   */
  gate?: DeliverableEvaluator | null;
}

/** The money plumbing the two payment tools use; real Stripe and the service-role ledger. */
function moneyDeps(ctx: ToolContext, op: OperatorHandle) {
  return {
    ledger: supabaseLedger(undefined, op.db), operations: operationStore(),
    stripe: realStripe(process.env.STRIPE_SECRET_KEY ?? ""),
    appUrl: (process.env.APP_URL ?? "https://www.agentsexchange.ai").replace(/\/$/, ""),
    notify: ctx.notify,
  };
}

function fundingOf(ctx: ToolContext, c: Row) {
  const status = (c.payment_status as string | null) ?? "unfunded";
  return {
    required: ctx.paymentsEnabled,
    status,
    // Work may start when funding is not required, or once the hold is in place.
    workMayStart: !ctx.paymentsEnabled || status === "authorized" || status === "captured" || status === "paid_out",
  };
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

/** The brief a contract came from, when it came from one. */
async function opportunityOf(db: SupabaseClient, c: Row): Promise<Row | null> {
  if (!c.source_type || !c.source_id) return null;
  const table = c.source_type === "application" ? "applications" : c.source_type === "negotiation" ? "negotiations" : c.source_type === "hire-request" ? "hire_requests" : null;
  if (!table) return null;
  const { data: src } = await db.from(table).select("opportunity_id").eq("id", c.source_id).maybeSingle();
  if (!src?.opportunity_id) return null;
  const { data: opp } = await db
    .from("opportunities")
    .select("id,title,organization_name,category,budget_range,estimated_duration,required_skills,description,success_criteria")
    .eq("id", src.opportunity_id)
    .maybeSingle();
  return (opp as Row) ?? null;
}

/**
 * Run the deliverable through the quality gate. Never throws: an evaluator
 * failure is an "unavailable" verdict, and the count of earlier returns is read
 * from deliverable_gate_events so a worker cannot loop forever.
 */
async function gateDeliverable(
  ctx: ToolContext,
  db: SupabaseClient,
  c: Row,
  input: { title: string; notes: string },
): Promise<GateResult> {
  // Returns since the last deliverable that actually landed on this contract.
  const { data: latest } = await db
    .from("contract_deliverables")
    .select("created_at")
    .eq("contract_id", c.id)
    .order("created_at", { ascending: false });
  const since = (latest as Row[] | null)?.[0]?.created_at as string | undefined;
  const { data: events } = await db.from("deliverable_gate_events").select("id,verdict,created_at").eq("contract_id", c.id).eq("verdict", "returned");
  const priorReturns = ((events as Row[] | null) ?? []).filter((e) => !since || String(e.created_at) > since).length;

  if (!ctx.gate) return decide(null, priorReturns, ctx.now);
  const opp = await opportunityOf(db, c);
  const brief: Brief = {
    contractTitle: String(c.title ?? ""),
    title: (opp?.title as string | null) ?? null,
    category: (opp?.category as string | null) ?? null,
    description: (opp?.description as string | null) ?? null,
    successCriteria: (opp?.success_criteria as string | null) ?? null,
    requiredSkills: (opp?.required_skills as string[] | null) ?? null,
  };
  try {
    const answers = await ctx.gate({ brief, title: input.title, notes: input.notes });
    return decide(answers, priorReturns, ctx.now);
  } catch (e) {
    console.warn("[gate] evaluator failed; accepting without evaluation:", e instanceof Error ? e.message : e);
    return decide(null, priorReturns, ctx.now);
  }
}

/** Append-only record of every gate decision; best-effort so it can never block a submission. */
async function recordGate(db: SupabaseClient, c: Row, profileId: string, title: string, gate: GateResult, deliverableId: string | null) {
  const { error } = await db.from("deliverable_gate_events").insert({
    contract_id: c.id,
    worker_profile_id: profileId,
    deliverable_id: deliverableId,
    title,
    verdict: gate.verdict,
    attempt: gate.attempt,
    answers: gate.answers,
    flags: gate.flags,
    model: gate.model,
  });
  if (error) console.warn("[gate] could not record gate event:", error.message);
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
    amountCents: c.amount_cents,
    currency: c.currency,
    paymentStatus: c.payment_status,
  };
}

export const TOOLS = [
  tool({name:'get_owner_setup_link', description:'Get a secure owner setup navigation link. Share it with the human who issued your API key. The owner signs in, saves a card, sets limits, explicitly enables this key, and optionally completes Stripe seller verification. This link grants no access. Never collect owner card, bank, identity documents or passwords in chat.', schema:z.object({}), readOnly:true,
    run:async (_input,ctx)=> {await ctx.open();return {ok:true,url:setupLink(process.env.APP_URL ?? 'https://www.agentsexchange.ai',ctx.agentKeyId),instructions:'Send this link to your existing account owner. New owners must first create an account and issue a non-spending key at /account. Check get_payment_setup_status after they finish. Do not poll more than once every 30 seconds.'};}}),
  tool({name:'get_payment_setup_status',description:'Read payment and earnings readiness for your own owner and API key. Returns no card or bank details. Payment readiness does not guarantee any particular charge succeeds.',schema:z.object({}),readOnly:true,
    run:async (_input,ctx)=>{const op=await ctx.open();try{return {ok:true,...await setupStatus(serviceClient(),op.profileId,ctx.agentKeyId,ctx.paymentsEnabled,id=>sellerGateway(process.env.STRIPE_SECRET_KEY!).readiness(id))};}catch{return {ok:false,error:'Setup status unavailable; ask your owner to check the setup page'};}}}),

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
        paymentsEnabled: ctx.paymentsEnabled,
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
      "Hire requests organizations have sent to this worker's agents, with the offered price (offeredAmountCents; accepting is accepting that price). Pending ones need a decision via respond_to_hire_request.",
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
        .select("id,agent_id,agent_name,opportunity_id,opportunity_title,quick_job_title,status,created_at,amount_cents,currency")
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
          offeredAmountCents: r.amount_cents,
          currency: r.currency,
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
            funding: fundingOf(ctx, c),
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
      "Everything about one contract: terms, funding state (funding.workMayStart says whether you may begin), the opportunity it came from (scope, success criteria), milestones, deliverables with the organization's decisions, and the full message thread in order.",
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
      const opportunity = await opportunityOf(op.db, c as Row);
      return {
        ok: true,
        contract: contractSummary(c as Row),
        funding: fundingOf(ctx, c as Row),
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
      "Submit a deliverable for the organization's review. `notes` IS the work product (markdown is fine): the memo, plan, analysis, copy, code or report the contract asked for, complete and self-contained. Every submission passes a quality gate that checks it against the brief's scope and success criteria; if it comes back ok=false with gate.verdict \"returned\", read gate.flags, revise, and submit again. Only the organization can approve it; you cannot.",
    schema: z.object({
      contractId: uuid,
      deliverableId: uuid.optional().describe("Rejected draft to revise; required when multiple drafts exist"),
      title: z.string().min(2).max(160),
      notes: z.string().min(1).max(60000),
    }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const { data: c, error: contractError } = await op.db.from("contracts").select("*").eq("id", input.contractId).maybeSingle();
      if (contractError) return fail("submit_deliverable", contractError);
      if (!c) return { ok: false, error: "contract not found or not visible to this worker" };

      const {data: drafts, error: draftError} = await op.db.from("contract_deliverables").select("id,decisions").eq("contract_id", input.contractId).eq("status", "draft");
      if(draftError) return fail("submit_deliverable", draftError);
      const candidates = (drafts ?? []) as Row[];
      const revision = input.deliverableId ? candidates.find(d=>d.id===input.deliverableId) : candidates.length===1 ? candidates[0] : undefined;
      if(input.deliverableId && !revision) return {ok:false,error:"Only a draft on this contract can be revised"};
      if(!input.deliverableId && candidates.length>1) return {ok:false,error:"Choose the rejected draft using deliverableId"};
      const gate = await gateDeliverable(ctx, op.db, c as Row, input);
      if (gate.verdict === "returned") {
        await recordGate(op.db, c as Row, op.profileId, input.title, gate, null);
        const remaining = gate.thresholds.maxReturns - gate.attempt + 1;
        return {
          ok: false,
          error: `Quality gate returned this deliverable (attempt ${gate.attempt}; ${remaining} more return${remaining === 1 ? "" : "s"} before it is accepted with flags). Fix: ${gate.flags.join("; ")}. Nothing was submitted.`,
          gate,
        };
      }

      const row = {
        contract_id: input.contractId,
        title: input.title,
        notes: input.notes,
        status: "submitted",
        submitted_at: ctx.now(),
      };
      const write = (payload: Record<string, unknown>) => revision
        ? op.db.from("contract_deliverables").update(payload).eq("id", revision.id).eq("status", "draft").select("id,title,status,submitted_at").single()
        : op.db.from("contract_deliverables").insert(payload).select("id,title,status,submitted_at").single();
      let { data, error } = await write({...row, gate});
      if (error && /gate/i.test(error.message)) {
        ({ data, error } = await write(row));
      }
      if (error) return fail("submit_deliverable", error);
      await recordGate(op.db, c as Row, op.profileId, input.title, gate, String((data as Row).id));
      // A submitted deliverable puts the contract in review; the organization's
      // decision moves it on from there (the product writes that transition).
      const { error: statusError } = await op.db
        .from("contracts")
        .update({ status: "In Review" })
        .eq("id", input.contractId)
        .eq("status", "Active");
      return { ok: true, deliverable: data, gate, contractStatus: statusError ? "unchanged" : "In Review" };
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

  tool({
    name: "search_opportunities",
    description:
      "Find open briefs organizations have posted: title, category, budget, required skills, scope and success criteria. This is where work comes from — search here, then apply_to_opportunity with one of your agents.",
    schema: z.object({
      query: z.string().max(120).optional().describe("Free text matched against title, description, category and skills"),
      category: z.string().max(60).optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    readOnly: true,
    run: async (input, ctx) => {
      const op = await ctx.open();
      let q = op.db
        .from("opportunities")
        .select("id,title,organization_name,category,budget_range,estimated_duration,required_skills,description,success_criteria,status,created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(200);
      if (input.category) q = q.ilike("category", input.category);
      const { data, error } = await q;
      if (error) return fail("search_opportunities", error);
      const needle = (input.query ?? "").trim().toLowerCase();
      const rows = ((data ?? []) as Row[]).filter((o) => {
        if (isTestListing(o)) return false;
        if (!needle) return true;
        const hay = [o.title, o.description, o.category, o.success_criteria, ...(((o.required_skills as string[]) ?? []))].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(needle);
      });
      return { ok: true, count: rows.length, opportunities: rows.slice(0, input.limit) };
    },
  }),
  tool({
    name: "get_opportunity",
    description: "One brief in full, plus whether any of your agents has already applied or negotiated on it.",
    schema: z.object({ opportunityId: uuid }),
    readOnly: true,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const { data: o, error } = await op.db
        .from("opportunities")
        .select("id,title,organization_name,organization_id,category,budget_range,estimated_duration,required_skills,description,success_criteria,status,created_at")
        .eq("id", input.opportunityId)
        .maybeSingle();
      if (error) return fail("get_opportunity", error);
      if (!o) return { ok: false, error: "opportunity not found" };
      const mine = (await ownedAgents(op)).map((a) => a.id as string);
      const [apps, negs] = await Promise.all([
        mine.length ? op.db.from("applications").select("id,agent_id,agent_name,status,created_at").eq("opportunity_id", o.id).in("agent_id", mine) : Promise.resolve({ data: [] }),
        mine.length ? op.db.from("negotiations").select("id,agent_id,agent_name,rate,timeline,amount_cents,counter_rate,counter_timeline,counter_note,counter_amount_cents,accepted_by,status,created_at").eq("opportunity_id", o.id).in("agent_id", mine) : Promise.resolve({ data: [] }),
      ]);
      return { ok: true, opportunity: o, myApplications: apps.data ?? [], myNegotiations: negs.data ?? [] };
    },
  }),
  tool({
    name: "apply_to_opportunity",
    description:
      "Apply to an open brief with one of your agents and a short proposal (what you will deliver, how, and by when). One application per agent per brief; the organization accepts or rejects it, and acceptance creates a contract at a price the organization states.",
    schema: z.object({
      opportunityId: uuid,
      agentId: uuid,
      proposal: z.string().min(20).max(3000),
    }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const agent = (await ownedAgents(op)).find((a) => a.id === input.agentId);
      if (!agent) return { ok: false, error: "agentId is not one of your agents (see whoami)" };
      const { data: existing } = await op.db.from("applications").select("id,status").eq("opportunity_id", input.opportunityId).eq("agent_id", input.agentId).maybeSingle();
      if (existing) return { ok: false, error: `this agent already applied (application ${existing.id}, ${existing.status})` };
      const { data, error } = await op.db
        .from("applications")
        .insert({ opportunity_id: input.opportunityId, agent_id: input.agentId, agent_name: agent.name, proposal: input.proposal })
        .select("id,status,created_at")
        .single();
      if (error) return fail("apply_to_opportunity", error);
      return { ok: true, application: data };
    },
  }),
  tool({
    name: "negotiate_opportunity",
    description:
      "Propose terms on an open brief with one of your agents: a fixed price in cents, a timeline (e.g. \"3 days\") and optional milestone notes. The organization accepts, counters or rejects. If it counters, answer with respond_to_negotiation. Acceptance by either side creates a contract at the accepted price.",
    schema: z.object({
      opportunityId: uuid,
      agentId: uuid,
      amountCents: z.number().int().min(5000).describe("Your price for the whole brief, in cents (minimum 5000 = $50)"),
      timeline: z.string().min(1).max(60),
      milestoneNotes: z.string().max(2000).optional(),
    }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const agent = (await ownedAgents(op)).find((a) => a.id === input.agentId);
      if (!agent) return { ok: false, error: "agentId is not one of your agents (see whoami)" };
      const { data: open } = await op.db.from("negotiations").select("id,status").eq("opportunity_id", input.opportunityId).eq("agent_id", input.agentId).in("status", ["pending", "countered"]).maybeSingle();
      if (open) return { ok: false, error: `this agent already has an open negotiation (${open.id}, ${open.status}); answer it with respond_to_negotiation` };
      const rate = `$${(input.amountCents / 100).toFixed(input.amountCents % 100 === 0 ? 0 : 2)}`;
      const { data, error } = await op.db
        .from("negotiations")
        .insert({ opportunity_id: input.opportunityId, agent_id: input.agentId, agent_name: agent.name, rate, timeline: input.timeline, milestone_notes: input.milestoneNotes ?? null, amount_cents: input.amountCents, currency: "USD", status: "pending" })
        .select("id,status,amount_cents,created_at")
        .single();
      if (error) return fail("negotiate_opportunity", error);
      return { ok: true, negotiation: data };
    },
  }),
  tool({
    name: "respond_to_negotiation",
    description:
      "Answer the organization's counter on one of your negotiations: accept it (a contract is created at the counter price) or withdraw. To propose different terms instead, withdraw and open a new negotiation.",
    schema: z.object({ negotiationId: uuid, decision: z.enum(["accept", "withdraw"]) }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const { data: neg } = await op.db.from("negotiations").select("id,status,counter_amount_cents,counter_rate,counter_timeline,counter_note").eq("id", input.negotiationId).maybeSingle();
      if (!neg) return { ok: false, error: "negotiation not found or not visible to this account" };
      if (input.decision === "withdraw") {
        const { error } = await op.db.from("negotiations").update({ status: "rejected" }).eq("id", neg.id).in("status", ["pending", "countered"]);
        if (error) return fail("respond_to_negotiation", error);
        return { ok: true, negotiationId: neg.id, status: "rejected" };
      }
      if (neg.status !== "countered") return { ok: false, error: `negotiation is ${neg.status}; only a countered negotiation can be accepted by the agent` };
      const { data: updated, error } = await op.db.from("negotiations").update({ status: "accepted" }).eq("id", neg.id).eq("status", "countered").select("id,status,accepted_by").maybeSingle();
      if (error) return fail("respond_to_negotiation", error);
      if (!updated) return { ok: false, error: "negotiation changed before acceptance; read it again" };
      const { data: contract, error: rpcError } = await op.db.rpc("materialize_negotiation_contract", { negotiation_uuid: neg.id });
      if (rpcError) return fail("materialize_negotiation_contract", rpcError);
      return { ok: true, negotiationId: neg.id, status: "accepted", acceptedPriceCents: neg.counter_amount_cents, contract: contractSummary(contract as Row) };
    },
  }),
  tool({
    name: "list_my_applications",
    description: "Applications and negotiations your agents have made, with their current status, newest first.",
    schema: z.object({ status: z.enum(["pending", "accepted", "rejected", "countered", "all"]).default("all") }),
    readOnly: true,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const mine = (await ownedAgents(op)).map((a) => a.id as string);
      if (mine.length === 0) return { ok: true, applications: [], negotiations: [] };
      let apps = op.db.from("applications").select("id,opportunity_id,agent_id,agent_name,proposal,status,created_at").in("agent_id", mine).order("created_at", { ascending: false });
      let negs = op.db.from("negotiations").select("id,opportunity_id,agent_id,agent_name,rate,timeline,amount_cents,counter_rate,counter_timeline,counter_note,counter_amount_cents,accepted_by,status,created_at").in("agent_id", mine).order("created_at", { ascending: false });
      if (input.status !== "all") {
        apps = apps.eq("status", input.status);
        negs = negs.eq("status", input.status);
      }
      const [a, n] = await Promise.all([apps, negs]);
      if (a.error) return fail("list_my_applications", a.error);
      if (n.error) return fail("list_my_applications", n.error);
      return { ok: true, applications: a.data ?? [], negotiations: n.data ?? [] };
    },
  }),
  tool({
    name: "get_marketplace_guide",
    description: "How AgentExchange works for an agent: the lifecycle from listing to payment, the rules, and what each tool is for. Read once at the start of a session.",
    schema: z.object({}),
    readOnly: true,
    run: async () => ({ ok: true, guide: MARKETPLACE_GUIDE }),
  }),

  // ── Demand side: an agent acting for an organization ─────────────────────
  tool({
    name: "post_opportunity",
    description:
      "Post a brief as an organization you operate: what you need, the budget range, required skills and success criteria. Agents will find it with search_opportunities and apply or negotiate. Reuses your organization of the same name or creates it.",
    schema: z.object({
      organization: z.string().min(2).max(120),
      title: z.string().min(4).max(160),
      category: z.string().min(2).max(60).describe("e.g. Research, Dev, Sales, Copy"),
      budgetMinCents: z.number().int().min(5000),
      budgetMaxCents: z.number().int().min(5000),
      duration: z.string().min(1).max(60).describe("e.g. \"3 days\""),
      requiredSkills: z.array(z.string().min(1).max(40)).max(12).default([]),
      description: z.string().min(20).max(6000),
      successCriteria: z.string().min(10).max(3000),
    }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      if (input.budgetMaxCents < input.budgetMinCents) return { ok: false, error: "budgetMaxCents must be >= budgetMinCents" };
      const { data: existingOrg } = await op.db.from("organizations").select("id,name").eq("owner_id", op.profileId).eq("name", input.organization).limit(1).maybeSingle();
      let organizationId = existingOrg?.id as string | undefined;
      if (!organizationId) {
        const { data: org, error } = await op.db
          .from("organizations")
          .insert({ name: input.organization, industry: input.category, overview: `Organization hiring for ${input.category.toLowerCase()} work.` })
          .select("id")
          .single();
        if (error) return fail("post_opportunity (organization)", error);
        organizationId = org.id as string;
      }
      const dollars = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
      const { data, error } = await op.db
        .from("opportunities")
        .insert({
          organization_id: organizationId,
          organization_name: input.organization,
          title: input.title,
          category: input.category,
          budget_range: `${dollars(input.budgetMinCents)} - ${dollars(input.budgetMaxCents)}`,
          estimated_duration: input.duration,
          required_skills: input.requiredSkills,
          description: input.description,
          success_criteria: input.successCriteria,
          status: "open",
        })
        .select("id,title,organization_id,budget_range,status,created_at")
        .single();
      if (error) return fail("post_opportunity", error);
      return { ok: true, opportunity: data };
    },
  }),
  tool({
    name: "list_my_opportunities",
    description: "Briefs posted by organizations you operate, with how many applications and negotiations are waiting on a decision.",
    schema: z.object({}),
    readOnly: true,
    run: async (_input, ctx) => {
      const op = await ctx.open();
      const { data, error } = await op.db.from("opportunities").select("id,title,organization_name,category,budget_range,status,created_at").eq("owner_id", op.profileId).order("created_at", { ascending: false });
      if (error) return fail("list_my_opportunities", error);
      const rows = (data ?? []) as Row[];
      const ids = rows.map((r) => r.id as string);
      const pendingApps = new Map<string, number>();
      const openNegs = new Map<string, number>();
      if (ids.length) {
        const [{ data: apps }, { data: negs }] = await Promise.all([
          op.db.from("applications").select("opportunity_id").in("opportunity_id", ids).eq("status", "pending"),
          op.db.from("negotiations").select("opportunity_id").in("opportunity_id", ids).eq("status", "pending"),
        ]);
        for (const a of (apps ?? []) as Row[]) pendingApps.set(a.opportunity_id as string, (pendingApps.get(a.opportunity_id as string) ?? 0) + 1);
        for (const n of (negs ?? []) as Row[]) openNegs.set(n.opportunity_id as string, (openNegs.get(n.opportunity_id as string) ?? 0) + 1);
      }
      return { ok: true, opportunities: rows.map((r) => ({ ...r, pendingApplications: pendingApps.get(r.id as string) ?? 0, pendingNegotiations: openNegs.get(r.id as string) ?? 0 })) };
    },
  }),
  tool({
    name: "list_applicants",
    description: "Applications and negotiations agents have made on one of your briefs, with each agent's listing (specialty, skills, verification, trust).",
    schema: z.object({ opportunityId: uuid }),
    readOnly: true,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const [{ data: apps, error: e1 }, { data: negs, error: e2 }] = await Promise.all([
        op.db.from("applications").select("id,agent_id,agent_name,proposal,status,created_at").eq("opportunity_id", input.opportunityId).order("created_at", { ascending: false }),
        op.db.from("negotiations").select("id,agent_id,agent_name,rate,timeline,milestone_notes,amount_cents,counter_amount_cents,counter_note,accepted_by,status,created_at").eq("opportunity_id", input.opportunityId).order("created_at", { ascending: false }),
      ]);
      if (e1) return fail("list_applicants", e1);
      if (e2) return fail("list_applicants", e2);
      const agentIds = [...new Set([...((apps ?? []) as Row[]), ...((negs ?? []) as Row[])].map((r) => r.agent_id).filter(Boolean))] as string[];
      const agents = new Map<string, Row>();
      if (agentIds.length) {
        const { data } = await op.db.from("agents").select("id,name,specialty,skills,verification_status,trust_score,success_rate,availability").in("id", agentIds);
        for (const a of (data ?? []) as Row[]) agents.set(a.id as string, a);
      }
      const withAgent = (r: Row) => ({ ...r, agent: agents.get(r.agent_id as string) ?? null });
      return { ok: true, applications: ((apps ?? []) as Row[]).map(withAgent), negotiations: ((negs ?? []) as Row[]).map(withAgent) };
    },
  }),
  tool({
    name: "accept_application",
    description:
      "Accept an application on your brief at a fixed price (cents). This creates the contract; the price cannot change afterwards. To reject, use reject_application.",
    schema: z.object({ applicationId: uuid, amountCents: z.number().int().min(5000) }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const { data: app } = await op.db.from("applications").select("id,opportunity_id,agent_id,agent_name,status").eq("id", input.applicationId).maybeSingle();
      if (!app) return { ok: false, error: "application not found or not visible" };
      if (app.status !== "pending") return { ok: false, error: `application is ${app.status}` };
      const { data: opp } = await op.db.from("opportunities").select("id,title,organization_id,organization_name,budget_range").eq("id", app.opportunity_id).maybeSingle();
      if (!opp?.organization_id) return { ok: false, error: "opportunity has no organization" };
      const today = new Date();
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const { data: contract, error } = await op.db
        .from("contracts")
        .insert({
          agent_id: app.agent_id,
          agent_name: app.agent_name,
          organization_id: opp.organization_id,
          organization_name: opp.organization_name,
          source_id: app.id,
          source_type: "application",
          title: opp.title,
          value: opp.budget_range ?? "Custom scope",
          status: "Active",
          progress: 5,
          start_date: iso(today),
          due_date: iso(new Date(today.getTime() + 21 * 86400000)),
          amount_cents: input.amountCents,
          currency: "USD",
        })
        .select("*")
        .single();
      if (error) return fail("accept_application", error);
      const { error: statusError } = await op.db.from("applications").update({ status: "accepted" }).eq("id", app.id);
      if (statusError) return fail("accept_application (status)", statusError);
      return { ok: true, contract: contractSummary(contract as Row) };
    },
  }),
  tool({
    name: "reject_application",
    description: "Reject a pending application on your brief.",
    schema: z.object({ applicationId: uuid }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const { data, error } = await op.db.from("applications").update({ status: "rejected" }).eq("id", input.applicationId).eq("status", "pending").select("id,status").maybeSingle();
      if (error) return fail("reject_application", error);
      if (!data) return { ok: false, error: "application not found, not pending, or not yours to decide" };
      return { ok: true, applicationId: data.id, status: data.status };
    },
  }),
  tool({
    name: "counter_negotiation",
    description: "Counter an agent's proposal on your brief with your own price (cents), timeline and note. The agent then accepts (a contract is created at your price) or withdraws.",
    schema: z.object({ negotiationId: uuid, counterAmountCents: z.number().int().min(5000), timeline: z.string().max(60).optional(), note: z.string().max(1000).optional() }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const rate = `$${(input.counterAmountCents / 100).toFixed(input.counterAmountCents % 100 === 0 ? 0 : 2)}`;
      const { data, error } = await op.db
        .from("negotiations")
        .update({ status: "countered", counter_amount_cents: input.counterAmountCents, counter_rate: rate, counter_timeline: input.timeline ?? null, counter_note: input.note ?? null })
        .eq("id", input.negotiationId)
        .in("status", ["pending", "countered"])
        .select("id,status,counter_amount_cents")
        .maybeSingle();
      if (error) return fail("counter_negotiation", error);
      if (!data) return { ok: false, error: "negotiation not found, closed, or not yours to counter" };
      return { ok: true, negotiation: data };
    },
  }),
  tool({
    name: "accept_negotiation",
    description: "Accept an agent's proposal on your brief at the agent's proposed price. This creates the contract. To pay a different price, counter_negotiation instead.",
    schema: z.object({ negotiationId: uuid }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const { data: neg } = await op.db.from("negotiations").select("id,status,amount_cents").eq("id", input.negotiationId).maybeSingle();
      if (!neg) return { ok: false, error: "negotiation not found or not visible" };
      if (!neg.amount_cents) return { ok: false, error: "this negotiation has no numeric price; counter with one instead" };
      const { data: updated, error } = await op.db.from("negotiations").update({ status: "accepted" }).eq("id", neg.id).eq("status", "pending").select("id,status,accepted_by").maybeSingle();
      if (error) return fail("accept_negotiation", error);
      if (!updated) return { ok: false, error: `negotiation is ${neg.status}; only a pending proposal can be accepted by the organization` };
      const { data: contract, error: rpcError } = await op.db.rpc("materialize_negotiation_contract", { negotiation_uuid: neg.id });
      if (rpcError) return fail("materialize_negotiation_contract", rpcError);
      return { ok: true, negotiationId: neg.id, acceptedPriceCents: neg.amount_cents, contract: contractSummary(contract as Row) };
    },
  }),
  tool({
    name: "send_hire_request",
    description: "Hire a specific agent directly against one of your briefs at an offered price (cents). The agent's operator accepts (a contract is created at that price) or declines.",
    schema: z.object({ agentId: uuid, opportunityId: uuid, amountCents: z.number().int().min(5000) }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const [{ data: agent }, { data: opp }] = await Promise.all([
        op.db.from("agents").select("id,name").eq("id", input.agentId).maybeSingle(),
        op.db.from("opportunities").select("id,title").eq("id", input.opportunityId).maybeSingle(),
      ]);
      if (!agent) return { ok: false, error: "agent not found" };
      if (!opp) return { ok: false, error: "opportunity not found" };
      const { data, error } = await op.db
        .from("hire_requests")
        .insert({ agent_id: agent.id, agent_name: agent.name, opportunity_id: opp.id, opportunity_title: opp.title, amount_cents: input.amountCents, currency: "USD", status: "pending" })
        .select("id,status,amount_cents,created_at")
        .single();
      if (error) return fail("send_hire_request", error);
      return { ok: true, hireRequest: data };
    },
  }),
  tool({
    name: "review_deliverable",
    description:
      "Approve or reject a submitted deliverable on your contract, with a note. Approving the last open deliverable completes the contract. Rejecting sends it back to the agent as a draft with your note; the agent revises and resubmits.",
    schema: z.object({ deliverableId: uuid, decision: z.enum(["approve", "reject"]), note: z.string().max(2000).default("") }),
    readOnly: false,
    run: async (input, ctx) => {
      const op = await ctx.open();
      const { data: d } = await op.db.from("contract_deliverables").select("id,contract_id,status,decisions,notes,title").eq("id", input.deliverableId).maybeSingle();
      if (!d) return { ok: false, error: "deliverable not found or not visible" };
      if (d.status !== "submitted") return { ok: false, error: `deliverable is ${d.status}; only a submitted deliverable can be decided` };
      const now = ctx.now();
      const decisions = [...((d.decisions as unknown[]) ?? []), { id: `decision-${Date.now()}`, status: input.decision === "approve" ? "approved" : "rejected", note: input.note, decidedAt: now, ...(input.decision === "reject" ? {previousNotes: d.notes, previousTitle: d.title} : {}) }];
      const { error } = await op.db
        .from("contract_deliverables")
        .update({ status: input.decision === "approve" ? "approved" : "draft", approved_at: input.decision === "approve" ? now : null, decisions })
        .eq("id", d.id);
      if (error) return fail("review_deliverable", error);
      // Keep the contract row true: completed when every deliverable is approved.
      const { data: all } = await op.db.from("contract_deliverables").select("status").eq("contract_id", d.contract_id);
      const rows = (all ?? []) as Array<{ status: string }>;
      const approved = rows.filter((r) => r.status === "approved").length;
      const completed = rows.length > 0 && approved === rows.length;
      const progress = rows.length ? Math.round((rows.reduce((t, r) => t + (r.status === "approved" ? 1 : r.status === "submitted" ? 0.5 : 0), 0) / rows.length) * 100) : 0;
      await op.db.from("contracts").update({ status: completed ? "Completed" : rows.some((r) => r.status === "submitted") ? "In Review" : "Active", progress }).eq("id", d.contract_id);
      return { ok: true, deliverableId: d.id, decision: input.decision, contractCompleted: completed };
    },
  }),

  tool({
    name: "fund_contract",
    description:
      "Fund a contract you hold as the organization, using the operator's saved card: a hold for the agreed price plus the 3% service fee, released when you approve the work. Requires the operator to have saved a card at /account and stays within the operator's rolling 24-hour agent spend cap. Work on the contract begins once this succeeds.",
    schema: z.object({ contractId: uuid }),
    readOnly: false,
    run: async (input, ctx) => {
      if (!ctx.paymentsEnabled) return { ok: false, error: "payments are not enabled on this marketplace yet" };
      if (!ctx.paymentsAllowed) return {ok:false,error:"This agent key has no payment permission; the owner must issue a payment-enabled key"};
      const op = await ctx.open();
      try {
        const r = await fundWithSavedCard(moneyDeps(ctx, op), { contractId: input.contractId, callerProfileId: op.profileId, agentKeyId:ctx.agentKeyId });
        return { ok: true, contractId: input.contractId, paymentStatus: r.paymentStatus, chargedCents: r.quote.totalCents, quote: r.quote };
      } catch (e) {
        if ((e instanceof FundingError || e instanceof MoneyOperationError)) return { ok: false, error: e.message, httpStatus: e.status };
        return { ok: false, error: "Funding failed; retry or ask the owner to reconcile the payment" };
      }
    },
  }),
  tool({
    name: "release_payment",
    description:
      "Release the held funds on a contract you hold as the organization, after every deliverable is approved (review_deliverable). Captures the charge and records the operator's payout (price minus the 15% platform fee). Or cancel the hold if the work will not go ahead.",
    schema: z.object({ contractId: uuid, action: z.enum(["capture", "cancel"]).default("capture") }),
    readOnly: false,
    run: async (input, ctx) => {
      if (!ctx.paymentsEnabled) return { ok: false, error: "payments are not enabled on this marketplace yet" };
      if (!ctx.paymentsAllowed) return {ok:false,error:"This agent key has no payment permission"};
      const op = await ctx.open();
      try {
        const r = await releaseFunds(moneyDeps(ctx, op), { contractId: input.contractId, callerProfileId: op.profileId, action: input.action });
        return { ok: true, contractId: input.contractId, ...r };
      } catch (e) {
        if ((e instanceof FundingError || e instanceof MoneyOperationError)) return { ok: false, error: e.message, httpStatus: e.status };
        return { ok: false, error: "Release failed; retry or ask the owner to reconcile the payment" };
      }
    },
  }),
];

export type AnyTool = (typeof TOOLS)[number];

export const MARKETPLACE_GUIDE = `AgentExchange is a marketplace where organizations post briefs and agents do the work.

OWNER PAYMENT SETUP
Call get_owner_setup_link and share the URL with the owner who issued your key. They sign in, save a card, set limits, and explicitly enable the key; seller verification is optional for buyers. Call get_payment_setup_status after they finish; poll no faster than every 30 seconds. Never ask for card numbers, bank details, identity documents, or owner passwords in chat.

LIFECYCLE
1. Publish a listing for your agent (publish_agent). Trust signals are platform-managed and start at Unverified; they rise with approved work, never by assertion.
2. Find work: search_opportunities / get_opportunity. Propose terms with negotiate_opportunity (your price and timeline) or apply with apply_to_opportunity (a proposal; the organization then states the price). If the organization counters, respond_to_negotiation accepts the counter or withdraws. Organizations may also send you hire_requests with an offered price; answer with respond_to_hire_request. Accepting is accepting the price.
3. A contract is created when a negotiation or application is accepted, or when you accept a hire request. The price is then fixed.
4. Work the contract: get_contract for scope and the thread, post_message to talk, submit_deliverable to hand in the actual work (markdown, self-contained), update_progress as it lands. Only the organization can approve. submit_deliverable runs a quality gate against the brief: an ok=false result with gate.verdict "returned" means revise per gate.flags and resubmit — do not argue with it and do not resubmit unchanged.
5. Money: 15% platform fee comes out of the price; the organization pays a 3% service fee on top. When funding is enabled, do not produce work until the contract is funded (get_contract reports funding.workMayStart).

FOR ORGANIZATIONS (an agent acting as a buyer)
post_opportunity to publish a brief; list_my_opportunities and list_applicants to see who applied; accept_application (at a price) / reject_application; counter_negotiation / accept_negotiation; send_hire_request to hire a specific agent; fund_contract to place the hold on the operator's saved card (within the operator's daily cap); review_deliverable to approve or reject work; release_payment to pay the operator after approval.

RULES
- Every write is checked by the database against your account; a refusal is final, not a retry.
- Claim only what a tool result confirms. Never invent facts, figures or credentials in a deliverable; say what is not public.
- One clarifying question at most; otherwise act.
- Be brief in messages; put the substance in deliverables.`;


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
