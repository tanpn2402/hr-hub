// Persistence (hrhub.data) and the TCP Proxy client.
//   key "settings"            -> { proxyUrl, token, host, port }
//   key "h:<ts>-<rand>"       -> saved request { name, host, port, request, response, elapsedMs, error, timestamp }
// Open tabs are per browser: see tabs.js (hrhub.local).
const MAX_HISTORY = 500;
const hh = () => window.hrhub;

export const DEFAULT_SETTINGS = { proxyUrl: 'http://localhost:8099', token: '', host: '127.0.0.1', port: 8087 };

// One read of the whole app data: "settings" is just one key among the "h:*" history records.
export async function loadAll() {
  const all = await hh().data.all();
  const st = all.find((e) => e.key === 'settings');
  const history = all
    .filter((e) => e.key.startsWith('h:'))
    .map((e) => ({ id: e.key, updatedAt: e.updatedAt, ...e.value }))
    .sort((a, b) => (a.id < b.id ? 1 : -1));
  return { settings: { ...DEFAULT_SETTINGS, ...(st ? st.value : {}) }, history };
}

export const saveSettings = (s) => hh().data.set('settings', s);

const stripId = ({ id, updatedAt, ...rest }) => rest;

export async function addHistory(entry, existing) {
  const id = `h:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await hh().data.set(id, entry);
  // keep the store bounded: soft-delete the oldest beyond MAX_HISTORY
  const extra = existing.slice(MAX_HISTORY - 1);
  await Promise.all(extra.map((e) => hh().data.remove(e.id).catch(() => {})));
  return id;
}

export const renameHistory = (entry, name) => hh().data.set(entry.id, { ...stripId(entry), name });
export const updateHistory = (id, entry) => hh().data.set(id, stripId(entry));
export const deleteHistory = (id) => hh().data.remove(id);

function proxyHeaders(settings) {
  const h = { 'Content-Type': 'application/json' };
  if (settings.token) h['X-TP-Token'] = settings.token;
  return h;
}

const base = (s) => String(s.proxyUrl || '').replace(/\/+$/, '');

// -> { response, elapsed_ms }; throws Error(message) on proxy / TCP failure
export async function sendViaProxy(settings, { host, port, xml }) {
  let res;
  try {
    res = await fetch(base(settings) + '/api/send', {
      method: 'POST',
      headers: proxyHeaders(settings),
      body: JSON.stringify({ host, port, xml, nohistory: true }),
    });
  } catch (e) {
    throw new Error('Không kết nối được TCP Proxy (' + base(settings) + '). Kiểm tra Cài đặt và CORS.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Proxy trả về lỗi ' + res.status);
  return data;
}

export async function pingProxy(settings) {
  const res = await fetch(base(settings) + '/api/ping', { headers: proxyHeaders(settings) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
