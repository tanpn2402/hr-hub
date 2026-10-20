import { html, render, useState, useEffect, useMemo, useRef } from './lib.js';
import { XmlEditor } from './editor.js';
import { Field, formDialog, Icon, IconButton, copyText } from './ui.js';
import { openSettings } from './settings.js';
import { formatXml, getMsgId, suggestName } from './xml.js';
import * as store from './store.js';
import { newTab, isDirty, loadTabs, saveTabs } from './tabs.js';

const entryName = (e) => e.name || getMsgId(e.request) || '(không tên)';
const tabName = (t) => t.name || getMsgId(t.xml) || 'Request mới';
const fmtTime = (iso) => new Date(iso).toLocaleString('vi-VN');

function SavedItem({ entry, selected, open, onOpen, onRename, onDelete }) {
  const ok = !entry.error;
  return html`<div class=${'tp-history-item' + (selected ? ' tp-active' : '')} role="button" tabindex="0" onClick=${() => onOpen(entry)}
    onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(entry); } }}>
    <div class="tp-history-meta">
      <span class=${'hh-dot ' + (ok ? 'hh-dot-success' : 'hh-dot-danger')} title=${ok ? 'Thành công' : 'Lỗi'}></span>
      <strong class="tp-history-name">${entryName(entry)}</strong>
      ${open && html`<span class="tp-open-mark" title="Đang mở trong tab"></span>`}
      <span class="tp-history-actions">
        <${IconButton} small icon="pencil" label="Đổi tên" onClick=${(e) => { e.stopPropagation(); onRename(entry); }} />
        <${IconButton} small icon="x" label="Xóa" onClick=${(e) => { e.stopPropagation(); onDelete(entry); }} />
      </span>
    </div>
    <div class="hh-muted tp-history-time">${fmtTime(entry.timestamp)}</div>
    <div class="hh-muted tp-history-size hh-mono">${entry.host}:${entry.port}${entry.elapsedMs != null ? ' · ' + entry.elapsedMs + ' ms' : ''}</div>
  </div>`;
}

function SavedPanel({ saved, visible, loadError, search, setSearch, selectedId, openIds, collapsed, onToggle, onOpen, onRename, onDelete }) {
  const count = saved ? saved.length : 0;
  if (collapsed) {
    return html`<aside class="tp-history tp-history-collapsed" aria-label="Request đã lưu">
      <${IconButton} icon="panelLeftOpen" label="Hiện request đã lưu" onClick=${onToggle} />
      <span class="tp-history-vertical"><${Icon} name="bookmark" /> Đã lưu${count ? ` (${count})` : ''}</span>
    </aside>`;
  }
  return html`<aside class="tp-history" aria-label="Request đã lưu">
    <div class="tp-pane-head">
      <strong class="tp-pane-title"><${Icon} name="bookmark" /> Đã lưu</strong>
      ${count > 0 && html`<span class="hh-badge hh-badge-secondary">${count}</span>`}
      <span class="tp-spacer"></span>
      <${IconButton} icon="panelLeftClose" label="Ẩn danh sách" onClick=${onToggle} />
    </div>
    <div class="tp-history-search">
      <${Icon} name="search" />
      <input class="hh-input" type="search" aria-label="Tìm request đã lưu" placeholder="Tìm theo tên hoặc msgId…" value=${search}
        onInput=${(e) => setSearch(e.target.value)} />
    </div>
    <div class="tp-history-list">
      ${saved === null && !loadError && html`<div class="hh-empty"><span class="hh-spinner"></span></div>`}
      ${saved && !visible.length && html`<div class="hh-empty">${saved.length ? 'Không có kết quả.' : 'Chưa có request nào. Bấm Lưu để giữ request ở đây.'}</div>`}
      ${visible.map((e) => html`<${SavedItem} key=${e.id} entry=${e} selected=${e.id === selectedId} open=${openIds.has(e.id)}
        onOpen=${onOpen} onRename=${onRename} onDelete=${onDelete} />`)}
    </div>
  </aside>`;
}

function TabBar({ tabs, activeId, sendingIds, onSelect, onClose, onAdd }) {
  const listRef = useRef(null);
  // keep the active tab in view (new tab, tab opened from the list)
  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector('.tp-tab-active');
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId, tabs.length]);
  return html`<div class="tp-tabbar">
    <div class="tp-tabs" role="tablist" ref=${listRef}>
      ${tabs.map((t) => {
        const active = t.id === activeId;
        const dirty = isDirty(t);
        return html`<div key=${t.id} role="tab" aria-selected=${active} tabindex=${active ? 0 : -1}
          class=${'tp-tab' + (active ? ' tp-tab-active' : '')} title=${tabName(t) + (t.savedId ? '' : ' (chưa lưu)')}
          onClick=${() => onSelect(t.id)} onAuxClick=${(e) => { if (e.button === 1) { e.preventDefault(); onClose(t); } }}
          onMouseDown=${(e) => { if (e.button === 1) e.preventDefault(); }}>
          ${sendingIds.has(t.id) ? html`<span class="hh-spinner tp-tab-spinner"></span>`
            : html`<${Icon} name=${t.savedId ? 'bookmark' : 'file'} />`}
          <span class=${'tp-tab-name' + (t.savedId ? '' : ' tp-tab-new')}>${tabName(t)}</span>
          ${dirty && html`<span class="tp-dirty" title="Có thay đổi chưa lưu"></span>`}
          <button type="button" class="tp-tab-close" aria-label="Đóng tab" title="Đóng tab"
            onClick=${(e) => { e.stopPropagation(); onClose(t); }}><${Icon} name="x" /></button>
        </div>`;
      })}
    </div>
    <${IconButton} icon="plus" label="Tab mới" onClick=${onAdd} />
  </div>`;
}

function NameBody({ values }) {
  const [name, setName] = useState(values.name);
  return html`<div class="hh-stack">
    <${Field} id="r-name" label="Tên"><input class="hh-input" id="r-name" value=${name} autofocus
      onInput=${(e) => { values.name = e.target.value; setName(e.target.value); }} /><//>
    ${values.hint && html`<p class="hh-muted tp-dialog-hint">${values.hint}</p>`}
  </div>`;
}

const askName = (title, values, actions) => formDialog({ title, width: '28rem', values, Body: NameBody, actions });

// what the response pane shows for a tab
function responseView(t, sending) {
  if (sending) return { text: '', error: null, meta: 'Đang gửi…' };
  const r = t.last;
  if (!r || r.request === undefined) return { text: '', error: null, meta: '' };
  const meta = fmtTime(r.timestamp) + (r.elapsedMs != null ? ' · ' + r.elapsedMs + ' ms' : '');
  return r.error ? { text: '', error: r.error, meta } : { text: formatXml(r.response || ''), error: null, meta };
}

function App() {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [tabs, setTabs] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [sendingIds, setSendingIds] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState('');

  const tab = tabs && (tabs.find((t) => t.id === activeId) || tabs[0]);
  const patchTab = (id, patch) => setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)));

  const reload = async (first = false) => {
    try {
      const data = await store.loadAll();
      setSaved(data.history);
      if (first) {
        setSettings(data.settings);
        if (!data.settings.proxyUrl) editSettings(data.settings);
      }
      return data.history;
    } catch (e) {
      setLoadError(e.message);
      return null;
    }
  };

  useEffect(() => {
    reload(true);
    const init = loadTabs();
    setTabs(init.tabs);
    setActiveId(init.activeId);
  }, []);

  // persist the tabs (debounced: the editor changes them on every keystroke)
  useEffect(() => {
    if (!tabs) return undefined;
    const timer = setTimeout(() => saveTabs(tabs, activeId), 400);
    return () => clearTimeout(timer);
  }, [tabs, activeId]);

  const editSettings = async (current) => {
    const s = await openSettings(current || settings || store.DEFAULT_SETTINGS);
    if (s) setSettings(s);
  };

  // ---------- tabs ----------

  const addTab = () => {
    const t = newTab();
    setTabs((ts) => [...ts, t]);
    setActiveId(t.id);
  };

  const closeTab = async (t) => {
    if (isDirty(t) && !(await window.hrhub.ui.confirm(`"${tabName(t)}" có thay đổi chưa lưu. Đóng tab?`, { destructive: true, confirmLabel: 'Đóng' }))) return;
    const i = tabs.findIndex((x) => x.id === t.id);
    const rest = tabs.filter((x) => x.id !== t.id);
    if (!rest.length) rest.push(newTab());
    setTabs(rest);
    if (t.id === tab.id) setActiveId(rest[Math.min(i, rest.length - 1)].id);
  };

  // opens a saved request: focus its tab when already open, else reuse an empty new tab, else add a tab
  const openSaved = (e) => {
    const existing = tabs.find((t) => t.savedId === e.id);
    if (existing) { setActiveId(existing.id); return; }
    const t = newTab({ savedId: e.id, name: entryName(e), xml: e.request, savedXml: e.request, last: e });
    const blank = tab && !tab.savedId && !tab.xml.trim() && !tab.last && !sendingIds.has(tab.id);
    setTabs((ts) => (blank ? ts.map((x) => (x.id === tab.id ? t : x)) : [...ts, t]));
    setActiveId(t.id);
  };

  // ---------- saved requests ----------

  const rename = async (entry) => {
    const values = { name: entry.name || entryName(entry) };
    const action = await askName('Đổi tên request', values,
      [{ label: 'Hủy', value: 'cancel', variant: 'outline' }, { label: 'Lưu', value: 'save', autofocus: true }]);
    if (action !== 'save') return;
    const name = values.name.trim();
    try {
      await store.renameHistory(entry, name);
      setTabs((ts) => ts.map((t) => (t.savedId === entry.id ? { ...t, name: name || entryName(entry) } : t)));
      reload();
    } catch (e) {
      window.hrhub.ui.alert('Không đổi tên được: ' + e.message);
    }
  };

  const remove = async (e) => {
    if (!(await window.hrhub.ui.confirm(`Xóa "${entryName(e)}"?`, { destructive: true, confirmLabel: 'Xóa' }))) return;
    try {
      await store.deleteHistory(e.id);
      // tabs of the deleted request stay open as new (unsaved) requests
      setTabs((ts) => ts.map((t) => (t.savedId === e.id ? { ...t, savedId: null, savedXml: '' } : t)));
      reload();
    } catch (err) {
      window.hrhub.ui.alert(err.status === 403 ? 'Bạn không có quyền xóa bản ghi này.' : err.message);
    }
  };

  // ---------- send / save (act on the tab that was active when started) ----------

  const send = async () => {
    const t = tab;
    if (!t || !t.xml.trim() || sendingIds.has(t.id) || !settings) return;
    const { host, port } = settings;
    setSendingIds((s) => new Set(s).add(t.id));
    const result = { host, port, request: t.xml, timestamp: new Date().toISOString(), response: null, elapsedMs: null, error: null };
    try {
      const data = await store.sendViaProxy(settings, { host, port, xml: t.xml });
      result.response = data.response;
      result.elapsedMs = data.elapsed_ms;
    } catch (e) {
      result.error = e.message;
    }
    patchTab(t.id, { last: result });
    setSendingIds((s) => { const n = new Set(s); n.delete(t.id); return n; });
  };

  const save = async () => {
    const t = tab;
    if (!t || !t.xml.trim() || !settings) return;
    const entry = t.savedId && saved && saved.find((e) => e.id === t.savedId);
    const cancel = { label: 'Hủy', value: 'cancel', variant: 'outline' };
    const values = entry
      ? { name: entryName(entry), hint: `Lưu đè sẽ thay nội dung của "${entryName(entry)}". Lưu mới tạo một request khác và giữ nguyên request cũ.` }
      : { name: suggestName(t.xml) };
    const action = await askName('Lưu request', values, entry
      ? [cancel, { label: 'Lưu mới', value: 'new', variant: 'outline' }, { label: 'Lưu đè', value: 'overwrite', autofocus: true }]
      : [cancel, { label: 'Lưu', value: 'new', autofocus: true }]);
    if (action !== 'new' && action !== 'overwrite') return;
    const name = values.name.trim() || suggestName(t.xml);
    const base = t.last && t.last.request === t.xml && t.last.timestamp
      ? { host: t.last.host, port: t.last.port, request: t.last.request, timestamp: t.last.timestamp, response: t.last.response, elapsedMs: t.last.elapsedMs, error: t.last.error }
      : { host: settings.host, port: settings.port, request: t.xml, timestamp: new Date().toISOString(), response: null, elapsedMs: null, error: null };
    const record = { ...base, name };
    try {
      let id = t.savedId;
      if (action === 'overwrite') await store.updateHistory(id, record);
      else id = await store.addHistory(record, saved || []);
      patchTab(t.id, (cur) => ({ savedId: id, name, savedXml: t.xml, last: cur.last && cur.last.request === t.xml ? cur.last : { ...record, id } }));
      reload();
    } catch (e) {
      window.hrhub.ui.alert('Không lưu được: ' + e.message);
    }
  };

  // Ctrl+S anywhere (also inside the editor) saves the active tab
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!saved) return [];
    return q ? saved.filter((e) => entryName(e).toLowerCase().includes(q) || getMsgId(e.request).toLowerCase().includes(q)) : saved;
  }, [saved, search]);

  const openIds = useMemo(() => new Set((tabs || []).map((t) => t.savedId).filter(Boolean)), [tabs]);

  const sending = !!tab && sendingIds.has(tab.id);
  const res = useMemo(() => (tab ? responseView(tab, sending) : { text: '', error: null, meta: '' }), [tab && tab.last, sending]);

  const copyResponse = async () => {
    const ok = await copyText(res.text);
    setCopied(ok ? 'Đã sao chép' : 'Không sao chép được');
    setTimeout(() => setCopied(''), 1500);
  };

  const canSend = !!tab && !!tab.xml.trim() && !!settings;
  const dirty = !!tab && isDirty(tab);

  return html`<div class="tp-app">
    <header class="hh-page-header tp-header">
      <div class="tp-heading">
        <h1>TP Client</h1>
        <p class="hh-muted">Gửi XML thô tới FO server qua TCP Proxy và lưu lại các request hay dùng.</p>
      </div>
      <div class="hh-row tp-toolbar">
        ${settings && html`<span class="hh-badge hh-badge-outline tp-conn" title=${'TCP Proxy: ' + settings.proxyUrl}>
          <${Icon} name="server" /> ${settings.host}:${settings.port}
        </span>`}
        <button class="hh-btn hh-btn-outline" type="button" onClick=${() => editSettings()}><${Icon} name="gear" /> Cài đặt</button>
      </div>
    </header>
    ${loadError && html`<div class="hh-alert hh-alert-error tp-load-error">${loadError}</div>`}
    <div class="tp-body">
      <${SavedPanel} saved=${saved} visible=${visible} loadError=${loadError} search=${search} setSearch=${setSearch}
        selectedId=${tab && tab.savedId} openIds=${openIds} collapsed=${collapsed} onToggle=${() => setCollapsed(!collapsed)}
        onOpen=${openSaved} onRename=${rename} onDelete=${remove} />

      <main class="tp-main">
        ${!tabs ? html`<div class="hh-empty"><span class="hh-spinner"></span></div>` : html`
        <${TabBar} tabs=${tabs} activeId=${tab.id} sendingIds=${sendingIds} onSelect=${setActiveId} onClose=${closeTab} onAdd=${addTab} />

        <div class="tp-tab-toolbar">
          <div class="tp-tab-title">
            <strong>${tabName(tab)}</strong>
            ${!tab.savedId ? html`<span class="hh-badge hh-badge-secondary">Chưa lưu</span>`
              : dirty ? html`<span class="hh-badge hh-badge-outline">Đã sửa</span>` : null}
          </div>
          <span class="tp-spacer"></span>
          <button class="hh-btn hh-btn-outline" type="button" disabled=${!canSend} onClick=${save} title="Ctrl+S"><${Icon} name="save" /> Lưu</button>
          <button class="hh-btn" type="button" disabled=${sending || !canSend} onClick=${send} title="Ctrl+Enter">
            ${sending ? html`<span class="hh-spinner tp-btn-spinner"></span>` : html`<${Icon} name="send" />`} ${sending ? 'Đang gửi…' : 'Gửi'}
          </button>
        </div>

        <div class="tp-panes">
          <section class="tp-pane tp-request">
            <div class="tp-pane-head">
              <strong class="tp-pane-title">Request XML</strong>
              <span class="hh-badge hh-badge-secondary">Ctrl+Enter để gửi</span>
              <span class="tp-spacer"></span>
              <${IconButton} icon="wand" label="Định dạng" disabled=${!tab.xml.trim()} onClick=${() => patchTab(tab.id, { xml: formatXml(tab.xml) })} />
              <${IconButton} icon="eraser" label="Xóa nội dung" disabled=${!tab.xml} onClick=${() => patchTab(tab.id, { xml: '' })} />
            </div>
            <${XmlEditor} key=${tab.id} value=${tab.xml} onChange=${(xml) => patchTab(tab.id, { xml })} onSubmit=${send}
              placeholder="<HKSOR001Q03 msgId=\"HKSOR001Q03\" ...>...</HKSOR001Q03>" />
          </section>

          <section class="tp-pane tp-response">
            <div class="tp-pane-head">
              <strong class="tp-pane-title">Response XML</strong>
              ${res.meta && html`<span class="hh-muted tp-meta">${res.meta}</span>`}
              <span class="tp-spacer"></span>
              ${copied && html`<span class="hh-muted tp-meta">${copied}</span>`}
              <${IconButton} icon="copy" label="Sao chép" disabled=${!res.text} onClick=${copyResponse} />
            </div>
            ${res.error && html`<div class="hh-alert hh-alert-error tp-status">${res.error}</div>`}
            <${XmlEditor} value=${res.text} readOnly=${true} />
          </section>
        </div>`}
      </main>
    </div>
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
