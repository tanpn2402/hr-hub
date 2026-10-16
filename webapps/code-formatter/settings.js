// Settings dialog: hrhub.ui.dialog with a Preact form rendered into its content node.
import { html, render, useState } from './lib.js';
import { Checkbox, Segmented } from './ui.js';
import { DEFAULT_SETTINGS } from './store.js';
import { UI_LANGUAGES, translator } from './i18n.js';

const SQL_DIALECTS = [
  { value: 'sql', label: 'Standard' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'plsql', label: 'Oracle' },
  { value: 'transactsql', label: 'SQL Server' },
  { value: 'mariadb', label: 'MariaDB' },
];

const clampInt = (v, min, max, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function NumberField({ id, label, hint, value, onChange }) {
  return html`<div class="hh-field">
    <label class="hh-label" for=${id}>${label}</label>
    <input class="hh-input cf-number" id=${id} type="number" min="1" max="8" value=${value}
      onInput=${(e) => onChange(clampInt(e.currentTarget.value, 1, 8, value))} />
    ${hint && html`<span class="hh-hint">${hint}</span>`}
  </div>`;
}

function SettingsForm({ initial, onDraft }) {
  const [s, setS] = useState(initial);
  const t = translator(s.uiLanguage);
  const set = (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    onDraft(next);
  };

  return html`<div class="cf-settings">
    <section>
      <h3>${t('editor')}</h3>
      <div class="cf-settings-checks">
        <${Checkbox} id="set-line-numbers" label=${t('lineNumbers')} checked=${s.lineNumbers} onChange=${(v) => set({ lineNumbers: v })} />
        <${Checkbox} id="set-line-wrapping" label=${t('lineWrapping')} checked=${s.lineWrapping} onChange=${(v) => set({ lineWrapping: v })} />
        <${Checkbox} id="set-use-tabs" label=${t('useTabs')} checked=${s.useTabs} onChange=${(v) => set({ useTabs: v })} />
      </div>
      <div class="cf-settings-grid">
        <${NumberField} id="set-tab-size" label=${t('tabSize')} value=${s.tabSize} onChange=${(v) => set({ tabSize: v })} />
        <${NumberField} id="set-indent-unit" label=${t('indentUnit')} hint=${t('indentUnitHint')} value=${s.indentUnit}
          onChange=${(v) => set({ indentUnit: v })} />
      </div>
    </section>
    <section>
      <h3>${t('behaviour')}</h3>
      <${Checkbox} id="set-auto-format" label=${t('autoFormat')} checked=${s.autoFormatOnPaste} onChange=${(v) => set({ autoFormatOnPaste: v })} />
    </section>
    <section>
      <h3>${t('sql')}</h3>
      <div class="hh-field">
        <span class="hh-label">${t('sqlDialect')}</span>
        <${Segmented} ariaLabel=${t('sqlDialect')} options=${SQL_DIALECTS} value=${s.sqlDialect} onChange=${(v) => set({ sqlDialect: v })} />
      </div>
      <div class="hh-field">
        <span class="hh-label">${t('keywordCase')}</span>
        <${Segmented} ariaLabel=${t('keywordCase')} value=${s.sqlKeywordCase} onChange=${(v) => set({ sqlKeywordCase: v })}
          options=${[{ value: 'preserve', label: t('casePreserve') }, { value: 'upper', label: t('caseUpper') }, { value: 'lower', label: t('caseLower') }]} />
      </div>
    </section>
    <section>
      <h3>${t('uiLanguage')}</h3>
      <${Segmented} ariaLabel=${t('uiLanguage')} options=${UI_LANGUAGES} value=${s.uiLanguage} onChange=${(v) => set({ uiLanguage: v })} />
    </section>
  </div>`;
}

// resolves with the new settings, or null when cancelled
export async function openSettings(current) {
  const t = translator(current.uiLanguage);
  const node = document.createElement('div');
  let draft = current;
  render(html`<${SettingsForm} initial=${current} onDraft=${(d) => { draft = d; }} />`, node);
  try {
    const result = await window.hrhub.ui.dialog({
      title: t('settingsTitle'),
      content: node,
      width: '34rem',
      actions: [
        { label: t('reset'), value: 'reset', variant: 'ghost' },
        { label: t('cancel'), value: 'cancel', variant: 'outline' },
        { label: t('save'), value: 'save', autofocus: true },
      ],
    });
    if (result === 'save') return draft;
    if (result === 'reset') {
      // keep what is not an editor preference (language picked, panels, zoom)
      const { language, historyCollapsed, outputFontSize } = current;
      return { ...DEFAULT_SETTINGS, language, historyCollapsed, outputFontSize };
    }
    return null;
  } finally {
    render(null, node);
  }
}
