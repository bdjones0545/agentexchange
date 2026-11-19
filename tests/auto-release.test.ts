import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_APPROVAL_NOTE, autoReleasePlan, type AutoReleaseInput } from "../src/lib/autoRelease";
import { holdNotice } from "../src/lib/payments";
import { runAutoRelease, type AutoReleaseStore, type ReleaseCandidate } from "../server/autoRelease";
import { reportReconciliationHeartbeat } from "../server/reconciliationHeartbeat";

const H = 3_600_000;
const T0 = Date.parse("2026-11-20T12:00:00Z"); // delivery time in most cases
const sec = (ms: number) => Math.floor(ms / 1000);
const passed = (submittedAt = new Date(T0).toISOString()) => ({ status: "submitted", submittedAt, gateVerdict: "passed" });
const input = (patch: Partial<AutoReleaseInput> = {}): AutoReleaseInput => ({
  paymentStatus: "authorized",
  holdExpiresAt: sec(T0 + 6 * 24 * H), // hold ends 6 days after delivery
  deliverables: [passed()],
  openDisputes: 0,
  ...patch,
});

describe("auto-release rule", () => {
  it("releases 3 days after delivery when the hold lasts longer", () => {
    const plan = autoReleasePlan(input(), T0 + 71 * H);
    expect(plan).toEqual({ eligible: true, releaseAt: T0 + 72 * H, deliveredAt: T0, due: false });
    expect(autoReleasePlan(input(), T0 + 72 * H)).toMatchObject({ eligible: true, due: true });
  });

  it("releases 12 hours before the hold ends when that comes first", () => {
    const plan = autoReleasePlan(input({ holdExpiresAt: sec(T0 + 48 * H) }), T0);
    expect(plan).toMatchObject({ eligible: true, releaseAt: T0 + 36 * H });
  });

  it("always gives the buyer at least 24 hours after delivery", () => {
    const plan = autoReleasePlan(input({ holdExpiresAt: sec(T0 + 30 * H) }), T0);
    expect(plan).toMatchObject({ eligible: true, releaseAt: T0 + 24 * H });
  });

  it("does not release work delivered too close to the end of the hold", () => {
    expect(autoReleasePlan(input({ holdExpiresAt: sec(T0 + 24 * H) }), T0)).toMatchObject({ eligible: false, reason: "delivered_too_late" });
  });

  it("clocks from the latest delivery and covers work approved but never released", () => {
    const later = new Date(T0 + 10 * H).toISOString();
    const plan = autoReleasePlan(input({ deliverables: [{ status: "approved", submittedAt: new Date(T0).toISOString(), gateVerdict: null }, passed(later)] }), T0);
    expect(plan).toMatchObject({ eligible: true, releaseAt: T0 + 82 * H, deliveredAt: T0 + 10 * H });
    const approvedOnly = autoReleasePlan(input({ deliverables: [{ status: "approved", submittedAt: new Date(T0).toISOString(), gateVerdict: null }] }), T0 + 80 * H);
    expect(approvedOnly).toMatchObject({ eligible: true, due: true });
  });

  it.each([
    ["not on hold", { paymentStatus: "captured" }, "not_held"],
    ["no hold expiry", { holdExpiresAt: null }, "hold_expiry_unknown"],
    ["no deliverables", { deliverables: [] }, "nothing_delivered"],
    ["work returned to the seller", { deliverables: [passed(), { status: "draft", submittedAt: null, gateVerdict: "passed" }] }, "work_returned_or_unfinished"],
    ["accepted with flags", { deliverables: [{ ...passed(), gateVerdict: "accepted_with_flags" }] }, "quality_check_not_passed"],
    ["quality gate unavailable", { deliverables: [{ ...passed(), gateVerdict: "unavailable" }] }, "quality_check_not_passed"],
    ["no gate result", { deliverables: [{ ...passed(), gateVerdict: null }] }, "quality_check_not_passed"],
    ["an open dispute", { openDisputes: 1 }, "dispute_open"],
  ] as const)("never releases with %s", (_label, patch, reason) => {
    expect(autoReleasePlan(input(patch as Partial<AutoReleaseInput>), T0 + 100 * H)).toMatchObject({ eligible: false, reason });
  });
});

describe("contract page notice", () => {
  const hold = { holdExpiresAt: sec(T0 + 6 * 24 * H), endedAttempts: 0 };
  const work = { deliverables: [passed()], openDisputes: 0 };
  it("tells the buyer when the platform will approve and release", () => {
    const notice = holdNotice("authorized", hold, true, sec(T0 + 1 * H), work);
    expect(notice?.text).toMatch(/^If you don't review the delivered work, AgentExchange approves it and releases payment on /);
    expect(notice?.tone).toBe("info");
    expect(holdNotice("authorized", hold, true, sec(T0 + 60 * H), work)?.tone).toBe("warning");
  });
  it("tells the seller payment arrives without a buyer click", () => {
    expect(holdNotice("authorized", hold, false, sec(T0 + 1 * H), work)?.text).toMatch(/^If the buyer doesn't respond, payment is released automatically on /);
  });
  it("keeps the old hold warning when the platform will not release", () => {
    const disputed = holdNotice("authorized", hold, true, sec(T0 + 1 * H), { ...work, openDisputes: 1 });
    expect(disputed?.text).toMatch(/^Card hold expires /);
    expect(holdNotice("authorized", hold, true, sec(T0 + 1 * H))?.text).toMatch(/^Card hold expires /);
  });
});

describe("reconcile auto-release step", () => {
  const candidate = (id: string, patch: Partial<ReleaseCandidate> = {}): ReleaseCandidate => ({
    contractId: id, organizationId: `org-${id}`, paymentStatus: "authorized", holdExpiresAt: sec(T0 + 6 * 24 * H), openDisputes: 0,
    deliverables: [{ id: `d-${id}`, decisions: [], ...passed() }], ...patch,
  });
  const setup = (candidates: ReleaseCandidate[]) => {
    const store = { candidates: vi.fn(async () => candidates), approve: vi.fn(async () => {}) } satisfies AutoReleaseStore;
    const release = vi.fn(async () => ({ paymentStatus: "captured" }));
    const notify = vi.fn(async () => ({}));
    const organizationOwner = vi.fn(async (org: string | null) => (org ? `buyer-of-${org}` : null));
    return { store, release, notify, organizationOwner, deps: { store, release, notify, organizationOwner } };
  };

  it("approves and releases a due contract as its buyer, then wakes the worker", async () => {
    const f = setup([candidate("due"), candidate("not-yet", { deliverables: [{ id: "d2", decisions: [], ...passed(new Date(T0 + 50 * H).toISOString()) }] })]);
    const report = await runAutoRelease(f.deps, () => T0 + 73 * H, T0 + 74 * H);
    expect(report).toEqual({ autoReleased: 1, attention: 0, failed: 0 });
    expect(f.store.approve).toHaveBeenCalledOnce();
    expect(f.store.approve).toHaveBeenCalledWith(expect.objectContaining({ contractId: "due" }), new Date(T0 + 73 * H).toISOString());
    expect(f.release).toHaveBeenCalledExactlyOnceWith("due", "buyer-of-org-due");
    expect(f.notify).toHaveBeenCalledWith({ event: "deliverable_decision", contractId: "due" });
  });

  it("captures already-approved work without approving it again", async () => {
    const f = setup([candidate("approved", { deliverables: [{ id: "d", decisions: [], status: "approved", submittedAt: new Date(T0).toISOString(), gateVerdict: null }] })]);
    expect(await runAutoRelease(f.deps, () => T0 + 73 * H, T0 + 74 * H)).toMatchObject({ autoReleased: 1 });
    expect(f.store.approve).not.toHaveBeenCalled();
    expect(f.release).toHaveBeenCalledOnce();
  });

  it("flags delivered work about to lose its hold that the platform may not release", async () => {
    const lapsing = sec(T0 + 20 * H);
    const f = setup([
      candidate("flagged", { holdExpiresAt: lapsing, deliverables: [{ id: "d", decisions: [], ...passed(), gateVerdict: "accepted_with_flags" }] }),
      candidate("disputed", { holdExpiresAt: lapsing, openDisputes: 1 }),
      candidate("far", { holdExpiresAt: sec(T0 + 5 * 24 * H), openDisputes: 1 }),
      candidate("undelivered", { holdExpiresAt: lapsing, deliverables: [] }),
    ]);
    expect(await runAutoRelease(f.deps, () => T0 + 1 * H, T0 + 2 * H)).toEqual({ autoReleased: 0, attention: 2, failed: 0 });
    expect(f.release).not.toHaveBeenCalled();
  });

  it("counts a failed release and keeps going", async () => {
    const f = setup([candidate("a"), candidate("b")]);
    f.release.mockRejectedValueOnce(new Error("capture returned requires_payment_method"));
    expect(await runAutoRelease(f.deps, () => T0 + 73 * H, T0 + 74 * H)).toEqual({ autoReleased: 1, attention: 0, failed: 1 });
  });

  it("never releases without a buyer to act for", async () => {
    const f = setup([candidate("orphan", { organizationId: null })]);
    expect(await runAutoRelease(f.deps, () => T0 + 73 * H, T0 + 74 * H)).toMatchObject({ autoReleased: 0, failed: 1 });
    expect(f.store.approve).not.toHaveBeenCalled();
  });

  it("records a plain note on the approval", () => {
    expect(AUTO_APPROVAL_NOTE).toMatch(/^Approved automatically by AgentExchange/);
  });
});

describe("reconciliation heartbeat", () => {
  const send = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", send);
    send.mockReset().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubEnv("RECONCILIATION_SUCCESS_URL", "");
    vi.stubEnv("RECONCILIATION_FAILURE_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("does nothing until a monitor is configured", async () => {
    await reportReconciliationHeartbeat(true); await reportReconciliationHeartbeat(false);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([true, false])("pings the outcome's URL with counts only: ok=%s", async (ok) => {
    vi.stubEnv("RECONCILIATION_SUCCESS_URL", "https://hc-ping.example/check");
    vi.stubEnv("RECONCILIATION_FAILURE_URL", "https://hc-ping.example/check/fail");
    await reportReconciliationHeartbeat(ok, { failed: 0, attention: ok ? 0 : 1, nonsense: Number.NaN });
    expect(send).toHaveBeenCalledExactlyOnceWith(new URL(ok ? "https://hc-ping.example/check" : "https://hc-ping.example/check/fail"), {
      method: "POST", redirect: "error", signal: expect.any(AbortSignal),
      headers: { "content-type": "application/json" }, body: JSON.stringify({ failed: 0, attention: ok ? 0 : 1 }),
    });
  });

  it.each(["http://hc-ping.example/private", "https://user:secret@hc-ping.example/private"])("refuses unsafe URLs without logging them: %s", async (url) => {
    vi.stubEnv("RECONCILIATION_SUCCESS_URL", url);
    await reportReconciliationHeartbeat(true);
    expect(send).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private");
  });

  it.each(["network", "http"])("swallows delivery failures and redacts the URL: %s", async (kind) => {
    vi.stubEnv("RECONCILIATION_SUCCESS_URL", "https://hc-ping.example/private-token");
    if (kind === "network") send.mockRejectedValue(new Error("private-token"));
    else send.mockResolvedValue(new Response(null, { status: 503 }));
    await expect(reportReconciliationHeartbeat(true)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
});
