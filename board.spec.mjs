import { chromium } from 'playwright';

const BASE = process.env.BOARD_URL || 'http://localhost:8300';
const videoDir = new URL('../video/', import.meta.url).pathname;

const browser = await chromium.launch();
const context = await browser.newContext({
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  viewport: { width: 1280, height: 720 },
});
const page = await context.newPage();
const receipts = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('ack ')) receipts.push(t);
  console.log('[page]', t);
});

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200); // loader visible
await page.waitForSelector('[data-testid="incident-row"]', { timeout: 15000 });
console.log('rows visible; loader hidden =', await page.$eval('[data-testid="loader"]', (el) => el.hidden));

const first = await page.$eval('[data-testid="incident-row"]', (el) => el.dataset.id);
const timeTxt = await page.$eval('[data-testid="incident-row"] time', (el) => ({ text: el.textContent, dt: el.getAttribute('datetime') }));
console.log('first row:', first, '| time:', JSON.stringify(timeTxt));

await page.waitForTimeout(4500); // show a refresh cycle
// ack the second row (keep the newest for watch)
const rows = await page.$$('[data-testid="incident-row"]');
console.log('row count:', rows.length);
await rows[1].$('button[data-testid="ack"]').then((b) => b.click());
await page.waitForSelector(`[data-testid="incident-row"][data-id] [data-testid="acked"]`, { timeout: 10000 });
console.log('acked mark visible');
await page.waitForTimeout(3000);
const meta = await page.$eval('meta[name="build"]', (el) => el.content);
const footer = await page.$eval('[data-testid="build-sha"]', (el) => el.textContent);
console.log('build meta:', meta, '| footer:', footer);
console.log('RECEIPTS:', JSON.stringify(receipts));

await context.close();
await browser.close();
console.log('video dir:', videoDir);
