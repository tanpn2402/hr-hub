import { html } from './lib.js';
import { useLoad } from './hooks.js';
import { loadEvents } from './store.js';
import { Alert, Loading } from './ui.js';

const go = (path) => window.hrhub.route.navigate(path);
const date = (value) => (value ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
/** "Tan Pham <tan@x.com>" -> "Tan Pham" */
const person = (label) => (label ? label.replace(/\s*<[^>]*>\s*$/, '') : '');

export function ListView() {
  const events = useLoad(loadEvents, []);

  return html`
    <header class="hh-page-header">
      <div>
        <h1>Quizzy Admin</h1>
        <p class="hh-muted">Tạo bộ câu hỏi và tổ chức đố vui trực tiếp cho nhân viên.</p>
      </div>
      <div class="hh-row">
        <button class="hh-btn min-w-32" type="button" onClick=${() => go('edit:new')}>+ Tạo bộ câu hỏi</button>
      </div>
    </header>
    <main class="hh-page-body hh-container hh-stack">
      ${events.status === 'loading' && !events.value ? html`<${Loading} />` : null}
      <${Alert}>${events.status === 'error' ? `Không thể tải danh sách: ${events.error.message}` : ''}<//>
      ${events.value && events.value.length === 0
        ? html`<div class="hh-empty">Chưa có bộ câu hỏi nào. Bấm “Tạo bộ câu hỏi” để bắt đầu.</div>`
        : null}
      ${events.value && events.value.length
        ? html`<div class="qz-event-list">
            ${events.value.map(
              (event) => html`<div class="qz-event-row" key=${event.code}>
                <button type="button" class="qz-event-main" onClick=${() => go(`edit:${event.code}`)} title="Sửa bộ câu hỏi">
                  <span class="qz-event-icon" aria-hidden="true">?</span>
                  <span class="qz-event-title">
                    <strong>${event.title || 'Chưa đặt tên'}</strong>
                    <span class="hh-muted">${event.description || (event.createdBy ? `Tạo bởi ${person(event.createdBy)}` : '')}</span>
                  </span>
                </button>
                <span class="qz-event-stat"><span class="hh-mono qz-event-code">${event.code}</span><small>Mã phòng</small></span>
                <span class="qz-event-stat"><strong>${event.questions.length}</strong><small>câu hỏi</small></span>
                <span class="qz-event-stat"><strong>${date(event.createdAt)}</strong><small>ngày tạo</small></span>
                <span class="qz-event-stat"><strong>${event.runs.count}</strong><small>${event.runs.last ? `lần chơi · ${date(event.runs.last)}` : 'lần chơi'}</small></span>
                <span class="qz-event-actions">
                  <button class="hh-btn hh-btn-sm min-w-32" type="button" onClick=${() => go(`run:${event.code}`)}>▶ Mở phòng</button>
                  <button class="hh-btn hh-btn-outline hh-btn-sm" type="button" onClick=${() => go(`edit:${event.code}`)}>Sửa</button>
                  <button class="hh-btn hh-btn-ghost hh-btn-sm" type="button" disabled=${!event.runs.count} onClick=${() => go(`results:${event.code}`)}>Kết quả</button>
                </span>
              </div>`,
            )}
          </div>`
        : null}
    </main>
  `;
}
