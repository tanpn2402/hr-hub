import { html, render } from './lib.js';

export const Field = ({ id, label, hint, children }) => html`<div class="hh-field">
  <label class="hh-label" for=${id}>${label}</label>${children}${hint && html`<span class="hh-hint">${hint}</span>`}
</div>`;

// Shows a Preact form inside hrhub.ui.dialog (content must be a DOM node). The Body component edits the shared
// `values` object; resolves with the clicked action's value (null when dismissed), then read `values`.
export async function formDialog({ title, width, actions, values, Body }) {
  const node = document.createElement('div');
  render(html`<${Body} values=${values} />`, node);
  const action = await window.hrhub.ui.dialog({ title, width, content: node, actions });
  render(null, node);
  return action;
}

// stroke icons (inline SVG, no icon font / emoji)
const PATHS = {
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  wand: 'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5',
  panelLeftClose: 'M3 3h18v18H3zM9 3v18M16 15l-3-3 3-3',
  panelLeftOpen: 'M3 3h18v18H3zM9 3v18M14 9l3 3-3 3',
  pencil: 'M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  x: 'M18 6 6 18M6 6l12 12',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  eraser: 'M7 21h10M5 15l9-9 5 5-9 9H7z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  server: 'M2 3h20v8H2zM2 13h20v8H2zM6 7h.01M6 17h.01',
  plus: 'M12 5v14M5 12h14',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
};

export const Icon = ({ name }) => html`<svg class="tp-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d=${PATHS[name]} /></svg>`;

export function IconButton({ icon, label, onClick, disabled, small }) {
  return html`<button type="button" class=${'hh-btn hh-btn-ghost tp-icon-btn ' + (small ? 'hh-btn-xs tp-icon-btn-xs' : 'hh-btn-sm')}
    title=${label} aria-label=${label} disabled=${disabled} onClick=${onClick}><${Icon} name=${icon} /></button>`;
}

// navigator.clipboard is often blocked in the sandboxed iframe: fall back to a hidden textarea + execCommand
export async function copyText(text) {
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
