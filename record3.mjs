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
});

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="incident-row"]', { timeout: 15000 });

// 1) the list holds still while new incidents arrive: count rows, wait for the bar
const rowsBefore = await page.$$eval('[data-testid="incident-row"]', (r) => r.map((e) => e.dataset.id));
console.log('rows at open:', rowsBefore.length);
await page.waitForSelector('[data-testid="new-bar"]:not([hidden])', { timeout: 60000 });
const barText = await page.$eval('[data-testid="new-bar"]', (el) => el.textContent);
await page.waitForTimeout(4000); // let more land behind the bar — list must not move
const rowsDuring = await page.$$eval('[data-testid="incident-row"]', (r) => r.map((e) => e.dataset.id));
console.log('bar shows:', barText, '| list still:', JSON.stringify(rowsBefore.slice(0, 3)) === JSON.stringify(rowsDuring.slice(0, 3)));

// 2) click the bar — queued incidents merge in at the top
await page.click('[data-testid="new-bar"]');
await page.waitForTimeout(1000);
const rowsAfter = await page.$$eval('[data-testid="incident-row"]', (r) => r.map((e) => e.dataset.id));
console.log('rows after merge:', rowsAfter.length, '| new top:', rowsAfter[0]);

// 3) ack a specific row — the click lands on the row I mean, no race
const btn = page.locator('[data-testid="incident-row"]').nth(2).locator('button[data-testid="ack"]');
const intended = await page.locator('[data-testid="incident-row"]').nth(2).getAttribute('data-id');
await btn.hover();
await page.waitForTimeout(600);
await btn.click();
await page.waitForSelector(`[data-testid="incident-row"][data-id="${intended}"] [data-testid="acked"]`, { timeout: 10000 });
console.log('INTENDED', intended, '| receipt:', receipts[receipts.length - 1]);
const got = receipts[receipts.length - 1]?.match(/^ack (\S+)/)?.[1];
console.log(intended === got ? 'ACK CORRECT' : 'ACK WRONG');

await page.waitForTimeout(2000);
await context.close();
await browser.close();
