/*!
 * HR Hub Guard: keeps the curious out of DevTools in a web app.
 *
 *   import { watchDevtools } from '/hr-hub/vendor/hrhub-guard.module.js';
 *   const guard = watchDevtools({ onChange: (open) => showOverlay(open) });
 *   guard.isOpen();   // true while DevTools is open
 *   guard.stop();     // stop watching, restore shortcuts and the context menu
 *
 * A deterrent, not security: it runs on the user's device, so anyone determined gets around it. Protect what
 * matters on the server (roles, data API checks, never sending secrets to the browser).
 *
 * How it detects: a `debugger` statement only pauses while DevTools is open, so the time spent on it gives DevTools
 * away (and pausing there every second is itself the deterrent). Window-size tricks are not used: web apps run in an
 * iframe, whose size never matches the browser window, so they would always report "open".
 */

const SHORTCUTS = [
  (e) => e.key === 'F12',
  (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase()), // inspector, console
  (e) => (e.ctrlKey || e.metaKey) && e.altKey && ['I', 'J', 'C'].includes(e.key.toUpperCase()), // macOS variants
  (e) => (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toUpperCase() === 'U', // view source
];

/** Swallows the DevTools / view-source shortcuts and (optionally) the context menu. Returns a function to undo. */
export function blockShortcuts({ contextMenu = true } = {}) {
  const onKey = (e) => {
    if (!SHORTCUTS.some((match) => match(e))) return;
    e.preventDefault();
    e.stopPropagation();
  };
  const onMenu = (e) => e.preventDefault();
  window.addEventListener('keydown', onKey, true);
  if (contextMenu) window.addEventListener('contextmenu', onMenu, true);
  return () => {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('contextmenu', onMenu, true);
  };
}

/**
 * Watches for DevTools. Options:
 *   onChange(open)    called when DevTools opens or closes
 *   interval = 1000   ms between checks
 *   threshold = 100   ms a check may take before DevTools is considered open
 *   blockShortcuts = true, contextMenu = true   also swallow F12, Ctrl+Shift+I/J/C, Ctrl+U and right click
 */
export function watchDevtools({ onChange, interval = 1000, threshold = 100, blockShortcuts: block = true, contextMenu = true } = {}) {
  let open = false;
  const unblock = block ? blockShortcuts({ contextMenu }) : () => {};

  const timer = setInterval(() => {
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const now = performance.now() - start > threshold;
    if (now === open) return;
    open = now;
    if (onChange) {
      try {
        onChange(open);
      } catch (error) {
        console.error(error);
      }
    }
  }, interval);

  return {
    isOpen: () => open,
    stop() {
      clearInterval(timer);
      unblock();
    },
  };
}
