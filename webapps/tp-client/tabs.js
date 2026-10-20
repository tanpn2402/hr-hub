// Open tabs, kept in localStorage. Inside the HR Hub sandbox (opaque origin) localStorage throws: the tabs then
// only live for the current page load.
//   tab = { id, savedId, name, xml, savedXml, last }
//     savedId  : key of the saved request this tab edits ("h:..."), null for a new request
//     savedXml : request as saved, to tell whether the tab has unsaved changes
//     last     : latest send result or the opened saved entry ({ host, port, request, response, error, ... }):
//                shown in the response pane and reused by Lưu
const KEY = 'tabs';

const newId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const newTab = (init = {}) => ({
  id: newId(), savedId: null, name: '', xml: '', savedXml: '', last: null, ...init,
});

export const isDirty = (t) => (t.savedId ? t.xml !== t.savedXml : !!t.xml.trim());

const PREFIX = 'tp-client:';

function storage() {
  try {
    const ls = window.localStorage;
    ls.getItem(PREFIX + KEY); // throws a SecurityError in the sandbox
    return ls;
  } catch (e) {
    return null;
  }
}

// -> { tabs, activeId } (always at least one tab)
export function loadTabs() {
  let data = null;
  const ls = storage();
  try {
    data = ls ? JSON.parse(ls.getItem(PREFIX + KEY) || 'null') : null;
  } catch (e) {
    data = null;
  }
  const tabs = data && Array.isArray(data.tabs) ? data.tabs.filter((t) => t && t.id).map((t) => newTab(t)) : [];
  if (!tabs.length) tabs.push(newTab());
  const activeId = data && tabs.some((t) => t.id === data.activeId) ? data.activeId : tabs[0].id;
  return { tabs, activeId };
}

// Responses can be large: when the value does not fit, keep the requests and drop the responses.
export function saveTabs(tabs, activeId) {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(PREFIX + KEY, JSON.stringify({ tabs, activeId }));
  } catch (e) {
    const slim = tabs.map((t) => ({ ...t, last: null }));
    try { ls.setItem(PREFIX + KEY, JSON.stringify({ tabs: slim, activeId })); } catch (err) { /* nothing more to do */ }
  }
}
