import { chromium } from 'playwright';

const BASE = process.env.BOARD_URL || 'http://localhost:8300';
const videoDir = new URL('../video/', import.meta.url).pathname;
const ROW_IDX = Number(process.env.ROW || 2); // which row index I mean to ack

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

// hover the Ack button of the row I mean to take
const btn = page.locator('[data-testid="incident-row"]').nth(ROW_IDX).locator('button[data-testid="ack"]');
const box = await btn.boundingBox();
const intended = await page.locator('[data-testid="incident-row"]').nth(ROW_IDX).getAttribute('data-id');
console.log('INTENDED', intended, 'at', JSON.stringify(box));
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
await page.mouse.move(cx, cy, { steps: 12 }); // person moves to the button

// wait until a NEW row lands at the top, then click those same coords fast — like a person whose eyes lag the shift
const topId = await page.$eval('[data-testid="incident-row"]', (el) => el.dataset.id);
let misbehaved = false;
for (let attempt = 0; attempt < 12 && !misbehaved; attempt++) {
  await page.waitForFunction(
    (prev) => {
      const el = document.querySelector('[data-testid="incident-row"]');
      return el && el.dataset.id !== prev;
    },
    topId,
    { polling: 'raf', timeout: 30000 },
  ).catch(() => null);
  const landed = await page.$eval('[data-testid="incident-row"]', (el) => el.dataset.id);
  console.log('NEW ROW LANDED AT TOP:', landed, '— clicking the coords I was hovering');
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(1200);
  if (receipts.length) {
    const m = receipts[receipts.length - 1].match(/^ack (\S+)/);
    const got = m && m[1];
    console.log('CLICK RESULT: receipt for', got, '| meant', intended, '|', got === intended ? 'ok' : 'MISBEHAVED');
    if (got !== intended) misbehaved = true;
    break;
  }
  console.log('no receipt — click may have been lost to the re-render; retry');
}
await page.waitForTimeout(2500);
console.log('RECEIPTS', JSON.stringify(receipts));
await context.close();
await browser.close();
