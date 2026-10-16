import { html, useState } from './lib.js';
import { useLoad } from './hooks.js';
import { loadEvent, loadResults } from './store.js';
import { Alert, Avatar, Loading, Podium, Suit } from './ui.js';

const when = (iso) => new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const minutes = (from, to) => Math.max(1, Math.round((new Date(to) - new Date(from)) / 60000));
const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0);

export function ResultsView({ code }) {
  const data = useLoad(async () => {
    const [results, found] = await Promise.all([loadResults(code), loadEvent(code)]);
    return { results, title: found ? found.event.title : code };
  }, [code]);
  const [selected, setSelected] = useState(0);

  const results = data.value ? data.value.results : [];
  const result = results[Math.min(selected, results.length - 1)];

  return html`
    <header class="hh-page-header">
      <div>
        <h1>Kết quả · ${data.value ? data.value.title : code}</h1>
        <p class="hh-muted">Mã phòng <span class="hh-mono">${code}</span> · ${results.length} lần tổ chức</p>
      </div>
      <div class="hh-row">
        <button class="hh-btn hh-btn-ghost min-w-32" type="button" onClick=${() => window.hrhub.route.back('')}>Quay lại</button>
        ${result ? html`<button class="hh-btn hh-btn-outline min-w-32" type="button" onClick=${() => downloadCsv(result)}>Xuất CSV</button>` : null}
      </div>
    </header>
    <main class="hh-page-body hh-container hh-stack">
      ${data.status === 'loading' && !data.value ? html`<${Loading} />` : null}
      <${Alert}>${data.status === 'error' ? `Không thể tải kết quả: ${data.error.message}` : ''}<//>
      ${data.value && results.length === 0 ? html`<div class="hh-empty">Bộ câu hỏi này chưa được tổ chức lần nào.</div>` : null}
      ${results.length > 1
        ? html`<div class="qz-run-chips" role="tablist" aria-label="Các lần tổ chức">
            ${results.map(
              (run, i) => html`<button type="button" role="tab" key=${run.runId} aria-selected=${run === result}
                class=${`qz-run-chip${run === result ? ' is-active' : ''}`} onClick=${() => setSelected(i)}>
                ${when(run.finishedAt)} · ${run.ranking.length} người
              </button>`,
            )}
          </div>`
        : null}
      ${result ? html`<${Run} key=${result.runId} result=${result} />` : null}
    </main>
  `;
}

function Run({ result }) {
  const players = result.ranking.length;
  const questions = result.questions.length;
  const answers = result.questions.reduce((sum, q) => sum + q.counts.reduce((a, b) => a + b, 0), 0);
  const correct = result.ranking.reduce((sum, p) => sum + p.correct, 0);

  return html`<div class="hh-stack">
    <section class="qz-result-hero">
      <div class="qz-result-stats">
        <${Stat} value=${players} label="người chơi" />
        <${Stat} value=${questions} label="câu hỏi" />
        <${Stat} value=${`${percent(correct, players * questions)}%`} label="trả lời đúng" />
        <${Stat} value=${`${percent(answers, players * questions)}%`} label="tỉ lệ trả lời" />
        <${Stat} value=${`${minutes(result.startedAt, result.finishedAt)}′`} label=${when(result.finishedAt)} />
      </div>
      ${players ? html`<${Podium} top=${result.ranking.slice(0, 3)} />` : html`<p>Không có người chơi.</p>`}
    </section>

    <section class="hh-card hh-stack">
      <h2 class="qz-section-title">Bảng xếp hạng</h2>
      <ol class="qz-result-ranking">
        ${result.ranking.map(
          (player) => html`<li key=${player.id}>
            <span class=${`qz-rank qz-rank-${player.rank}`}>${player.rank}</span>
            <${Avatar} id=${player.id} name=${player.name} size="sm" />
            <span class="qz-name">${player.name} ${player.anonymous ? html`<span class="kh-tag">khách</span>` : null}</span>
            <span class="qz-accuracy" title=${`${player.correct}/${questions} câu đúng`}>
              <span class="qz-accuracy-bar"><span style=${{ width: `${percent(player.correct, questions)}%` }}></span></span>
              <span class="hh-muted">${player.correct}/${questions}</span>
            </span>
            <span class="qz-score">${player.score.toLocaleString('vi-VN')}</span>
          </li>`,
        )}
      </ol>
    </section>

    <section class="hh-stack">
      <h2 class="qz-section-title">Thống kê từng câu</h2>
      ${result.questions.map((question, idx) => html`<${QuestionStat} key=${idx} idx=${idx} question=${question} />`)}
    </section>
  </div>`;
}

function Stat({ value, label }) {
  return html`<div class="qz-stat"><strong>${value}</strong><span>${label}</span></div>`;
}

function QuestionStat({ idx, question }) {
  const total = question.counts.reduce((sum, n) => sum + n, 0);
  const right = percent(question.counts[question.correct] || 0, total);
  const tone = right >= 70 ? 'is-easy' : right >= 40 ? 'is-medium' : 'is-hard';
  return html`<article class="hh-card qz-qstat">
    <header class="qz-qstat-head">
      <span class="qz-thumb-no">${idx + 1}</span>
      <h3>${question.text}</h3>
      <span class=${`qz-qstat-badge ${tone}`}>${right}% đúng</span>
    </header>
    <div class="qz-qstat-grid">
      ${question.options.map((text, index) => {
        const share = percent(question.counts[index], total);
        return html`<div key=${index} class=${`qz-qstat-option qz-option-${index}${index === question.correct ? ' is-correct' : ''}`}>
          <span class="qz-qstat-fill" style=${{ width: `${share}%` }}></span>
          <${Suit} index=${index} />
          <span class="qz-option-text">${text}</span>
          ${index === question.correct ? html`<span class="qz-check" aria-label="Đáp án đúng">✓</span>` : null}
          <span class="qz-count">${question.counts[index]} · ${share}%</span>
        </div>`;
      })}
    </div>
  </article>`;
}

function downloadCsv(result) {
  const cell = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const rows = [
    ['Hạng', 'Người chơi', 'Khách', 'Số câu đúng', 'Số câu', 'Điểm'],
    ...result.ranking.map((p) => [p.rank, p.name, p.anonymous ? 'x' : '', p.correct, result.questions.length, p.score]),
  ];
  // BOM so Excel reads UTF-8 (Vietnamese) correctly.
  const blob = new Blob(['﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${result.code}-${result.finishedAt.slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
