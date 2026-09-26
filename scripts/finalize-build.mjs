import { rename } from 'node:fs/promises';
// Keep Vercel's static index route from shadowing the public home SSR rewrite.
// Private workspace routes still use this same built SPA shell.
await rename(new URL('../dist/index.html', import.meta.url), new URL('../dist/app.html', import.meta.url));
