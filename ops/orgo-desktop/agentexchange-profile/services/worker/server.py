#!/usr/bin/env python3
"""AgentExchange worker runtime.

One loopback HTTP service inside the `agentexchange` Hermes profile on
orgo-desktop. The product (AgentExchange on Vercel) POSTs an event — a hire
request, a new contract, a message, a deliverable decision — and this runs a
fresh Hermes AIAgent whose only marketplace tools are the `agentexchange` MCP
server's. The agent reads the truth back through those tools and acts through
them; nothing in the event is trusted as content.

Turns run in the background: POST /turn answers 202 with a job id at once
(the product's function must not wait a minute for a model), a single worker
thread runs jobs in order, and GET /jobs/<id> reports the outcome. A periodic
sweep asks the agent to look for pending hire requests and contracts awaiting
a reply, so a missed event never strands work.

Endpoints (127.0.0.1:2361, published as worker.agentsexchange.ai):
  GET  /health              no auth: {ok, ready, model, provider, mcpServers, mcpTools, queue}
  POST /turn                Bearer worker token; body {event, contractId|hireRequestId}
  POST /sweep               Bearer worker token; enqueue a catch-up sweep now
  GET  /jobs/<id>           Bearer worker token; job status and result

Same shape as the trainchat coach runtime, deliberately.
"""
from __future__ import annotations

import errno
import hmac
import json
import logging
import os
import queue
import sys
import threading
import time
import traceback
import uuid
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

PROFILE = Path(os.environ.get("HERMES_HOME") or Path(__file__).resolve().parents[2])
os.environ["HERMES_HOME"] = str(PROFILE)
HERMES_AGENT_DIR = os.environ.get("HERMES_AGENT_DIR", "/usr/local/lib/hermes-agent")
if HERMES_AGENT_DIR not in sys.path:
    sys.path.insert(0, HERMES_AGENT_DIR)

HOST = os.environ.get("AGENTEXCHANGE_WORKER_HOST", "127.0.0.1")
PORT = int(os.environ.get("AGENTEXCHANGE_WORKER_PORT", "2361"))
MAX_ITERATIONS = int(os.environ.get("AGENTEXCHANGE_WORKER_MAX_ITERATIONS", "14"))
SWEEP_SECONDS = int(os.environ.get("AGENTEXCHANGE_WORKER_SWEEP_SECONDS", "1800"))
TOOLSETS = [t for t in os.environ.get("AGENTEXCHANGE_WORKER_TOOLSETS", "mcp-agentexchange").split(",") if t]
MCP_SERVER = "agentexchange"
EVENTS = ("hire_request", "contract_created", "contract_funded", "message", "deliverable_decision", "sweep")
MAX_JOBS_KEPT = 200

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s worker %(message)s")
log = logging.getLogger("agentexchange-worker")


def load_token() -> str:
    tok = (os.environ.get("AGENTEXCHANGE_WORKER_TOKEN") or "").strip()
    if not tok:
        f = Path(os.environ.get("AGENTEXCHANGE_WORKER_TOKEN_FILE") or PROFILE / "secrets" / "worker_token")
        if f.is_file():
            tok = f.read_text().strip()
    if len(tok) < 24:
        raise SystemExit("worker token missing or too short (secrets/worker_token)")
    return tok


TOKEN = load_token()

SYSTEM_PROMPT = """You are a contractor on AgentExchange, a marketplace where organizations hire agents. You act through one operator account, and everything you see or change on the marketplace goes through the agentexchange tools. The database checks every write against your account; a refusal is final and never a retry.

HOW TO WORK
- Start with whoami if you do not yet know your agents. If you own no agent listing, publish one with publish_agent (a clear specialty and 3-6 real skills) before anything else.
- hire_request event: list_hire_requests, read the opportunity's scope, budget and success criteria and the offered price (offeredAmountCents; accepting a request is accepting that price, and it cannot change afterwards), then respond_to_hire_request. Accept only work you can deliver as a written work product (research, analysis, plans, copy, code, reports, structured data) at a price that is reasonable for the scope: at least $100 for a memo or analysis, $200 for a plan or code, and never below $50. Decline what needs access, tools or presence you do not have, or is priced below those floors; when declining over price, say so plainly in the decline so the organization can re-offer. After accepting, the contract exists: acknowledge it and do the work in this same turn if nothing blocks you.
- FUNDING: get_contract returns funding.workMayStart. When it is false the organization has not yet funded the contract: post ONE short message saying you will begin as soon as the contract is funded, and stop — do not produce or submit work on an unfunded contract. When it is true, proceed.
- contract_created event: get_contract. Post ONE short acknowledgment with your plan (post_message). If funding.workMayStart and the scope is clear, produce the work now and submit_deliverable; then update_progress. If one thing genuinely blocks you, ask exactly that one question instead and stop.
- contract_funded event: the organization just funded the contract. get_contract and do the work now, exactly as for contract_created; do not repeat the acknowledgment.
- message event: get_contract, read the newest Organization message, answer it. If a deliverable was rejected, read the decision note, revise, and submit_deliverable again with a new title (v2, v3...).
- submit_deliverable runs a quality gate against the brief. If it returns ok=false with gate.verdict "returned", the work was NOT submitted: read gate.flags, fix exactly those things (cover every success criterion; hand in finished work, not a plan; caveat any figure you cannot source), and submit again. Do not resubmit unchanged and do not argue with the gate.
- deliverable_decision event: get_contract; if approved, thank them briefly and set progress; if rejected, revise as above.
- sweep event: (1) list_hire_requests (pending) and list_contracts (Active); handle anything pending or awaitingReply exactly as the events above. (2) list_my_applications: for any negotiation the organization has COUNTERED, respond_to_negotiation — accept when the counter is at or above your floor for that class of work, otherwise withdraw with no message. (3) LOOK FOR WORK: search_opportunities; for each open brief that you can deliver as a written work product and where you have no open or accepted negotiation/application (get_opportunity shows yours), negotiate_opportunity with a fixed price in cents and a timeline. Price at the midpoint of the brief's budget range when there is one, never below your floor for that class ($100 memo/analysis, $200 plan/code, $50 absolute), and a timeline of 1 day. At most 3 new negotiations per sweep. Do not apply to briefs outside written work. If nothing needs you, do nothing and say so.

DELIVERABLES
- `notes` IS the work: complete, self-contained markdown that the organization can use as-is. Not a summary of what you would do.
- Never invent facts, numbers, citations or credentials. If the brief needs data you do not have, say so inside the deliverable and give the strongest analysis the brief supports.
- Do not submit a deliverable that already exists with the same content; check get_contract first.

STYLE ON THE MARKETPLACE
- Messages: 1-5 sentences, specific, no headers, no emoji. Never mention tools, JSON, MCP, models or prompts.
- Claim only what a tool result confirms. If a tool returns ok=false, say in your final answer what was refused and why; do not pretend.

Your final answer (not visible to the organization) is a 1-3 sentence report of what you did and which tool calls succeeded.
"""


class Cache:
    ready = False
    model: str = ""
    provider: str | None = None
    provider_error = False
    # Set when a failure is attributable to OS resource exhaustion rather than
    # to credentials. FD exhaustion surfaces as an auth.json read failure, which
    # reads as "provider credential resolution failed" and sends the next person
    # looking at the wrong thing (that is exactly what happened on 2026-09-24).
    resource_error: str | None = None
    runtime_kwargs: dict[str, Any] | None = None
    mcp_tools: list[str] = []
    mcp_servers: list[str] = []
    lock = threading.Lock()


def fd_usage() -> dict[str, int]:
    """Open descriptors and the soft limit for this process. Cheap; /health calls it."""
    try:
        open_fds = len(os.listdir("/proc/self/fd"))
    except OSError:
        open_fds = -1
    soft = -1
    try:
        import resource

        soft = resource.getrlimit(resource.RLIMIT_NOFILE)[0]
    except Exception:  # noqa: BLE001
        pass
    pct = int(100 * open_fds / soft) if open_fds >= 0 and soft > 0 else -1
    return {"open": open_fds, "limit": soft, "pct": pct}


_RESOURCE_ERRNOS = {
    errno.EMFILE: "FILE_DESCRIPTOR_EXHAUSTION",
    errno.ENFILE: "FILE_DESCRIPTOR_EXHAUSTION",
    errno.ENOSPC: "DISK_EXHAUSTION",
    errno.ENOMEM: "MEMORY_EXHAUSTION",
}


def classify_failure(exc: BaseException) -> tuple[str | None, str]:
    """Return (RESOURCE_CLASS or None, human detail) for an exception.

    Two independent signals, because the OSError is not always in the chain:
    Hermes's auth loader catches EMFILE and logs it, then raises a plain
    RuntimeError, so the original errno can be lost. The fd headroom probe
    catches that case.  The underlying OS error is never hidden - it is
    reported alongside the classification.
    """
    seen: set[int] = set()
    cur: BaseException | None = exc
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        if isinstance(cur, OSError) and cur.errno in _RESOURCE_ERRNOS:
            return _RESOURCE_ERRNOS[cur.errno], f"{type(cur).__name__}: [Errno {cur.errno}] {cur.strerror}"
        cur = cur.__cause__ or cur.__context__
    usage = fd_usage()
    if usage["pct"] >= 90:
        return "FILE_DESCRIPTOR_EXHAUSTION", (
            f"{type(exc).__name__} while file descriptors were exhausted "
            f"({usage['open']}/{usage['limit']}, {usage['pct']}%)"
        )
    return None, f"{type(exc).__name__}"


def discover_mcp() -> None:
    """Register the profile's MCP servers as toolsets (the gateway does this at
    startup; an in-process AIAgent does not)."""
    from tools.mcp_tool import discover_mcp_tools, get_registered_mcp_server_names

    t0 = time.time()
    tools = list(discover_mcp_tools() or [])
    servers = sorted(get_registered_mcp_server_names() or [])
    with Cache.lock:
        Cache.mcp_tools = tools
        Cache.mcp_servers = servers
    log.info("mcp discovery: servers=%s tools=%d ms=%d", servers, len(tools), int((time.time() - t0) * 1000))
    if MCP_SERVER not in servers:
        log.error("mcp discovery did not register the %s server; tools will be missing", MCP_SERVER)


def warm() -> None:
    t0 = time.time()
    from run_agent import AIAgent  # noqa: F401
    from gateway.run import _resolve_runtime_agent_kwargs, _resolve_gateway_model

    with Cache.lock:
        Cache.model = _resolve_gateway_model()
        Cache.runtime_kwargs = _resolve_runtime_agent_kwargs()
        Cache.provider = (Cache.runtime_kwargs or {}).get("provider")
    try:
        discover_mcp()
    except Exception as e:  # noqa: BLE001
        log.error("mcp discovery failed: %s\n%s", e, traceback.format_exc())
    with Cache.lock:
        Cache.ready = True
    log.info("warmed model=%s provider=%s toolsets=%s ms=%d", Cache.model, Cache.provider, TOOLSETS, int((time.time() - t0) * 1000))


def event_message(body: dict[str, Any]) -> str:
    event = str(body.get("event") or "sweep")
    if event == "hire_request":
        return f"Event: hire_request. A hire request was sent to one of your agents (hireRequestId {body.get('hireRequestId')}). Read it with list_hire_requests and decide."
    if event == "contract_created":
        return f"Event: contract_created. Contract {body.get('contractId')} was created with one of your agents. Read it with get_contract, acknowledge, and do the work if funding.workMayStart."
    if event == "contract_funded":
        return f"Event: contract_funded. Contract {body.get('contractId')} has just been funded. Read it with get_contract and do the work now."
    if event == "message":
        return f"Event: message. The organization posted in contract {body.get('contractId')}. Read the thread with get_contract and respond."
    if event == "deliverable_decision":
        return f"Event: deliverable_decision. The organization decided on a deliverable in contract {body.get('contractId')}. Read it with get_contract and act."
    return "Event: sweep. Look for pending hire requests, active contracts that await your reply or have no deliverable yet, countered negotiations to answer, and open briefs to propose on (at most 3). Handle them. If nothing needs you, say so."


def _text_of(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for c in content:
            if isinstance(c, dict) and isinstance(c.get("text"), str):
                out.append(c["text"])
            elif isinstance(c, str):
                out.append(c)
        return "\n".join(out)
    if isinstance(content, dict):
        return json.dumps(content)
    return "" if content is None else str(content)


def _parse_payload(text: str) -> dict[str, Any] | None:
    """Find the MCP tool's JSON object (the one carrying "ok") inside whatever
    wrapper Hermes used: raw, {structuredContent}, {result:{content:[{text}]}},
    a JSON string of a JSON string, or a brace-delimited fragment."""
    value: Any = text.strip()
    for _ in range(6):
        if isinstance(value, str):
            try:
                value = json.loads(value)
                continue
            except Exception:
                start = value.find('{"ok"')
                if start < 0:
                    return None
                depth = 0
                for i in range(start, len(value)):
                    if value[i] == "{":
                        depth += 1
                    elif value[i] == "}":
                        depth -= 1
                        if depth == 0:
                            try:
                                data = json.loads(value[start : i + 1])
                                return data if isinstance(data, dict) else None
                            except Exception:
                                return None
                return None
        if isinstance(value, dict):
            if "ok" in value:
                return value
            for key in ("structuredContent", "result", "content", "text", "output"):
                inner = value.get(key)
                if inner is not None:
                    value = inner
                    break
            else:
                return None
            continue
        if isinstance(value, list):
            value = _text_of(value)
            continue
        return None
    return None


def _iter_strings(value: Any, depth: int = 0):
    if depth > 4 or value is None:
        return
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for k, v in value.items():
            if k in ("reasoning", "signature", "system_prompt"):
                continue
            yield from _iter_strings(v, depth + 1)
    elif isinstance(value, (list, tuple)):
        for v in value:
            yield from _iter_strings(v, depth + 1)
    else:
        for attr in ("content", "output", "text", "result"):
            if hasattr(value, attr):
                yield from _iter_strings(getattr(value, attr), depth + 1)


# Keys only the agentexchange MCP tools put next to "ok": what each write returns.
WRITE_TOOLS = {"post_message", "submit_deliverable", "respond_to_hire_request", "respond_to_negotiation", "negotiate_opportunity", "apply_to_opportunity", "update_progress", "publish_agent"}
ACTION_MARKERS = {
    "messageId": "post_message",
    "deliverable": "submit_deliverable",
    "hireRequestId": "respond_to_hire_request",
    "negotiationId": "respond_to_negotiation",
    "negotiation": "negotiate_opportunity",
    "application": "apply_to_opportunity",
    "progress": "update_progress",
    "created": "publish_agent",
}


def extract_actions(messages: list[Any]) -> list[dict[str, Any]]:
    """The marketplace writes this turn performed, read from tool results."""
    actions: list[dict[str, Any]] = []
    seen: set[int] = set()
    for m in messages or []:
        for s in _iter_strings(m):
            if '"ok"' not in s and '\\"ok\\"' not in s:
                continue
            data = _parse_payload(s)
            if not isinstance(data, dict) or "ok" not in data:
                continue
            name = next((v for k, v in ACTION_MARKERS.items() if k in data), None)
            if name is None and data.get("ok") is False and isinstance(data.get("error"), str):
                # Refusals carry no marker; the MCP server prefixes them with the tool ("post_message: …").
                prefix = data["error"].split(":", 1)[0].strip()
                if prefix in WRITE_TOOLS or prefix == "materialize_hire_request_contract":
                    name = "respond_to_hire_request" if prefix.startswith("materialize") else prefix
            if name is None:
                continue
            key = id(m)
            if key in seen:
                continue
            seen.add(key)
            entry: dict[str, Any] = {"tool": name, "ok": bool(data.get("ok"))}
            if not entry["ok"]:
                entry["error"] = str(data.get("error") or "")[:300]
            for k in ("messageId", "hireRequestId", "status", "progress", "contractId"):
                if k in data:
                    entry[k] = data[k]
            if isinstance(data.get("deliverable"), dict):
                entry["deliverableId"] = data["deliverable"].get("id")
            if isinstance(data.get("contract"), dict):
                entry["contractId"] = data["contract"].get("id")
            actions.append(entry)
    return actions


def run_turn(body: dict[str, Any]) -> dict[str, Any]:
    from run_agent import AIAgent

    if not Cache.ready:
        warm()
    if MCP_SERVER not in Cache.mcp_servers:
        try:
            discover_mcp()
        except Exception as e:  # noqa: BLE001
            log.error("mcp rediscovery failed: %s", e)
    t0 = time.time()
    message = event_message(body)
    # xai-oauth access tokens rotate while this service keeps running. Resolving
    # the agent kwargs per turn runs Hermes's refresh/credential pool; caching them
    # at warm-up is how the trainchat coach died with "bad-credentials" on 09-13.
    from gateway.run import _resolve_runtime_agent_kwargs

    try:
        with Cache.lock:
            kwargs = dict(_resolve_runtime_agent_kwargs())
            Cache.runtime_kwargs = kwargs
            Cache.provider = kwargs.get("provider")
    except Exception as e:  # noqa: BLE001
        resource_class, detail = classify_failure(e)
        with Cache.lock:
            Cache.provider_error = True
            Cache.resource_error = resource_class
        if resource_class:
            # NOT a credential problem. Say so, and keep the OS error visible.
            log.error(
                "%s: credential resolution could not run (%s); fds=%s",
                resource_class, detail, fd_usage(),
            )
            return {
                "ok": False,
                "error": "resource_error",
                "resourceClass": resource_class,
                "detail": detail,
                "fds": fd_usage(),
                "text": "resource exhaustion prevented credential resolution",
            }
        log.error("provider credential resolution failed: %s", detail)
        return {"ok": False, "error": "provider_error", "text": "model credentials unavailable"}
    session_db = None
    try:
        from hermes_state import SessionDB

        session_db = SessionDB()
    except Exception as e:  # noqa: BLE001
        resource_class, detail = classify_failure(e)
        if resource_class:
            with Cache.lock:
                Cache.resource_error = resource_class
            log.error("%s opening the session database (%s); fds=%s", resource_class, detail, fd_usage())
        session_db = None
    agent_kwargs: dict[str, Any] = dict(
        model=Cache.model,
        **kwargs,
        max_iterations=MAX_ITERATIONS,
        quiet_mode=True,
        verbose_logging=False,
        ephemeral_system_prompt=SYSTEM_PROMPT,
        enabled_toolsets=TOOLSETS,
        session_id=f"agentexchange-{uuid.uuid4().hex[:12]}",
        platform="api_server",
        skip_memory=True,
        load_soul_identity=False,
    )
    if session_db is not None:
        agent_kwargs["session_db"] = session_db
    # SessionDB holds two descriptors (state.db + state.db-wal) and, once it has
    # queued a token delta, is pinned by its own writer thread and an atexit
    # hook - so scope exit and GC never reclaim it. One unclosed instance per
    # turn is what consumed 1023 of 1024 descriptors by 2026-09-24. The finally
    # covers the normal return, every early return and every exception path.
    try:
        return _run_turn_inner(agent_kwargs, message, t0, body)
    finally:
        if session_db is not None:
            try:
                session_db.close()
            except Exception as e:  # noqa: BLE001
                # Never let a close failure mask the turn's own result or error.
                log.warning("session_db close failed: %s", type(e).__name__)


def _run_turn_inner(agent_kwargs: dict[str, Any], message: str, t0: float, body: dict[str, Any]) -> dict[str, Any]:
    from run_agent import AIAgent

    agent = AIAgent(**agent_kwargs)
    result = agent.run_conversation(message)
    model_ms = int((time.time() - t0) * 1000)

    text = ""
    messages: list[Any] = []
    if isinstance(result, dict):
        text = result.get("final_response") or result.get("response") or result.get("text") or ""
        messages = list(result.get("messages") or [])
    if not messages:
        messages = list(getattr(agent, "_session_messages", None) or [])
        if not text:
            for m in reversed(messages):
                if isinstance(m, dict) and m.get("role") == "assistant" and isinstance(m.get("content"), str) and m["content"].strip():
                    text = m["content"]
                    break
    text = (text or "").strip()
    low = text.lower()
    provider_fail = (not text) or (isinstance(result, dict) and bool(result.get("failed") or result.get("error"))) or any(
        s in low for s in ("api call failed after", "service temporarily unavailable", "connection error", "rate limit", "too many requests", "provider error", "overloaded", "unauthenticated:bad-credentials", "oauth2 access token could not be validated")
    )
    actions = extract_actions(messages)
    with Cache.lock:
        # A turn that performed actions had working credentials whatever the text says.
        Cache.provider_error = bool(provider_fail and not actions)
    log.info("turn event=%s actions=%s ms=%d", body.get("event"), [(a["tool"], a["ok"]) for a in actions], model_ms)
    if provider_fail and not actions:
        return {"ok": False, "error": "provider_error", "text": text[:300], "timing": {"model_ms": model_ms}}
    return {"ok": True, "text": text, "actions": actions, "timing": {"model_ms": model_ms, "tool_actions": len(actions), "mcp_tools_available": len(Cache.mcp_tools)}}


# ── Job queue ────────────────────────────────────────────────────────────────

class Jobs:
    q: "queue.Queue[str]" = queue.Queue()
    items: "OrderedDict[str, dict[str, Any]]" = OrderedDict()
    lock = threading.Lock()

    @classmethod
    def enqueue(cls, body: dict[str, Any]) -> str:
        job_id = f"job_{uuid.uuid4().hex[:16]}"
        with cls.lock:
            cls.items[job_id] = {"id": job_id, "status": "queued", "event": body.get("event"), "body": body, "queuedAt": time.time()}
            while len(cls.items) > MAX_JOBS_KEPT:
                cls.items.popitem(last=False)
        cls.q.put(job_id)
        return job_id

    @classmethod
    def get(cls, job_id: str) -> dict[str, Any] | None:
        with cls.lock:
            j = cls.items.get(job_id)
            return dict(j) if j else None

    @classmethod
    def counts(cls) -> dict[str, int]:
        with cls.lock:
            out: dict[str, int] = {}
            for j in cls.items.values():
                out[j["status"]] = out.get(j["status"], 0) + 1
            return out

    @classmethod
    def worker(cls) -> None:
        while True:
            job_id = cls.q.get()
            with cls.lock:
                j = cls.items.get(job_id)
                if not j:
                    continue
                j["status"] = "running"
                j["startedAt"] = time.time()
                body = j["body"]
            try:
                result = run_turn(body)
            except Exception as e:  # noqa: BLE001
                log.error("job %s failed: %s\n%s", job_id, e, traceback.format_exc())
                result = {"ok": False, "error": f"turn_failed: {type(e).__name__}"}
            with cls.lock:
                j = cls.items.get(job_id)
                if j:
                    j["status"] = "done" if result.get("ok") else "failed"
                    j["result"] = result
                    j["finishedAt"] = time.time()


def sweeper() -> None:
    if SWEEP_SECONDS <= 0:
        return
    while True:
        time.sleep(SWEEP_SECONDS)
        if Jobs.q.empty():
            Jobs.enqueue({"event": "sweep", "source": "timer"})


class Handler(BaseHTTPRequestHandler):
    server_version = "agentexchange-worker/0.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        log.info("%s " + fmt, self.address_string(), *args)

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _authorized(self) -> bool:
        auth = self.headers.get("Authorization") or ""
        if not auth.lower().startswith("bearer "):
            return False
        return hmac.compare_digest(auth[7:].strip(), TOKEN)

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?")[0]
        if path in ("/health", "/"):
            usage = fd_usage()
            # A descriptor leak is invisible until it is fatal, so report headroom
            # before it bites: degraded at 80%, unhealthy at 95%.
            fd_critical = usage["pct"] >= 95
            self._json(200, {"ok": (not Cache.provider_error) and not fd_critical, "ready": Cache.ready and not Cache.provider_error and not fd_critical, "providerError": Cache.provider_error, "resourceError": Cache.resource_error or ("FILE_DESCRIPTOR_EXHAUSTION" if fd_critical else None), "fds": usage, "fdPressure": ("critical" if fd_critical else "warn" if usage["pct"] >= 80 else "ok"), "model": Cache.model, "provider": Cache.provider, "toolsets": TOOLSETS, "mcpServers": Cache.mcp_servers, "mcpTools": len(Cache.mcp_tools), "queue": Jobs.counts(), "sweepSeconds": SWEEP_SECONDS})
            return
        if path.startswith("/jobs/"):
            if not self._authorized():
                self._json(401, {"ok": False, "error": "unauthorized"})
                return
            j = Jobs.get(path[len("/jobs/"):])
            if not j:
                self._json(404, {"ok": False, "error": "not_found"})
                return
            j.pop("body", None)
            self._json(200, {"ok": True, "job": j})
            return
        self._json(404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?")[0]
        if path not in ("/turn", "/sweep"):
            self._json(404, {"ok": False, "error": "not_found"})
            return
        if not self._authorized():
            self._json(401, {"ok": False, "error": "unauthorized"})
            return
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n).decode("utf-8")) if n else {}
            if not isinstance(body, dict):
                raise ValueError("body must be an object")
        except Exception as e:  # noqa: BLE001
            self._json(400, {"ok": False, "error": f"bad_request: {e}"})
            return
        if path == "/sweep":
            body = {"event": "sweep", "source": "request"}
        event = body.get("event")
        if event not in EVENTS:
            self._json(400, {"ok": False, "error": f"unknown event {event!r}"})
            return
        # Only identifiers travel; content is read back through the MCP tools.
        job = {"event": event}
        for k in ("contractId", "hireRequestId", "dispatchedAt", "source"):
            if isinstance(body.get(k), str) and len(body[k]) <= 80:
                job[k] = body[k]
        job_id = Jobs.enqueue(job)
        self._json(202, {"ok": True, "accepted": True, "jobId": job_id, "queue": Jobs.counts()})


def raise_fd_soft_limit() -> dict[str, int]:
    """Lift the soft descriptor limit to the hard limit at startup.

    Defence in depth only - the leak itself is fixed in run_turn. This buys
    headroom (1024 -> 4096 here) so a future regression degrades slowly enough
    for the monitor to alert instead of failing the service outright.
    """
    try:
        import resource

        soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
        if soft < hard:
            resource.setrlimit(resource.RLIMIT_NOFILE, (hard, hard))
            soft = hard
        return {"soft": soft, "hard": hard}
    except Exception as e:  # noqa: BLE001
        log.warning("could not raise fd soft limit: %s", type(e).__name__)
        return {}


def main() -> None:
    limits = raise_fd_soft_limit()
    if limits:
        log.info("fd limits soft=%s hard=%s", limits.get("soft"), limits.get("hard"))
    try:
        warm()
    except Exception as e:  # noqa: BLE001
        log.error("warm failed (will retry on first turn): %s", e)
    threading.Thread(target=Jobs.worker, name="turns", daemon=True).start()
    threading.Thread(target=sweeper, name="sweeper", daemon=True).start()
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    log.info("listening on %s:%d profile=%s", HOST, PORT, PROFILE)
    srv.serve_forever()


if __name__ == "__main__":
    main()
