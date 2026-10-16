// node quiz.test.mjs  (not shipped: package.py only needs index.html; keep tests next to the rules they cover)
import assert from 'node:assert/strict';
import {
  countAnswers,
  inTime,
  newCode,
  newEvent,
  normalizeCode,
  playableQuestions,
  pointsFor,
  ranking,
  validateEvent,
} from './quiz.js';

const code = newCode();
assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
assert.equal(normalizeCode(' ab-c 12 '), 'ABC12');

assert.equal(pointsFor({ correct: false, elapsedMs: 0, durationMs: 20000, maxPoints: 1000, speedBonus: true }), 0);
assert.equal(pointsFor({ correct: true, elapsedMs: 0, durationMs: 20000, maxPoints: 1000, speedBonus: true }), 1000);
assert.equal(pointsFor({ correct: true, elapsedMs: 10000, durationMs: 20000, maxPoints: 1000, speedBonus: true }), 750);
assert.equal(pointsFor({ correct: true, elapsedMs: 25000, durationMs: 20000, maxPoints: 1000, speedBonus: true }), 500);
assert.equal(pointsFor({ correct: true, elapsedMs: 19000, durationMs: 20000, maxPoints: 1000, speedBonus: false }), 1000);

assert.equal(inTime(1000, 1000, 5000), true);
assert.equal(inTime(6400, 1000, 5000), true); // within grace
assert.equal(inTime(6600, 1000, 5000), false);
assert.equal(inTime(999, 1000, 5000), false);

assert.deepEqual(countAnswers({ a: { choice: 1 }, b: { choice: 1 }, c: { choice: 0 }, d: { choice: 9 } }, 3), [1, 2, 0]);

const ranked = ranking({
  a: { name: 'An', score: 900, timeMs: 3000 },
  b: { name: 'Bình', score: 900, timeMs: 3000 },
  c: { name: 'Chi', score: 1200, timeMs: 9000 },
  d: { name: 'Dũng', score: 900, timeMs: 1000 },
});
assert.deepEqual(
  ranked.map((p) => [p.name, p.rank]),
  [
    ['Chi', 1],
    ['Dũng', 2],
    ['An', 3],
    ['Bình', 3],
  ],
);

const event = newEvent('ABC234');
assert.ok(validateEvent(event).length >= 2); // no title, blank question
event.title = 'Quiz';
event.questions[0].text = 'Thủ đô Việt Nam?';
event.questions[0].options = ['Huế', '', 'Hà Nội', ''];
event.questions[0].correct = 2;
assert.deepEqual(validateEvent(event), []);
assert.deepEqual(playableQuestions(event)[0].options, ['Huế', 'Hà Nội']);
assert.equal(playableQuestions(event)[0].correct, 1);
event.questions[0].correct = 1; // blank option marked correct
assert.match(validateEvent(event)[0], /đáp án đúng/);

console.log('quiz.js: all tests passed');

// ---- import / export / AI prompt
const { parseQuestionsJson, exportQuestions, aiPrompt } = await import('./quiz.js');

const aiAnswer = 'Đây là bộ câu hỏi:\n```json\n{"title":"An toàn lao động","questions":[' +
  '{"text":"Bình chữa cháy CO2 dùng cho?","options":["Điện","Xăng","Gỗ","Giấy"],"correct":0,"seconds":15},' +
  '{"text":"Số khẩn cấp cứu hoả?","options":["113","114","115"],"correct":"114"},' +
  '{"text":"","options":["a","b"],"correct":0},' +
  '{"text":"Thiếu đáp án","options":["a","b"],"correct":5}]}\n```\nChúc vui!';
const parsed = parseQuestionsJson(aiAnswer);
assert.equal(parsed.title, 'An toàn lao động');
assert.equal(parsed.questions.length, 2);
assert.deepEqual(parsed.questions[1].options, ['113', '114', '115', '']);
assert.equal(parsed.questions[1].correct, 1); // matched by option text
assert.equal(parsed.questions[1].seconds, 20); // default
assert.equal(parsed.errors.length, 2);
assert.match(parsed.errors[0], /^Câu 3:/);
assert.match(parsed.errors[1], /^Câu 4: "correct"/);

assert.equal(parseQuestionsJson('[{"text":"Q","options":["a","b"],"correct":1,"seconds":999}]').questions[0].seconds, 120);
assert.match(parseQuestionsJson('không có json').errors[0], /Không đọc được JSON/);
assert.match(parseQuestionsJson('{"items":[]}').errors[0], /"questions"/);

// export -> import round trip (back to a valid event first)
event.questions[0].correct = 2;
const roundTrip = parseQuestionsJson(JSON.stringify(exportQuestions(event)));
assert.deepEqual(roundTrip.errors, []);
assert.equal(roundTrip.questions[0].text, event.questions[0].text);
assert.equal(roundTrip.title, 'Quiz');

const prompt = aiPrompt({ topic: 'Lịch sử công ty', count: 12, optionCount: 4, seconds: 20, notes: 'mức độ dễ' });
assert.match(prompt, /Số câu hỏi: 12/);
assert.match(prompt, /Yêu cầu thêm: mức độ dễ/);
const example = parseQuestionsJson(prompt); // the example JSON inside the prompt must itself be importable
assert.deepEqual(example.errors, []);

const { standings, settingsOf, questionErrors } = await import('./quiz.js');
const st = standings({ a: { name: 'An', score: 900 }, b: { name: 'Bình', score: 500 }, c: { name: 'Chi', score: 500 } });
assert.deepEqual(st.a, { rank: 1, behind: null });
assert.deepEqual(st.b, { rank: 2, behind: { name: 'An', points: 400 } });
assert.equal(settingsOf({ settings: { maxPoints: 5 } }).revealSeconds, 5);
assert.equal(questionErrors({ text: 'x', options: ['a', 'b', '', ''], correct: 0, seconds: 20 }).length, 0);

console.log('import/export/prompt: all tests passed');

// ---- images
const { MAX_IMAGE_CHARS, emptyQuestion } = await import('./quiz.js');
const q = { ...emptyQuestion(), text: 'Đây là gì?', options: ['A', 'B', '', ''], correct: 0 };
assert.deepEqual(questionErrors(q), []);
assert.deepEqual(questionErrors({ ...q, image: 'data:image/jpeg;base64,AAAA' }), []);
assert.equal(questionErrors({ ...q, image: 'http://example.com/x.png' }).length, 1);
assert.equal(questionErrors({ ...q, image: 'data:image/jpeg;base64,' + 'A'.repeat(MAX_IMAGE_CHARS) }).length, 1);
assert.equal(playableQuestions({ questions: [{ ...q, image: 'data:image/png;base64,AA', reveal: 'pixel' }] })[0].reveal, 'pixel');
assert.equal(playableQuestions({ questions: [{ ...q, reveal: 'bogus' }] })[0].reveal, 'blur');
console.log('image tests ok');

// ---- picture questions from the AI
{
  const { parseQuestionsJson, aiPrompt, missingImages, exportQuestions } = await import('./quiz.js');
  const prompt = aiPrompt({ topic: 'Bóng đá', count: 10, optionCount: 4, seconds: 20, imageCount: 3 });
  assert.match(prompt, /3\/10 câu phải dựa vào một hình/);
  assert.match(prompt, /upload\.wikimedia\.org/);
  assert.doesNotMatch(aiPrompt({ topic: 'x', count: 5, optionCount: 4, seconds: 20 }), /imageHint/);
  const fromPrompt = parseQuestionsJson(prompt); // the example inside the prompt must import
  assert.deepEqual(fromPrompt.errors, []);
  assert.equal(fromPrompt.questions[1].imageHint, 'Mô tả hình cần chiếu + từ khoá tìm ảnh');
  assert.equal(fromPrompt.questions[1].imageUrl, 'https://upload.wikimedia.org/wikipedia/commons/...jpg');

  const parsed = parseQuestionsJson(JSON.stringify({ questions: [
    { text: 'Ai đây?', options: ['A', 'B'], correct: 0, imageHint: 'Ảnh Messi nâng cúp World Cup 2022', imageUrl: 'http://insecure/x.jpg' },
    { text: 'Q2', options: ['A', 'B'], correct: 1, imageUrl: 'https://upload.wikimedia.org/a.jpg' },
  ] }));
  assert.equal(parsed.questions[0].imageUrl, undefined); // only https links
  assert.equal(parsed.questions[1].imageHint, 'Hình ảnh cho câu hỏi này');
  const ev = { title: 'x', description: '', settings: {}, questions: parsed.questions };
  assert.deepEqual(missingImages(ev).map((m) => m.index), [0, 1]);
  ev.questions[0].image = 'data:image/jpeg;base64,xx';
  assert.deepEqual(missingImages(ev).map((m) => m.index), [1]);
  assert.equal(exportQuestions(ev).questions[0].imageHint, 'Ảnh Messi nâng cúp World Cup 2022');
  console.log('picture questions: all tests passed');
}
