import { html, useState } from './lib.js';
import { Field, formDialog } from './ui.js';
import { saveSettings, pingProxy } from './store.js';

const clean = (v) => ({ ...v, proxyUrl: String(v.proxyUrl).trim(), host: String(v.host).trim(), port: parseInt(v.port, 10) || 8087 });

function Body({ values }) {
  const [form, setForm] = useState({ ...values });
  const [msg, setMsg] = useState(null); // { kind, text }
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    values[k] = e.target.value;
    setForm({ ...form, [k]: e.target.value });
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await pingProxy(clean(values));
      setMsg({ kind: 'success', text: 'Kết nối TCP Proxy thành công.' });
    } catch (e) {
      setMsg({ kind: 'error', text: 'Không kết nối được: ' + e.message });
    } finally {
      setBusy(false);
    }
  };

  return html`<div class="hh-stack">
    <${Field} id="s-url" label="URL TCP Proxy" hint="Chạy server.py của TPClient (python3 server.py --token ...). Trình duyệt không mở được TCP trực tiếp nên request đi qua proxy này.">
      <input class="hh-input" id="s-url" value=${form.proxyUrl} onInput=${set('proxyUrl')} placeholder="http://localhost:8099" />
    <//>
    <${Field} id="s-token" label="Token (tùy chọn)" hint="Gửi trong header X-TP-Token; phải khớp --token của proxy.">
      <input class="hh-input" id="s-token" type="password" value=${form.token} onInput=${set('token')} autocomplete="off" />
    <//>
    <div class="hh-grid-2">
      <${Field} id="s-host" label="Host FO server"><input class="hh-input" id="s-host" value=${form.host} onInput=${set('host')} /><//>
      <${Field} id="s-port" label="Port FO server"><input class="hh-input" id="s-port" type="number" value=${form.port} onInput=${set('port')} /><//>
    </div>
    <div class="hh-row">
      <button class="hh-btn hh-btn-outline hh-btn-sm" type="button" onClick=${test} disabled=${busy}>Kiểm tra kết nối</button>
    </div>
    ${msg && html`<div class=${'hh-alert hh-alert-' + msg.kind}>${msg.text}</div>`}
  </div>`;
}

// Opens the dialog; resolves with the saved settings, or null when cancelled. Re-opens when saving fails.
export async function openSettings(settings) {
  const values = { ...settings };
  for (;;) {
    const action = await formDialog({
      title: 'Cài đặt TCP Proxy server',
      width: '34rem',
      values,
      Body,
      actions: [{ label: 'Hủy', value: 'cancel', variant: 'outline' }, { label: 'Lưu', value: 'save', autofocus: true }],
    });
    if (action !== 'save') return null;
    const s = clean(values);
    if (!s.proxyUrl) {
      await window.hrhub.ui.alert('Vui lòng nhập URL TCP Proxy.');
      continue;
    }
    try {
      await saveSettings(s);
      return s;
    } catch (e) {
      await window.hrhub.ui.alert('Không lưu được: ' + e.message);
    }
  }
}
