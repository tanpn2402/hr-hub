// Pure quiz rules: no DOM, no SDK, no Preact (tested with Node: node quiz.test.mjs).

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
export const MIN_SECONDS = 5;
export const MAX_SECONDS = 120;
/** Answers stamped by the server up to this late are still accepted (network jitter). */
export const LATE_GRACE_MS = 500;
/** One image per question, kept as a small data URL inside the event (an hrhub.data value is capped at 1 MB). */
export const MAX_IMAGE_CHARS = 150000;
export const MAX_EVENT_CHARS = 950000;
/** How an image shows up on the host screen while the question runs: full, or sharpening with the timer. */
export const REVEAL_MODES = { none: 'Hiện rõ ngay', blur: 'Mờ rồi rõ dần', pixel: 'Pixel rồi rõ dần', tiles: 'Mở dần từng ô' };

export const DEFAULT_SETTINGS = {
  defaultSeconds: 20,
  maxPoints: 1000,
  speedBonus: true,
  requireLogin: false,
  leaderboardEvery: true,
  /** Run by itself once started: countdown -> question -> result -> leaderboard -> next countdown ... */
  auto: true,
  /** Show the question text during the countdown (players can read it before the answers appear). */
  showQuestionOnCountdown: true,
  /**
   * Send the question and the answers' text to players' devices. Off = Kahoot classic: the text is only on the host
   * screen and players get coloured suits, so nothing on their device can be read by a bot or an AI.
   */
  showQuestionToPlayers: true,
  /** Players' app pauses on DevTools and covers the game while it is open (and the host is told). */
  blockDevtools: true,
  countdownSeconds: 3,
  revealSeconds: 5,
  leaderboardSeconds: 10,
};

/** Bounds of the timing settings (seconds). */
export const TIMING_LIMITS = {
  defaultSeconds: [MIN_SECONDS, MAX_SECONDS],
  maxPoints: [100, 10000],
  countdownSeconds: [2, 10],
  revealSeconds: [2, 60],
  leaderboardSeconds: [3, 60],
};

const SETTING_LABELS = {
  defaultSeconds: 'thời gian mặc định',
  maxPoints: 'điểm tối đa',
  countdownSeconds: 'đếm ngược',
  revealSeconds: 'thời gian hiện kết quả',
  leaderboardSeconds: 'thời gian hiện bảng xếp hạng',
};

/** Settings of an event saved before a setting existed get its default. */
export function settingsOf(event) {
  return { ...DEFAULT_SETTINGS, ...(event.settings || {}) };
}

// No 0/O, 1/I/L: the code is read aloud and typed on phones.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newCode(random = Math.random, length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

export function normalizeCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function newId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyQuestion(settings = DEFAULT_SETTINGS) {
  return { id: newId('q'), text: '', options: ['', '', '', ''], correct: 0, seconds: settings.defaultSeconds, image: '', imageHint: '', reveal: 'blur' };
}

export function newEvent(code) {
  return {
    schemaVersion: 1,
    code,
    title: '',
    description: '',
    settings: { ...DEFAULT_SETTINGS },
    questions: [emptyQuestion()],
  };
}

/** Questions as they are played: blank options dropped, `correct` re-indexed. */
export function playableQuestions(event) {
  return event.questions.map((question) => {
    const kept = question.options.map((text, index) => ({ text: text.trim(), index })).filter((o) => o.text);
    return {
      id: question.id,
      text: question.text.trim(),
      options: kept.map((o) => o.text),
      correct: kept.findIndex((o) => o.index === question.correct),
      seconds: question.seconds,
      image: question.image || '',
      imageHint: question.imageHint || '',
      reveal: question.reveal in REVEAL_MODES ? question.reveal : 'blur',
    };
  });
}

/**
 * Questions written around a picture (an AI-written "imageHint") that still have no image. Saving is fine; starting a
 * room is not. Returns [{ index, hint }].
 */
export function missingImages(event) {
  return event.questions
    .map((question, index) => ({ index, hint: (question.imageHint || '').trim(), image: question.image }))
    .filter((q) => q.hint && !q.image)
    .map(({ index, hint }) => ({ index, hint }));
}

/** Google Images search for a hint (opened in a new tab: the sandbox allows popups). */
export function imageSearchUrl(hint) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(hint)}`;
}

/** Problems of one (editor-shaped) question, without the "Câu n:" prefix. */
export function questionErrors(question) {
  const [playable] = playableQuestions({ questions: [question] });
  const errors = [];
  if (!playable.text) errors.push('chưa nhập nội dung.');
  if (playable.options.length < MIN_OPTIONS) errors.push(`cần ít nhất ${MIN_OPTIONS} phương án.`);
  if (playable.correct < 0) errors.push('đáp án đúng đang để trống.');
  if (!(playable.seconds >= MIN_SECONDS && playable.seconds <= MAX_SECONDS)) {
    errors.push(`thời gian phải từ ${MIN_SECONDS} đến ${MAX_SECONDS} giây.`);
  }
  if (playable.image && !(/^data:image\/(jpeg|png|webp);base64,/.test(playable.image) && playable.image.length <= MAX_IMAGE_CHARS)) {
    errors.push('hình ảnh không hợp lệ hoặc quá lớn, hãy chọn lại.');
  }
  return errors;
}

/** Problems that prevent saving/starting, in Vietnamese, one per line. */
export function validateEvent(event) {
  const errors = [];
  if (!event.title.trim()) errors.push('Chưa nhập tên sự kiện.');
  if (event.questions.length === 0) errors.push('Cần ít nhất 1 câu hỏi.');
  event.questions.forEach((question, i) => {
    for (const error of questionErrors(question)) errors.push(`Câu ${i + 1}: ${error}`);
  });
  if (event.questions.reduce((sum, question) => sum + (question.image || '').length, 0) > MAX_EVENT_CHARS) {
    errors.push('Tổng dung lượng hình ảnh quá lớn, hãy bớt ảnh hoặc chọn ảnh nhỏ hơn.');
  }
  const settings = settingsOf(event);
  for (const [key, [min, max]] of Object.entries(TIMING_LIMITS)) {
    if (!(settings[key] >= min && settings[key] <= max)) errors.push(`Cài đặt: ${SETTING_LABELS[key]} phải từ ${min} đến ${max}.`);
  }
  return errors;
}

/**
 * Points for one answer. `elapsedMs` = server time of the answer minus server time the question was shown.
 * With the speed bonus, an instant answer earns maxPoints and a last-second one half of it (Kahoot-style).
 */
export function pointsFor({ correct, elapsedMs, durationMs, maxPoints, speedBonus }) {
  if (!correct) return 0;
  if (!speedBonus) return maxPoints;
  const ratio = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
  return Math.round(maxPoints * (1 - ratio / 2));
}

/** Whether an answer arriving at server time `at` counts for a question shown at `startedAt` for `durationMs`. */
export function inTime(at, startedAt, durationMs) {
  return at >= startedAt && at <= startedAt + durationMs + LATE_GRACE_MS;
}

/** For each player: { rank, behind: { name, points } | null } where behind = the player just above them. */
export function standings(players) {
  const ranked = ranking(players);
  const result = {};
  ranked.forEach((player, i) => {
    const above = ranked.slice(0, i).reverse().find((other) => other.score > player.score);
    result[player.id] = { rank: player.rank, behind: above ? { name: above.name, points: above.score - player.score } : null };
  });
  return result;
}

/** How many players picked each option. */
export function countAnswers(answers, optionCount) {
  const counts = new Array(optionCount).fill(0);
  for (const answer of Object.values(answers)) {
    if (answer.choice >= 0 && answer.choice < optionCount) counts[answer.choice]++;
  }
  return counts;
}

/**
 * Players sorted by score (ties: the one with less total answer time first, then name), with competition ranks
 * (1, 2, 2, 4). `players` = { id: { name, score, timeMs } }.
 */
export function ranking(players) {
  const sorted = Object.entries(players)
    .map(([id, p]) => ({ id, name: p.name, score: p.score, timeMs: p.timeMs || 0 }))
    .sort((a, b) => b.score - a.score || a.timeMs - b.timeMs || a.name.localeCompare(b.name, 'vi'));
  let rank = 0;
  return sorted.map((player, i) => {
    if (i === 0 || player.score !== sorted[i - 1].score || player.timeMs !== sorted[i - 1].timeMs) rank = i + 1;
    return { ...player, rank };
  });
}

// ------------------------------------------------------------------ import / export / AI prompt
// One JSON format for all three: { "title"?, "description"?, "questions": [{ "text", "options", "correct", "seconds"? }] }
// "correct" = 0-based index into "options" (the text of the right option is accepted too).
// Images themselves are not part of it; a picture question carries "imageHint" (what to show, search keywords) and,
// from an AI, optionally "imageUrl" (a direct image link the editor tries to download once, on import).

export const MAX_QUESTIONS = 100;
const MAX_TEXT = 300;
const MAX_OPTION = 120;
const MAX_HINT = 200;

/** The event's questions in the exchange format (blank options dropped). */
export function exportQuestions(event) {
  return {
    title: event.title,
    description: event.description,
    questions: playableQuestions(event).map(({ text, options, correct, seconds, imageHint }) => ({
      text,
      options,
      correct,
      seconds,
      ...(imageHint ? { imageHint } : {}),
    })),
  };
}

/**
 * Reads pasted JSON (also when an AI wrapped it in ```json fences or a sentence). Returns the valid questions in
 * editor shape (4 option slots) and one Vietnamese error per problem; invalid questions are skipped.
 */
export function parseQuestionsJson(text, settings = DEFAULT_SETTINGS) {
  const result = { title: '', description: '', questions: [], errors: [] };
  const raw = extractJson(text);
  if (raw === undefined) {
    result.errors.push('Không đọc được JSON. Hãy dán đúng nội dung JSON (bắt đầu bằng { hoặc [).');
    return result;
  }

  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.questions) ? raw.questions : null;
  if (!list) {
    result.errors.push('JSON phải có dạng { "questions": [...] } hoặc là một mảng câu hỏi.');
    return result;
  }
  if (!Array.isArray(raw)) {
    if (typeof raw.title === 'string') result.title = raw.title.trim().slice(0, 120);
    if (typeof raw.description === 'string') result.description = raw.description.trim().slice(0, 500);
  }
  if (list.length > MAX_QUESTIONS) result.errors.push(`Chỉ nhận tối đa ${MAX_QUESTIONS} câu; phần sau bị bỏ qua.`);

  list.slice(0, MAX_QUESTIONS).forEach((item, i) => {
    const question = parseQuestion(item, settings);
    if (typeof question === 'string') result.errors.push(`Câu ${i + 1}: ${question}`);
    else result.questions.push(question);
  });
  if (list.length === 0) result.errors.push('Danh sách câu hỏi đang trống.');
  return result;
}

function parseQuestion(item, settings) {
  if (!item || typeof item !== 'object') return 'không phải một đối tượng câu hỏi.';
  const text = typeof item.text === 'string' ? item.text.trim() : typeof item.question === 'string' ? item.question.trim() : '';
  if (!text) return 'thiếu "text" (nội dung câu hỏi).';
  if (text.length > MAX_TEXT) return `nội dung dài quá ${MAX_TEXT} ký tự.`;

  if (!Array.isArray(item.options)) return 'thiếu mảng "options".';
  const options = item.options.map((option) => (typeof option === 'string' || typeof option === 'number' ? String(option).trim() : ''));
  if (options.some((option) => !option)) return 'có phương án trống hoặc không phải chuỗi.';
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) return `cần từ ${MIN_OPTIONS} đến ${MAX_OPTIONS} phương án.`;
  if (options.some((option) => option.length > MAX_OPTION)) return `có phương án dài quá ${MAX_OPTION} ký tự.`;

  let correct = item.correct;
  // A string is the text of the right option first ("114" in ["113", "114"]), else an index written as text.
  if (typeof correct === 'string' && options.includes(correct.trim())) correct = options.indexOf(correct.trim());
  correct = Number(correct);
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
    return `"correct" phải là số thứ tự (từ 0 đến ${options.length - 1}) của đáp án đúng.`;
  }

  let seconds = Number(item.seconds);
  if (!Number.isFinite(seconds)) seconds = settings.defaultSeconds;
  seconds = Math.min(Math.max(Math.round(seconds), MIN_SECONDS), MAX_SECONDS);

  const imageHint = typeof item.imageHint === 'string' ? item.imageHint.trim().slice(0, MAX_HINT) : '';
  const imageUrl = typeof item.imageUrl === 'string' && /^https:\/\/\S{1,1000}$/.test(item.imageUrl.trim()) ? item.imageUrl.trim() : '';
  return {
    id: newId('q'),
    text,
    options: [...options, '', '', ''].slice(0, MAX_OPTIONS),
    correct,
    seconds,
    image: '',
    // A picture question: keep the hint even when only a URL came, so the admin knows what to look for.
    imageHint: imageHint || (imageUrl ? 'Hình ảnh cho câu hỏi này' : ''),
    reveal: 'blur',
    // Transient: downloaded by the editor right after import, never saved.
    ...(imageUrl ? { imageUrl } : {}),
  };
}

function extractJson(text) {
  const source = String(text || '').trim();
  const candidates = [source];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(source);
  if (fenced) candidates.push(fenced[1].trim());
  const start = source.search(/[[{]/);
  const end = Math.max(source.lastIndexOf('}'), source.lastIndexOf(']'));
  if (start >= 0 && end > start) candidates.push(source.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next shape
    }
  }
  return undefined;
}

/** The prompt an admin pastes into any AI chat; the answer is pasted back into "Nhập JSON". */
export function aiPrompt({ topic, count, optionCount, seconds, notes, imageCount = 0 }) {
  const options = Array.from({ length: optionCount }, (_, i) => `Phương án ${i + 1}`);
  const images = Math.min(Math.max(Math.round(imageCount) || 0, 0), count);
  const example = {
    title: 'Tên ngắn cho bộ câu hỏi',
    questions: [
      { text: 'Nội dung câu hỏi?', options, correct: 0, seconds },
      ...(images
        ? [
            {
              text: 'Câu hỏi dựa vào hình (ví dụ: Công trình trong ảnh nằm ở thành phố nào?)',
              options,
              correct: 1,
              seconds,
              imageHint: 'Mô tả hình cần chiếu + từ khoá tìm ảnh',
              imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/...jpg',
            },
          ]
        : []),
    ],
  };
  return [
    'Bạn soạn câu hỏi trắc nghiệm cho một trò chơi đố vui trực tiếp (kiểu Kahoot) trong công ty.',
    '',
    `Chủ đề: ${topic.trim()}`,
    `Số câu hỏi: ${count}`,
    `Mỗi câu có đúng ${optionCount} phương án và chỉ 1 phương án đúng.`,
    notes && notes.trim() ? `Yêu cầu thêm: ${notes.trim()}` : null,
    '',
    'Quy tắc:',
    '- Viết bằng tiếng Việt, rõ ràng, không đánh đố mẹo, không trùng lặp câu hỏi.',
    `- Nội dung câu hỏi tối đa ${MAX_TEXT} ký tự, mỗi phương án tối đa ${MAX_OPTION} ký tự, ngắn gọn để đọc nhanh trên điện thoại.`,
    '- Các phương án sai phải hợp lý; vị trí đáp án đúng phân bố ngẫu nhiên giữa các câu.',
    '- Kiểm tra kỹ tính chính xác của đáp án đúng.',
    '- "correct" là số thứ tự của đáp án đúng trong mảng "options", đếm từ 0.',
    `- "seconds" là thời gian trả lời (${MIN_SECONDS}-${MAX_SECONDS} giây), thường là ${seconds}; câu dài có thể cho nhiều hơn.`,
    ...(images
      ? [
          '',
          `Câu hỏi dạng hình ảnh: ${images}/${count} câu phải dựa vào một hình chiếu trên màn hình chính (người chơi nhìn hình để trả lời).`,
          '- Nội dung câu hỏi nhắc tới hình ("trong ảnh", "hình này"...) và chỉ trả lời được khi nhìn hình; hình không được lộ đáp án bằng chữ.',
          `- Thêm "imageHint": mô tả ngắn hình cần chiếu kèm từ khoá tìm ảnh (tối đa ${MAX_HINT} ký tự).`,
          '- Thêm "imageUrl" CHỈ khi bạn chắc chắn có link trực tiếp tới file ảnh công khai trên Wikimedia Commons, dạng https://upload.wikimedia.org/...(.jpg|.png); không chắc thì bỏ trường này, không được bịa link.',
          `- Các câu còn lại không có "imageHint"/"imageUrl".`,
        ]
      : []),
    '',
    'Chỉ trả về JSON hợp lệ đúng theo mẫu dưới đây, không kèm giải thích, không markdown:',
    JSON.stringify(example, null, 2),
  ]
    .filter((line) => line !== null)
    .join('\n');
}
