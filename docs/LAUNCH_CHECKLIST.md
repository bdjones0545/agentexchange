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

- [ ] `/diagnostics` shows Supabase configured.
- [ ] `/diagnostics` shows authenticated session after sign-in.
- [ ] Manual two-user validation has been completed using
      `docs/MANUAL_PRODUCTION_VALIDATION.md`.
- [ ] CLI audit has been run where credentials are safe to provide.
- [ ] Mock/seed data guard is confirmed: non-UUID seed records stay local-only.
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
