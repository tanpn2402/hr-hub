import { html, useEffect, useState } from './lib.js';
import {
  MAX_OPTIONS,
  MAX_QUESTIONS,
  MAX_SECONDS,
  MIN_SECONDS,
  REVEAL_MODES,
  TIMING_LIMITS,
  emptyQuestion,
  newCode,
  newEvent,
  newId,
  imageSearchUrl,
  questionErrors,
  settingsOf,
  validateEvent,
} from './quiz.js';
import { imageToDataUrl, imageUrlToDataUrl } from './image.js';
import { loadEvent, removeEvent, saveEvent } from './store.js';
import { Modal } from './modal.js';
import { AiDialog, downloadQuestions, ImportDialog } from './transfer.js';
import { Alert, Checkbox, Loading, Suit, SUIT_NAMES } from './ui.js';

/** `code` = 'new' for a new event. Full-width: questions on the left, the selected one as a slide on the right. */
export function EditorView({ code }) {
  const [event, setEvent] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [status, setStatus] = useState({ saving: false, error: '', saved: false });
  const [panel, setPanel] = useState(null); // null | 'settings' | 'import' | 'ai'
  const [notice, setNotice] = useState('');
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (code === 'new') {
      setEvent(newEvent(newCode()));
      setUpdatedAt(0);
      setPanel('settings');
      return;
    }
    loadEvent(code)
      .then((found) => {
        if (!found) return setStatus({ saving: false, error: `Không tìm thấy sự kiện ${code}.`, saved: false });
        setEvent({ ...found.event, settings: settingsOf(found.event) });
        setUpdatedAt(found.updatedAt);
      })
      .catch((error) => setStatus({ saving: false, error: error.message, saved: false }));
  }, [code]);

  if (!event) {
    return html`<main class="hh-page-body hh-container">
      ${status.error ? html`<${Alert}>${status.error}<//>` : html`<${Loading} />`}
    </main>`;
  }

  const patch = (changes) => {
    setEvent({ ...event, ...changes });
    setStatus({ ...status, saved: false });
  };
  const patchSettings = (changes) => patch({ settings: { ...event.settings, ...changes } });
  const setQuestions = (questions, select = current) => {
    patch({ questions });
    setCurrent(Math.max(0, Math.min(select, questions.length - 1)));
  };
  const patchQuestion = (index, changes) =>
    patch({ questions: event.questions.map((q, i) => (i === index ? { ...q, ...changes } : q)) });

  const move = (index, delta) => {
    const questions = [...event.questions];
    const [moved] = questions.splice(index, 1);
    questions.splice(index + delta, 0, moved);
    setQuestions(questions, index + delta);
  };
  const duplicate = (index) => {
    const questions = [...event.questions];
    questions.splice(index + 1, 0, { ...event.questions[index], id: newId('q'), options: [...event.questions[index].options] });
    setQuestions(questions, index + 1);
  };
  const removeQuestion = async (index) => {
    const question = event.questions[index];
    if (question.text.trim() && !(await window.hrhub.ui.confirm(`Xoá câu ${index + 1}?`, { destructive: true }))) return;
    setQuestions(event.questions.filter((_, i) => i !== index), index);
  };
  const add = () => setQuestions([...event.questions, emptyQuestion(event.settings)], event.questions.length);

  const errors = validateEvent(event);

  const isBlank = (q) => !q.text.trim() && q.options.every((o) => !o.trim());
  const importQuestions = (mode, parsed) => {
    // The untouched blank question of a new event is replaced, not kept in front of the imported ones.
    const kept = mode === 'replace' ? [] : event.questions.filter((q) => !isBlank(q));
    const questions = [...kept, ...parsed.questions].slice(0, MAX_QUESTIONS);
    setEvent({
      ...event,
      questions,
      title: event.title.trim() ? event.title : parsed.title,
      description: event.description.trim() ? event.description : parsed.description,
    });
    setCurrent(kept.length);
    setStatus({ ...status, saved: false });
    setPanel(null);
    const withUrl = parsed.questions.filter((q) => q.imageUrl);
    setNotice(
      `Đã nhập ${questions.length - kept.length} câu hỏi${withUrl.length ? `, đang tải ${withUrl.length} hình từ link AI gợi ý…` : ''}. Kiểm tra lại rồi bấm Lưu.`,
    );
    if (withUrl.length) void downloadImages(withUrl);
  };

  /** Fetches the AI's image links one by one; questions keep their hint when a link fails. */
  const downloadImages = async (list) => {
    let ok = 0;
    for (const q of list) {
      let image = '';
      try {
        image = await imageUrlToDataUrl(q.imageUrl);
        ok++;
      } catch {
        // keep the hint: the admin adds the picture by hand ("Tìm ảnh")
      }
      setEvent((current) => ({
        ...current,
        questions: current.questions.map((item) => {
          if (item.id !== q.id) return item;
          const { imageUrl, ...rest } = item;
          return image ? { ...rest, image } : rest;
        }),
      }));
    }
    setNotice(
      ok === list.length
        ? `Đã tải đủ ${ok} hình. Kiểm tra lại rồi bấm Lưu.`
        : `Tải được ${ok}/${list.length} hình. Câu còn thiếu có nút “Tìm ảnh” để thêm tay.`,
    );
  };
  const exportFile = () => {
    downloadQuestions(event);
    setNotice(`Đã tải về ${event.code}-questions.json.`);
  };

  const save = async () => {
    setStatus({ saving: true, error: '', saved: false });
    try {
      const result = await saveEvent(event, updatedAt);
      setUpdatedAt(result.updatedAt);
      setStatus({ saving: false, error: '', saved: true });
      if (code === 'new') window.hrhub.route.navigate(`edit:${event.code}`, { replace: true });
    } catch (error) {
      const message =
        error.status === 409
          ? 'Sự kiện vừa được người khác sửa. Tải lại trang để xem bản mới nhất.'
          : `Không thể lưu: ${error.message}`;
      setStatus({ saving: false, error: message, saved: false });
    }
  };

  const remove = async () => {
    if (!(await window.hrhub.ui.confirm(`Xoá sự kiện “${event.title || event.code}”?`, { destructive: true }))) return;
    try {
      await removeEvent(event.code);
      window.hrhub.route.navigate('');
    } catch (error) {
      setStatus({ saving: false, error: `Không thể xoá: ${error.message}`, saved: false });
    }
  };

  const togglePanel = (name) => setPanel(panel === name ? null : name);
  const tool = (name, label) =>
    html`<button class=${`hh-btn hh-btn-sm min-w-32 ${panel === name ? 'hh-btn-secondary' : 'hh-btn-outline'}`} type="button"
      onClick=${() => togglePanel(name)}>${label}</button>`;

  const index = Math.min(current, event.questions.length - 1);
  const question = event.questions[index];

  return html`
    <header class="hh-page-header">
      <div>
        <h1>${event.title || (code === 'new' ? 'Sự kiện mới' : 'Sửa sự kiện')}</h1>
        <p class="hh-muted">Mã phòng <span class="hh-mono">${event.code}</span> · ${event.questions.length} câu hỏi</p>
      </div>
      <div class="hh-row">
        <button class="hh-btn hh-btn-ghost min-w-32" type="button" onClick=${() => window.hrhub.route.back('')}>Quay lại</button>
        ${code !== 'new' ? html`<button class="hh-btn hh-btn-outline min-w-32" type="button" onClick=${remove}>Xoá sự kiện</button>` : null}
      </div>
    </header>
    <main class="hh-page-body qz-editor">
      <div class="hh-row qz-toolbar">
        ${tool('settings', '⚙ Cài đặt')} ${tool('ai', '✨ Soạn bằng AI')} ${tool('import', 'Nhập JSON')}
        <button class="hh-btn hh-btn-outline hh-btn-sm min-w-32" type="button" onClick=${exportFile}>Xuất JSON</button>
      </div>
      ${panel === 'settings' ? html`<${SettingsDialog} event=${event} patch=${patch} patchSettings=${patchSettings} onClose=${() => setPanel(null)} />` : null}
      ${panel === 'ai' ? html`<${AiDialog} event=${event} onClose=${() => setPanel(null)} onPasteResult=${() => setPanel('import')} />` : null}
      ${panel === 'import' ? html`<${ImportDialog} event=${event} onImport=${importQuestions} onClose=${() => setPanel(null)} />` : null}
      ${notice ? html`<${Alert} kind="info">${notice}<//>` : null}

      <div class="qz-editor-grid">
        <aside class="qz-slides" aria-label="Danh sách câu hỏi">
          ${event.questions.map(
            (q, i) => html`<button type="button" key=${q.id} class=${`qz-thumb${i === index ? ' is-active' : ''}${questionErrors(q).length ? ' has-error' : ''}${q.imageHint && !q.image ? ' needs-image' : ''}`}
              onClick=${() => setCurrent(i)} aria-current=${i === index}>
              <span class="qz-thumb-no">${i + 1}</span>
              <span class="qz-thumb-body">
                <span class="qz-thumb-text">${q.text.trim() || 'Câu hỏi chưa có nội dung'}</span>
                <span class="qz-thumb-meta">
                  <span class="qz-thumb-dots">
                    ${q.options.map((o, oi) => html`<i class=${`qz-option-${oi}${o.trim() ? '' : ' is-empty'}${oi === q.correct ? ' is-correct' : ''}`}></i>`)}
                  </span>
                  <span>${q.image ? '🖼 ' : q.imageHint ? '⚠🖼 ' : ''}${q.seconds}s</span>
                </span>
              </span>
            </button>`,
          )}
          <button type="button" class="hh-btn hh-btn-outline min-w-32 qz-add" disabled=${event.questions.length >= MAX_QUESTIONS} onClick=${add}>
            + Thêm câu hỏi
          </button>
        </aside>

        ${question
          ? html`<${Slide} key=${question.id} question=${question} index=${index} total=${event.questions.length}
              patch=${(changes) => patchQuestion(index, changes)} move=${move} duplicate=${duplicate} remove=${removeQuestion} />`
          : null}
      </div>

      <div class="qz-action-bar">
        <div class="hh-stack">
          ${errors.length ? html`<span class="hh-muted">${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} lỗi khác)` : ''}</span>` : null}
          <${Alert}>${status.error}<//>
          ${status.saved ? html`<span class="qz-saved">✓ Đã lưu</span>` : null}
        </div>
        <div class="hh-row">
          ${code !== 'new' && status.saved
            ? html`<button class="hh-btn hh-btn-outline min-w-32" type="button" onClick=${() => window.hrhub.route.navigate(`run:${event.code}`)}>Mở phòng</button>`
            : null}
          <button class="hh-btn min-w-32" type="button" disabled=${status.saving || errors.length > 0} onClick=${save}>
            ${status.saving ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </div>
    </main>
  `;
}

/** The selected question, laid out like the slide players will see: text on top, 2 x 2 answers below. */
function Slide({ question, index, total, patch, move, duplicate, remove }) {
  const problems = questionErrors(question);
  const [imageError, setImageError] = useState('');
  const pickImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      patch({ image: await imageToDataUrl(file) });
      setImageError('');
    } catch (error) {
      setImageError(error.message);
    }
  };
  return html`<section class="qz-slide-wrap">
    <div class="hh-row hh-between qz-slide-tools">
      <strong>Câu ${index + 1}/${total}</strong>
      <div class="hh-row">
        <label class="hh-label" for="q-seconds">⏱</label>
        <input class="hh-input qz-seconds" id="q-seconds" type="number" min=${MIN_SECONDS} max=${MAX_SECONDS}
          value=${question.seconds} onInput=${(e) => patch({ seconds: Number(e.target.value) })} aria-label="Thời gian trả lời (giây)" />
        <span class="hh-muted">giây</span>
        <button class="hh-btn hh-btn-ghost hh-btn-xs" type="button" disabled=${index === 0} onClick=${() => move(index, -1)} title="Đưa lên">↑</button>
        <button class="hh-btn hh-btn-ghost hh-btn-xs" type="button" disabled=${index === total - 1} onClick=${() => move(index, 1)} title="Đưa xuống">↓</button>
        <button class="hh-btn hh-btn-ghost hh-btn-xs" type="button" disabled=${total >= MAX_QUESTIONS} onClick=${() => duplicate(index)}>Nhân bản</button>
        <button class="hh-btn hh-btn-ghost hh-btn-xs" type="button" disabled=${total === 1} onClick=${() => remove(index)}>Xoá</button>
      </div>
    </div>
    <div class="qz-slide">
      <textarea class="qz-slide-question" rows="2" maxlength="300" placeholder="Nhập câu hỏi…" value=${question.text}
        aria-label=${`Nội dung câu ${index + 1}`} onInput=${(e) => patch({ text: e.target.value })}></textarea>
      <div class="qz-image-tools">
        ${question.image ? html`<img src=${question.image} alt="Hình ảnh câu hỏi" />` : null}
        <label class="hh-btn hh-btn-outline hh-btn-sm min-w-32">
          ${question.image ? 'Đổi hình' : '🖼 Thêm hình'}
          <input type="file" accept="image/*" onChange=${pickImage} />
        </label>
        ${question.image
          ? html`<button class="hh-btn hh-btn-outline hh-btn-sm min-w-32" type="button" onClick=${() => patch({ image: '', imageHint: '' })}>Bỏ hình</button>
              <div class="qz-reveal-modes" role="radiogroup" aria-label="Cách hiện hình">
                ${Object.entries(REVEAL_MODES).map(
                  ([value, label]) => html`<button type="button" role="radio" key=${value} aria-checked=${question.reveal === value}
                    class=${`qz-chip${question.reveal === value ? ' is-active' : ''}`} onClick=${() => patch({ reveal: value })}>${label}</button>`,
                )}
              </div>`
          : null}
        ${!question.image && question.imageHint
          ? html`<span class="qz-image-hint" title="Gợi ý hình cần chiếu">🖼 Cần hình: ${question.imageHint}</span>
              <button class="hh-btn hh-btn-outline hh-btn-sm min-w-32" type="button"
                onClick=${() => window.open(imageSearchUrl(question.imageHint), '_blank', 'noopener')}>🔎 Tìm ảnh</button>
              <button class="hh-btn hh-btn-outline hh-btn-sm min-w-32" type="button" onClick=${() => patch({ imageHint: '' })}>Không cần hình</button>`
          : null}
        ${imageError ? html`<span class="qz-slide-problem">${imageError}</span>` : null}
      </div>
      <div class="qz-answer-grid">
        ${question.options.slice(0, MAX_OPTIONS).map(
          (text, oi) => html`<div class=${`qz-answer-edit qz-option-${oi}${text.trim() ? '' : ' is-empty'}`} key=${oi}>
            <${Suit} index=${oi} />
            <input maxlength="120" placeholder=${`Đáp án ${oi + 1}${oi >= 2 ? ' (tuỳ chọn)' : ''}`} value=${text}
              aria-label=${`Đáp án ${SUIT_NAMES[oi]}`}
              onInput=${(e) => patch({ options: question.options.map((o, i) => (i === oi ? e.target.value : o)) })} />
            <button type="button" class=${`qz-correct-toggle${question.correct === oi ? ' is-correct' : ''}`}
              aria-pressed=${question.correct === oi} title="Đánh dấu là đáp án đúng" onClick=${() => patch({ correct: oi })}>✓</button>
          </div>`,
        )}
      </div>
    </div>
    ${problems.length ? html`<p class="qz-slide-problem">⚠ ${problems.join(' ')}</p>` : html`<p class="hh-muted">Bấm ✓ để chọn đáp án đúng.${question.image ? ' Hình chỉ hiện trên màn hình host, không gửi xuống máy người chơi.' : ''}</p>`}
  </section>`;
}

function SettingsDialog({ event, patch, patchSettings, onClose }) {
  const s = event.settings;
  const number = (key, label, min, max, step = 1) => html`<div class="hh-field">
    <label class="hh-label" for=${`set-${key}`}>${label}</label>
    <input class="hh-input" id=${`set-${key}`} type="number" min=${min} max=${max} step=${step} value=${s[key]}
      onInput=${(e) => patchSettings({ [key]: Number(e.target.value) })} />
  </div>`;
  const footer = html`<button class="hh-btn min-w-32" type="button" onClick=${onClose}>Xong</button>`;
  return html`<${Modal} title="⚙ Cài đặt sự kiện" width="46rem" onClose=${onClose} footer=${footer}>
    <div class="hh-stack">
    <div class="hh-grid-2">
      <div class="hh-field">
        <label class="hh-label" for="title">Tên sự kiện</label>
        <input class="hh-input" id="title" maxlength="120" value=${event.title} onInput=${(e) => patch({ title: e.target.value })} />
      </div>
      <div class="hh-field">
        <label class="hh-label" for="description">Mô tả</label>
        <input class="hh-input" id="description" maxlength="500" value=${event.description} onInput=${(e) => patch({ description: e.target.value })} />
      </div>
    </div>
    <div class="qz-settings-grid">
      ${number('defaultSeconds', 'Thời gian mặc định mỗi câu (giây)', MIN_SECONDS, MAX_SECONDS)}
      ${number('maxPoints', 'Điểm tối đa mỗi câu', 100, 10000, 100)}
      ${number('countdownSeconds', 'Đếm ngược trước câu hỏi (giây)', ...TIMING_LIMITS.countdownSeconds)}
      ${s.auto ? number('revealSeconds', 'Hiện kết quả (giây)', ...TIMING_LIMITS.revealSeconds) : null}
      ${s.auto && s.leaderboardEvery ? number('leaderboardSeconds', 'Hiện bảng xếp hạng (giây)', ...TIMING_LIMITS.leaderboardSeconds) : null}
    </div>
    <div class="qz-settings-checks">
      <${Checkbox} label="Tự động chạy toàn bộ (bấm Bắt đầu là chạy hết các câu)" checked=${s.auto} onChange=${(v) => patchSettings({ auto: v })} />
      <${Checkbox} label="Hiện bảng xếp hạng sau mỗi câu" checked=${s.leaderboardEvery} onChange=${(v) => patchSettings({ leaderboardEvery: v })} />
      <${Checkbox} label="Thưởng tốc độ (trả lời càng nhanh càng nhiều điểm)" checked=${s.speedBonus} onChange=${(v) => patchSettings({ speedBonus: v })} />
      <${Checkbox} label="Hiển thị câu hỏi ở màn hình người chơi" checked=${s.showQuestionToPlayers}
        onChange=${(v) => patchSettings({ showQuestionToPlayers: v })} />
      ${s.showQuestionToPlayers
        ? null
        : html`<p class="hh-hint qz-setting-note">
            Người chơi chỉ thấy 4 ô màu ♥ ♦ ♣ ♠ và phải nhìn câu hỏi trên màn hình chính (máy chiếu). Câu hỏi không được gửi
            xuống máy người chơi nên bot hay AI trên máy đó không đọc được.
          </p>`}
      <${Checkbox} label="Hiện câu hỏi trong lúc đếm ngược (cho người chơi đọc trước)" checked=${s.showQuestionOnCountdown}
        onChange=${(v) => patchSettings({ showQuestionOnCountdown: v })} />
      <${Checkbox} label="Bắt buộc đăng nhập (không nhận người chơi ẩn danh)" checked=${s.requireLogin} onChange=${(v) => patchSettings({ requireLogin: v })} />
      <${Checkbox} label="Chặn mở DevTools trên máy người chơi (răn đe người tò mò, host thấy ai đã mở)" checked=${s.blockDevtools}
        onChange=${(v) => patchSettings({ blockDevtools: v })} />
    </div>
    <p class="hh-hint">Các thay đổi được áp dụng khi bấm Lưu.</p>
    </div>
  <//>`;
}
