import { describe, expect, it } from "vitest";
import { DISPUTE_REVIEW_DAYS, loadDeletionRequests, loadDisputes, parseDeletionUpdate, updateDeletionRequest } from "../server/supportQueue";
import { DELETION_REQUEST_RESPONSE } from "../server/accountDeletion";
import { reviewNoticeLines } from "../src/components/OwnerReviewNotice";
import { WEBHOOK_EVENT_TYPES } from "../server/agentWebhooks";
import { fakeDb } from "./fakeSupabase";

const NOW = Date.parse("2026-11-26T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const ORG_OWNER = "11111111-1111-4111-8111-111111111111";
const SELLER = "22222222-2222-4222-8222-222222222222";

function disputesDb() {
  return fakeDb({
    tables: {
      disputes: [
        { id: "d-stale", contract_id: "c1", owner_id: ORG_OWNER, reason: "Report missing sources", status: "Open", created_at: daysAgo(12), updated_at: daysAgo(12) },
        { id: "d-active", contract_id: "c2", owner_id: SELLER, reason: "Hold expired", status: "Under Review", created_at: daysAgo(10), updated_at: daysAgo(10) },
        { id: "d-done", contract_id: "c1", owner_id: ORG_OWNER, reason: "Old", status: "Resolved", created_at: daysAgo(30), updated_at: daysAgo(29) },
      ],
      contracts: [
        { id: "c1", title: "Competitive scan", organization_name: "Gym", agent_name: "Analyst", amount_cents: 75000, payment_status: "authorized", organization_id: "o1", agent_id: "a1" },
        { id: "c2", title: "One-pager", organization_name: "Gym", agent_name: "Writer", amount_cents: 35000, payment_status: "authorized", organization_id: "o1", agent_id: "a2" },
      ],
      // A message 2 days ago keeps the second dispute active.
      contract_messages: [{ contract_id: "c2", created_at: daysAgo(2) }, { contract_id: "c1", created_at: daysAgo(20) }],
      organizations: [{ id: "o1", owner_id: ORG_OWNER }],
    },
  });
}

describe("open disputes", () => {
  it("lists open disputes only, flags the ones quiet for 7 days first, and says who opened them", async () => {
    const items = await loadDisputes(disputesDb(), NOW);
    expect(items.map((d) => d.id)).toEqual(["d-stale", "d-active"]);
    expect(items[0]).toMatchObject({ dueForReview: true, quietDays: 12, openedBy: "organization", contractTitle: "Competitive scan", amountCents: 75000 });
    expect(items[1]).toMatchObject({ dueForReview: false, quietDays: 2, openedBy: "agent" });
  });
  it("uses a 7-day rule", () => {
    expect(DISPUTE_REVIEW_DAYS).toBe(7);
  });
});

describe("deletion requests", () => {
  const USER = "33333333-3333-4333-8333-333333333333";
  const REQ = "44444444-4444-4444-8444-444444444444";
  const db = () => fakeDb({
    tables: {
      account_deletion_requests: [
        { id: REQ, user_id: USER, status: "requested", requested_at: daysAgo(3), updated_at: daysAgo(3), response: "We received your request." },
        { id: "55555555-5555-4555-8555-555555555555", user_id: "x", status: "completed", requested_at: daysAgo(40), updated_at: daysAgo(35), response: "Done." },
      ],
      profiles: [{ id: "p1", user_id: USER, email: "seller@example.test", display_name: "Seller" }],
    },
    rpc: (name, args) => (name === "account_deletion_ready" && args.target === "p1" ? { data: false, error: null } : { data: null, error: { message: "no" } }),
  });

  it("lists requests that aren't completed, with whether the account could go now", async () => {
    const items = await loadDeletionRequests(db());
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: REQ, email: "seller@example.test", status: "requested", deletableNow: false });
  });

  it("accepts only a valid status and a real response", () => {
    expect(parseDeletionUpdate({ deletionRequestId: REQ, status: "completed", response: "We deleted your account." })).toEqual({ deletionRequestId: REQ, status: "completed", response: "We deleted your account." });
    expect(parseDeletionUpdate({ deletionRequestId: REQ, status: "requested", response: "Back to the start." })).toBeNull();
    expect(parseDeletionUpdate({ deletionRequestId: REQ, status: "completed", response: "ok" })).toBeNull();
    expect(parseDeletionUpdate({ deletionRequestId: "nope", status: "completed", response: "We deleted your account." })).toBeNull();
  });

  it("saves an update and won't reopen a completed request", async () => {
    const d = db();
    expect(await updateDeletionRequest(d, { deletionRequestId: REQ, status: "processing", response: "We're settling one open contract first." })).toMatchObject({ id: REQ, status: "processing" });
    expect(await updateDeletionRequest(d, { deletionRequestId: "55555555-5555-4555-8555-555555555555", status: "processing", response: "Reopening this one now." })).toBeNull();
  });

  it("never promises a deletion date", () => {
    expect(DELETION_REQUEST_RESPONSE).not.toMatch(/\d+\s*days?/i);
    expect(DELETION_REQUEST_RESPONSE).toContain("A person on our team reviews it");
  });
});

describe("owner notice", () => {
  const empty = { pending: [], rejected: [], disputes: [], deletionRequests: [] };
  it("says nothing when nothing waits", () => {
    expect(reviewNoticeLines(empty, NOW)).toEqual([]);
  });
  it("counts listings, disputes due for review and open deletion requests", () => {
    const lines = reviewNoticeLines({
      ...empty,
      pending: [{ id: "a", name: "A", specialty: "", description: null, startingRate: null, skills: [], jobKinds: [], status: "pending", createdAt: daysAgo(6), updatedAt: null, owner: "x" }],
      disputes: [
        { id: "d1", dueForReview: true } as never,
        { id: "d2", dueForReview: false } as never,
      ],
      deletionRequests: [{ id: "r1", status: "requested" } as never],
    }, NOW);
    expect(lines).toEqual([
      "1 seller listing is waiting for review (oldest 6 days); buyers can't see them until you approve.",
      "1 dispute has been quiet for 7 days and is due for your review.",
      "1 account deletion request needs a person.",
    ]);
  });
});

describe("listing review webhooks", () => {
  it("are part of the event types agents can subscribe to", () => {
    expect(WEBHOOK_EVENT_TYPES).toContain("listing.approved");
    expect(WEBHOOK_EVENT_TYPES).toContain("listing.rejected");
  });
});
