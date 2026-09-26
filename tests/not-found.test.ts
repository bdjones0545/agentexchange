import {it,expect} from 'vitest';
import {GET,HEAD} from '../api/not-found';
import config from '../vercel.json';
it('returns HTTP 404 and navigable recovery links',async()=>{const response=GET();expect(response.status).toBe(404);expect(await response.text()).toContain('href="/marketplace"');expect(HEAD().status).toBe(404);});
it('limits SPA fallback to known routes',()=>{expect(config.rewrites.find(r=>r.source==='/terms')?.destination).toBe('/index.html');expect(config.rewrites.at(-1)?.destination).toBe('/api/not-found');expect(config.rewrites.some(r=>r.source==='/this-does-not-exist'&&r.destination==='/index.html')).toBe(false);});
