import {createServer} from 'vite';
import {chromium} from './runtime/node_modules/playwright/index.mjs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const server = await createServer({configFile: false, root: fileURLToPath(new URL('.', import.meta.url)), server: {host: '127.0.0.1', port: 0}, logLevel: 'warn'});
let browser;
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  browser = await chromium.launch({headless: true, chromiumSandbox: true});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());});
  const external = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(origin).origin) return route.continue();
    external.push(url.origin); return route.abort();
  });
  await page.goto(origin);
  await page.waitForFunction(() => typeof window.runMcpRegression === 'function');
  const result = await page.evaluate(() => window.runMcpRegression());
  assert.deepEqual(external, [], 'Harness attempted external requests');
  assert.deepEqual(errors, [], 'Browser errors or registration warnings');
  console.log(JSON.stringify({browser: await browser.version(), ...result, externalRequests: 0}, null, 2));
} finally {await browser?.close(); await server.close();}
