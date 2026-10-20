import { html, useEffect, useRef } from './lib.js';

// Preact wrapper around CodeMirror 5 (global `CodeMirror`, loaded in index.html).
// Controlled by `value`; calls onChange(text) on user edits; `readOnly` for the response pane.
export function XmlEditor({ value, onChange, readOnly = false, placeholder = '', onSubmit }) {
  const host = useRef(null);
  const cm = useRef(null);
  const cb = useRef({});
  cb.current = { onChange, onSubmit };
  // texts reported through onChange that the props have not caught up with yet: renders lag behind the typing, and
  // pushing one of those older values back would undo keystrokes and move the cursor to the start
  const pending = useRef([]);

  useEffect(() => {
    const editor = window.CodeMirror(host.current, {
      value: value || '',
      mode: 'xml',
      lineNumbers: true,
      lineWrapping: true,
      readOnly,
      placeholder,
      tabSize: 2,
      indentWithTabs: false,
      autoCloseTags: !readOnly,
      matchTags: { bothTags: true },
      matchBrackets: true,
      foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      extraKeys: {
        'Ctrl-Enter': () => cb.current.onSubmit && cb.current.onSubmit(),
        'Cmd-Enter': () => cb.current.onSubmit && cb.current.onSubmit(),
        'Ctrl-Q': (c) => c.foldCode(c.getCursor()),
      },
    });
    editor.on('change', (c, change) => {
      if (change.origin === 'setValue' || !cb.current.onChange) return;
      const text = c.getValue();
      pending.current.push(text);
      cb.current.onChange(text);
    });
    cm.current = editor;
    // the panes change size (history collapsed, window resized): let CodeMirror measure again
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => editor.refresh()) : null;
    if (ro) ro.observe(host.current);
    return () => {
      if (ro) ro.disconnect();
      host.current.innerHTML = '';
      cm.current = null;
    };
  }, []);

  useEffect(() => {
    const c = cm.current;
    const v = value || '';
    if (!c) return;
    const i = pending.current.indexOf(v);
    if (i >= 0) {
      pending.current.splice(0, i + 1);
      return;
    }
    pending.current = [];
    if (c.getValue() !== v) c.setValue(v);
  }, [value]);

  return html`<div class="tp-editor" ref=${host}></div>`;
}
