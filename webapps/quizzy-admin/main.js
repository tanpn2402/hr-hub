import { html, render } from './lib.js';
import { useRoute } from './hooks.js';
import { ListView } from './list.js';
import { EditorView } from './editor.js';
import { RunView } from './run.js';
import { ResultsView } from './results.js';

// Routes: '' = events, 'edit:<CODE>' (or 'edit:new'), 'run:<CODE>' = host console, 'results:<CODE>'.
function App() {
  const path = useRoute();
  if (path === null) return null;

  const [view, code] = path.split(':');
  if (view === 'edit' && code) return html`<${EditorView} key=${code} code=${code} />`;
  if (view === 'run' && code) return html`<${RunView} key=${code} code=${code} />`;
  if (view === 'results' && code) return html`<${ResultsView} key=${code} code=${code} />`;
  return html`<${ListView} />`;
}

render(html`<div class="hh-page"><${App} /></div>`, document.getElementById('app'));
