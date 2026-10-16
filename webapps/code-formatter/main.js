import { html, render, useState, useEffect, useRef, useCallback } from './lib.js';
import { LANGUAGES, languageById, format, FormatError } from './formatters.js';
import { translator, locale } from './i18n.js';
import { CodeEditor, Combobox, Icon, IconButton } from './ui.js';
import { openSettings } from './settings.js';
import { DEFAULT_SETTINGS, userKey, loadSettings, saveSettings, loadHistory, addHistory, removeHistory, pruneHistory } from './store.js';

const ZOOM_MIN = 9;
const ZOOM_MAX = 28;

function formatOptions(settings) {
  return {
    indentUnit: settings.indentUnit,
    useTabs: settings.useTabs,
    sqlDialect: settings.sqlDialect,
    sqlKeywordCase: settings.sqlKeywordCase,
    sqlFormatter: window.sqlFormatter,
  };
}

function firstLine(text) {
  const line = (text.split('\n').find((l) => l.trim()) || '').trim();
  return line.length > 70 ? line.slice(0, 70) + '…' : line;
}

function fmtTime(iso, lang) {
  const d = new Date(iso);
  return Number.isNaN(Number(d)) ? '' : d.toLocaleString(locale(lang), { dateStyle: 'short', timeStyle: 'short' });
}

function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// navigator.clipboard is often blocked in the sandboxed iframe: fall back to a hidden textarea + execCommand
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove();
    return ok;
  }
}

function HistoryPanel({ t, lang, state, activeKey, collapsed, onToggle, onOpen, onDelete, onClear }) {
  if (collapsed) {
    return html`<aside class="cf-history cf-history-collapsed" aria-label=${t('history')}>
      <${IconButton} icon="panelLeftOpen" label=${t('showHistory')} onClick=${onToggle} />
      <span class="cf-history-vertical"><${Icon} name="history" /> ${t('history')}${state.entries.length ? ` (${state.entries.length})` : ''}</span>
    </aside>`;
  }
  return html`<aside class="cf-history" aria-label=${t('history')}>
    <div class="cf-pane-head">
      <strong class="cf-pane-title"><${Icon} name="history" /> ${t('history')}</strong>
      ${state.entries.length > 0 && html`<span class="hh-badge hh-badge-secondary">${state.entries.length}</span>`}
      <span class="cf-spacer"></span>
      ${state.entries.length > 0 && html`<button type="button" class="hh-btn hh-btn-ghost hh-btn-xs" onClick=${onClear}>${t('clearHistory')}</button>`}
      <${IconButton} icon="panelLeftClose" label=${t('hideHistory')} onClick=${onToggle} />
    </div>
    <div class="cf-history-list">
      ${state.status === 'loading' && html`<div class="hh-empty"><span class="hh-spinner"></span> ${t('historyLoading')}</div>`}
      ${state.status === 'error' && html`<div class="hh-alert hh-alert-error">${t('loadFailed')}${state.error.message}</div>`}
      ${state.status === 'ready' && !state.entries.length && html`<div class="hh-empty">${t('historyEmpty')}</div>`}
      ${state.entries.map((e) => html`<div
        key=${e.key}
        class=${'cf-history-item' + (e.key === activeKey ? ' cf-active' : '')}
        role="button"
        tabindex="0"
        onClick=${() => onOpen(e)}
        onKeyDown=${(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen(e); } }}
      >
        <div class="cf-history-meta">
          <span class="hh-badge hh-badge-outline">${languageById(e.language).label}</span>
          <span class="hh-muted">${fmtTime(e.createdAt, lang)}</span>
          <span class="cf-spacer"></span>
          <button type="button" class="hh-btn hh-btn-ghost hh-btn-xs cf-icon-btn cf-history-delete" title=${t('delete')} aria-label=${t('delete')}
            onClick=${(ev) => { ev.stopPropagation(); onDelete(e); }}><${Icon} name="x" /></button>
        </div>
        <div class="cf-history-preview hh-mono">${firstLine(e.input) || '—'}</div>
        <div class="hh-muted cf-history-size">${e.input.split('\n').length} ${t('lines')} · ${e.input.length.toLocaleString(locale(lang))} ${t('chars')}</div>
      </div>`)}
    </div>
  </aside>`;
}

function App() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [uk, setUk] = useState('anon');
  const [inputDoc, setInputDoc] = useState({ text: '' });
  const [outputDoc, setOutputDoc] = useState({ text: '' });
  const [status, setStatus] = useState(null);     // { kind: 'success' | 'error' | 'info', text, line? }
  const [history, setHistory] = useState({ status: 'loading', entries: [] });
  const [activeKey, setActiveKey] = useState(null);
  const [maximized, setMaximized] = useState(false);
  const [copyState, setCopyState] = useState('');
  const inputCm = useRef(null);
  const outputCm = useRef(null);
  const live = useRef({});
  const t = translator(settings.uiLanguage);
  const lang = languageById(settings.language);

  live.current = { settings, uk, history };

  // ---- initial load: user -> settings + history
  useEffect(() => {
    let alive = true;
    (async () => {
      let key = 'anon';
      try { key = userKey(await window.hrhub.user.get()); } catch (e) { /* public app, anonymous */ }
      if (!alive) return;
      setUk(key);
      try {
        const s = await loadSettings(key);
        if (alive) setSettings(s);
      } catch (e) {
        if (alive) setStatus({ kind: 'error', text: translator('en')('loadFailed') + e.message });
      }
      if (alive) setReady(true);
      try {
        const entries = await loadHistory(key);
        if (alive) setHistory({ status: 'ready', entries: pruneHistory(entries) });
      } catch (e) {
        if (alive) setHistory({ status: 'error', entries: [], error: e });
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { document.documentElement.lang = settings.uiLanguage; }, [settings.uiLanguage]);

  // persist settings (debounced: zoom clicks, toggles)
  const saveTimer = useRef(null);
  const updateSettings = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveSettings(live.current.uk, next).catch((e) => setStatus({ kind: 'error', text: e.message }));
      }, 500);
      return next;
    });
  }, []);

  // ---- format
  const runFormat = useCallback(async (source, language) => {
    const { uk: key } = live.current;
    const s = language ? { ...live.current.settings, language } : live.current.settings;
    const text = source != null ? source : inputCm.current ? inputCm.current.getValue() : '';
    const tr = translator(s.uiLanguage);
    if (!text.trim()) {
      setStatus({ kind: 'info', text: tr('nothingToFormat') });
      return;
    }
    const started = performance.now();
    let output;
    try {
      output = format(s.language, text, formatOptions(s));
    } catch (e) {
      const where = e instanceof FormatError && e.line ? tr('errorAt', { line: e.line, column: e.column || 1 }) : '';
      setStatus({ kind: 'error', text: where + e.message, line: e instanceof FormatError ? e.line : undefined });
      return;
    }
    setOutputDoc({ text: output });
    setStatus({ kind: 'success', text: tr('formatted', { ms: Math.max(1, Math.round(performance.now() - started)) }) });

    // history: skip when identical to the newest entry
    const newest = live.current.history.entries[0];
    if (newest && newest.input === text && newest.language === s.language) {
      setActiveKey(newest.key);
      return;
    }
    try {
      const entry = await addHistory(key, { language: s.language, input: text, output });
      if (!entry) {
        setStatus({ kind: 'info', text: tr('tooBigForHistory') });
        return;
      }
      setActiveKey(entry.key);
      setHistory((h) => ({ ...h, status: h.status === 'error' ? 'ready' : h.status, entries: pruneHistory([entry, ...h.entries]) }));
    } catch (e) {
      setStatus({ kind: 'error', text: tr('saveHistoryFailed') + e.message });
    }
  }, []);

  const onPaste = useCallback((text) => {
    if (live.current.settings.autoFormatOnPaste) runFormat(text);
  }, []);

  // ---- history actions
  const openEntry = (e) => {
    setActiveKey(e.key);
    if (e.language !== settings.language) updateSettings({ language: e.language });
    setInputDoc({ text: e.input });
    if (e.output != null) {
      setOutputDoc({ text: e.output });
      setStatus(null);
    } else {
      // stored without its result (too large): format again with the entry's language
      runFormat(e.input, e.language);
    }
  };

  const deleteEntry = async (e) => {
    try {
      await removeHistory(e.key);
      setHistory((h) => ({ ...h, entries: h.entries.filter((x) => x.key !== e.key) }));
      if (activeKey === e.key) setActiveKey(null);
    } catch (err) {
      setStatus({ kind: 'error', text: err.message });
    }
  };

  const clearHistory = async () => {
    const ok = await window.hrhub.ui.confirm(t('clearHistoryConfirm'), {
      title: t('confirmTitle'), confirmLabel: t('clearHistory'), cancelLabel: t('cancel'), destructive: true,
    });
    if (!ok) return;
    const entries = history.entries;
    const results = await Promise.allSettled(entries.map((e) => removeHistory(e.key)));
    const failed = entries.filter((e, i) => results[i].status === 'rejected');
    setHistory((h) => ({ ...h, entries: failed }));
    setActiveKey(null);
    if (failed.length) setStatus({ kind: 'error', text: results.find((r) => r.status === 'rejected').reason.message });
  };

  // ---- result actions
  const zoom = (delta) => {
    const size = delta === 0 ? DEFAULT_SETTINGS.outputFontSize : Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, settings.outputFontSize + delta));
    updateSettings({ outputFontSize: size });
  };

  const copyOutput = async () => {
    const ok = await copyText(outputDoc.text);
    setCopyState(ok ? 'copied' : 'failed');
    setTimeout(() => setCopyState(''), 1500);
  };

  useEffect(() => {
    if (!maximized) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) setMaximized(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [maximized]);

  const showSettings = async () => {
    const next = await openSettings(settings);
    if (next) updateSettings(next);
  };

  if (!ready) {
    return html`<div class="cf-loading"><span class="hh-spinner"></span></div>`;
  }

  const languageOptions = LANGUAGES.map((l) => ({ value: l.id, label: l.label }));
  const hasOutput = !!outputDoc.text;
  const zoomPct = Math.round((settings.outputFontSize / DEFAULT_SETTINGS.outputFontSize) * 100);

  return html`<div class=${'cf-app' + (maximized ? ' cf-maximized' : '')}>
    <header class="hh-page-header cf-header">
      <div class="cf-heading">
        <h1>${t('title')}</h1>
        <p class="hh-muted">${t('description')}</p>
      </div>
      <div class="hh-row cf-toolbar">
        <label class="hh-label cf-inline-label" for="language">${t('language')}</label>
        <${Combobox} id="language" ariaLabel=${t('language')} options=${languageOptions} value=${settings.language}
          onChange=${(v) => v && updateSettings({ language: v })} />
        <button type="button" class="hh-btn" onClick=${() => runFormat()} title=${t('formatHint')}>
          <${Icon} name="wand" /> ${t('format')}
        </button>
        <button type="button" class="hh-btn hh-btn-outline" onClick=${showSettings}>
          <${Icon} name="gear" /> ${t('settings')}
        </button>
      </div>
    </header>

    <div class="cf-body">
      <${HistoryPanel}
        t=${t}
        lang=${settings.uiLanguage}
        state=${history}
        activeKey=${activeKey}
        collapsed=${settings.historyCollapsed}
        onToggle=${() => updateSettings({ historyCollapsed: !settings.historyCollapsed })}
        onOpen=${openEntry}
        onDelete=${deleteEntry}
        onClear=${clearHistory}
      />

      <section class="cf-pane cf-input">
        <div class="cf-pane-head">
          <strong class="cf-pane-title">${t('input')}</strong>
          <span class="hh-badge hh-badge-secondary">${lang.label}</span>
          <span class="cf-spacer"></span>
          <${IconButton} icon="eraser" label=${t('clear')} onClick=${() => { setInputDoc({ text: '' }); setStatus(null); setActiveKey(null); if (inputCm.current) inputCm.current.focus(); }} />
        </div>
        <${CodeEditor}
          doc=${inputDoc}
          mode=${lang.mode}
          settings=${settings}
          placeholder=${t('inputPlaceholder')}
          errorLine=${status && status.kind === 'error' ? status.line : null}
          onReady=${(cm) => { inputCm.current = cm; cm.focus(); }}
          onChange=${() => { setStatus((st) => (st && st.line ? { ...st, line: null } : st)); }}
          onPaste=${onPaste}
          onFormatKey=${() => runFormat()}
        />
      </section>

      <section class="cf-pane cf-output">
        <div class="cf-pane-head">
          <strong class="cf-pane-title">${t('output')}</strong>
          <span class="cf-spacer"></span>
          <div class="cf-zoom" role="group" aria-label="Zoom">
            <${IconButton} icon="zoomOut" label=${t('zoomOut')} onClick=${() => zoom(-1)} disabled=${settings.outputFontSize <= ZOOM_MIN} />
            <button type="button" class="hh-btn hh-btn-ghost hh-btn-xs cf-zoom-value" title=${t('zoomReset')} onClick=${() => zoom(0)}>${zoomPct}%</button>
            <${IconButton} icon="zoomIn" label=${t('zoomIn')} onClick=${() => zoom(1)} disabled=${settings.outputFontSize >= ZOOM_MAX} />
          </div>
          <${IconButton} icon="foldAll" label=${t('foldAll')} disabled=${!hasOutput} onClick=${() => outputCm.current && outputCm.current.execCommand('foldAll')} />
          <${IconButton} icon="unfoldAll" label=${t('unfoldAll')} disabled=${!hasOutput} onClick=${() => outputCm.current && outputCm.current.execCommand('unfoldAll')} />
          <${IconButton} icon="copy" label=${copyState === 'copied' ? t('copied') : copyState === 'failed' ? t('copyFailed') : t('copy')} onClick=${copyOutput} disabled=${!hasOutput} />
          <${IconButton} icon="download" label=${t('download')} onClick=${() => downloadText(outputDoc.text + '\n', 'formatted.' + lang.ext)} disabled=${!hasOutput} />
          <${IconButton} icon=${maximized ? 'minimize' : 'maximize'} label=${maximized ? t('restore') : t('maximize')} pressed=${maximized}
            onClick=${() => setMaximized(!maximized)} />
        </div>
        ${status && html`<div class=${'cf-status hh-alert ' + (status.kind === 'error' ? 'hh-alert-error' : status.kind === 'success' ? 'hh-alert-success' : 'hh-alert-info')} role="status">
          ${status.text}
          ${copyState && html` · ${copyState === 'copied' ? t('copied') : t('copyFailed')}`}
        </div>`}
        ${!status && copyState && html`<div class="cf-status hh-alert hh-alert-info" role="status">${copyState === 'copied' ? t('copied') : t('copyFailed')}</div>`}
        <${CodeEditor}
          doc=${outputDoc}
          mode=${lang.mode}
          readOnly=${true}
          settings=${settings}
          fontSize=${settings.outputFontSize}
          placeholder=${t('outputPlaceholder')}
          onReady=${(cm) => { outputCm.current = cm; }}
        />
      </section>
    </div>
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
