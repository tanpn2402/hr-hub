import { html, render, useEffect, useRef, useState } from './lib.js';
import { confetti, countUp, emojiRain, pop, shake } from './fx.js';
import { watchDevtools } from '/hr-hub/vendor/hrhub-guard.module.js';
import { Avatar, BigCount, Leaderboard, Podium, QuestionImage, Signal, Suit, SUIT_NAMES, TimeBar } from './ui.js';

/** The app that hosts the rooms (its hrhub.json lists this app as a participant). */
const HOST_APP = 'quizzy-admin';
const RETRY_MS = 5000;

const JOIN_ERRORS = {
  not_found: 'Không tìm thấy phòng, hoặc phòng chưa mở. Kiểm tra lại mã.',
  full: 'Phòng đã đủ người.',
  forbidden: 'Bạn không thể vào phòng này.',
  login_required: 'Phòng này yêu cầu đăng nhập.',
  nickname_taken: 'Tên này đã có người dùng trong phòng, hãy chọn tên khác.',
  rate_limited: 'Thao tác quá nhanh, thử lại sau giây lát.',
};

const CLOSED = {
  closed: 'Người tổ chức đã đóng phòng.',
  host_left: 'Người tổ chức đã rời phòng. Đang chờ họ mở lại…',
  kicked: 'Bạn đã được mời ra khỏi phòng.',
  login_required: 'Sự kiện này yêu cầu đăng nhập.',
};

const CHEERS = ['Quá đỉnh!', 'Chuẩn không cần chỉnh!', 'Xuất sắc!', 'Nhanh như chớp!', 'Thiên tài!'];
const OOPS = ['Sai mất rồi!', 'Hụt rồi!', 'Tiếc quá!', 'Suýt nữa thì đúng!'];

// The nickname typed on the join screen, kept while the app is open (the sandbox has no storage). A reload simply
// rejoins: the server remembers the seat and its name.
let pendingNickname = '';

function useRoute() {
  const [path, setPath] = useState(null);
  useEffect(() => {
    window.hrhub.route.get().then(setPath);
    return window.hrhub.route.onChange(setPath);
  }, []);
  return path;
}

function useMe() {
  const [me, setMe] = useState(null);
  useEffect(() => {
    window.hrhub.user.get().then(setMe, () => setMe({ authenticated: false }));
  }, []);
  return me;
}

/** This device's ping, measured by the server every ~5 s (null until the first measurement). */
function usePing() {
  const [ms, setMs] = useState(() => window.hrhub.realtime.ping());
  useEffect(() => window.hrhub.realtime.onPing(setMs), []);
  return ms;
}

function useCountdown(endsAt) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((endsAt - window.hrhub.realtime.now()) / 1000)));
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - window.hrhub.realtime.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [endsAt]);
  return left;
}

const pick = (list, seed) => list[Math.abs(seed) % list.length];
/** The answers' text, or nulls when the host keeps the question on the main screen only (showQuestionToPlayers off). */
const optionsOf = (state) => state.options || Array.from({ length: state.optionCount || 4 }, () => null);

function App() {
  const path = useRoute();
  const me = useMe();
  if (path === null || me === null) return null;
  const match = /^play:([A-Z0-9]+)$/.exec(path);
  if (match) return html`<${Play} key=${match[1]} code=${match[1]} me=${me} />`;
  return html`<${Join} me=${me} initialCode=${path.startsWith('join:') ? path.slice(5) : ''} />`;
}

// ------------------------------------------------------------------ join

function Join({ me, initialCode }) {
  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState(pendingNickname || (me.authenticated ? me.name || me.username || '' : ''));
  const card = useRef(null);
  const ready = code.length >= 4 && (me.authenticated || nickname.trim().length > 0);
  useEffect(() => pop(card.current, { from: 0.6 }), []);

  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    pendingNickname = nickname.trim();
    window.hrhub.route.navigate(`play:${code}`);
  };

  return html`<main class="kh-stage kh-center">
    <form class="kh-card kh-stack kh-join-form" ref=${card} onSubmit=${submit}>
      <div class="kh-logo">Quizzy<span>🎉</span></div>
      <input class="kh-input kh-code-input" id="code" autocomplete="off" autocapitalize="characters" maxlength="8"
        aria-label="Mã phòng" placeholder="Mã phòng" value=${code}
        onInput=${(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
      <input class="kh-input" id="nickname" maxlength="40" aria-label="Tên hiển thị"
        placeholder=${me.authenticated ? 'Tên hiển thị (tuỳ chọn)' : 'Tên hiển thị'} value=${nickname}
        onInput=${(e) => setNickname(e.target.value)} />
      <button class="kh-btn kh-btn-dark kh-btn-lg min-w-32" type="submit" disabled=${!ready}>Vào phòng</button>
      ${me.authenticated
        ? null
        : html`<p class="kh-hint">
            Bạn đang chơi với tư cách khách.
            <button type="button" class="kh-link" onClick=${() => window.hrhub.user.login()}>Đăng nhập</button>
            để kết quả gắn với tài khoản.
          </p>`}
    </form>
  </main>`;
}

// ------------------------------------------------------------------ play

function Play({ code, me }) {
  const [phase, setPhase] = useState({ kind: 'joining' }); // joining | error | playing | closed
  const [state, setState] = useState(null);
  const [presence, setPresence] = useState(null);
  const [mine, setMine] = useState(null); // last 'me' message from the host
  const [answer, setAnswer] = useState(null); // { idx, choice } sent by this player
  const [you, setYou] = useState(null);
  const [online, setOnline] = useState(true);
  const ping = usePing();
  const [peeking, setPeeking] = useState(false);
  const channel = useRef(null);
  const retry = useRef(null);
  // Set while the room is closed and we wait for the host to open it again (join answers not_found meanwhile).
  const waiting = useRef(false);

  const join = async () => {
    clearTimeout(retry.current);
    try {
      const ch = await window.hrhub.realtime.join({ app: HOST_APP, channel: `event:${code}`, nickname: pendingNickname || undefined });
      channel.current = ch;
      waiting.current = false;
      setYou(ch.me);
      const offs = [
        ch.onState(setState),
        ch.onPresence(setPresence),
        ch.on('me', setMine),
        ch.on('rejected', (payload) => setPhase({ kind: 'closed', reason: payload.reason })),
        ch.onClose((reason) => {
          offs.forEach((off) => off());
          channel.current = null;
          setPhase((current) => (current.kind === 'closed' ? current : { kind: 'closed', reason }));
          if (reason === 'host_left' || reason === 'closed') {
            waiting.current = true;
            retry.current = setTimeout(join, RETRY_MS);
          }
        }),
      ];
      setPhase({ kind: 'playing' });
      // Ask the host for my score and whether I already answered (after a reload or reconnect).
      await ch.send('hello', null);
    } catch (error) {
      if (error.code === 'bad_request' && !pendingNickname) {
        // A new seat needs a name: back to the join screen with the code filled in.
        window.hrhub.route.navigate(`join:${code}`, { replace: true });
        return;
      }
      if (waiting.current && error.code === 'not_found') {
        retry.current = setTimeout(join, RETRY_MS);
        return;
      }
      setPhase({ kind: 'error', code: error.code, message: JOIN_ERRORS[error.code] || error.message });
    }
  };

  useEffect(() => {
    void join();
    const offStatus = window.hrhub.realtime.onStatus((status) => setOnline(status.connected));
    return () => {
      clearTimeout(retry.current);
      offStatus();
      if (channel.current) void channel.current.leave().catch(() => {});
    };
  }, [code]);

  // DevTools guard, when the event asks for it (state.guard): cover the game and tell the host.
  const guarded = !!(state && state.guard);
  useEffect(() => {
    if (!guarded) return;
    const guard = watchDevtools({
      onChange: (open) => {
        setPeeking(open);
        if (channel.current) void channel.current.send('devtools', { open }).catch(() => {});
      },
    });
    return () => {
      guard.stop();
      setPeeking(false);
    };
  }, [guarded]);

  const getAsset = (key) => (channel.current ? channel.current.getAsset(key) : Promise.reject(new Error('offline')));

  const choose = async (idx, choice) => {
    if (answer && answer.idx === idx) return;
    setAnswer({ idx, choice });
    try {
      await channel.current.send('answer', { idx, choice }, { persist: `q${idx}` });
    } catch (error) {
      setAnswer(null);
      window.hrhub.ui.alert(`Chưa gửi được đáp án: ${error.message}`);
    }
  };

  const exit = () => {
    if (channel.current) void channel.current.leave().catch(() => {});
    channel.current = null;
    window.hrhub.route.navigate('');
  };

  const myAnswer =
    state && answer && answer.idx === state.idx
      ? answer
      : state && mine && mine.idx === state.idx && mine.answered
        ? mine
        : null;
  const result = state && mine && mine.idx === state.idx && mine.phase === 'reveal' ? mine : null;
  const verdict = state && state.phase === 'reveal' && result ? (result.correct ? 'correct' : result.answered ? 'wrong' : 'timeout') : '';

  let body;
  if (phase.kind === 'joining') body = html`<div class="kh-center kh-fill"><div class="kh-loader"></div><p>Đang vào phòng…</p></div>`;
  else if (phase.kind === 'error') {
    body = html`<div class="kh-center kh-fill"><div class="kh-card kh-stack">
      <div class="kh-emoji">🤔</div>
      <p>${phase.message}</p>
      ${phase.code === 'login_required'
        ? html`<button class="kh-btn kh-btn-dark min-w-32" type="button" onClick=${() => window.hrhub.user.login()}>Đăng nhập</button>`
        : html`<button class="kh-btn kh-btn-dark min-w-32" type="button" onClick=${() => window.hrhub.route.navigate(`join:${code}`)}>Nhập lại</button>`}
    </div></div>`;
  } else if (phase.kind === 'closed') {
    body = html`<div class="kh-body">
      <div class="kh-card kh-stack kh-center-card">
        <div class="kh-emoji">${phase.reason === 'kicked' ? '👋' : phase.reason === 'host_left' ? '📡' : '🚪'}</div>
        <p>${CLOSED[phase.reason] || 'Phòng đã đóng.'}</p>
        ${phase.reason === 'login_required' && !me.authenticated
          ? html`<button class="kh-btn kh-btn-dark min-w-32" type="button" onClick=${() => window.hrhub.user.login()}>Đăng nhập</button>`
          : null}
      </div>
      ${state && state.phase === 'finished' ? html`<${Final} state=${state} mine=${mine} you=${you} />` : null}
    </div>`;
  } else {
    body = html`<${Stage} state=${state} mine=${mine} result=${result} myAnswer=${myAnswer} choose=${choose} you=${you} presence=${presence}
      getAsset=${getAsset} />`;
  }

  return html`<main class=${`kh-stage kh-player-stage${verdict ? ` is-${verdict}` : ''}`}>
    <div class="kh-playerbar">
      ${you ? html`<${Avatar} id=${you.id} name=${you.name} size="sm" />` : null}
      <span class="kh-playerbar-name">${you ? you.name : ''}</span>
      <span class="kh-pill kh-ping-pill"><${Signal} ms=${online ? ping : null} /></span>
      <span class="kh-pill hh-mono">${code}</span>
      ${mine ? html`<span class="kh-pill kh-score-pill">${mine.score.toLocaleString('vi-VN')}</span>` : null}
      <button class="kh-btn kh-btn-ghost kh-btn-sm" type="button" onClick=${exit}>Rời phòng</button>
    </div>
    ${!online ? html`<div class="kh-banner kh-banner-info">Mất kết nối, đang kết nối lại…</div>` : null}
    ${online && phase.kind === 'playing' && presence && !presence.hostOnline
      ? html`<div class="kh-banner kh-banner-info">Người tổ chức đang mất kết nối, vui lòng chờ…</div>`
      : null}
    ${body}
    ${peeking
      ? html`<div class="kh-peek" role="alertdialog" aria-label="Đang mở DevTools">
          <div class="kh-card kh-stack kh-center-card">
            <div class="kh-emoji">🙈</div>
            <h2 class="kh-title">Đừng tò mò nha!</h2>
            <p>Đóng DevTools để chơi tiếp. Người tổ chức đã được báo 😉</p>
          </div>
        </div>`
      : null}
  </main>`;
}

function Stage({ state, mine, result, myAnswer, choose, you, presence, getAsset }) {
  if (!state || state.phase === 'lobby') return html`<${Lobby} you=${you} presence=${presence} />`;
  if (state.phase === 'countdown') return html`<${Countdown} key=${`c${state.idx}`} state=${state} getAsset=${getAsset} />`;
  if (state.phase === 'question') {
    return html`<${Question} key=${`q${state.idx}`} state=${state} myAnswer=${myAnswer} choose=${choose} getAsset=${getAsset} />`;
  }
  if (state.phase === 'reveal') return html`<${Reveal} key=${`r${state.idx}`} state=${state} result=${result} myAnswer=${myAnswer} />`;
  if (state.phase === 'leaderboard') return html`<${Standings} key=${`l${state.idx}`} state=${state} mine=${mine} you=${you} />`;
  return html`<${Final} state=${state} mine=${mine} you=${you} />`;
}

function Lobby({ you, presence }) {
  const ref = useRef(null);
  useEffect(() => pop(ref.current, { from: 0.2 }), []);
  return html`<div class="kh-center kh-fill">
    <div class="kh-stack kh-lobby" ref=${ref}>
      ${you ? html`<div class="kh-bounce"><${Avatar} id=${you.id} name=${you.name} size="lg" /></div>` : null}
      <h2 class="kh-heading">Bạn đã vào phòng!</h2>
      <p class="kh-sub">Thấy tên mình trên màn hình chưa? 👀</p>
      ${presence ? html`<p class="kh-sub">👥 ${presence.count} người chơi · chờ người tổ chức bắt đầu…</p>` : null}
      <div class="kh-dots"><i></i><i></i><i></i></div>
    </div>
  </div>`;
}

/**
 * The question's picture, when the host shares questions with players: fetched once from the channel by its key,
 * then revealed in sync with the host screen (same server clock, same tile order seeded by the question id).
 */
function PlayerImage({ state, getAsset, endsAt, total }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    if (state.image) getAsset(state.image).then((value) => alive && setData(value), () => {});
    return () => {
      alive = false;
    };
  }, [state.image]);
  if (!state.image) return null;
  if (!data) return html`<div class="kh-image-loading">🖼 Đang tải hình…</div>`;
  const question = { id: state.image.replace(/^img:/, ''), image: data, reveal: state.reveal };
  return html`<${QuestionImage} question=${question} endsAt=${endsAt} total=${total} />`;
}

function Countdown({ state, getAsset }) {
  const left = useCountdown(state.endsAt);
  return html`<div class="kh-center kh-fill kh-splash">
    <div class="kh-splash-label">Câu ${state.idx + 1}/${state.total}</div>
    ${state.text ? html`<h2 class="kh-question">${state.text}</h2>` : null}
    <${PlayerImage} state=${state} getAsset=${getAsset} />
    <${BigCount} value=${left} />
    <p class="kh-sub">Chuẩn bị!</p>
  </div>`;
}

function Question({ state, myAnswer, choose, getAsset }) {
  const left = useCountdown(state.endsAt);
  const over = left <= 0;
  if (myAnswer) {
    return html`<div class="kh-center kh-fill">
      <div class="kh-stack kh-sent">
        <div class=${`kh-sent-tile qz-option-${myAnswer.choice}`}><${Suit} index=${myAnswer.choice} /></div>
        <h2 class="kh-heading">Bạn đã chọn</h2>
        <${AnswerCard} index=${myAnswer.choice} text=${optionsOf(state)[myAnswer.choice]} />
        <p class="kh-sub">Chờ mọi người trả lời… ⏳</p>
        <div class="kh-dots"><i></i><i></i><i></i></div>
      </div>
    </div>`;
  }
  // Without text the tiles carry only colour + suit (the question is on the main screen).
  const blind = !state.text;
  return html`<div class=${`kh-body${blind ? ' kh-blind' : ''}`}>
    <div class="kh-question-head">
      <div class=${`kh-timer kh-timer-sm${left <= 5 ? ' is-urgent' : ''}`}>${left}</div>
      ${blind
        ? html`<h2 class="kh-question kh-look-up">👀 Câu ${state.idx + 1}/${state.total} · nhìn câu hỏi trên màn hình chính</h2>`
        : html`<h2 class="kh-question">${state.text}</h2>`}
    </div>
    <${TimeBar} endsAt=${state.endsAt} total=${state.seconds * 1000} />
    ${blind ? null : html`<${PlayerImage} state=${state} getAsset=${getAsset} endsAt=${state.endsAt} total=${state.seconds * 1000} />`}
    <div class="qz-option-grid kh-answer-grid">
      ${optionsOf(state).map(
        (text, index) => html`<button key=${index} type="button" class=${`qz-option kh-answer qz-option-${index}`} disabled=${over}
          aria-label=${text ? `${SUIT_NAMES[index]}: ${text}` : SUIT_NAMES[index]} onClick=${() => choose(state.idx, index)}>
          <${Suit} index=${index} />${text ? html`<span class="qz-option-text">${text}</span>` : null}
        </button>`,
      )}
    </div>
    ${over ? html`<p class="kh-sub kh-center">⏰ Hết giờ!</p>` : null}
  </div>`;
}

/** An answer as a small card: its colour, its suit and its text ("Rô · Hà Nội" without spelling out "Rô"). */
function AnswerCard({ index, text }) {
  return html`<div class=${`kh-answer-card qz-option-${index}${text ? '' : ' is-suit-only'}`} aria-label=${text ? `${SUIT_NAMES[index]}: ${text}` : SUIT_NAMES[index]}>
    <${Suit} index=${index} />
    ${text ? html`<span>${text}</span>` : null}
  </div>`;
}

function Reveal({ state, result, myAnswer }) {
  const box = useRef(null);
  const points = useRef(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!result || fired.current) return;
    fired.current = true;
    pop(box.current, { from: 0.4 });
    if (result.correct) {
      confetti();
      countUp(points.current, result.points, { duration: 1 });
    } else if (result.answered) {
      shake(box.current);
      emojiRain(['😵', '🙈', '💦', '😅']);
    } else {
      emojiRain(['⏰', '🐢', '💤']);
    }
  }, [result]);

  let content;
  if (!result) content = html`<div class="kh-loader"></div><p class="kh-sub">${myAnswer ? 'Đang chấm điểm…' : 'Đang tổng kết…'}</p>`;
  else if (result.correct) {
    content = html`<div class="kh-emoji">🎉</div>
      <h2 class="kh-heading">${pick(CHEERS, result.points)}</h2>
      <div class="kh-points">+<span ref=${points}>0</span></div>
      ${result.streak >= 2 ? html`<div class="kh-streak">🔥 Chuỗi ${result.streak} câu đúng!</div>` : null}`;
  } else if (result.answered) {
    content = html`<div class="kh-emoji">😵</div><h2 class="kh-heading">${pick(OOPS, state.idx)}</h2>
      <p class="kh-sub">Đáp án đúng</p>
      <${AnswerCard} index=${state.correct} text=${optionsOf(state)[state.correct]} />`;
  } else {
    content = html`<div class="kh-emoji">⏰</div><h2 class="kh-heading">Chậm mất rồi!</h2>
      <p class="kh-sub">Đáp án đúng</p>
      <${AnswerCard} index=${state.correct} text=${optionsOf(state)[state.correct]} />`;
  }

  return html`<div class="kh-center kh-fill">
    <div class="kh-stack kh-verdict" ref=${box}>
      ${content}
      ${result
        ? html`<div class="kh-rank-card">
            <span>Hạng <strong>${result.rank}</strong>/${result.players}</span>
            <span>${result.behind ? `Kém ${result.behind.name} ${result.behind.points.toLocaleString('vi-VN')} điểm` : result.rank === 1 ? 'Bạn đang dẫn đầu! 👑' : ''}</span>
          </div>`
        : null}
    </div>
  </div>`;
}

function Standings({ state, mine, you }) {
  const card = useRef(null);
  useEffect(() => pop(card.current, { delay: 1.6 }), []);
  return html`<div class="kh-body kh-narrow">
    <h2 class="kh-heading">Bảng xếp hạng</h2>
    <${Podium} top=${state.top.slice(0, 3)} />
    ${mine
      ? html`<div class="kh-rank-card kh-rank-big" ref=${card}>
          <span>Bạn hạng <strong>${mine.rank}</strong>/${mine.players}</span>
          <span><strong>${mine.score.toLocaleString('vi-VN')}</strong> điểm</span>
        </div>`
      : null}
    ${state.top.length > 3 ? html`<${Leaderboard} players=${state.top.slice(3, 5)} highlight=${you && you.id} />` : null}
    <p class="kh-sub kh-center">${state.idx + 1 < state.total ? 'Chuẩn bị câu tiếp theo…' : 'Sắp công bố kết quả cuối!'}</p>
  </div>`;
}

function Final({ state, mine }) {
  const top3 = mine && mine.rank && mine.rank <= 3;
  useEffect(() => {
    const timers = [1500, ...(top3 ? [2600, 3800] : [])].map((ms) => setTimeout(() => confetti(), ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  return html`<div class="kh-body kh-narrow">
    <h2 class="kh-heading">🏁 Kết thúc!</h2>
    <${Podium} top=${(state.top || []).slice(0, 3)} />
    ${mine
      ? html`<div class="kh-rank-card kh-rank-big">
          <span>${top3 ? 'Bạn lên bục vinh quang! 🏆' : `Bạn hạng ${mine.rank}/${mine.players}`}</span>
          <span><strong>${mine.score.toLocaleString('vi-VN')}</strong> điểm</span>
        </div>`
      : null}
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
