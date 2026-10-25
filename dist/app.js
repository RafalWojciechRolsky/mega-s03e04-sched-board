import { fetchIncidents, ack } from './api.js';

const POLL_MS = 2000;
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const newBar = document.querySelector('[data-testid="new-bar"]');

const seen = new Map();
const order = [];
const pending = new Map();
const acked = new Set();
const timeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' });

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function render() {
  const incidents = order.map((id) => seen.get(id)).filter(Boolean);
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

function updateBar() {
  const n = pending.size;
  newBar.classList.toggle('show', n > 0);
  if (n) newBar.textContent = `${n} new`;
}

newBar.addEventListener('click', () => {
  for (const [id, i] of pending) seen.set(id, i);
  order.unshift(...pending.keys());
  pending.clear();
  updateBar();
  render();
});

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
    if (seen.size === 0 && pending.size === 0) {
      for (const i of page.incidents) {
        seen.set(i.id, i);
        order.push(i.id);
      }
      loader.hidden = true;
      render();
    } else {
      for (const i of page.incidents) if (!seen.has(i.id)) pending.set(i.id, i);
    }
    updateBar();
  } catch (err) {
    console.error('poll failed', err);
  }
}

poll();
setInterval(poll, POLL_MS);
