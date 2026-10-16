// The host side of a live quiz: owns the channel, the clock and the scores. No DOM: the view subscribes to
// snapshots. Players only ever see what is put in the channel state (never the correct answer before "reveal").
//
// Phases: lobby -> countdown -> question -> reveal -> [leaderboard] -> countdown (next) ... -> finished.
// With settings.auto every step advances by itself; otherwise the host clicks "next" after reveal/leaderboard.
import {
  countAnswers,
  inTime,
  LATE_GRACE_MS,
  newId,
  playableQuestions,
  pointsFor,
  ranking,
  settingsOf,
  standings,
} from './quiz.js';
import { channelName, clearRun, saveResult, saveRun } from './store.js';

const TOP = 10;
/** Lobby chat: what the host keeps and relays (players never talk to each other directly). */
const CHAT_KEEP = 50;
const CHAT_MAX_CHARS = 200;
const CHAT_MIN_INTERVAL_MS = 800;
const CHAT_HISTORY_BYTES = 14000; // under the 16 KB message limit
const imageKey = (question) => `img:${question.id}`;
/** Requests from players (hello on join/reconnect) are answered in one sendEach every so often. */
const HELLO_FLUSH_MS = 300;

export class QuizHost {
  constructor(event, onChange) {
    this.event = event;
    this.questions = playableQuestions(event);
    this.settings = settingsOf(event);
    this.onChange = onChange;

    this.channel = null;
    this.phase = 'lobby'; // lobby | countdown | question | reveal | leaderboard | finished
    this.idx = -1;
    this.runId = newId('r');
    this.startedAt = new Date().toISOString();
    /** id -> { name, anonymous, ip, online, score, timeMs, streak, answers: { [idx]: { choice, correct, points, elapsedMs } } } */
    this.players = {};
    /** Answers to the current question: id -> { choice, at } */
    this.answers = {};
    /** Ranks before the last question, to show who moved up. */
    this.previousRanks = {};
    this.phaseEndsAt = 0; // server time the current timed phase ends (countdown, question, auto steps)
    this.questionStartedAt = 0;
    this.questionEndsAt = 0;
    this.paused = false;
    this.error = '';
    /** Server-measured pings (ms): participant id -> ms, and the host's own. */
    this.pings = {};
    this.hostPing = null;

    this.timer = null;
    this.pending = null; // the step an auto timer will run (kept while paused)
    this.helloQueue = new Set();
    this.helloTimer = null;
    this.chat = [];
    this.lastChatAt = {};
    this.offs = [];
    this.assetsReady = Promise.resolve();
    /** Asset key of the latest full ranking (players fetch it only when they open the ranking panel). */
    this.rankingKey = null;
  }

  // ------------------------------------------------------------ lifecycle

  async open(resume) {
    if (resume) this.restore(resume);
    this.channel = await window.hrhub.realtime.open(channelName(this.event.code));
    this.offs.push(
      this.channel.onPresence((presence) => this.onPresence(presence)),
      this.channel.onLatency((pings, hostMs) => {
        this.pings = pings;
        this.hostPing = hostMs ?? this.hostPing;
        this.changed();
      }),
      window.hrhub.realtime.onPing((ms) => {
        this.hostPing = ms;
        this.changed();
      }),
      this.channel.on('answer', (payload, meta) => this.onAnswer(payload, meta)),
      this.channel.on('chat', (payload, meta) => this.onChat(payload, meta)),
      // The players' app reports DevTools opening/closing (only a hint: it runs on their device).
      this.channel.on('devtools', (payload, meta) => {
        if (!this.ensurePlayer(meta.from)) return;
        const player = this.players[meta.from.id];
        player.devtools = !!(payload && payload.open);
        if (player.devtools) player.devtoolsCount = (player.devtoolsCount || 0) + 1;
        this.changed();
      }),
      this.channel.on('hello', (payload, meta) => {
        if (this.ensurePlayer(meta.from)) this.queueHello(meta.from.id);
        this.changed();
      }),
      this.channel.onClose((reason) => {
        this.error = reason === 'closed' ? '' : `Phòng đã đóng (${reason}).`;
        this.channel = null;
        this.clearTimer();
        this.changed();
      }),
    );
    // Images go to the channel once, in the background while players join (only when players may see questions).
    this.assetsReady = this.uploadImages();
    // Resuming: show the leaderboard where we stopped (players reconnect to the same state).
    await this.publish();
    this.changed();
  }

  /** Puts every question image into the channel as asset "img:<question id>"; players fetch them by key. */
  async uploadImages() {
    if (!this.settings.showQuestionToPlayers) return;
    for (const question of this.questions) {
      if (!question.image) continue;
      try {
        await this.channel.putAsset(imageKey(question), question.image);
      } catch (error) {
        this.fail(error);
      }
    }
  }

  async close() {
    this.clearTimer();
    clearTimeout(this.helloTimer);
    this.offs.forEach((off) => off());
    if (this.channel) await this.channel.close().catch(() => {});
    this.channel = null;
  }

  // ------------------------------------------------------------ flow

  start() {
    return this.countdown(0);
  }

  /** "Next" button: skips whatever is running (also the auto timer). */
  next() {
    this.clearTimer();
    if (this.phase === 'lobby') return this.start();
    if (this.phase === 'countdown') return this.showQuestion(this.idx);
    if (this.phase === 'question') return this.reveal();
    if (this.phase === 'reveal') return this.afterReveal();
    if (this.phase === 'leaderboard') return this.advance();
  }

  /** Next question, or the end after the last one. */
  advance() {
    return this.idx + 1 < this.questions.length ? this.countdown(this.idx + 1) : this.finish();
  }

  pause() {
    this.paused = true;
    if (this.timer && this.phase !== 'question' && this.phase !== 'countdown') {
      clearTimeout(this.timer);
      this.timer = null;
      this.phaseEndsAt = 0;
    }
    this.changed();
  }

  resume() {
    this.paused = false;
    // An auto step that was due while paused runs now.
    if (this.pending && !this.timer) {
      const step = this.pending;
      this.pending = null;
      void step();
    }
    this.changed();
  }

  async countdown(idx) {
    await this.assetsReady;
    this.phase = 'countdown';
    this.idx = idx;
    this.answers = {};
    const question = this.questions[idx];
    const ms = this.settings.countdownSeconds * 1000;
    this.phaseEndsAt = window.hrhub.realtime.now() + ms;
    await this.publish({
      ...(this.settings.showQuestionOnCountdown && this.settings.showQuestionToPlayers
        ? { text: question.text, image: question.image ? imageKey(question) : null, reveal: question.reveal }
        : { text: null }),
      optionCount: question.options.length,
      endsAt: this.phaseEndsAt,
    });
    // The countdown always runs by itself (also in manual mode): it is part of showing the question.
    this.schedule(() => this.showQuestion(idx), ms, true);
    this.changed();
  }

  async showQuestion(idx) {
    const question = this.questions[idx];
    const durationMs = question.seconds * 1000;
    this.phase = 'question';
    this.idx = idx;
    this.answers = {};
    this.previousRanks = Object.fromEntries(ranking(this.players).map((player) => [player.id, player.rank]));
    // Players count down to endsAt on the server clock; answers are judged on server timestamps.
    const { at } = await this.channel.setState({
      ...this.base(),
      phase: 'question',
      ...this.forPlayers(question),
      seconds: question.seconds,
      endsAt: window.hrhub.realtime.now() + durationMs,
    });
    this.questionStartedAt = at;
    this.questionEndsAt = at + durationMs;
    this.phaseEndsAt = this.questionEndsAt;
    this.schedule(() => this.reveal(), durationMs + LATE_GRACE_MS, true);
    this.changed();
  }

  async reveal() {
    if (this.phase !== 'question') return;
    this.clearTimer();
    const question = this.questions[this.idx];
    const durationMs = question.seconds * 1000;

    for (const [id, player] of Object.entries(this.players)) {
      const answer = this.answers[id];
      if (!answer) {
        player.streak = 0;
        continue;
      }
      const correct = answer.choice === question.correct;
      const elapsedMs = Math.max(answer.at - this.questionStartedAt, 0);
      const points = pointsFor({ correct, elapsedMs, durationMs, ...this.settings });
      player.answers[this.idx] = { choice: answer.choice, correct, points, elapsedMs };
      player.score += points;
      player.timeMs += elapsedMs;
      player.streak = correct ? (player.streak || 0) + 1 : 0;
    }

    this.phase = 'reveal';
    await this.shareRanking();
    await this.autoStep(this.settings.revealSeconds, () => this.afterReveal());
    await this.sendPersonal();
    await this.checkpoint();
    this.changed();
  }

  afterReveal() {
    if (this.idx + 1 >= this.questions.length) return this.finish();
    return this.settings.leaderboardEvery ? this.showLeaderboard() : this.advance();
  }

  async showLeaderboard() {
    this.phase = 'leaderboard';
    await this.autoStep(this.settings.leaderboardSeconds, () => this.advance());
    this.changed();
  }

  async finish() {
    this.clearTimer();
    this.phase = 'finished';
    this.phaseEndsAt = 0;
    await this.shareRanking();
    await this.publish();
    await this.sendPersonal();
    await saveResult(this.event.code, this.result());
    await clearRun(this.event.code);
    this.changed();
  }

  async kick(id) {
    await this.channel.kick(id);
    delete this.players[id];
    delete this.answers[id];
    this.changed();
  }

  // ------------------------------------------------------------ timers

  /** Publishes the phase and, in auto mode, schedules the next step after `seconds`. */
  async autoStep(seconds, step) {
    const auto = this.settings.auto && !this.paused;
    this.phaseEndsAt = auto ? window.hrhub.realtime.now() + seconds * 1000 : 0;
    await this.publish(auto ? { nextAt: this.phaseEndsAt } : {});
    if (this.settings.auto) this.schedule(step, seconds * 1000);
  }

  /** `always`: also in manual mode and while paused (countdown, question time). */
  schedule(step, ms, always = false) {
    this.clearTimer();
    this.pending = step;
    if (this.paused && !always) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.pending = null;
      Promise.resolve(step()).catch((error) => this.fail(error));
    }, ms);
  }

  clearTimer() {
    clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  // ------------------------------------------------------------ players

  onPresence(presence) {
    for (const member of presence.participants || []) {
      if (this.ensurePlayer(member, member.online)) {
        Object.assign(this.players[member.id], { name: member.name, online: member.online, ip: member.ip || null });
      }
    }
    // Players who left on purpose disappear from presence; keep their score if they already played.
    const present = new Set((presence.participants || []).map((member) => member.id));
    for (const [id, player] of Object.entries(this.players)) {
      if (present.has(id)) continue;
      if (Object.keys(player.answers).length === 0) delete this.players[id];
      else player.online = false;
    }
    this.changed();
    if (this.phase === 'question' && this.everyoneAnswered()) void this.reveal();
  }

  /**
   * Presence reaches the host a moment after a join, so a player's first message can come first: `from` (stamped by
   * the server, not by the player) is enough to seat them. Returns false for players this event refuses.
   */
  ensurePlayer(from, online = true) {
    if (this.players[from.id]) return true;
    if (this.settings.requireLogin && from.anonymous) {
      void this.reject(from.id);
      return false;
    }
    this.players[from.id] = {
      name: from.name,
      anonymous: from.anonymous,
      ip: from.ip || null,
      online,
      joinedAt: from.joinedAt || Date.now(),
      score: 0,
      timeMs: 0,
      streak: 0,
      answers: {},
    };
    return true;
  }

  async reject(id) {
    try {
      await this.channel.sendTo([id], 'rejected', { reason: 'login_required' });
      await this.channel.kick(id);
    } catch (error) {
      console.warn('Could not reject player', id, error);
    }
  }

  onAnswer(payload, meta) {
    const id = meta.from.id;
    if (this.phase !== 'question' || this.answers[id] || !this.ensurePlayer(meta.from)) return;
    if (!payload || payload.idx !== this.idx) return;
    const choice = Number(payload.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= this.questions[this.idx].options.length) return;
    if (!inTime(meta.at, this.questionStartedAt, this.questionEndsAt - this.questionStartedAt)) return;

    this.answers[id] = { choice, at: meta.at };
    this.changed();
    if (this.everyoneAnswered()) void this.reveal();
  }

  everyoneAnswered() {
    const online = Object.entries(this.players).filter(([, player]) => player.online);
    return online.length > 0 && online.every(([id]) => this.answers[id]);
  }

  /**
   * Lobby chat. The sender comes from the server (meta.from), so nobody can speak for someone else; the host trims,
   * rate-limits and relays to everyone.
   */
  onChat(payload, meta) {
    // The host's own relays come back to it too (a broadcast reaches the whole channel): never relay them again.
    if (meta.host) return;
    if (!this.settings.chat || !this.channel) return;
    if (!this.ensurePlayer(meta.from)) return;
    const id = meta.from.id;
    if (meta.at - (this.lastChatAt[id] || 0) < CHAT_MIN_INTERVAL_MS) return;
    const text = String((payload && payload.text) || '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_CHARS);
    if (!text) return;
    this.lastChatAt[id] = meta.at;
    const message = { id: newId('m'), from: { id, name: this.players[id].name }, text, at: meta.at };
    this.chat = [...this.chat, message].slice(-CHAT_KEEP);
    void this.channel.broadcast('chat', message).catch((error) => this.fail(error));
    this.changed();
  }

  /** The host's own message: tagged as the organizer, broadcast to everyone (it is not relayed back). */
  async sendChat(text) {
    if (!this.channel || !this.settings.chat) throw new Error('Chat đang tắt');
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_CHARS);
    if (!clean) return;
    const me = this.channel.me || { id: 'host', name: 'Người tổ chức' };
    const message = { id: newId('m'), from: { id: me.id, name: me.name, host: true }, text: clean, at: window.hrhub.realtime.now() };
    this.chat = [...this.chat, message].slice(-CHAT_KEEP);
    this.changed();
    await this.channel.broadcast('chat', message);
  }

  /** The latest messages that fit in one message. */
  chatHistory() {
    const messages = [];
    let bytes = 0;
    for (let i = this.chat.length - 1; i >= 0; i--) {
      bytes += JSON.stringify(this.chat[i]).length + 1;
      if (bytes > CHAT_HISTORY_BYTES) break;
      messages.unshift(this.chat[i]);
    }
    return messages;
  }

  /** A player (re)joined: tell them their score and whether they already answered the current question. */
  queueHello(id) {
    this.helloQueue.add(id);
    if (this.helloTimer) return;
    this.helloTimer = setTimeout(() => {
      this.helloTimer = null;
      const ids = [...this.helloQueue];
      this.helloQueue.clear();
      void this.sendPersonal(ids);
      // Newcomers (and players back after a reload) get the chat so far.
      if (this.settings.chat && this.chat.length) {
        void this.channel.sendTo(ids, 'chatHistory', { messages: this.chatHistory() }).catch(() => {});
      }
    }, HELLO_FLUSH_MS);
  }

  /** Each player's own result: one sendEach for everybody. */
  async sendPersonal(ids = Object.keys(this.players)) {
    if (!this.channel) return;
    const table = standings(this.players);
    const total = Object.keys(this.players).length;
    const messages = {};
    for (const id of ids) {
      const player = this.players[id];
      if (!player) continue;
      const answer = player.answers[this.idx] || null;
      const pending = this.answers[id];
      messages[id] = {
        idx: this.idx,
        phase: this.phase,
        answered: !!(answer || pending),
        choice: answer ? answer.choice : pending ? pending.choice : null,
        correct: answer ? answer.correct : null,
        points: answer ? answer.points : 0,
        score: player.score,
        streak: player.streak || 0,
        rank: table[id] ? table[id].rank : null,
        behind: table[id] ? table[id].behind : null,
        players: total,
      };
    }
    if (Object.keys(messages).length) await this.channel.sendEach('me', messages).catch((error) => this.fail(error));
  }

  // ------------------------------------------------------------ state

  /** What players get of a question: its text and answers, or only how many answers there are. */
  forPlayers(question) {
    return this.settings.showQuestionToPlayers
      ? {
          text: question.text,
          options: question.options,
          optionCount: question.options.length,
          // The key of the question's image asset (players fetch it once), and how it is revealed.
          image: question.image ? imageKey(question) : null,
          reveal: question.reveal,
        }
      : { text: null, options: null, optionCount: question.options.length };
  }

  base() {
    return {
      title: this.event.title,
      total: this.questions.length,
      idx: this.idx,
      auto: this.settings.auto,
      guard: this.settings.blockDevtools,
      chat: this.settings.chat,
      rankingKey: this.rankingKey,
    };
  }

  /**
   * The whole ranking as a channel asset (one per question: assets are cached by key), so the state stays small and
   * only players who open the ranking panel download it.
   */
  async shareRanking() {
    if (!this.channel) return;
    const list = ranking(this.players).map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      rank: player.rank,
      correct: Object.values(this.players[player.id].answers).filter((answer) => answer.correct).length,
    }));
    const key = `ranking:${this.phase === 'finished' ? 'final' : this.idx}`;
    try {
      await this.channel.putAsset(key, JSON.stringify(list));
      this.rankingKey = key;
    } catch (error) {
      // Not worth stopping the game (e.g. the channel's asset budget is used up): players keep the previous one.
      console.warn('Could not share the ranking', error);
    }
  }

  top() {
    return ranking(this.players)
      .slice(0, TOP)
      .map(({ id, name, score, rank }) => ({
        name,
        score,
        rank,
        move: this.previousRanks[id] ? this.previousRanks[id] - rank : 0,
        streak: this.players[id].streak || 0,
      }));
  }

  /** The (public) channel state for the current phase; `extra` adds timing fields. */
  async publish(extra = {}) {
    const question = this.questions[this.idx];
    let state;
    if (this.phase === 'countdown') {
      state = { ...this.base(), phase: 'countdown' };
    } else if (this.phase === 'reveal') {
      state = {
        ...this.base(),
        phase: 'reveal',
        ...this.forPlayers(question),
        correct: question.correct,
        counts: countAnswers(this.answers, question.options.length),
      };
    } else if (this.phase === 'leaderboard' || this.phase === 'finished') {
      state = { ...this.base(), phase: this.phase, top: this.top(), players: Object.keys(this.players).length };
    } else {
      state = { ...this.base(), phase: 'lobby' };
    }
    await this.channel.setState({ ...state, ...extra });
  }

  /** Saved after every question so a host who reloads can resume (players keep their seats for hostGraceSeconds). */
  checkpoint() {
    return saveRun(this.event.code, {
      runId: this.runId,
      startedAt: this.startedAt,
      idx: this.idx,
      phase: this.phase,
      players: this.players,
      savedAt: new Date().toISOString(),
    }).catch((error) => this.fail(error));
  }

  restore(run) {
    this.runId = run.runId;
    this.startedAt = run.startedAt;
    this.idx = run.idx;
    // A question that was running is lost; continue from the leaderboard after it (scores up to there are saved).
    this.phase = 'leaderboard';
    this.paused = true;
    this.players = Object.fromEntries(Object.entries(run.players).map(([id, player]) => [id, { ...player, online: false }]));
  }

  result() {
    const ranked = ranking(this.players);
    return {
      runId: this.runId,
      code: this.event.code,
      title: this.event.title,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      questions: this.questions.map((question, idx) => ({
        text: question.text,
        options: question.options,
        correct: question.correct,
        counts: countAnswers(
          Object.fromEntries(
            Object.entries(this.players)
              .filter(([, player]) => player.answers[idx])
              .map(([id, player]) => [id, player.answers[idx]]),
          ),
          question.options.length,
        ),
      })),
      ranking: ranked.map((player) => ({
        rank: player.rank,
        id: player.id,
        name: player.name,
        anonymous: !!this.players[player.id].anonymous,
        score: player.score,
        correct: Object.values(this.players[player.id].answers).filter((answer) => answer.correct).length,
      })),
    };
  }

  /** Snapshot for the view. */
  snapshot() {
    const question = this.questions[this.idx] || null;
    const table = ranking(this.players);
    return {
      connected: !!this.channel,
      phase: this.phase,
      idx: this.idx,
      total: this.questions.length,
      question,
      auto: this.settings.auto,
      paused: this.paused,
      phaseEndsAt: this.phaseEndsAt,
      answered: Object.keys(this.answers).length,
      counts: question ? countAnswers(this.answers, question.options.length) : [],
      ranking: table.map((player) => ({
        ...this.players[player.id],
        ...player,
        move: this.previousRanks[player.id] ? this.previousRanks[player.id] - player.rank : 0,
      })),
      hostPing: this.hostPing,
      chat: this.chat,
      chatOn: this.settings.chat,
      me: this.channel ? this.channel.me : null,
      players: Object.entries(this.players)
        .map(([id, player]) => ({ id, ...player, ping: player.online ? (this.pings[id] ?? null) : null }))
        .sort((a, b) => a.joinedAt - b.joinedAt),
      online: Object.values(this.players).filter((player) => player.online).length,
      error: this.error,
    };
  }

  fail(error) {
    this.error = error.message || String(error);
    this.changed();
  }

  changed() {
    this.onChange(this.snapshot());
  }
}
