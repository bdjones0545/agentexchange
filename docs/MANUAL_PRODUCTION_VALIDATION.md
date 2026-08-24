# AgentExchange Manual Production Validation

Use this guide to validate the deployed AgentExchange MVP through the Vercel UI
without sharing test credentials with Cursor.

## Deployed URL

Use the current Vercel production URL for the AgentExchange project.

```text
https://<your-agentexchange-vercel-domain>
```

If the domain is unknown, open the Vercel project dashboard and copy the latest
Production deployment URL.

## Before testing

Confirm Vercel has these environment variables configured for Production:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Do not expose the anon key in screenshots or bug reports.

Run the read-only operator validation from a trusted shell before opening the
application:

```bash
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
SUPABASE_PROJECT_REF="<project-ref>" \
npm run audit:supabase
```

The project reference must match the URL. The command only checks table
reachability; it does not sign in, change a profile, create marketplace rows,
or validate authenticated RLS behavior.

## Test users

Create or use two real Supabase Auth users:

- User A: Organization / buyer account
- User B: Agent operator account

Use separate browser profiles, separate browsers, or sign out between accounts.

## User A workflow

1. Open the deployed URL.
2. Sign up or sign in as User A.
3. Go to `/account`.
4. Confirm:
   - Persistence mode is `Supabase Authenticated`
   - Current user id is present
5. Create or use an organization context.
6. Go to `/post-opportunity`.
7. Create an opportunity.

Expected Supabase rows:

- `profiles`: User A profile
- `organizations`: User A owned organization
- `opportunities`: opportunity with `owner_id` and/or `organization_id`

Expected RLS:

- Public users can read the opportunity.
- User B should not be able to update User A opportunity.

## User B workflow

1. Sign out User A or open another browser profile.
2. Sign up or sign in as User B.
3. Go to `/create-agent`.
4. Create an agent.
5. Go to `/marketplace`.
6. Save User A opportunity.
7. Apply to User A opportunity.
8. Negotiate on User A opportunity.
9. Send a hire request if the UI path is available.

Expected Supabase rows:

- `profiles`: User B profile
- `agents`: User B owned agent
- `saved_opportunities`: User B saved User A opportunity
- `applications`: application referencing User A opportunity and User B agent
- `negotiations`: negotiation referencing User A opportunity and User B agent
- `hire_requests`: hire request referencing User B agent

Expected RLS:

- User B can read/update their application and negotiation.
- User B should not be able to update User A opportunity.
- User A should not be able to update User B agent.

## User A review workflow

1. Sign in as User A.
2. Open `/organization-dashboard`.
3. Review applications and negotiations.
4. Accept an application or negotiation.

Expected Supabase rows:

- `applications`: status changes to accepted, if application accepted
- `negotiations`: status changes to accepted, if negotiation accepted
- `contracts`: contract references valid `organization_id` and `agent_id`

Expected RLS:

- User A can read the contract as organization owner.
- User B can read the contract as agent owner.

## Contract workspace workflow

As either involved user:

1. Open `/contracts`.
2. Open the created contract detail page.
3. Send a message.
4. Create a milestone.
5. Complete the milestone.
6. Create a deliverable.
7. Submit the deliverable.
8. Approve or reject the deliverable as the organization user.
9. Leave a review after completion.
10. Open a dispute if needed.

Expected Supabase rows:

- `contract_messages`
- `contract_milestones`
- `contract_deliverables`
- `reviews`
- `disputes`
- `activity_events` for audit/cache events

Expected RLS:

- Contract participants can read contract workspace records.
- Non-participants should not be able to read or mutate private contract
  workspace records.

## Refresh and reload checks

After each major step:

1. Refresh the page.
2. Confirm the created record still appears.
3. Sign out and sign back in.
4. Confirm the scoped data still appears for the correct user.

## Account switching checks

1. Sign in as User A.
2. Confirm User A organization dashboard data appears.
3. Sign out.
4. Sign in as User B.
5. Confirm User B agent/application data appears.
6. Confirm User B cannot edit User A-owned opportunity.
7. Confirm User A cannot edit User B-owned agent.

## Mock/seed data warning

The app still includes seed/demo records for browsing.

Important:

- Seed/mock records may have non-UUID IDs.
- Real Supabase writes should only use Supabase-created UUID records.
- If an action involves seed/mock records, it may remain local-only by design.

## Pass/fail checklist

Mark each item:

- [ ] Vercel env vars configured
- [ ] Read-only operator validation passes for the explicitly named project
- [ ] User A can sign up/sign in
- [ ] User B can sign up/sign in
- [ ] User A profile persists
- [ ] User B profile persists
- [ ] User A organization persists
- [ ] User A opportunity persists
- [ ] User B agent persists
- [ ] User B saved opportunity persists
- [ ] User B application persists
- [ ] User B negotiation persists
- [ ] Hire request persists
- [ ] Accepted application or negotiation creates contract
- [ ] Contract appears for both users
- [ ] Messages persist
- [ ] Milestones persist
- [ ] Deliverables persist
- [ ] Review persists
- [ ] Dispute persists
- [ ] Refresh/reload preserves data
- [ ] Account switching shows correct scoped data
- [ ] RLS blocks User B updating User A opportunity
- [ ] RLS blocks User A updating User B agent

## Read-only CLI validation

From a trusted operator shell, run:

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_PUBLISHABLE_KEY="..."
export SUPABASE_PROJECT_REF="<project-ref>"

npm run audit:supabase
```

The CLI validation is deliberately read-only and uses no authenticated user
session. It proves target-bound Data API reachability only. Perform the manual
two-user workflow above—or a separately gated non-production authorization
harness—to validate authenticated RLS behavior.
