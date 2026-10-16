import { html, useEffect, useRef, useState } from './lib.js';
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

/** Small stroke icons (Lucide shapes): play, logout, copy, check, chat, x. */
const ICONS = {
  play: ['M6 4l14 8-14 8z'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  copy: ['M8 8h12v12H8z', 'M4 16V4h12'],
  check: ['M20 6L9 17l-5-5'],
  chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  trophy: ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16',
    'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22', 'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22',
    'M18 2H6v7a6 6 0 0 0 12 0V2Z'],
};
export function Icon({ name, size = 18 }) {
  return html`<svg class="qz-icon" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    ${ICONS[name].map((d) => html`<path d=${d} fill=${name === 'play' ? 'currentColor' : 'none'} />`)}
  </svg>`;
}

// ------------------------------------------------------------------ lobby chat (shared by players and the host)

/** How long a chat message stays as a bubble over its sender. */
export const BUBBLE_MS = 20000;
export const CHAT_MAX_CHARS = 200;

/** The latest message of each sender, for BUBBLE_MS after it was received: { senderId: message }. */
export function useBubbles(chat) {
  const [bubbles, setBubbles] = useState({});
  const seen = useRef(chat.length);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const fresh = chat.slice(seen.current);
    seen.current = chat.length;
    if (!fresh.length) return;
    setBubbles((current) => {
      const next = { ...current };
      for (const message of fresh) next[message.from.id] = message;
      return next;
    });
    // Each bubble expires on its own (a newer message must not cancel older timers).
    const added = fresh.map((message) =>
      setTimeout(() => {
        setBubbles((current) => {
          if (!current[message.from.id] || current[message.from.id].id !== message.id) return current;
          const { [message.from.id]: gone, ...rest } = current;
          return rest;
        });
      }, BUBBLE_MS),
    );
    timers.current = [...timers.current.slice(-200), ...added];
  }, [chat.length]);
  return bubbles;
}

/** A chat message popping over its sender (fades out before BUBBLE_MS). */
export function Bubble({ text }) {
  const ref = useRef(null);
  useEffect(() => pop(ref.current, { from: 0.4 }), []);
  return html`<div class="kh-bubble" ref=${ref} style=${{ animationDuration: `${BUBBLE_MS}ms` }}>${text}</div>`;
}

/** Chat anchored bottom-right: a round button (chat icon + unread count; ✕ while open) and the panel above it. */
export function ChatPanel({ you, chat, sendChat, defaultOpen }) {
  // defaultOpen: true/false; unset = open on wide screens (lobby), closed on phones.
  const [open, setOpen] = useState(() => (defaultOpen === undefined ? window.innerWidth >= 760 : defaultOpen));
  const [seen, setSeen] = useState(chat.length);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const list = useRef(null);
  // Follow new messages only while the reader is at the bottom; reading history is never interrupted.
  const atBottom = useRef(true);
  const [below, setBelow] = useState(0); // new messages under the visible part
  const shown = useRef(chat.length);

  const toBottom = () => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
    atBottom.current = true;
    setBelow(0);
  };
  const onScroll = () => {
    const el = list.current;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom.current) setBelow(0);
  };

  // Opening the panel shows the latest messages.
  useEffect(() => {
    if (!open) return;
    toBottom();
    shown.current = chat.length;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSeen(chat.length);
    const added = chat.length - shown.current;
    shown.current = chat.length;
    if (added <= 0) return;
    const last = chat[chat.length - 1];
    const mine = you && last && last.from.id === you.id;
    if (atBottom.current || mine) toBottom();
    else setBelow((n) => n + added);
  }, [chat.length]);

  const submit = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    setError('');
    try {
      await sendChat(value);
    } catch (err) {
      setText(value);
      setError(err.code === 'rate_limited' ? 'Gửi chậm lại một chút nhé.' : `Chưa gửi được: ${err.message}`);
    }
  };

  const unread = Math.max(0, chat.length - seen);
  const fab = html`<button type="button" class=${`kh-chat-fab${open ? ' is-open' : ''}`} onClick=${() => setOpen(!open)}
    aria-label=${open ? 'Đóng chat' : 'Mở chat'} aria-expanded=${open}>
    <${Icon} name=${open ? 'x' : 'chat'} size=${26} />
    ${!open && unread ? html`<span class="kh-chat-badge">${unread > 99 ? '99+' : unread}</span>` : null}
  </button>`;
  if (!open) return fab;

  return html`${fab}<aside class="kh-chat" aria-label="Chat phòng chờ">
    <header class="kh-chat-head">
      <strong>Chat phòng chờ</strong>
      <span class="hh-muted">${chat.length} tin</span>
    </header>
    <ol class="kh-chat-list" ref=${list} onScroll=${onScroll}>
      ${chat.length === 0 ? html`<li class="kh-chat-empty">Chưa có tin nhắn. Chào mọi người một câu đi! 👋</li>` : null}
      ${chat.map((message) => {
        const mine = you && message.from.id === you.id;
        return html`<li key=${message.id} class=${`kh-chat-msg${mine ? ' is-mine' : ''}${message.from.host ? ' is-host' : ''}`}>
          ${mine ? null : html`<${Avatar} id=${message.from.id} name=${message.from.name} size="sm" />`}
          <div class="kh-chat-body">
            ${mine ? null : html`<div class="kh-chat-name">${message.from.name}${message.from.host ? html` <span class="kh-chat-tag">Tổ chức</span>` : null}</div>`}
            <div class="kh-chat-text">${message.text}</div>
            <time class="kh-chat-time">${new Date(message.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        </li>`;
      })}
    </ol>
    ${below
      ? html`<button type="button" class="kh-chat-jump" onClick=${toBottom}>↓ ${below} tin mới</button>`
      : null}
    <form class="kh-chat-form" onSubmit=${submit}>
      <input class="kh-input kh-chat-input" maxlength=${CHAT_MAX_CHARS} placeholder="Nhắn gì đó…" value=${text}
        aria-label="Tin nhắn" onInput=${(e) => setText(e.target.value)} />
      <button class="kh-btn kh-btn-dark kh-btn-sm" type="submit" disabled=${!text.trim()}>Gửi</button>
    </form>
    ${error ? html`<div class="kh-chat-error">${error}</div>` : null}
  </aside>`;
}


/**
 * Whole ranking, anchored bottom-left (mirror of the chat): a round trophy button (✕ while open) and the panel above.
 * Either `players` (the host has them) or `load()` (players fetch the host's ranking asset, again when `version`
 * changes while open).
 */
export function RankingPanel({ you, players, load, version, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [list, setList] = useState(players || null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const box = useRef(null);

  useEffect(() => {
    if (players) setList(players);
  }, [players]);

  useEffect(() => {
    if (!open || !load) return;
    let alive = true;
    setStatus('loading');
    load().then(
      (value) => {
        if (!alive) return;
        setList(value);
        setStatus('ready');
      },
      () => alive && setStatus('error'),
    );
    return () => {
      alive = false;
    };
  }, [open, version]);

  // Opening shows where I am.
  useEffect(() => {
    if (!open || !box.current) return;
    const me = box.current.querySelector('.is-me');
    if (me && me.scrollIntoView) me.scrollIntoView({ block: 'center' });
  }, [open, list]);

  const fab = html`<button type="button" class=${`kh-rank-fab${open ? ' is-open' : ''}`} onClick=${() => setOpen(!open)}
    aria-label=${open ? 'Đóng bảng xếp hạng' : 'Xem bảng xếp hạng'} aria-expanded=${open}>
    <${Icon} name=${open ? 'x' : 'trophy'} size=${26} />
  </button>`;
  if (!open) return fab;

  const rows = list || [];
  return html`${fab}<aside class="kh-rank-panel" aria-label="Bảng xếp hạng">
    <header class="kh-chat-head">
      <strong>Bảng xếp hạng</strong>
      <span class="hh-muted">${rows.length} người chơi</span>
    </header>
    <ol class="kh-rank-list" ref=${box}>
      ${status === 'loading' && !list ? html`<li class="kh-chat-empty">Đang tải…</li>` : null}
      ${status === 'error' ? html`<li class="kh-chat-empty">Chưa tải được bảng xếp hạng.</li>` : null}
      ${rows.length === 0 && status !== 'loading' && status !== 'error'
        ? html`<li class="kh-chat-empty">Chưa có điểm: bảng xếp hạng có sau câu đầu tiên.</li>`
        : null}
      ${rows.map(
        (player) => html`<li key=${player.id} class=${`kh-rank-row${you && player.id === you.id ? ' is-me' : ''}`}>
          <span class=${`kh-rank-no${player.rank <= 3 ? ` is-top is-top-${player.rank}` : ''}`}>${player.rank}</span>
          <${Avatar} id=${player.id} name=${player.name} size="sm" />
          <span class="kh-rank-name">${player.name}${you && player.id === you.id ? ' (bạn)' : ''}</span>
          ${player.correct !== undefined ? html`<span class="kh-rank-correct" title="Số câu đúng">✓${player.correct}</span>` : null}
          <span class="kh-rank-score">${player.score.toLocaleString('vi-VN')}</span>
        </li>`,
      )}
    </ol>
  </aside>`;
}
