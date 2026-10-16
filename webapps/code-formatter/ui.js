// Small components: CodeMirror 5 wrapper, hrhub.ui widgets wrapped for Preact, icons.
import { html, useEffect, useRef } from './lib.js';

// Folding: XML elements (xml-fold), JSON objects/arrays and Java blocks (brace-fold), comments (comment-fold);
// SQL has no fold helper in its mode, so it folds by indentation (the formatter indents every clause).
function foldOptions(mode) {
  const f = window.CodeMirror.fold;
  return {
    rangeFinder: mode === 'text/x-sql' ? f.combine(f.indent, f.comment) : f.combine(f.auto, f.comment),
    widget: '…',
    minFoldSize: 1,
  };
}

// CodeMirror 5 (window.CodeMirror, vendored). `doc` is { text } and is only pushed into the editor when the object
// changes, so typing does not re-render the app; read the live text through `onReady(cm)` / cm.getValue().
export function CodeEditor({ doc, mode, readOnly, settings, fontSize, placeholder, onReady, onChange, onPaste, onFormatKey, errorLine }) {
  const host = useRef(null);
  const cmRef = useRef(null);
  const handlers = useRef({});
  handlers.current = { onChange, onPaste, onFormatKey };

  useEffect(() => {
    const cm = window.CodeMirror(host.current, {
      value: doc ? doc.text : '',
      mode,
      readOnly: !!readOnly,
      lineNumbers: settings.lineNumbers,
      lineWrapping: settings.lineWrapping,
      tabSize: settings.tabSize,
      indentUnit: settings.indentUnit,
      indentWithTabs: settings.useTabs,
      matchBrackets: true,
      styleActiveLine: !readOnly,
      foldGutter: true,
      foldOptions: foldOptions(mode),
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      placeholder,
      extraKeys: {
        'Ctrl-Enter': () => handlers.current.onFormatKey && handlers.current.onFormatKey(),
        'Cmd-Enter': () => handlers.current.onFormatKey && handlers.current.onFormatKey(),
        'Shift-Alt-F': () => handlers.current.onFormatKey && handlers.current.onFormatKey(),
        'Ctrl-Q': (ed) => ed.foldCode(ed.getCursor()),
        'Cmd-Q': (ed) => ed.foldCode(ed.getCursor()),
        Tab: (ed) => (ed.somethingSelected() ? ed.indentSelection('add') : ed.execCommand(settings.useTabs ? 'insertTab' : 'insertSoftTab')),
      },
    });
    cmRef.current = cm;
    cm.on('change', (ed, change) => {
      if (handlers.current.onChange) handlers.current.onChange(ed.getValue(), change);
      if (change.origin === 'paste' && handlers.current.onPaste) setTimeout(() => handlers.current.onPaste(ed.getValue()), 0);
    });
    if (onReady) onReady(cm);
    // the panes change size (history collapsed, result maximized): let CodeMirror measure again
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => cm.refresh()) : null;
    if (ro) ro.observe(host.current);
    return () => {
      if (ro) ro.disconnect();
      host.current.innerHTML = '';
      cmRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cm = cmRef.current;
    if (cm && doc && cm.getValue() !== doc.text) {
      cm.setValue(doc.text);
      cm.scrollTo(0, 0);
    }
  }, [doc]);

  useEffect(() => {
    const cm = cmRef.current;
    if (!cm) return;
    cm.setOption('mode', mode);
    cm.setOption('foldOptions', foldOptions(mode));
    cm.setOption('foldGutter', false);   // re-enable so the gutter markers are recomputed with the new range finder
    cm.setOption('foldGutter', true);
    cm.setOption('lineNumbers', settings.lineNumbers);
    cm.setOption('lineWrapping', settings.lineWrapping);
    cm.setOption('tabSize', settings.tabSize);
    cm.setOption('indentUnit', settings.indentUnit);
    cm.setOption('indentWithTabs', settings.useTabs);
    cm.setOption('placeholder', placeholder);
    cm.setOption('extraKeys', { ...cm.getOption('extraKeys'), Tab: (ed) => (ed.somethingSelected() ? ed.indentSelection('add') : ed.execCommand(settings.useTabs ? 'insertTab' : 'insertSoftTab')) });
  }, [mode, settings.lineNumbers, settings.lineWrapping, settings.tabSize, settings.indentUnit, settings.useTabs, placeholder]);

  useEffect(() => {
    const cm = cmRef.current;
    if (!cm || !fontSize) return;
    cm.getWrapperElement().style.fontSize = fontSize + 'px';
    cm.refresh();
  }, [fontSize]);

  // highlight the line a format error points to
  useEffect(() => {
    const cm = cmRef.current;
    if (!cm || !errorLine || errorLine > cm.lineCount()) return undefined;
    const handle = cm.addLineClass(errorLine - 1, 'background', 'cf-error-line');
    cm.scrollIntoView({ line: errorLine - 1, ch: 0 }, 80);
    return () => cm.removeLineClass(handle, 'background', 'cf-error-line');
  }, [errorLine, doc]);

  return html`<div ref=${host} class="cf-editor"></div>`;
}

// hrhub.ui.combobox wrapped as a controlled component
export function Combobox({ id, ariaLabel, options, value, onChange }) {
  const host = useRef(null);
  const box = useRef(null);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    box.current = window.hrhub.ui.combobox(host.current, { id, ariaLabel, options, value, onChange: (next) => latest.current(next) });
    return () => {
      box.current = null;
      host.current.innerHTML = '';
    };
  }, []);

  useEffect(() => {
    if (!box.current) return;
    box.current.setOptions(options);
    box.current.setValue(value);
  }, [JSON.stringify(options), value]);

  return html`<div ref=${host} class="cf-combobox"></div>`;
}

// hrhub.ui.checkbox wrapped as a controlled component
export function Checkbox({ id, label, checked, onChange }) {
  const host = useRef(null);
  const box = useRef(null);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    box.current = window.hrhub.ui.checkbox(host.current, { id, label, checked, onChange: (v) => latest.current(v) });
    return () => {
      box.current = null;
      host.current.innerHTML = '';
    };
  }, []);

  useEffect(() => {
    if (box.current) box.current.setChecked(checked);
  }, [checked]);

  return html`<div ref=${host}></div>`;
}

// a row of toggle buttons for small option sets
export function Segmented({ options, value, onChange, ariaLabel }) {
  return html`<div class="cf-segmented" role="group" aria-label=${ariaLabel}>
    ${options.map((o) => html`<button
      key=${o.value}
      type="button"
      class=${'hh-btn hh-btn-sm ' + (o.value === value ? '' : 'hh-btn-outline')}
      aria-pressed=${o.value === value ? 'true' : 'false'}
      onClick=${() => onChange(o.value)}
    >${o.label}</button>`)}
  </div>`;
}

// stroke icons (inline SVG, no icon font)
const PATHS = {
  foldAll: 'M7 20l5-5 5 5M7 4l5 5 5-5',
  unfoldAll: 'M7 15l5 5 5-5M7 9l5-5 5 5',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  wand: 'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5',
  panelLeftClose: 'M3 3h18v18H3zM9 3v18M16 15l-3-3 3-3',
  panelLeftOpen: 'M3 3h18v18H3zM9 3v18M14 9l3 3-3 3',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  x: 'M18 6 6 18M6 6l12 12',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  zoomIn: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M11 8v6M8 11h6',
  zoomOut: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M8 11h6',
  maximize: 'M8 3H3v5M21 8V3h-5M16 21h5v-5M3 16v5h5',
  minimize: 'M3 8h5V3M16 3v5h5M21 16h-5v5M8 21v-5H3',
  eraser: 'M7 21h10M5 15l9-9 5 5-9 9H7z',
};

export const Icon = ({ name }) => html`<svg class="cf-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d=${PATHS[name]} /></svg>`;

export function IconButton({ icon, label, onClick, disabled, pressed }) {
  return html`<button type="button" class="hh-btn hh-btn-ghost hh-btn-sm cf-icon-btn" title=${label} aria-label=${label}
    aria-pressed=${pressed == null ? undefined : String(!!pressed)} disabled=${disabled} onClick=${onClick}><${Icon} name=${icon} /></button>`;
}
