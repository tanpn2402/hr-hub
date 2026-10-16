import { html, useEffect, useRef, useState } from './lib.js';
import { useCountdown } from './hooks.js';
import { QuizHost } from './host.js';
import { missingImages, settingsOf, validateEvent } from './quiz.js';
import { clearRun, loadEvent, loadRun, playerApp } from './store.js';
import { confetti, pop } from './fx.js';
import { Alert, AnswerBars, Avatar, BigCount, Icon, Leaderboard, Loading, OptionTile, Podium, QuestionImage, Signal, TimeBar } from './ui.js';
import { copyText } from './transfer.js';
import { qrDataUrl } from '/hr-hub/vendor/hrhub-qr.module.js';

const OPEN_ERRORS = {
  in_use: 'Phòng này đang được người khác điều khiển.',
  not_found: 'App chưa khai báo kênh realtime (thiếu hrhub.json trong phiên bản đang publish).',
  forbidden: 'Bạn không có quyền mở phòng này.',
};

const PHASE_LABELS = {
  lobby: 'Phòng chờ',
  countdown: 'Chuẩn bị',
  question: 'Đang trả lời',
  reveal: 'Kết quả',
  leaderboard: 'Bảng xếp hạng',
  finished: 'Kết thúc',
};

export function RunView({ code }) {
  const [setup, setSetup] = useState({ status: 'loading' });
  const [snap, setSnap] = useState(null);
  const [busy, setBusy] = useState(false);
  const host = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadEvent(code), loadRun(code)])
      .then(async ([found, run]) => {
        if (!alive) return;
        if (!found) return setSetup({ status: 'error', message: `Không tìm thấy sự kiện ${code}.` });
        if (!(await playerApp())) {
          return setSetup({ status: 'error', message: 'Chưa chọn “App người chơi” trong cài đặt của Web App này (HR Hub → Web Apps).' });
        }
        const errors = validateEvent(found.event);
        if (errors.length) return setSetup({ status: 'error', message: `Sự kiện chưa hoàn chỉnh: ${errors[0]}` });
        const missing = missingImages(found.event);
        if (missing.length) {
          return setSetup({
            status: 'error',
            message: `Câu ${missing.map((m) => m.index + 1).join(', ')} cần hình nhưng chưa có. Vào “Sửa” để thêm hình (nút “Tìm ảnh”) hoặc chọn “Không cần hình”.`,
          });
        }
        setSetup({ status: run ? 'resume' : 'ready', event: found.event, run });
      })
      .catch((error) => alive && setSetup({ status: 'error', message: error.message }));
    return () => {
      alive = false;
      if (host.current) void host.current.close();
    };
  }, [code]);

  const open = async (resume) => {
    setBusy(true);
    if (!resume && setup.run) await clearRun(code).catch(() => {});
    const quiz = new QuizHost(setup.event, setSnap);
    host.current = quiz;
    try {
      await quiz.open(resume ? setup.run : null);
      setSetup({ ...setup, status: 'open' });
    } catch (error) {
      host.current = null;
      setSetup({ ...setup, status: 'error', message: OPEN_ERRORS[error.code] || `Không thể mở phòng: ${error.message}` });
    }
    setBusy(false);
  };

  const act = (fn) => async () => {
    setBusy(true);
    try {
      await fn(host.current);
    } catch (error) {
      host.current.fail(error);
    }
    setBusy(false);
  };

  const kick = async (player) => {
    const ok = await window.hrhub.ui.confirm(`Mời “${player.name}”${player.ip ? ` (${player.ip})` : ''} ra khỏi phòng? Người này sẽ không vào lại được.`, {
      title: 'Mời ra khỏi phòng',
      destructive: true,
    });
    if (ok) await act((quiz) => quiz.kick(player.id))();
  };

  const leave = async () => {
    if (snap && snap.phase !== 'finished' && snap.phase !== 'lobby') {
      if (!(await window.hrhub.ui.confirm('Đóng phòng khi trò chơi chưa kết thúc?', { destructive: true }))) return;
    }
    if (host.current) await host.current.close();
    host.current = null;
    window.hrhub.route.navigate('');
  };

  if (setup.status === 'loading') return html`<main class="hh-page-body hh-container"><${Loading} /></main>`;
  if (setup.status === 'error') {
    return html`<main class="hh-page-body hh-container hh-stack">
      <${Alert}>${setup.message}<//>
      <div><button class="hh-btn hh-btn-outline min-w-32" type="button" onClick=${() => window.hrhub.route.navigate('')}>Về danh sách</button></div>
    </main>`;
  }

  const event = setup.event;
  if (setup.status === 'resume' || setup.status === 'ready') {
    return html`<main class="kh-stage kh-center">
      <div class="kh-card kh-stack">
        <h1 class="kh-title">${event.title}</h1>
        <p>${event.questions.length} câu hỏi · mã <strong class="hh-mono">${event.code}</strong> · ${settingsOf(event).auto ? 'tự động' : 'điều khiển tay'}</p>
        ${setup.status === 'resume'
          ? html`<p>
                Có phiên đang dở ở câu ${setup.run.idx + 1}/${event.questions.length} với ${Object.keys(setup.run.players).length} người chơi
                (lưu lúc ${new Date(setup.run.savedAt).toLocaleString('vi-VN')}).
              </p>
              <div class="hh-row kh-center-row">
                <button class="kh-btn kh-btn-primary min-w-32" type="button" disabled=${busy} onClick=${() => open(true)}>Tiếp tục phiên này</button>
                <button class="kh-btn kh-btn-outline min-w-32" type="button" disabled=${busy} onClick=${() => open(false)}>Bắt đầu lại</button>
              </div>`
          : html`<div class="hh-row kh-center-row">
              <button class="kh-btn kh-btn-primary kh-btn-lg min-w-32" type="button" disabled=${busy} onClick=${() => open(false)}>Mở phòng</button>
            </div>`}
        <button class="kh-link" type="button" onClick=${() => window.hrhub.route.navigate('')}>← Về danh sách</button>
      </div>
    </main>`;
  }

  if (!snap) return html`<main class="kh-stage kh-center"><${Loading} /></main>`;

  return html`<main class="kh-stage">
    <div class="kh-topbar">
      <span class="kh-pill">${PHASE_LABELS[snap.phase]}${snap.idx >= 0 && snap.phase !== 'lobby' && snap.phase !== 'finished' ? ` · Câu ${snap.idx + 1}/${snap.total}` : ''}</span>
      <span class="kh-pill">👥 ${snap.online}/${snap.players.length}</span>
      <span class="kh-pill hh-mono">${event.code}</span>
      <span class="kh-pill" title="Độ trễ của máy host tới máy chủ"><${Signal} ms=${snap.hostPing} /></span>
      <div class="kh-topbar-actions">
        ${snap.phase !== 'lobby' && snap.phase !== 'finished' && snap.auto
          ? snap.paused
            ? html`<button class="kh-btn kh-btn-sm min-w-32" type="button" onClick=${act((q) => q.resume())}>▶ Tiếp tục</button>`
            : html`<button class="kh-btn kh-btn-light kh-btn-sm min-w-32" type="button" onClick=${act((q) => q.pause())}>⏸ Tạm dừng</button>`
          : null}
        ${snap.phase !== 'lobby' && snap.phase !== 'finished'
          ? html`<button class="kh-btn kh-btn-light kh-btn-sm min-w-32" type="button" disabled=${busy} onClick=${act((q) => q.next())}>Tiếp ⏭</button>`
          : null}
        <button class="kh-btn kh-btn-ghost kh-btn-sm min-w-32" type="button" onClick=${leave}>
          <${Icon} name="logout" size=${16} />${snap.phase === 'finished' ? 'Đóng phòng' : 'Thoát'}
        </button>
      </div>
    </div>
    ${snap.error ? html`<div class="kh-banner">${snap.error}</div>` : null}
    ${!snap.connected ? html`<div class="kh-banner">Phòng đã đóng. Người chơi không còn kết nối.</div>` : null}
    ${snap.paused && snap.phase !== 'lobby' ? html`<div class="kh-banner kh-banner-info">Đã tạm dừng: bấm “Tiếp tục” hoặc “Tiếp” để đi tiếp.</div>` : null}
    <${Stage} snap=${snap} event=${event} busy=${busy} act=${act} kick=${kick} />
  </main>`;
}

function Stage({ snap, event, busy, act, kick }) {
  const settings = settingsOf(event);
  switch (snap.phase) {
    case 'lobby':
      return html`<${Lobby} snap=${snap} event=${event} busy=${busy} act=${act} kick=${kick} />`;
    case 'countdown':
      return html`<${CountdownStage} snap=${snap} key=${snap.idx} showQuestion=${settings.showQuestionOnCountdown} />`;
    case 'question':
      return html`<${QuestionStage} snap=${snap} key=${snap.idx} />`;
    case 'reveal': {
      const answered = snap.counts.reduce((sum, n) => sum + n, 0);
      return html`<div class="kh-body" key=${`r${snap.idx}`}>
        <h2 class="kh-question">${snap.question.text}</h2>
        <${QuestionImage} question=${snap.question} revealed=${true} />
        <${AnswerBars} options=${snap.question.options} counts=${snap.counts} correct=${snap.question.correct} />
        <div class="qz-option-grid">
          ${snap.question.options.map(
            (text, index) => html`<${OptionTile} key=${index} index=${index} text=${text} count=${snap.counts[index]}
              total=${answered} correct=${index === snap.question.correct} dim=${index !== snap.question.correct} />`,
          )}
        </div>
        <${NextBar} snap=${snap} total=${settings.revealSeconds * 1000} busy=${busy} act=${act}
          label=${snap.idx + 1 >= snap.total ? 'Xem kết quả cuối' : settings.leaderboardEvery ? 'Bảng xếp hạng' : `Câu ${snap.idx + 2}`} />
      </div>`;
    }
    case 'leaderboard':
      return html`<div class="kh-body kh-narrow" key=${`l${snap.idx}`}>
        <h2 class="kh-heading">Bảng xếp hạng</h2>
        <${Leaderboard} players=${snap.ranking} limit=${5} />
        <${NextBar} snap=${snap} total=${settings.leaderboardSeconds * 1000} busy=${busy} act=${act}
          label=${snap.idx + 1 < snap.total ? `Câu ${snap.idx + 2}` : 'Xem kết quả cuối'} />
      </div>`;
    default:
      return html`<${Final} snap=${snap} />`;
  }
}

function Lobby({ snap, event, busy, act, kick }) {
  const [player, setPlayer] = useState(null);
  useEffect(() => {
    playerApp().then(setPlayer, () => {});
  }, []);
  // Full link to the players' app with the code filled in (/join:<CODE>), as players will type it: same host and
  // port as this page (the app is served from the HR Hub origin).
  const joinUrl = player ? `${window.location.protocol}//${window.location.host}/hr-hub/apps/${player}/join:${event.code}` : '';
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!(await copyText(joinUrl))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return html`<div class="kh-body">
    <div class="kh-join">
      <div class="kh-join-main">
        <div>Mở đường dẫn dưới đây (hoặc quét mã QR) rồi nhập mã phòng</div>
        <div class="kh-join-url">
          <span class="kh-join-link hh-mono">${joinUrl || 'Đang tải…'}</span>
          <button type="button" class="kh-btn kh-btn-primary kh-btn-sm" disabled=${!joinUrl} onClick=${copy}
            title="Sao chép đường dẫn">
            <${Icon} name=${copied ? 'check' : 'copy'} size=${16} />${copied ? 'Đã sao chép' : 'Sao chép'}
          </button>
        </div>
        <div class="kh-code" aria-label="Mã phòng">${event.code}</div>
      </div>
      ${joinUrl
        ? html`<img class="kh-qr" src=${qrDataUrl(joinUrl, { margin: 2, dark: '#25076b' })} alt=${`Mã QR: ${joinUrl}`} />`
        : null}
    </div>
    <div class="kh-lobby-bar">
      <span class="kh-count">👥 <strong>${snap.players.length}</strong> người chơi</span>
      <h2 class="kh-title">${event.title}</h2>
      <button class="kh-btn kh-btn-lg min-w-32" type="button" disabled=${busy || snap.players.length === 0} onClick=${act((q) => q.start())}>
        <${Icon} name="play" size=${20} />Bắt đầu
      </button>
    </div>
    ${snap.players.length === 0 ? html`<div class="kh-waiting">Đang chờ người chơi tham gia…</div>` : null}
    <div class="kh-players">
      ${snap.players.map((player) => html`<${PlayerCard} key=${player.id} player=${player} kick=${kick} />`)}
    </div>
  </div>`;
}

function PlayerCard({ player, kick }) {
  const ref = useRef(null);
  useEffect(() => pop(ref.current), []);
  return html`<div class=${`kh-player${player.online ? '' : ' is-offline'}`} ref=${ref}>
    <${Avatar} id=${player.id} name=${player.name} />
    <div class="kh-player-info">
      <div class="kh-player-name">
        ${player.name}
        ${player.anonymous ? html`<span class="kh-tag">khách</span>` : null}
        ${player.devtoolsCount
          ? html`<span class=${`kh-tag kh-tag-warn${player.devtools ? ' is-live' : ''}`}
              title=${player.devtools ? 'Đang mở DevTools' : `Đã mở DevTools ${player.devtoolsCount} lần`}>🔍 ${player.devtoolsCount}</span>`
          : null}
      </div>
      <div class="kh-player-meta">
        <span class="kh-player-ip hh-mono" title="Địa chỉ IP">${player.ip || '—'}</span>
        ${player.online ? html`<${Signal} ms=${player.ping} />` : html`<span class="kh-player-ip">mất kết nối</span>`}
      </div>
    </div>
    <button type="button" class="kh-kick" title="Mời ra khỏi phòng" aria-label=${`Mời ${player.name} ra khỏi phòng`} onClick=${() => kick(player)}>✕</button>
  </div>`;
}

function CountdownStage({ snap, showQuestion }) {
  const left = useCountdown(snap.phaseEndsAt);
  return html`<div class="kh-body kh-center kh-splash">
    <div class="kh-splash-label">Câu ${snap.idx + 1}/${snap.total}</div>
    ${showQuestion ? html`<h2 class="kh-question kh-question-xl">${snap.question.text}</h2>` : html`<div class="kh-heading">Chuẩn bị!</div>`}
    ${showQuestion ? html`<${QuestionImage} question=${snap.question} />` : null}
    <${BigCount} value=${left} />
  </div>`;
}

function QuestionStage({ snap }) {
  const left = useCountdown(snap.phaseEndsAt);
  return html`<div class="kh-body">
    <h2 class="kh-question">${snap.question.text}</h2>
    <${QuestionImage} question=${snap.question} endsAt=${snap.phaseEndsAt} total=${snap.question.seconds * 1000} />
    <div class="kh-question-row">
      <div class=${`kh-timer${left <= 5 ? ' is-urgent' : ''}`} aria-live="polite">${left}</div>
      <div class="kh-answered"><strong>${snap.answered}</strong><span>trả lời</span></div>
    </div>
    <${TimeBar} endsAt=${snap.phaseEndsAt} total=${snap.question.seconds * 1000} />
    <div class="qz-option-grid">
      ${snap.question.options.map((text, index) => html`<${OptionTile} key=${index} index=${index} text=${text} />`)}
    </div>
  </div>`;
}

/** Auto: a bar emptying until the next step. Manual: the "next" button. */
function NextBar({ snap, total, busy, act, label }) {
  if (snap.auto && !snap.paused && snap.phaseEndsAt) return html`<${TimeBar} endsAt=${snap.phaseEndsAt} total=${total} />`;
  return html`<div class="hh-row kh-center-row">
    <button class="kh-btn kh-btn-lg min-w-32" type="button" disabled=${busy} onClick=${act((q) => q.next())}>${label}</button>
  </div>`;
}

function Final({ snap }) {
  useEffect(() => {
    const timers = [400, 1600, 2800].map((ms) => setTimeout(() => confetti(), ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  return html`<div class="kh-body kh-narrow">
    <h2 class="kh-heading">🏆 Kết quả chung cuộc</h2>
    <${Podium} top=${snap.ranking.slice(0, 3)} />
    ${snap.ranking.length > 3 ? html`<${Leaderboard} players=${snap.ranking.slice(3)} limit=${100} />` : null}
    <div class="kh-banner kh-banner-info">Đã lưu kết quả. Xem lại trong mục “Kết quả” của sự kiện.</div>
  </div>`;
}
