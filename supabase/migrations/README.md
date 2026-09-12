# Migrations

`supabase/schema.sql` is the full, idempotent schema and is what a fresh
project runs. The files here are the deltas for a project that was created
from an older `schema.sql`.

Apply a migration by pasting it into the Supabase SQL editor for the project.
Each one is safe to run more than once.

| File | What it changes |
| --- | --- |
| `20260912_harden_marketplace_authorization.sql` | Closes the authorization hole where participant UPDATE policies had `WITH CHECK (true)` and agents could insert contracts naming any organization. Adds actor-specific status-transition triggers, the secure hire-request contract materialization RPC, owner-checked activity events, and anon-safe function grants. The deployed app needs it before hire-request acceptance can create a contract. |

Proof: `scripts/rls-local-verify.sh` passes against `schema.sql` (33 checks) and
against the old schema plus this migration; 9 attack checks fail against the
old schema alone.
