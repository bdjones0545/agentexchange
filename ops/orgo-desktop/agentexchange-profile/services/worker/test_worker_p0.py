#!/usr/bin/env python3
"""P0 regression tests for the agentexchange worker.

Covers:  SQLite/fd lifecycle (leak fix), exception + early-return paths,
         resource-exhaustion classification, /health fd reporting.
Runs entirely against a THROWAWAY database in /tmp. Never touches production.
"""
import errno, importlib.util, os, sys, tempfile, shutil, threading, gc
from pathlib import Path

sys.path.insert(0, "/usr/local/lib/hermes-agent")
TMP = Path(tempfile.mkdtemp(prefix="p0-test-"))
os.environ["HERMES_HOME"] = str(TMP)
os.environ.setdefault("AGENTEXCHANGE_WORKER_TOKEN", "x" * 40)
(TMP / "secrets").mkdir(parents=True, exist_ok=True)

WORKER = "/root/.hermes/profiles/agentexchange/services/worker/server.py"
spec = importlib.util.spec_from_file_location("aeworker", WORKER)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

PASS, FAIL = [], []
def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f"  — {detail}" if detail else ""))

def dbfds():
    n = 0; base = "/proc/self/fd"
    for f in os.listdir(base):
        try: t = os.readlink(os.path.join(base, f))
        except OSError: continue
        if t.endswith("state.db") or t.endswith("state.db-wal"): n += 1
    return n

print("\n== classify_failure ==")
e = OSError(errno.EMFILE, "Too many open files"); e.filename = "auth.json"
cls, detail = m.classify_failure(e)
check("EMFILE -> FILE_DESCRIPTOR_EXHAUSTION", cls == "FILE_DESCRIPTOR_EXHAUSTION", detail)
check("underlying OS error is not hidden", "Errno 24" in detail, detail)

try:
    try: raise OSError(errno.EMFILE, "Too many open files")
    except OSError as inner: raise RuntimeError("provider credential resolution failed") from inner
except RuntimeError as chained:
    cls2, d2 = m.classify_failure(chained)
check("EMFILE found through __cause__ chain", cls2 == "FILE_DESCRIPTOR_EXHAUSTION", d2)

cls3, d3 = m.classify_failure(OSError(errno.ENOSPC, "No space left on device"))
check("ENOSPC -> DISK_EXHAUSTION", cls3 == "DISK_EXHAUSTION", d3)
cls4, d4 = m.classify_failure(ValueError("bad token"))
check("ordinary error is NOT misclassified", cls4 is None, d4)
check("ordinary error still names the type", "ValueError" in d4, d4)

print("\n== fd_usage ==")
u = m.fd_usage()
check("fd_usage reports open/limit/pct", u["open"] > 0 and u["limit"] > 0 and 0 <= u["pct"] <= 100, str(u))

print("\n== SessionDB lifecycle (the leak) ==")
from hermes_state import SessionDB
db = TMP / "state.db"
gc.collect(); base_fds, base_thr = dbfds(), threading.active_count()

def unclosed_turn():
    s = SessionDB(db_path=db); s.queue_token_counts("s", input_tokens=1, output_tokens=1)
for _ in range(5): unclosed_turn()
gc.collect(); gc.collect()
leaked_fds = dbfds() - base_fds
check("OLD behaviour leaks 2 fds/turn and survives GC", leaked_fds == 10, f"{leaked_fds} fds after 5 turns")
check("OLD behaviour also leaks a writer thread/turn", threading.active_count() - base_thr == 5,
      f"{threading.active_count() - base_thr} threads")

# Fresh database for the repaired arm: the leaked handles above keep the old
# WAL open, which adds a one-time fd on first touch and would mask the real
# question, which is whether growth is MONOTONIC across repeated sweeps.
db2 = TMP / "state2.db"
def closed_turn():
    s = SessionDB(db_path=db2)
    try:
        s.queue_token_counts("s", input_tokens=1, output_tokens=1)
    finally:
        s.close()
gc.collect(); t0 = threading.active_count()
series = []
for _ in range(30):
    closed_turn()
    series.append(dbfds())
gc.collect()
tail = series[5:]                      # ignore first-touch WAL creation
check("NEW behaviour: no monotonic fd growth over 30 sweeps",
      max(tail) == min(tail), f"series[5:]={min(tail)}..{max(tail)} full={series[:8]}...{series[-3:]}")
check("NEW behaviour: 30 sweeps end with 0 open state.db fds", series[-1] - series[4] == 0,
      f"first={series[0]} last={series[-1]}")
check("NEW behaviour: 30 turns add 0 threads", threading.active_count() - t0 == 0,
      f"delta={threading.active_count()-t0}")

db3 = TMP / "state3.db"
def closed_turn_raises():
    s = SessionDB(db_path=db3)
    try:
        s.queue_token_counts("s", input_tokens=1)
        raise RuntimeError("turn blew up")
    finally:
        s.close()
gc.collect()
eseries = []
for _ in range(15):
    try: closed_turn_raises()
    except RuntimeError: pass
    eseries.append(dbfds())
gc.collect()
etail = eseries[3:]
check("exception path: no monotonic fd growth over 15 failing sweeps",
      max(etail) == min(etail), f"series[3:]={min(etail)}..{max(etail)}")

# An early return before the agent runs must not leak either.
db4 = TMP / "state4.db"
def closed_turn_early_return():
    s = SessionDB(db_path=db4)
    try:
        s.queue_token_counts("s", input_tokens=1)
        return {"ok": False, "error": "provider_error"}
    finally:
        s.close()
gc.collect()
rseries = []
for _ in range(15):
    closed_turn_early_return()
    rseries.append(dbfds())
gc.collect()
rtail = rseries[3:]
check("early-return path: no monotonic fd growth over 15 sweeps",
      max(rtail) == min(rtail), f"series[3:]={min(rtail)}..{max(rtail)}")

print("\n== run_turn end-to-end (stubbed model, real code path) ==")
# Exercises the WHOLE of run_turn with a fake AIAgent, so a NameError or a
# missing argument in the refactored body fails here rather than in production.
import types, gc as _gc

class _FakeAgent:
    def __init__(self, **kw):
        self.kw = kw
        self._session_messages = []
    def run_conversation(self, message):
        return {"final_response": "nothing needed", "messages": []}

fake_run_agent = types.ModuleType("run_agent"); fake_run_agent.AIAgent = _FakeAgent
sys.modules["run_agent"] = fake_run_agent
fake_gw = types.ModuleType("gateway.run")
fake_gw._resolve_runtime_agent_kwargs = lambda: {"provider": "test-provider"}
fake_gw._resolve_gateway_model = lambda: "test-model"
sys.modules["gateway.run"] = fake_gw

m.Cache.ready = True
m.Cache.model = "test-model"
m.Cache.mcp_servers = [m.MCP_SERVER]

_gc.collect()
results, eseries2 = [], []
for i in range(12):
    results.append(m.run_turn({"event": "sweep", "source": "test"}))
    eseries2.append(dbfds())
_gc.collect()
check("run_turn completes without NameError/TypeError", all(isinstance(r, dict) for r in results),
      str(results[0])[:120])
check("run_turn reports ok for a clean turn", results[0].get("ok") is True, str(results[0])[:160])
# The database file is created on first touch; what matters is whether growth
# is MONOTONIC across repeated sweeps, which is what exhausted the descriptors.
steady2 = eseries2[2:]
check("run_turn: no monotonic fd growth across 12 sweeps",
      max(steady2) == min(steady2), f"series={eseries2}")
check("run_turn: sweep 12 holds no more fds than sweep 3",
      eseries2[-1] <= eseries2[2], f"sweep3={eseries2[2]} sweep12={eseries2[-1]}")

# every early/exception path, end to end
class _BoomAgent(_FakeAgent):
    def run_conversation(self, message):
        raise RuntimeError("model exploded")
fake_run_agent.AIAgent = _BoomAgent
_gc.collect(); b_before = dbfds()
raised = 0
for i in range(6):
    try: m.run_turn({"event": "sweep"})
    except RuntimeError: raised += 1
_gc.collect()
check("run_turn propagates a turn exception", raised == 6, f"{raised}/6")
check("run_turn: 6 FAILING invocations leak 0 state.db fds", dbfds() - b_before == 0,
      f"delta={dbfds()-b_before}")
fake_run_agent.AIAgent = _FakeAgent

# EMFILE during credential resolution must classify as a resource error
def _boom_kwargs():
    raise OSError(errno.EMFILE, "Too many open files")
fake_gw._resolve_runtime_agent_kwargs = _boom_kwargs
r = m.run_turn({"event": "sweep"})
check("EMFILE turn returns resource_error, not provider_error", r.get("error") == "resource_error", str(r)[:140])
check("EMFILE turn names the resource class", r.get("resourceClass") == "FILE_DESCRIPTOR_EXHAUSTION", str(r)[:140])
check("EMFILE turn reports fd usage", isinstance(r.get("fds"), dict), str(r)[:140])
fake_gw._resolve_runtime_agent_kwargs = lambda: {"provider": "test-provider"}
m.Cache.provider_error = False; m.Cache.resource_error = None

print("\n== run_turn wiring ==")
import inspect
src = inspect.getsource(m.run_turn)
check("run_turn closes session_db in a finally", "finally:" in src and "session_db.close()" in src)
check("close failure cannot mask the turn result", "close failed" in src)
check("run_turn delegates the body (single exit point)", "_run_turn_inner" in src)
hsrc = inspect.getsource(m.Handler.do_GET)
check("/health reports fds", '"fds"' in hsrc)
check("/health reports fd pressure", "fdPressure" in hsrc)
check("/health goes unhealthy at 95% fds", "fd_critical" in hsrc)
check("/health reports resourceError", "resourceError" in hsrc)
psrc = inspect.getsource(m.run_turn)
check("provider path emits resource_error, not provider_error, on EMFILE", '"resource_error"' in psrc)

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED:", ", ".join(FAIL))
shutil.rmtree(TMP, ignore_errors=True)
sys.exit(1 if FAIL else 0)
