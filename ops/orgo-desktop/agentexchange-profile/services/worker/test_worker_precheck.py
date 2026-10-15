#!/usr/bin/env python3
"""Sweep pre-check tests for the agentexchange worker.

Covers:  the run/skip decision (changed, owed, fallback, error), the state
         fingerprint (identifiers and statuses only), MCP payload parsing,
         and the job flow (events and POST /sweep always reach the model).
No network, no model, no production state: the MCP reads and run_turn are
stubbed, and HERMES_HOME is a throwaway directory.
"""
import importlib.util, json, os, sys, tempfile, threading, time, types
from pathlib import Path

sys.path.insert(0, "/usr/local/lib/hermes-agent")
TMP = Path(tempfile.mkdtemp(prefix="precheck-test-"))
os.environ["HERMES_HOME"] = str(TMP)
os.environ.setdefault("AGENTEXCHANGE_WORKER_TOKEN", "x" * 40)

WORKER = os.environ.get("WORKER", "/root/.hermes/profiles/agentexchange/services/worker/server.py")
spec = importlib.util.spec_from_file_location("aeworker", WORKER)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

PASS, FAIL = [], []
def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f"  — {detail}" if detail else ""))

HOUR = 3600.0
NOW = 1_800_000_000.0
RETRY, FALLBACK = m.RETRY_SWEEP_SECONDS, m.FALLBACK_SWEEP_SECONDS
check("defaults: retry 2h, fallback 8h, check every 30 min", (RETRY, FALLBACK, m.SWEEP_SECONDS) == (7200, 28800, 1800),
      f"{RETRY} {FALLBACK} {m.SWEEP_SECONDS}")

print("\n== precheck_decision ==")
d = m.precheck_decision
idle = {"pendingHireRequests": 0, "counteredNegotiations": 0}
owed = {"pendingHireRequests": 1, "counteredNegotiations": 0}
check("first check after start runs the model", d(NOW, "aaa", idle, None, 0.0) == (True, "changed"))
check("unchanged, 30 min after a model sweep: skip", d(NOW, "aaa", idle, "aaa", NOW - 0.5 * HOUR) == (False, "unchanged"))
check("unchanged, 7.9h after: skip", d(NOW, "aaa", idle, "aaa", NOW - 7.9 * HOUR) == (False, "unchanged"))
check("unchanged, 8h after: fallback sweep", d(NOW, "aaa", idle, "aaa", NOW - 8 * HOUR) == (True, "fallback"))
check("changed state runs at once", d(NOW, "bbb", idle, "aaa", NOW - 60) == (True, "changed"))
check("pending hire request, 1h after: wait", d(NOW, "aaa", owed, "aaa", NOW - 1 * HOUR) == (False, "unchanged"))
check("pending hire request, 2h after: retry", d(NOW, "aaa", owed, "aaa", NOW - 2 * HOUR) == (True, "owed"))
check("countered negotiation counts as owed",
      d(NOW, "aaa", {"pendingHireRequests": 0, "counteredNegotiations": 1}, "aaa", NOW - 2 * HOUR) == (True, "owed"))
check("owed retries stop after 3 on an unchanged state",
      d(NOW, "aaa", owed, "aaa", NOW - 2 * HOUR, owed_runs=3) == (False, "unchanged"))
check("...but the 8h fallback still runs", d(NOW, "aaa", owed, "aaa", NOW - 8 * HOUR, owed_runs=3) == (True, "fallback"))
check("check failed, 1h after: skip", d(NOW, None, None, "aaa", NOW - 1 * HOUR) == (False, "error"))
check("check failed, 2h after: run the model", d(NOW, None, None, "aaa", NOW - 2 * HOUR) == (True, "error"))
check("check failed at start: run the model", d(NOW, None, None, None, 0.0) == (True, "error"))

print("\n== marketplace_state ==")
def payloads(**over):
    p = {
        "list_hire_requests": {"ok": True, "hireRequests": []},
        "list_contracts": {"ok": True, "contracts": [
            {"id": "c1", "title": "Brief A", "status": "Active", "progress": 100, "paymentStatus": "captured",
             "funding": {"workMayStart": True}, "deliverables": 1, "lastMessageFrom": "Agent", "awaitingReply": False}]},
        "list_my_applications": {"ok": True, "applications": [],
                                 "negotiations": [{"id": "n1", "status": "pending", "counter_amount_cents": None, "counter_note": "x"}]},
        "search_opportunities": {"ok": True, "count": 2, "opportunities": [{"id": "o1", "title": "T1"}, {"id": "o2", "title": "T2"}]},
    }
    p.update(over)
    return lambda name, args: json.loads(json.dumps(p[name]))

sig0, counts0 = m.marketplace_state(payloads())
check("counts", counts0 == {"pendingHireRequests": 0, "activeContracts": 1, "awaitingReply": 0,
                            "counteredNegotiations": 0, "openBriefs": 2}, str(counts0))
check("fingerprint is short hex", len(sig0) == 16 and all(c in "0123456789abcdef" for c in sig0), sig0)
same = m.marketplace_state(payloads(search_opportunities={"ok": True, "opportunities": [{"id": "o2"}, {"id": "o1"}]}))[0]
check("order of rows does not matter", same == sig0)
retitled = m.marketplace_state(payloads(search_opportunities={"ok": True, "opportunities": [
    {"id": "o1", "title": "edited"}, {"id": "o2", "title": "T2", "description": "new text"}]}))[0]
check("titles and brief text are not part of it", retitled == sig0)
new_brief = m.marketplace_state(payloads(search_opportunities={"ok": True, "opportunities": [{"id": "o1"}, {"id": "o2"}, {"id": "o3"}]}))[0]
check("a new open brief changes it", new_brief != sig0)
hr_sig, hr_counts = m.marketplace_state(payloads(list_hire_requests={"ok": True, "hireRequests": [{"id": "h1", "status": "pending"}]}))
check("a pending hire request changes it and is counted", hr_sig != sig0 and hr_counts["pendingHireRequests"] == 1)
msg_p = {"ok": True, "contracts": [{"id": "c1", "status": "Active", "progress": 100, "paymentStatus": "captured",
          "funding": {"workMayStart": True}, "deliverables": 1, "lastMessageFrom": "Organization", "awaitingReply": True}]}
msg_sig, msg_counts = m.marketplace_state(payloads(list_contracts=msg_p))
check("an organization message changes it", msg_sig != sig0 and msg_counts["awaitingReply"] == 1)
ctr_sig, ctr_counts = m.marketplace_state(payloads(list_my_applications={"ok": True, "applications": [],
    "negotiations": [{"id": "n1", "status": "countered", "counter_amount_cents": 15000}]}))
check("a counter-offer changes it and is counted", ctr_sig != sig0 and ctr_counts["counteredNegotiations"] == 1)
funded = {"ok": True, "contracts": [{"id": "c1", "status": "Active", "progress": 100, "paymentStatus": "authorized",
          "funding": {"workMayStart": True}, "deliverables": 1, "lastMessageFrom": "Agent", "awaitingReply": False}]}
check("a funding change changes it", m.marketplace_state(payloads(list_contracts=funded))[0] != sig0)

print("\n== _read_tool payload shapes ==")
class FakeRegistry:
    answer = None
    calls = []
    def dispatch(self, name, args, **kw):
        self.calls.append((name, args))
        return self.answer
fake = FakeRegistry()
saved = {k: sys.modules.get(k) for k in ("tools", "tools.registry")}
if saved["tools"] is None:
    sys.modules["tools"] = types.ModuleType("tools")
sys.modules["tools.registry"] = types.SimpleNamespace(registry=fake)
try:
    body = {"ok": True, "hireRequests": [{"id": "h1"}]}
    for label, wrapped in [
        ("{result: object}", json.dumps({"result": body})),
        ("{result: json text}", json.dumps({"result": json.dumps(body)})),
        ("{result: text, structuredContent}", json.dumps({"result": "2 rows", "structuredContent": body})),
        ("bare object", json.dumps(body)),
    ]:
        fake.answer = wrapped
        got = m._read_tool("list_hire_requests", {"status": "pending"})
        check(f"parses {label}", got.get("hireRequests") == [{"id": "h1"}], str(got)[:80])
    check("calls the registry name the model uses", fake.calls[-1] == ("mcp__agentexchange__list_hire_requests", {"status": "pending"}),
          str(fake.calls[-1]))
    for label, wrapped in [
        ("tool error", json.dumps({"error": "MCP server 'agentexchange' is not connected"})),
        ("ok=false", json.dumps({"result": {"ok": False, "error": "list_contracts: denied"}})),
        ("garbage", "not json"),
    ]:
        fake.answer = wrapped
        try:
            m._read_tool("list_contracts", {})
            check(f"{label} raises", False)
        except RuntimeError:
            check(f"{label} raises", True)
finally:
    for k, v in saved.items():
        if v is None:
            sys.modules.pop(k, None)
        else:
            sys.modules[k] = v

print("\n== handle_job ==")
turns = []
state = {"sig": "aaa", "counts": dict(idle), "fail": False}
def fake_turn(body):
    turns.append(body.get("event"))
    return {"ok": not state["fail"], "text": "x", "actions": []}
def fake_check():
    return (state["sig"], dict(state["counts"])) if state["sig"] else (None, None)
m.run_turn, m._check = fake_turn, fake_check
def reset():
    turns.clear()
    m.Sweep.signature, m.Sweep.last_model_at, m.Sweep.owed_runs = None, 0.0, 0
    m.Sweep.checks = m.Sweep.skipped = m.Sweep.errors = 0
    state.update(sig="aaa", counts=dict(idle), fail=False)

reset()
r = m.handle_job({"event": "sweep", "source": "timer"})
check("first timer sweep runs the model", turns == ["sweep"] and not r.get("skipped"))
check("...and records the state it left", m.Sweep.signature == "aaa" and m.Sweep.last_model_at > 0)
r = m.handle_job({"event": "sweep", "source": "timer"})
check("next timer sweep with nothing changed is skipped", turns == ["sweep"] and r.get("skipped") and r.get("reason") == "unchanged")
check("skips are counted", m.Sweep.skipped == 1 and m.Sweep.checks == 2)
r = m.handle_job({"event": "sweep", "source": "request"})
check("POST /sweep always runs the model", turns == ["sweep", "sweep"])
for ev in ("hire_request", "contract_created", "contract_funded", "message", "deliverable_decision"):
    m.handle_job({"event": ev, "contractId": "c1"})
check("every product event runs the model", turns[2:] == ["hire_request", "contract_created", "contract_funded", "message", "deliverable_decision"])
state["sig"] = "bbb"
m.handle_job({"event": "message", "contractId": "c1"})
check("a turn's own writes are fingerprinted after it", m.Sweep.signature == "bbb")
n = len(turns)
r = m.handle_job({"event": "sweep", "source": "timer"})
check("so the next timer sweep does not re-run to see them", len(turns) == n and r.get("skipped"))

reset()
m.handle_job({"event": "sweep", "source": "timer"})
state["sig"], state["fail"] = "ccc", True
m.handle_job({"event": "hire_request", "hireRequestId": "h1"})
check("a failed turn does not record its state", m.Sweep.signature == "aaa")
n = len(turns)
m.handle_job({"event": "sweep", "source": "timer"})
check("so the next timer sweep retries it", len(turns) == n + 1)

reset()
m.handle_job({"event": "sweep", "source": "timer"})
state["counts"] = dict(owed)
m.Sweep.last_model_at = time.time() - 2 * HOUR
n = len(turns)
m.handle_job({"event": "sweep", "source": "timer"})
check("owed work retries after 2h", len(turns) == n + 1 and m.Sweep.owed_runs == 1)
for _ in range(3):
    m.Sweep.last_model_at = time.time() - 2 * HOUR
    m.handle_job({"event": "sweep", "source": "timer"})
check("owed retries stop at 3", len(turns) == n + 3 and m.Sweep.owed_runs == 3, f"{len(turns) - n} runs")
state["sig"] = "ddd"
m.Sweep.last_model_at = time.time() - 2 * HOUR
m.handle_job({"event": "sweep", "source": "timer"})
check("a state change resets the owed budget", m.Sweep.owed_runs == 0 and m.Sweep.signature == "ddd")

reset()
m.PRECHECK = False
try:
    m.handle_job({"event": "sweep", "source": "timer"})
    m.handle_job({"event": "sweep", "source": "timer"})
    check("PRECHECK=0 restores the old every-tick sweep", turns == ["sweep", "sweep"] and m.Sweep.checks == 0)
finally:
    m.PRECHECK = True

print("\n== job status and health ==")
reset()
m.handle_job({"event": "sweep", "source": "timer"})
threading.Thread(target=m.Jobs.worker, daemon=True).start()
jid = m.Jobs.enqueue({"event": "sweep", "source": "timer"})
for _ in range(50):
    j = m.Jobs.get(jid)
    if j and j["status"] not in ("queued", "running"):
        break
    time.sleep(0.05)
check("a skipped sweep shows as 'skipped', not 'done'", j and j["status"] == "skipped", str(j and j["status"]))
s = m.sweep_status()
check("health reports the sweep block", s["precheck"] is True and s["fallbackSeconds"] == 28800 and s["lastCheck"].get("reason") == "unchanged",
      json.dumps(s, default=str)[:160])
check("health carries no brief text or identifiers beyond the fingerprint",
      set(s["lastCheck"]) == {"at", "run", "reason", "signature", "counts"})

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED:", FAIL)
sys.exit(1 if FAIL else 0)
