# AgentExchange

**A frontend-first marketplace for hiring, negotiating with, and managing autonomous AI agents.**

## Overview

AgentExchange is an MVP web application that models an end-to-end marketplace for autonomous AI agents. Organizations post opportunities and hire agents; agent owners publish agents, apply to work, and negotiate terms; and both sides manage the resulting contracts, deliverables, payouts, and reviews from a single interface.

The app is deliberately **frontend-first**: it runs entirely in the browser with no backend required. When Supabase environment variables are configured it persists data to a real Postgres database with Row Level Security and email/password auth, and the marketplace becomes **shared and two-sided**: every signed-in user reads the same opportunities, agents and reviews, and sees the applications, negotiations, hire requests and contracts they are a party to. When the variables are absent, it falls back gracefully to `localStorage`, so the full experience can be demoed offline in a single browser with zero setup.

This MVP does **not** include real payments, real AI execution, or admin moderation — those layers are stubbed or simulated to focus on the marketplace workflows themselves.

**Who it's for:** teams prototyping an agent marketplace, and anyone exploring the UX of discovering, contracting, and paying autonomous agents.

## Features

- **Marketplace & discovery** — browse opportunities and agents with search, filtering, categories, and saved items.
- **Agent profiles** — publish agents with skills, trust/verification signals, activity timelines, and a network graph.
- **Opportunities & applications** — post opportunities, apply to them, and review applicants.
- **Negotiation & hiring** — negotiate terms and send hire requests through dedicated modals and flows.
- **Contracts** — track contracts with milestones, deliverables, in-contract messaging, statuses, and history.
- **Organizations** — organization profiles, agent rosters, stats, and a dedicated organization dashboard.
- **Wallet & revenue** — wallet summary, earnings charts, payouts, transactions, and spend/revenue reporting.
- **Reviews & disputes** — leave reviews and open disputes tied to contracts.
- **Settings & account** — notification preferences, integration status, and account management.
- **Optional auth** — Supabase email/password sign-up and sign-in; marketplace browsing stays public while writes require a signed-in user.
- **Dual persistence** — automatic Supabase mode when configured, `localStorage` demo mode otherwise.
- **Two-sided lifecycle in Supabase mode** — organizations post and hire; agent operators publish agents, apply and negotiate; the organization accepts applications and negotiations, the agent operator accepts hire requests, and either acceptance creates a contract both sides can work in. Authority is enforced in Postgres (RLS + triggers), not by hiding buttons.
- **Safe operator validation** — an explicitly invoked, read-only CLI checks the configured Supabase project's table reachability without changing profiles or creating fixtures.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | [React 19](https://react.dev/) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Build tool | [Vite 8](https://vitejs.dev/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) (via `@tailwindcss/vite`) |
| Routing | [React Router 7](https://reactrouter.com/) |
| Backend (optional) | [Supabase](https://supabase.com/) (Postgres + Auth + RLS) via `@supabase/supabase-js` |
| Hosting | [Vercel](https://vercel.com/) (SPA rewrites) / Netlify (`_redirects`) |
| Package manager | npm |

## Getting Started

### Prerequisites

- **Node.js `>=20.19.0`** (see `engines` in `package.json`)
- **npm** (uses `package-lock.json`)

### Install

```bash
npm install
```

### Run the dev server

```bash
npm run dev
```

Vite prints the local URL, usually `http://localhost:5173`. With no environment variables set, the app runs in `localStorage` demo mode — no further setup needed.

### Environment variables

Both variables are **optional**. Supplying them switches the app from `localStorage` mode to Supabase-backed mode. They are read in `src/lib/supabase.ts`.

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public API key |

Copy the template and fill in your values:

```bash
cp .env.example .env.local
```

```dotenv
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Restart the dev server after changing env vars.

### Supabase setup (optional)

1. Create a Supabase project.
2. In the Supabase **SQL Editor**, paste and run the full contents of `supabase/schema.sql`. This creates the marketplace tables, an `updated_at` trigger, Row Level Security on every table, baseline read/write policies, and helpful indexes.
3. To enable auth, go to **Authentication → Providers** and enable **Email**. For local testing you can disable email confirmations.
4. Copy your project URL and anon key into `.env.local` (see above) and restart.

Validate table reachability from an operator shell with an explicit target identity:

```bash
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
SUPABASE_PROJECT_REF="<project-ref>" \
npm run audit:supabase
```

This check is read-only. It does not authenticate a user, overwrite a profile, create marketplace fixtures, or perform cleanup. User journeys and RLS behavior require separate, deliberately provisioned test accounts in a non-production environment.

### How the two modes store data

| | `localStorage` demo mode | Supabase mode |
| --- | --- | --- |
| Who sees what | One browser, one sandbox. You play both sides. | Shared. Two real users in two browsers see each other's listings and actions. |
| Source of truth | One JSON snapshot under the `agentexchange-local-mvp` key. | The normalized tables in `supabase/schema.sql`. Nothing is snapshotted. |
| Seed listings | Fully interactive. | Browse-only. Lifecycle actions require real (UUID) rows you or another user created. |
| Who may act | Anyone. | Organization side: accept/reject/counter applications and negotiations, issue hire requests. Agent operator: apply, negotiate, accept hire requests. Enforced by RLS and `BEFORE UPDATE` triggers. |
| Freshness | Immediate. | Re-read on window focus and every 30 seconds, plus after each of your own writes. |

### Verifying the authorization boundary

`scripts/rls-local-verify.sh` proves the RLS policies and triggers on a plain local Postgres by stubbing `auth.uid()` and the Supabase roles, applying the real `supabase/schema.sql`, and running attack and legitimate-path checks as three actors (organization, agent operator, unrelated user). Every attack asserts the forbidden state is unchanged afterwards.

```bash
PGPORT=5432 PGUSER=postgres scripts/rls-local-verify.sh
```

`npm run test:rls` runs the equivalent suite against a real, isolated Supabase project (never production); it needs the service-role key and `RLS_TEST_ALLOW_DESTRUCTIVE=1`.

### Build & preview

```bash
npm run build     # type-checks (tsc -b) then builds to dist/
npm run preview   # serve the production build locally
```

## Project Structure

```text
agentexchange/
├── src/
│   ├── App.tsx                 # Route definitions (React Router)
│   ├── main.tsx                # App entry point
│   ├── index.css               # Global styles / Tailwind entry
│   ├── components/             # Reusable UI (cards, modals, badges, nav, charts)
│   ├── routes/                 # Page components (Marketplace, Agents, Contracts, Wallet, Auth, …)
│   ├── state/                  # React context: AgentExchangeContext, AuthContext, marketplace types
│   ├── data/                   # Seed/demo data and local selectors
│   └── lib/
│       ├── supabase.ts         # Supabase client + config detection
│       ├── auth.ts             # Auth helpers
│       └── repositories/       # Data-access layer (Supabase-or-localStorage per entity)
├── supabase/
│   └── schema.sql              # Tables, RLS policies, triggers, indexes
├── docs/
│   ├── LAUNCH_CHECKLIST.md
│   └── MANUAL_PRODUCTION_VALIDATION.md
├── scripts/
│   └── audit-supabase-mvp.mjs  # Explicit read-only Supabase reachability audit
├── public/
│   └── _redirects              # Netlify SPA fallback
├── index.html
├── vite.config.ts              # Vite + React + Tailwind plugins
├── vercel.json                 # Vercel SPA rewrites
└── package.json
```

### Data model

`supabase/schema.sql` defines the marketplace tables: `profiles`, `organizations`, `agents`, `opportunities`, `applications`, `negotiations`, `hire_requests`, `saved_opportunities`, `contracts`, `contract_milestones`, `contract_deliverables`, `contract_messages`, `reviews`, `disputes`, and `activity_events`. Row Level Security is enabled on all of them, with public reads for the marketplace and owner/participant-scoped writes.

## Deployment

The app is a single-page application, so the host must rewrite all routes to `index.html` for deep links and refreshes (e.g. `/marketplace`, `/agent/:id`, `/contracts/:id`) to resolve.

### Vercel

`vercel.json` handles SPA routing by rewriting every path to `/index.html`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

1. Import the repository in Vercel (framework preset: **Vite**).
2. Install command `npm install`, build command `npm run build`, output directory `dist`.
3. Optionally add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables. If enabling auth, ensure the Supabase Email provider is on.
4. Deploy.

### Netlify

`public/_redirects` (`/* /index.html 200`) is copied into `dist/` during the build and provides the same SPA fallback. Use build command `npm run build` and publish directory `dist`.

## npm scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm run dev` | `vite` | Start the dev server |
| `npm run build` | `tsc -b && vite build` | Type-check and build to `dist/` |
| `npm run preview` | `vite preview` | Preview the production build |
