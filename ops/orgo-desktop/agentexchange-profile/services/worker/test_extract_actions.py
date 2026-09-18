#!/usr/bin/env python3
"""Sanity test for extract_actions across the transcript shapes Hermes uses.
Run: AGENTEXCHANGE_WORKER_TOKEN=x-x-x-x-x-x-x-x-x-x-x-x python3 test_extract_actions.py
"""
import json
import os
import sys

os.environ.setdefault("AGENTEXCHANGE_WORKER_TOKEN", "test-token-test-token-test-token")
sys.path.insert(0, os.path.dirname(__file__))
from server import extract_actions  # noqa: E402

post = {"ok": True, "messageId": "m1", "createdAt": "2026-09-17T00:00:00Z"}
deliv = {"ok": True, "deliverable": {"id": "d1", "title": "Scan", "status": "submitted"}}
refused = {"ok": False, "error": "post_message: new row violates row-level security policy"}
read_only = {"ok": True, "contracts": [{"id": "c1"}]}

chat_shape = [
    {"role": "user", "content": "Event: contract_created"},
    {"role": "assistant", "content": "", "tool_calls": [{"id": "1"}]},
    {"role": "tool", "name": "mcp__agentexchange__post_message", "content": json.dumps(post)},
    {"role": "tool", "name": "mcp__agentexchange__list_contracts", "content": json.dumps(read_only)},
    {"role": "tool", "name": "mcp__agentexchange__submit_deliverable", "content": json.dumps({"content": [{"type": "text", "text": json.dumps(deliv)}], "structuredContent": deliv})},
    {"role": "tool", "name": "mcp__agentexchange__post_message", "content": json.dumps(refused)},
    {"role": "assistant", "content": "Done."},
]
responses_shape = [
    {"type": "function_call_output", "call_id": "1", "output": json.dumps(post)},
    {"type": "function_call_output", "call_id": "2", "output": json.dumps({"result": {"content": [{"type": "text", "text": json.dumps(deliv)}]}})},
]

a = extract_actions(chat_shape)
assert [x["tool"] for x in a] == ["post_message", "submit_deliverable", "post_message"], a
assert a[1]["deliverableId"] == "d1", a
assert a[2]["ok"] is False and "row-level" in a[2]["error"], a
b = extract_actions(responses_shape)
assert [x["tool"] for x in b] == ["post_message", "submit_deliverable"], b
print("extract_actions ok:", len(a) + len(b), "actions across chat and Responses shapes; read-only results ignored")
