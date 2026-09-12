# AgentExchange Launch Checklist

Use this checklist before sharing the AgentExchange MVP publicly.

## Supabase

- [ ] `supabase/schema.sql` has been run in the Supabase SQL editor.
- [ ] All required tables exist.
- [ ] Row Level Security is enabled on every table.
- [ ] RLS policies allow public marketplace reads.
- [ ] RLS policies block cross-user writes.
- [ ] Supabase Email auth is enabled.
- [ ] Test profiles are created for at least two users.

## Vercel

- [ ] Production branch points at the latest `main` commit.
- [ ] Framework preset is `Vite`.
- [ ] Install command is `npm install`.
- [ ] Build command is `npm run build`.
- [ ] Output directory is `dist`.
- [ ] Environment variable `VITE_SUPABASE_URL` is set.
- [ ] Environment variable `VITE_SUPABASE_ANON_KEY` is set.
- [ ] No secrets are committed to `.env.example`.

## Validation

- [ ] Read-only operator validation passes for the explicitly named Supabase
      project using `npm run audit:supabase`.
- [ ] Manual two-user validation has been completed using
      `docs/MANUAL_PRODUCTION_VALIDATION.md`.
- [ ] No browser route performs diagnostic database writes or profile updates.
- [ ] Seed data guard is confirmed: lifecycle actions on non-UUID seed records are refused with a toast in Supabase mode.
- [ ] Two-user check: User B sees User A's opportunity; User A sees User B's application; only User A can accept it; both see the contract.
- [ ] `scripts/rls-local-verify.sh` passes against `supabase/schema.sql`.
- [ ] Created Supabase agents/opportunities use UUIDs.
- [ ] Contracts include valid `organization_id` and `agent_id`.
- [ ] Refresh/reload preserves authenticated Supabase data.
- [ ] Account switching shows scoped records.

## Build

- [ ] `npm install` passes.
- [ ] `npm run build` passes.
- [ ] No `console`, `debugger`, `TODO`, or `FIXME` entries remain in `src`.

## Known MVP limitations

- No payments.
- No real AI/LLM APIs.
- No admin moderation workflow.
- Some activity events remain audit/cache records.
- Seed data remains for public demo browsing.
