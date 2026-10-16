// Bundles a tiny QR code API into one ES module that HR Hub serves to web apps at
// /hr-hub/vendor/hrhub-qr.module.js (no build step in apps). Re-run after upgrading "qrcode":
//   node scripts/build-vendor-qr.mjs
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('qrcode/package.json');

// SVG only (no canvas, no DOM): usable as <img src="data:image/svg+xml,..."> without innerHTML.
const entry = `
import { create } from 'qrcode/lib/core/qrcode.js';

/** The QR matrix: { size, dark(x, y) }. ecl: 'L' | 'M' | 'Q' | 'H' (error correction). */
export function qrMatrix(text, { ecl = 'M' } = {}) {
  const { modules } = create(String(text), { errorCorrectionLevel: ecl });
  return { size: modules.size, dark: (x, y) => !!modules.get(y, x) };
}

/** An SVG document of the QR code (quiet zone included). */
export function qrSvg(text, { ecl = 'M', margin = 2, dark = '#000', light = '#fff' } = {}) {
  const { size, dark: isDark } = qrMatrix(text, { ecl });
  const total = size + margin * 2;
  let path = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (isDark(x, y)) path += 'M' + (x + margin) + ' ' + (y + margin) + 'h1v1h-1z';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges">' +
    '<rect width="100%" height="100%" fill="' + light + '"/><path fill="' + dark + '" d="' + path + '"/></svg>';
}

/** The same SVG as a data URL, ready for <img src>. */
export function qrDataUrl(text, options) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qrSvg(text, options));
}
`;

await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: 'js' },
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2020',
  legalComments: 'none',
  platform: 'browser',
  banner: { js: `/* qrcode ${version} (MIT) - QR codes for HR Hub web apps: import { qrDataUrl } from '/hr-hub/vendor/hrhub-qr.module.js' */` },
  outfile: 'apps/hr-hub-web/public/vendor/hrhub-qr.module.js',
});
console.log(`hrhub-qr.module.js built from qrcode ${version}`);
