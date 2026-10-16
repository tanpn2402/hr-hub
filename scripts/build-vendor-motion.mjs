// Bundles Motion's vanilla API (animate, stagger, spring...) into one ES module that HR Hub serves to web apps at
// /hr-hub/vendor/hrhub-motion.module.js (no build step in apps). Re-run after upgrading "motion":
//   node scripts/build-vendor-motion.mjs
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('motion/package.json');

await build({
  stdin: {
    contents: "export { animate, stagger, spring, inView, scroll, delay } from 'motion';",
    resolveDir: process.cwd(),
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2020',
  legalComments: 'none',
  banner: { js: `/* Motion ${version} (MIT) - vanilla API for HR Hub web apps: import { animate } from '/hr-hub/vendor/hrhub-motion.module.js' */` },
  outfile: 'apps/hr-hub-web/public/vendor/hrhub-motion.module.js',
});
console.log(`hrhub-motion.module.js built from motion ${version}`);
