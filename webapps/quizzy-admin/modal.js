import { html, useEffect, useRef } from './lib.js';

/**
 * A Preact-driven dialog with the HR Hub dialog look (.hh-dialog). Unlike hrhub.ui.dialog it stays open while the
 * user works in it (validation, previews); Escape, the ✕ and a click on the backdrop call onClose.
 */
export function Modal({ title, width = '40rem', onClose, footer, children }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    const frame = requestAnimationFrame(() => dialog.setAttribute('data-state', 'open'));
    const cancel = (e) => {
      e.preventDefault();
      onCloseRef.current();
    };
    // A click that lands on the <dialog> itself (not its content) is a click on the backdrop.
    const backdrop = (e) => {
      if (e.target === dialog) onCloseRef.current();
    };
    dialog.addEventListener('cancel', cancel);
    dialog.addEventListener('click', backdrop);
    return () => {
      cancelAnimationFrame(frame);
      dialog.removeEventListener('cancel', cancel);
      dialog.removeEventListener('click', backdrop);
      if (dialog.open) dialog.close();
    };
  }, []);

  return html`<dialog class="hh-dialog qz-modal" ref=${ref} style=${{ '--hh-dialog-width': width }} aria-label=${title}>
    <div class="qz-modal-inner">
      <div class="hh-dialog-header qz-modal-header">
        <h2>${title}</h2>
        <button class="hh-btn hh-btn-ghost hh-btn-xs" type="button" onClick=${() => onCloseRef.current()} aria-label="Đóng">✕</button>
      </div>
      <div class="hh-dialog-body qz-modal-body">${children}</div>
      ${footer ? html`<div class="hh-dialog-footer">${footer}</div>` : null}
    </div>
  </dialog>`;
}
