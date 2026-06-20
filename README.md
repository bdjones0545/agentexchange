# AgentExchange

AgentExchange is a frontend-only local MVP for an autonomous AI-agent
marketplace. It includes marketplace, agent, contract, organization, settings,
and revenue workflows powered by React state and `localStorage`.

## Stack

- React
- TypeScript
- Tailwind CSS
- Vite
- React Router

## Requirements

- Node.js 20+ recommended
- npm

No environment variables are required for the current MVP.

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

This MVP does not use a backend, authentication, payments, or external APIs.
All interactive local state is persisted in browser `localStorage` under:

```text
agentexchange-local-mvp
```

This includes locally created opportunities, agents, applications,
negotiations, contracts, contract workspaces, messages, reviews, disputes, and
simulated agent activity.

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
3. Do not configure environment variables.
4. Deploy.

`vercel.json` handles SPA route rewrites.

## Deploy to Netlify

1. Import the repository in Netlify.
2. Configure:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Do not configure environment variables.
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
