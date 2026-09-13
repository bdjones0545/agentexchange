# Codex Handoff 1 — finish the AgentExchange production verification

You are picking up one small, well-defined task. Everything else in this piece
of work is already done, merged, and live. Read this file top to bottom, do the
**one remaining step**, report the result, and you are finished.

---

## The one thing left

Run the automated two-user marketplace journey against the production Supabase
project **once**, and confirm every check passes.

```bash
cd <repo root>   # the agentexchange repo, default branch `main`

SUPABASE_URL="https://ynkxhrptkvefcizxuvhk.supabase.co" \
SUPABASE_ANON_KEY="<anon key — see below>" \
SUPABASE_SERVICE_ROLE_KEY="<service role key — see below>" \
RLS_TEST_ALLOW_DESTRUCTIVE=1 \
npm run journey
```

- The **anon key** is public and committed in `.env.example`-adjacent docs; it is
  the `VITE_SUPABASE_ANON_KEY` the deployed app already ships with. You can also
  read it from the Supabase dashboard (Project Settings → API → anon/public).
- The **service role key** is a secret. Get it from the Supabase dashboard:
  Project Settings → API → `service_role`. Do not commit it, do not paste it
  anywhere public, and prefer setting it inline on the command as above so it
  never lands in a file. It is required because the harness creates and deletes
  its own auth users via the admin API and reads ground truth past RLS.

`npm run journey` runs `scripts/two-user-journey.mjs`. If any required env var is
missing it prints `TWO_USER_JOURNEY_PENDING` and exits `2` — that is a
configuration gate, not a pass and not a failure. With everything set it runs the
journey and exits `0` only if **every** check passed, `1` otherwise.

### What a good run looks like

A `PASS` line per check, a short `Cleanup:` section, and a final
`N/N checks passed`. Example shape (names are stable; ids vary):

```
Two-user journey against https://ynkxhrptkvefcizxuvhk.supabase.co
run id <...>

  PASS  profiles created by trigger for both users
  PASS  A creates an organization owned by A
  ...
  PASS  B can see A's opportunity (shared marketplace)
  PASS  A can see B's application
  PASS  B cannot accept B's own application
  PASS  B cannot manufacture a contract naming A's organization
  PASS  A accepts the application and B sees accepted
  PASS  B materializes the hire contract through the secure RPC
  PASS  retry is idempotent; contract names A's org and B's agent

Cleanup:
  cleanup contracts: 2
  cleanup ... 
  cleanup user <...>: deleted
  cleanup user <...>: deleted

24/24 checks passed
```

### Report back

- **All checks pass (exit 0):** say so plainly. The production two-user
  verification is complete and the whole task is closed. Nothing else to do.
- **Any check fails (exit 1):** paste the failing `FAIL` line(s). The check name
  tells you which invariant broke. The most load-bearing ones and what they mean:
  - `B can see A's opportunity (shared marketplace)` failing → the shared-read
    fix did not take; suspect the deployed app or RLS public-read policies.
  - `B cannot accept B's own application` / `... cannot manufacture a contract`
    failing → the authorization migration is not applied to **this** project.
    Re-check `supabase/migrations/20260912_harden_marketplace_authorization.sql`.
  - `B materializes the hire contract through the secure RPC` failing → the
    `materialize_hire_request_contract` function or its grant is missing.

The harness cleans up after itself even on failure, so it is safe to re-run.

---

## Why this is confirmation, not discovery

Do not treat a green run as the thing that makes the code correct — it is the
last belt-and-suspenders check. The fix is already proven at the database layer:

- The authorization migration is **applied to production** (migration ledger
  entries `20260912232143` and `revoke_trigger_function_execute`), and the live
  policies were verified directly: the participant `UPDATE` policies no longer
  use `WITH CHECK (true)`, the four `enforce_*` triggers exist, the
  `materialize_hire_request_contract` RPC exists, and `anon` cannot execute the
  helper functions.
- `scripts/rls-local-verify.sh` runs 33 attack/allow checks against the exact
  schema on a local Postgres and passes; the same suite fails 9 attack checks
  against the pre-fix schema, so it is proven to detect regressions.
- Demo-mode (localStorage) lifecycle was verified in a browser: post → apply →
  accept → contract, no console errors.

So if the run is green, you are simply recording that production agrees with the
proof. If it is red, something about **this project's** deployed state diverged
from the repo, and the failing check name points at where.

---

## Full context (what was already delivered)

Root defect that was fixed: in Supabase mode the entire app state used to be a
per-user JSON snapshot in `activity_events`; the normalized tables were written
but never read back, so two users never saw each other's data — the marketplace
only worked as a single-browser sandbox. `src/lib/repositories/supabaseStateRepository.ts`
now hydrates state from the normalized tables scoped by RLS; snapshot writes are
gone; state re-reads after each write, on focus, and every 30s. Decision controls
are shown to whichever side holds authority, and Postgres enforces it regardless.

Everything below is **done**:

| Item | State |
| --- | --- |
| Shared two-sided marketplace (app) | Merged (PR #6), live on https://www.agentsexchange.ai |
| Authorization hardening (RLS + triggers + RPC) | Applied to production and verified against live policies |
| `activity_events` owner-checked insert, anon-safe function grants | Applied (migration `revoke_trigger_function_execute`) |
| Supabase Site URL bug (`http://localhost:3000` → `https://www.agentsexchange.ai`) | Fixed in dashboard |
| Leaked-password protection | Enabled in dashboard |
| Duplicate Vercel projects `agentexchange`, `agentexchange-fa3s` (broken install/build commands) | Repaired via API; both build green |
| CI runs vitest + diagnostics again | Green on `main` |
| `npm run journey` two-user validation script | Merged (PR #8) — **this is the thing to run** |

Production coordinates:
- Repo: `bdjones0545/agentexchange`, default branch `main`.
- Supabase project ref: `ynkxhrptkvefcizxuvhk` (name "AgentExchange").
- Vercel production project that serves the domain: `agentexchange-7nnq`.

### Optional tidy-up (not required)

Two throwaway users may still exist from earlier verification attempts:
`bryan.jones+agentexchange-e2e-a-mtz1js6u@efficiencystrengthtraining.com`
(confirmed) and `bryan.jones+agentexchange-e2e-b@efficiencystrengthtraining.com`
(invited, unconfirmed). They are harmless. Delete them from the Supabase
dashboard (Authentication → Users) if you want a clean user list. The
`npm run journey` fixtures are separate and self-delete.
