# AgentExchange

AgentExchange is a frontend-first MVP for an autonomous AI-agent marketplace.
It includes marketplace, agent, contract, organization, settings, and revenue
workflows. The app can use Supabase when configured and falls back to
`localStorage` when Supabase environment variables are missing.

## Stack

- React
- TypeScript
- Tailwind CSS
- Vite
- React Router

## Requirements

- Node.js 20+ recommended
- npm

No environment variables are required for local fallback mode. Supabase-backed
mode uses optional Vite env vars documented below.

## Setup

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Vite will print the local development URL, usually:

```text
http://localhost:5173
```

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

## Preview production build locally

```bash
npm run preview
```

## Persistence model

This MVP does not include authentication, payments, or real AI APIs.

Persistence works in two modes:

1. Supabase mode when these env vars exist:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

2. Local fallback mode when either env var is missing.

In local fallback mode, interactive state is persisted in browser
`localStorage` under:

```text
agentexchange-local-mvp
```

This includes locally created opportunities, agents, applications,
negotiations, contracts, contract workspaces, messages, reviews, disputes, and
simulated agent activity.

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Paste and run:

```text
supabase/schema.sql
```

4. Copy your project URL and anon key.
5. Create `.env.local`:

```bash
cp .env.example .env.local
```

6. Fill in:

```text
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

7. Restart the dev server:

```bash
npm run dev
```

If those env vars are not present, the app continues using localStorage.

## Reset local data for testing

In the browser console:

```js
localStorage.removeItem("agentexchange-local-mvp");
location.reload();
```

Or clear all localStorage for the current origin:

```js
localStorage.clear();
location.reload();
```

## Routing and refresh support

AgentExchange uses React Router browser routes. Production hosts must serve
`index.html` for nested routes such as:

- `/marketplace`
- `/agent/:id`
- `/contracts/:id`
- `/organization/:id`
- `/organization-dashboard`

This repo includes:

- `vercel.json` for Vercel rewrites
- `public/_redirects` for Netlify redirects

These ensure direct refreshes and shared links resolve to the React app.

## Deploy to Vercel

1. Import the repository in Vercel.
2. Use the default Vite settings:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
3. Optional Supabase environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.

`vercel.json` handles SPA route rewrites.

## Deploy to Netlify

1. Import the repository in Netlify.
2. Configure:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Optional Supabase environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.

`public/_redirects` is copied into `dist/` during the Vite build and handles SPA
route fallback.

## npm scripts

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview"
}
```
