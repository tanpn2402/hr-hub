// Fun effects shared by the quiz apps (the same file ships in quizzy and quizzy-admin).
// Motion (vanilla API) is served by HR Hub; everything else is plain canvas/DOM.
import { animate, spring, stagger } from '/hr-hub/vendor/hrhub-motion.module.js';

export { animate, spring, stagger };

const COLORS = ['#e11d48', '#2563eb', '#d97706', '#16a34a', '#facc15', '#a855f7', '#ffffff'];
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Full-screen confetti burst from the bottom corners (or from x, y in 0..1 of the viewport). */
export function confetti({ count = 160, duration = 2600, origin } = {}) {
  if (reduced()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-layer';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();

  const sources = origin ? [origin] : [{ x: 0.05, y: 1, dir: 1 }, { x: 0.95, y: 1, dir: -1 }];
  const pieces = Array.from({ length: count }, (_, i) => {
    const source = sources[i % sources.length];
    const dir = source.dir ?? (Math.random() < 0.5 ? -1 : 1);
    const angle = origin ? Math.random() * Math.PI * 2 : (Math.PI / 2) * (0.55 + Math.random() * 0.35);
    const speed = (origin ? 6 + Math.random() * 8 : 14 + Math.random() * 10) * dpr;
    return {
      x: source.x * canvas.width,
      y: source.y * canvas.height,
      vx: origin ? Math.cos(angle) * speed : dir * Math.cos(angle) * speed,
      vy: origin ? Math.sin(angle) * speed - 4 * dpr : -Math.sin(angle) * speed,
      size: (6 + Math.random() * 6) * dpr,
      color: COLORS[i % COLORS.length],
      spin: Math.random() * Math.PI,
      spinSpeed: (Math.random() - 0.5) * 0.4,
      shape: i % 3,
    };
  });

  const start = performance.now();
  const frame = (now) => {
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - duration * 0.7) / (duration * 0.3));
    for (const p of pieces) {
      p.vy += 0.35 * dpr;
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.spinSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else if (p.shape === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -p.size / 2);
        ctx.lineTo(p.size / 2, p.size / 2);
        ctx.lineTo(-p.size / 2, p.size / 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/** Emoji falling from the top (wrong answer, time out...). */
export function emojiRain(emojis, { count = 24, duration = 2200 } = {}) {
  if (reduced()) return;
  const layer = document.createElement('div');
  layer.className = 'fx-layer fx-rain';
  document.body.appendChild(layer);
  for (let i = 0; i < count; i++) {
    const drop = document.createElement('span');
    drop.textContent = emojis[i % emojis.length];
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.fontSize = `${1.5 + Math.random() * 1.5}rem`;
    layer.appendChild(drop);
    animate(
      drop,
      { y: ['-10vh', '110vh'], rotate: [0, (Math.random() - 0.5) * 360], opacity: [1, 1, 0] },
      { duration: (duration / 1000) * (0.6 + Math.random() * 0.5), delay: Math.random() * 0.6, ease: 'easeIn' },
    );
  }
  setTimeout(() => layer.remove(), duration + 800);
}

/** Wobble an element left/right (wrong answer). */
export function shake(element) {
  if (!element || reduced()) return;
  animate(element, { x: [0, -16, 14, -10, 8, -4, 0] }, { duration: 0.55, ease: 'easeOut' });
}

/** Pop an element in (scale + fade) with a bouncy spring. */
export function pop(element, { delay = 0, from = 0.3 } = {}) {
  if (!element || reduced()) return;
  animate(element, { scale: [from, 1], opacity: [0, 1] }, { type: spring, bounce: 0.55, duration: 0.6, delay });
}

/** Stagger children in from below (lists, podiums). */
export function riseIn(elements, { delay = 0, step = 0.08 } = {}) {
  if (!elements || !elements.length || reduced()) return;
  animate(elements, { y: [40, 0], opacity: [0, 1] }, { type: spring, bounce: 0.4, duration: 0.7, delay: stagger(step, { startDelay: delay }) });
}

/** Counts a number up inside an element (score reveals). */
export function countUp(element, to, { from = 0, duration = 1.2 } = {}) {
  if (!element) return;
  const format = (value) => Math.round(value).toLocaleString('vi-VN');
  if (reduced()) {
    element.textContent = format(to);
    return;
  }
  animate(from, to, { duration, ease: 'easeOut', onUpdate: (value) => (element.textContent = format(value)) });
}
