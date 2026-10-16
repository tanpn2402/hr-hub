// Persistence through hrhub.data (browser storage is blocked in the sandbox).
//   settings:<user>                 one small document per user
//   history:<user>:<ts>-<rand>      one record per format (append-only), newest MAX_HISTORY kept per user
const sdk = () => window.hrhub;

export const MAX_HISTORY = 50;
const MAX_VALUE_CHARS = 900000;   // values are capped at ~1 MB by the API

export const DEFAULT_SETTINGS = {
  schemaVersion: 1,
  language: 'xml',
  uiLanguage: 'en',
  lineNumbers: true,
  lineWrapping: false,
  tabSize: 4,
  indentUnit: 2,
  useTabs: false,
  autoFormatOnPaste: true,
  sqlDialect: 'sql',
  sqlKeywordCase: 'preserve',
  outputFontSize: 13,
  historyCollapsed: false,
};

export function userKey(me) {
  const raw = me && me.authenticated ? me.id || me.username : '';
  const safe = String(raw || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
  return safe || 'anon';
}

const settingsKey = (uk) => 'settings:' + uk;
const historyPrefix = (uk) => 'history:' + uk + ':';

export async function loadSettings(uk) {
  const value = await sdk().data.get(settingsKey(uk));
  return { ...DEFAULT_SETTINGS, ...(value && typeof value === 'object' ? value : {}) };
}

export function saveSettings(uk, settings) {
  return sdk().data.set(settingsKey(uk), settings);
}

export async function loadHistory(uk) {
  const prefix = historyPrefix(uk);
  const all = await sdk().data.all();
  return all
    .filter((e) => e.key.startsWith(prefix) && e.value && typeof e.value.input === 'string')
    .map((e) => ({ key: e.key, ...e.value }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// returns the stored entry, or null when the code is too large to keep
export async function addHistory(uk, { language, input, output }) {
  const createdAt = new Date().toISOString();
  const key = historyPrefix(uk) + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  let value = { schemaVersion: 1, language, input, output, createdAt };
  if (input.length + output.length > MAX_VALUE_CHARS) {
    if (input.length > MAX_VALUE_CHARS) return null;
    value = { ...value, output: null };   // keep the input only; the result is formatted again when opened
  }
  await sdk().data.set(key, value);
  return { key, ...value };
}

export function removeHistory(key) {
  return sdk().data.remove(key);
}

// drop entries beyond MAX_HISTORY (oldest first); failures are ignored
export function pruneHistory(entries) {
  const extra = entries.slice(MAX_HISTORY);
  extra.forEach((e) => removeHistory(e.key).catch(() => {}));
  return entries.slice(0, MAX_HISTORY);
}
