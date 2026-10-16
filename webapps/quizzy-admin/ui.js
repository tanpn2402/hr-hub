import { html, useEffect, useRef } from './lib.js';
import { countUp, pop, riseIn } from './fx.js';

/** Answer symbols: hearts, diamonds, clubs, spades ("cơ, rô, chuồn, bích"), one per answer colour. */
export const SUIT_NAMES = ['Cơ', 'Rô', 'Chuồn', 'Bích'];
const SUIT_PATHS = [
  'M12 21.3S2.5 15.5 2.5 8.9A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.5 2.9c0 6.6-9.5 12.4-9.5 12.4z',
  'M12 1.8 20.5 12 12 22.2 3.5 12z',
  'M12 2.2a4.6 4.6 0 0 1 4.3 6.3 4.6 4.6 0 1 1-2.6 7.6l1.4 5.7H8.9l1.4-5.7a4.6 4.6 0 1 1-2.6-7.6A4.6 4.6 0 0 1 12 2.2z',
  'M12 1.8c2.9 4 9.3 7.4 9.3 12a4.7 4.7 0 0 1-7.9 3.4l1.4 4.8H9.2l1.4-4.8a4.7 4.7 0 0 1-7.9-3.4c0-4.6 6.4-8 9.3-12z',
];

export function Suit({ index, class: className = '' }) {
  return html`<svg class=${`qz-suit ${className}`} viewBox="0 0 24 24" aria-hidden="true"><path d=${SUIT_PATHS[index]} /></svg>`;
}

const AVATAR_COLORS = ['#e11d48', '#2563eb', '#d97706', '#16a34a', '#9333ea', '#0891b2', '#db2777', '#ea580c'];

function hash(text) {
  let h = 0;
  for (const char of String(text)) h = (h * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Initials on a colour picked from the id, so a player keeps their colour all game long. */
export function Avatar({ id, name, size = 'md' }) {
  const words = String(name || '?').trim().split(/\s+/);
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)).toUpperCase();
  return html`<span class=${`qz-avatar qz-avatar-${size}`} style=${{ background: AVATAR_COLORS[hash(id || name) % AVATAR_COLORS.length] }}
    aria-hidden="true">${initials}</span>`;
}

export function Checkbox({ label, checked, onChange }) {
  const host = useRef(null);
  const api = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    api.current = window.hrhub.ui.checkbox(host.current, { label, checked, onChange: (value) => onChangeRef.current(value) });
    return () => {
      if (host.current) host.current.textContent = '';
    };
  }, []);
  useEffect(() => {
    if (api.current && api.current.getChecked() !== checked) api.current.setChecked(checked);
  }, [checked]);
  return html`<div ref=${host}></div>`;
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  return html`<div class=${`hh-alert hh-alert-${kind}`}>${children}</div>`;
}

export function Loading() {
  return html`<div class="hh-empty"><span class="hh-spinner"></span></div>`;
}

/** A coloured answer tile (host screens, results). */
export function OptionTile({ index, text, count, total, correct, dim }) {
  const share = total ? Math.round((count / total) * 100) : 0;
  return html`<div class=${`qz-option qz-option-${index}${dim ? ' qz-dim' : ''}${correct ? ' qz-correct' : ''}`}>
    <${Suit} index=${index} />
    <span class="qz-option-text">${text}</span>
    ${correct ? html`<span class="qz-check" aria-label="Đáp án đúng">✓</span>` : null}
    ${count !== undefined ? html`<span class="qz-count">${count}${total ? ` · ${share}%` : ''}</span>` : null}
  </div>`;
}

/** Bars growing to the share of answers of each option (reveal). */
export function AnswerBars({ options, counts, correct }) {
  const ref = useRef(null);
  const max = Math.max(1, ...counts);
  useEffect(() => {
    if (ref.current) riseIn([...ref.current.querySelectorAll(".qz-bar")], { step: 0.12 });
  }, []);
  return html`<div class="qz-bars" ref=${ref}>
    ${options.map(
      (_, index) => html`<div class=${`qz-bar qz-option-${index}${index === correct ? '' : ' qz-dim'}`} key=${index}>
        <span class="qz-bar-count">${counts[index]}</span>
        <span class="qz-bar-fill" style=${{ height: `${Math.max(6, (counts[index] / max) * 100)}%` }}></span>
        <span class="qz-bar-label"><${Suit} index=${index} />${index === correct ? ' ✓' : ''}</span>
      </div>`,
    )}
  </div>`;
}

/** Big 3-2-1 number that bounces in on every change. */
export function BigCount({ value }) {
  const ref = useRef(null);
  useEffect(() => pop(ref.current, { from: 2.2 }), [value]);
  return html`<div class="qz-bigcount" ref=${ref} aria-live="assertive">${value > 0 ? value : 'GO!'}</div>`;
}

/** Thin bar emptying until `endsAt` (server time): auto steps and the question timer. */
export function TimeBar({ endsAt, total }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!endsAt || !ref.current) return;
    let frame;
    const tick = () => {
      const left = Math.max(0, endsAt - window.hrhub.realtime.now());
      if (ref.current) ref.current.style.width = `${Math.min(100, (left / total) * 100)}%`;
      if (left > 0) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [endsAt, total]);
  if (!endsAt) return null;
  return html`<div class="qz-timebar"><div ref=${ref}></div></div>`;
}

/** Top 3 on blocks of different heights, rising one after the other (3rd, 2nd, then 1st). */
export function Podium({ top }) {
  const ref = useRef(null);
  const places = [top.find((p) => p.rank === 2) || top[1], top.find((p) => p.rank === 1) || top[0], top.find((p) => p.rank === 3) || top[2]];
  useEffect(() => {
    if (!ref.current) return;
    const blocks = [...ref.current.querySelectorAll('.qz-podium-place')];
    riseIn([blocks[2], blocks[0], blocks[1]].filter(Boolean), { step: 0.6, delay: 0.2 });
    ref.current.querySelectorAll('[data-score]').forEach((el) => countUp(el, Number(el.dataset.score), { duration: 2 }));
  }, [top.map((p) => p && p.name).join('|')]);
  return html`<div class="qz-podium" ref=${ref}>
    ${places.map((player, i) =>
      player
        ? html`<div class=${`qz-podium-place qz-place-${player.rank}`} key=${i}>
            <div class="qz-medal">${['🥇', '🥈', '🥉'][player.rank - 1] || player.rank}</div>
            <${Avatar} id=${player.id || player.name} name=${player.name} size="lg" />
            <div class="qz-podium-name">${player.name}</div>
            <div class="qz-podium-block">
              <span class="qz-podium-score" data-score=${player.score}>0</span>
              <span class="qz-podium-rank">${player.rank}</span>
            </div>
          </div>`
        : html`<div class="qz-podium-place qz-empty-place" key=${i}></div>`,
    )}
  </div>`;
}

/** Ranked rows sliding in, with arrows for players who moved up and streak flames. */
export function Leaderboard({ players, limit = 10, highlight }) {
  const ref = useRef(null);
  const list = players.slice(0, limit);
  useEffect(() => {
    if (ref.current) riseIn([...ref.current.children], { step: 0.07 });
  }, [list.map((p) => `${p.name}:${p.score}`).join('|')]);
  if (!list.length) return html`<div class="hh-empty">Chưa có người chơi.</div>`;
  return html`<ol class="qz-ranking" ref=${ref}>
    ${list.map(
      (player) => html`<li key=${player.id || player.name} class=${player.id && player.id === highlight ? 'is-me' : ''}>
        <span class="qz-rank">${player.rank}</span>
        <${Avatar} id=${player.id || player.name} name=${player.name} size="sm" />
        <span class="qz-name">${player.name}</span>
        ${player.streak >= 2 ? html`<span class="qz-streak" title="Chuỗi trả lời đúng">🔥${player.streak}</span>` : null}
        ${player.move > 0 ? html`<span class="qz-move" title="Tăng hạng">▲${player.move}</span>` : null}
        <span class="qz-score">${player.score.toLocaleString('vi-VN')}</span>
      </li>`,
    )}
  </ol>`;
}

/** Ping as signal bars + ms: green < 100 ms, amber < 250 ms, red above, grey while unknown. */
export function Signal({ ms, compact = false }) {
  const level = ms == null ? 0 : ms < 100 ? 4 : ms < 250 ? 3 : ms < 500 ? 2 : 1;
  const quality = ms == null ? 'unknown' : ms < 100 ? 'good' : ms < 250 ? 'ok' : 'bad';
  return html`<span class=${`qz-signal is-${quality}`} title=${ms == null ? 'Đang đo độ trễ…' : `Độ trễ tới máy chủ: ${ms} ms`}>
    <svg viewBox="0 0 16 12" aria-hidden="true">
      ${[0, 1, 2, 3].map((i) => html`<rect x=${i * 4} y=${9 - i * 3} width="3" height=${3 + i * 3} rx="0.6" class=${i < level ? 'on' : ''} />`)}
    </svg>
    ${compact ? null : html`<span>${ms == null ? '…' : `${ms} ms`}</span>`}
  </span>`;
}

// ------------------------------------------------------------------ question image
// The image of a question exists only on the host screen (players never receive it). `reveal` decides how it
// sharpens while the question runs: blur (CSS), pixel or tiles (canvas), driven by the server clock like TimeBar.

const PIXEL_START = 8; // blocks across at the start
const TILE_COLS = 8;

/** Deterministic shuffle so every host render uncovers the tiles in the same order. */
function tileOrder(count, seed) {
  let state = 0;
  for (const ch of seed) state = (state * 31 + ch.charCodeAt(0)) >>> 0;
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function drawProgress(canvas, img, reveal, progress, order) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  if (progress >= 1) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, width, height);
    return;
  }
  if (reveal === 'pixel') {
    const across = Math.max(PIXEL_START, Math.round(PIXEL_START * Math.pow(width / PIXEL_START, progress)));
    const small = document.createElement('canvas');
    small.width = across;
    small.height = Math.max(1, Math.round((across * height) / width));
    small.getContext('2d').drawImage(img, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, width, height);
    return;
  }
  // tiles
  const rows = Math.max(1, Math.round((TILE_COLS * height) / width));
  const tileW = width / TILE_COLS;
  const tileH = height / rows;
  ctx.fillStyle = '#2b1b4d';
  ctx.fillRect(0, 0, width, height);
  const shown = Math.ceil(progress * order.length);
  for (let i = 0; i < shown; i++) {
    const col = order[i] % TILE_COLS;
    const row = Math.floor(order[i] / TILE_COLS);
    const sx = (col * img.naturalWidth) / TILE_COLS;
    const sy = (row * img.naturalHeight) / rows;
    ctx.drawImage(img, sx, sy, img.naturalWidth / TILE_COLS, img.naturalHeight / rows, col * tileW, row * tileH, tileW + 1, tileH + 1);
  }
}

/**
 * `endsAt`/`total`: the question timer (server clock); without `endsAt` the image is at its start (countdown).
 * `revealed`: show it sharp (answer screen).
 */
export function QuestionImage({ question, endsAt, total, revealed }) {
  const { image, reveal } = question;
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const animated = !revealed && (reveal === 'blur' || reveal === 'pixel' || reveal === 'tiles');
  const useCanvas = animated && reveal !== 'blur';

  useEffect(() => {
    if (!image || !animated) return;
    const progressNow = () => (endsAt ? Math.min(1, Math.max(0, 1 - (endsAt - window.hrhub.realtime.now()) / total)) : 0);
    let frame;
    if (!useCanvas) {
      const tick = () => {
        const progress = progressNow();
        if (imgRef.current) imgRef.current.style.filter = progress >= 1 ? 'none' : `blur(${Math.round(36 * (1 - progress) * (1 - progress))}px)`;
        if (endsAt && progress < 1) frame = requestAnimationFrame(tick);
      };
      tick();
      return () => cancelAnimationFrame(frame);
    }
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const rows = Math.max(1, Math.round((TILE_COLS * img.naturalHeight) / img.naturalWidth));
      const order = tileOrder(TILE_COLS * rows, question.id);
      const tick = () => {
        if (cancelled) return;
        const progress = progressNow();
        drawProgress(canvas, img, reveal, progress, order);
        if (endsAt && progress < 1) frame = requestAnimationFrame(tick);
      };
      tick();
    };
    img.src = image;
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [image, reveal, endsAt, total, animated, useCanvas, revealed]);

  if (!image) return null;
  return html`<div class="qz-qimage">
    ${useCanvas
      ? html`<canvas ref=${canvasRef} role="img" aria-label="Hình ảnh câu hỏi"></canvas>`
      : html`<img ref=${imgRef} src=${image} alt="Hình ảnh câu hỏi" />`}
  </div>`;
}
