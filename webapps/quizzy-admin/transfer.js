// Import / export of questions as JSON, and the prompt that asks an AI to write them in that JSON.
import { html, useMemo, useRef, useState } from './lib.js';
import { Modal } from './modal.js';
import { aiPrompt, exportQuestions, MAX_OPTIONS, MAX_QUESTIONS, MAX_SECONDS, MIN_OPTIONS, MIN_SECONDS, parseQuestionsJson } from './quiz.js';

/**
 * Copies text. The app runs in a sandboxed iframe: the async Clipboard API works when HR Hub delegates
 * clipboard-write to the frame, otherwise fall back to selecting a textarea and execCommand('copy').
 */
export async function copyText(text, textarea) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!textarea) return false;
    textarea.focus();
    textarea.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

/** Saves the event's questions as <CODE>-questions.json (the same format "Nhập JSON" reads). */
export function downloadQuestions(event) {
  const blob = new Blob([JSON.stringify(exportQuestions(event), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.code}-questions.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Paste JSON (or load a file), preview what will be imported, then append or replace. */
export function ImportDialog({ event, onImport, onClose }) {
  const [text, setText] = useState('');
  const file = useRef(null);
  const parsed = useMemo(() => (text.trim() ? parseQuestionsJson(text, event.settings) : null), [text]);
  const valid = parsed ? parsed.questions.length : 0;
  const room = MAX_QUESTIONS - event.questions.length;
  const hasContent = event.questions.some((q) => q.text.trim() || q.options.some((o) => o.trim()));

  const loadFile = async (e) => {
    const chosen = e.target.files && e.target.files[0];
    if (chosen) setText(await chosen.text());
    e.target.value = '';
  };

  const apply = async (mode) => {
    if (mode === 'replace' && hasContent) {
      const ok = await window.hrhub.ui.confirm(`Thay toàn bộ ${event.questions.length} câu hiện có bằng ${valid} câu mới?`, {
        destructive: true,
      });
      if (!ok) return;
    }
    onImport(mode, parsed);
  };

  const footer = html`
    <input ref=${file} type="file" accept=".json,application/json,text/plain" class="hh-hidden" onChange=${loadFile} />
    <button class="hh-btn hh-btn-ghost min-w-32 qz-footer-left" type="button" onClick=${() => file.current.click()}>Chọn file .json</button>
    <button class="hh-btn hh-btn-outline min-w-32" type="button" disabled=${!valid || room <= 0} onClick=${() => apply('append')}>Thêm vào cuối</button>
    <button class="hh-btn min-w-32" type="button" disabled=${!valid} onClick=${() => apply('replace')}>Thay thế toàn bộ</button>
  `;

  return html`<${Modal} title="Nhập câu hỏi từ JSON" width="44rem" onClose=${onClose} footer=${footer}>
    <div class="hh-stack">
      <div class="hh-field">
        <label class="hh-label" for="import-json">Dán JSON (kết quả AI trả về, hoặc file đã xuất)</label>
        <textarea class="hh-textarea hh-mono qz-json" id="import-json" rows="12" spellcheck="false" value=${text}
          placeholder=${'{ "questions": [ { "text": "...", "options": ["A", "B", "C", "D"], "correct": 0, "seconds": 20 } ] }'}
          onInput=${(e) => setText(e.target.value)}></textarea>
        <span class="hh-hint">"correct" là số thứ tự đáp án đúng, đếm từ 0. Có thể dán nguyên câu trả lời của AI.</span>
      </div>
      ${parsed && valid ? html`<div class="hh-alert hh-alert-success">Đọc được ${valid} câu hỏi${parsed.title ? ` · “${parsed.title}”` : ''}.</div>` : null}
      ${parsed && parsed.errors.length
        ? html`<div class="hh-alert hh-alert-error">
            <div>${valid ? 'Các câu sau bị bỏ qua:' : 'Không nhập được:'}</div>
            <ul class="qz-errors">${parsed.errors.slice(0, 8).map((error) => html`<li>${error}</li>`)}</ul>
            ${parsed.errors.length > 8 ? html`<div>… và ${parsed.errors.length - 8} lỗi khác</div>` : null}
          </div>`
        : null}
      ${valid > room ? html`<div class="hh-alert hh-alert-info">Còn chỗ cho ${room} câu khi thêm vào cuối (tối đa ${MAX_QUESTIONS}).</div>` : null}
    </div>
  <//>`;
}

/** Builds the prompt from a topic and a number of questions; the admin copies it into any AI chat. */
export function AiDialog({ event, onClose, onPasteResult }) {
  const [topic, setTopic] = useState(event.title || '');
  const [count, setCount] = useState(10);
  const [optionCount, setOptionCount] = useState(MAX_OPTIONS);
  const [seconds, setSeconds] = useState(event.settings.defaultSeconds);
  const [notes, setNotes] = useState('');
  const [imageCount, setImageCount] = useState(0);
  const [copied, setCopied] = useState(null); // null | true | false
  const area = useRef(null);

  const countOk = Number.isInteger(count) && count >= 1 && count <= MAX_QUESTIONS;
  const ready = topic.trim() && countOk;
  const prompt = ready
    ? aiPrompt({
        topic,
        count,
        optionCount: Math.min(Math.max(optionCount, MIN_OPTIONS), MAX_OPTIONS),
        seconds: Math.min(Math.max(seconds || 20, MIN_SECONDS), MAX_SECONDS),
        notes,
        imageCount: Math.min(Math.max(imageCount || 0, 0), count),
      })
    : '';

  const footer = html`
    <button class="hh-btn hh-btn-outline min-w-32" type="button" onClick=${onPasteResult}>Dán kết quả của AI</button>
    <button class="hh-btn min-w-32" type="button" disabled=${!ready} onClick=${async () => setCopied(await copyText(prompt, area.current))}>
      Sao chép prompt
    </button>
  `;

  return html`<${Modal} title="✨ Nhờ AI soạn câu hỏi" width="44rem" onClose=${onClose} footer=${footer}>
    <div class="hh-stack">
      <ol class="qz-steps hh-muted">
        <li>Nhập chủ đề và số câu, rồi sao chép prompt.</li>
        <li>Dán vào AI bạn hay dùng (ChatGPT, Claude, Gemini…).</li>
        <li>Sao chép JSON AI trả về, bấm “Dán kết quả của AI” và dán vào.</li>
      </ol>
      <div class="hh-field">
        <label class="hh-label" for="ai-topic">Chủ đề</label>
        <input class="hh-input" id="ai-topic" maxlength="200" placeholder="VD: Nội quy công ty, an toàn PCCC, văn hoá Tết…"
          value=${topic} onInput=${(e) => setTopic(e.target.value)} />
      </div>
      <div class="qz-ai-grid">
        <div class="hh-field">
          <label class="hh-label" for="ai-count">Số câu</label>
          <input class="hh-input" id="ai-count" type="number" min="1" max=${MAX_QUESTIONS} value=${count}
            aria-invalid=${!countOk} onInput=${(e) => setCount(Number(e.target.value))} />
        </div>
        <div class="hh-field">
          <label class="hh-label" for="ai-options">Số phương án</label>
          <input class="hh-input" id="ai-options" type="number" min=${MIN_OPTIONS} max=${MAX_OPTIONS} value=${optionCount}
            onInput=${(e) => setOptionCount(Number(e.target.value))} />
        </div>
        <div class="hh-field">
          <label class="hh-label" for="ai-seconds">Thời gian (giây)</label>
          <input class="hh-input" id="ai-seconds" type="number" min=${MIN_SECONDS} max=${MAX_SECONDS} value=${seconds}
            onInput=${(e) => setSeconds(Number(e.target.value))} />
        </div>
        <div class="hh-field">
          <label class="hh-label" for="ai-images">Số câu có hình</label>
          <input class="hh-input" id="ai-images" type="number" min="0" max=${count || 0} value=${imageCount}
            onInput=${(e) => setImageCount(Number(e.target.value))} />
        </div>
      </div>
      <div class="hh-field">
        <label class="hh-label" for="ai-notes">Yêu cầu thêm (tuỳ chọn)</label>
        <input class="hh-input" id="ai-notes" maxlength="300" placeholder="VD: mức độ dễ, dành cho nhân viên mới, có câu vui"
          value=${notes} onInput=${(e) => setNotes(e.target.value)} />
      </div>
      ${ready
        ? html`<div class="hh-field">
            <label class="hh-label" for="ai-prompt">Prompt</label>
            <textarea ref=${area} class="hh-textarea hh-mono qz-json" id="ai-prompt" rows="8" readonly value=${prompt}></textarea>
          </div>`
        : html`<div class="hh-hint">Nhập chủ đề và số câu (1-${MAX_QUESTIONS}) để tạo prompt.</div>`}
      ${imageCount > 0
        ? html`<div class="hh-hint">
            Câu có hình: AI ghi gợi ý hình cần chiếu và có thể kèm link ảnh trên Wikimedia. Khi nhập, app thử tải ảnh về;
            câu nào chưa có ảnh sẽ có nút “Tìm ảnh” để bạn tự thêm.
          </div>`
        : null}
      ${copied === true ? html`<div class="hh-alert hh-alert-success">Đã sao chép prompt. Dán vào AI rồi quay lại bấm “Dán kết quả của AI”.</div>` : null}
      ${copied === false ? html`<div class="hh-alert hh-alert-info">Không sao chép tự động được: hãy chọn nội dung ô Prompt và nhấn Ctrl+C.</div>` : null}
    </div>
  <//>`;
}
