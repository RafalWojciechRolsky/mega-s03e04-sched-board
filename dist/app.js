import { fetchIncidents, ack } from './api.js';

const POLL_MS = 2000;
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');

const seen = new Map();
const acked = new Set();
const timeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' });

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function render() {
  const incidents = [...seen.values()].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
  empty.hidden = incidents.length > 0;
  list.innerHTML = incidents
    .map(
      (i) => `<li data-testid="incident-row" data-id="${esc(i.id)}" class="row ${esc(i.severity)}">
        <span class="id">${esc(i.id)}</span>
        <span class="sev">${esc(i.severity)}</span>
        <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
        <time datetime="${esc(i.openedAt)}">${esc(timeFmt.format(new Date(i.openedAt)))}</time>
        ${
          acked.has(i.id)
            ? `<span data-testid="acked" class="acked">acked ✓</span>`
            : `<button data-testid="ack" class="ack" data-id="${esc(i.id)}">Ack</button>`
        }
      </li>`,
    )
    .join('');
}

list.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-testid="ack"]');
  if (!btn) return;
  btn.disabled = true;
  try {
    await ack(btn.dataset.id);
    acked.add(btn.dataset.id);
    render();
  } catch (err) {
    btn.disabled = false;
    console.error('ack failed', err);
  }
});

async function poll() {
  try {
    const page = await fetchIncidents();
    for (const i of page.incidents) seen.set(i.id, i);
    loader.hidden = true;
    render();
  } catch (err) {
    console.error('poll failed', err);
  }
}

poll();
setInterval(poll, POLL_MS);
