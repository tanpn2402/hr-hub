#!/usr/bin/env node
// Builds an HR Hub web app folder for packaging: merges + minifies its JS and CSS so the browser loads a couple of
// files instead of a module waterfall (HTTP/1.1 allows only 6 connections per host). Called by package.py.
//
//   node bundle.mjs <app-folder> <out-folder> [--sourcemap]
//
// - <script type="module" src="local.js">: the whole import graph becomes one minified ES module. Imports of
//   /hr-hub/* (SDK, vendor libraries) and http(s) URLs stay external, so every app shares the browser's cached copy.
// - Consecutive local classic scripts (<script src="a.js">) are concatenated in order and minified (globals kept).
// - Consecutive local stylesheets at the folder root are concatenated in order and minified.
// - index.html is rewritten to point at the new files (content-hashed names). Bundled sources and *.test.* files are
//   left out; every other file (images, data, unreferenced scripts...) is copied as is.
// Prints a JSON report on stdout: { outputs, removed, warnings }.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const [, , srcArg, outArg, ...flags] = process.argv;
if (!srcArg || !outArg) {
  console.error('usage: node bundle.mjs <app-folder> <out-folder> [--sourcemap]');
  process.exit(2);
}
const sourcemap = flags.includes('--sourcemap');
const src = resolve(srcArg);
const out = resolve(outArg);

let esbuild;
try {
  esbuild = await import('esbuild');
} catch {
  console.error('esbuild is not installed (run npm install in the HR Hub repository)');
  process.exit(3);
}

const warnings = [];
const removed = new Set(); // source files merged into an output (not shipped)
const outputs = [];

const isLocal = (url) => url && !/^([a-z]+:)?\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('data:');
const clean = (url) => url.split(/[?#]/)[0].replace(/^\.\//, '');
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 8);
const attr = (tag, name) => {
  const match = new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag);
  return match ? match[2] : null;
};
const hasAttr = (tag, name) => new RegExp(`\\s${name}(\\s|=|>|/)`, 'i').test(tag);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const indexPath = join(src, 'index.html');
let html = readFileSync(indexPath, 'utf8');

// ------------------------------------------------------------------ scripts and styles, in document order
const tagPattern = /<script\b[^>]*>\s*<\/script>|<link\b[^>]*>/gi;
const tags = [...html.matchAll(tagPattern)].map((match) => {
  const tag = match[0];
  const isScript = /^<script/i.test(tag);
  const url = isScript ? attr(tag, 'src') : /stylesheet/i.test(attr(tag, 'rel') || '') ? attr(tag, 'href') : null;
  let kind = null;
  if (url && isLocal(url) && existsSync(join(src, clean(url)))) {
    if (!isScript) kind = clean(url).includes('/') ? null : 'css'; // relative url() inside nested CSS would break
    else if ((attr(tag, 'type') || '').toLowerCase() === 'module') kind = 'module';
    else if (!hasAttr(tag, 'async')) kind = hasAttr(tag, 'defer') ? 'defer' : 'classic';
  }
  return { tag, index: match.index, kind, file: url ? clean(url) : null };
});

// Groups of consecutive tags of the same kind: another tag in between (e.g. the SDK) breaks a group, since
// order matters.
tags.forEach((item, i) => (item.next = tags[i + 1]));
const groups = [];
for (const item of tags) {
  const last = groups[groups.length - 1];
  const previous = last && last.items[last.items.length - 1];
  if (item.kind && last && last.kind === item.kind && previous.next === item) last.items.push(item);
  else if (item.kind) groups.push({ kind: item.kind, items: [item] });
}

// Module scripts anywhere in the page are evaluated in document order: one bundle for all of them.
const modules = tags.filter((item) => item.kind === 'module');
const replacements = new Map(); // tag -> replacement ('' removes it)

if (modules.length) {
  const entry = modules.map((item) => `import ${JSON.stringify('./' + item.file)};`).join('\n');
  const result = await esbuild.build({
    stdin: { contents: entry, resolveDir: src, sourcefile: 'index.html (module scripts)', loader: 'js' },
    absWorkingDir: src, // metafile paths are relative to it
    bundle: true,
    format: 'esm',
    minify: true,
    target: 'es2020',
    legalComments: 'none',
    write: false,
    metafile: true,
    sourcemap: sourcemap ? 'external' : false,
    outdir: out,
    external: ['/hr-hub/*', 'http://*', 'https://*'],
    logLevel: 'silent',
  });
  const js = result.outputFiles.find((file) => file.path.endsWith('.js'));
  const map = result.outputFiles.find((file) => file.path.endsWith('.map'));
  const name = `app.${hash(js.text)}.js`;
  writeFileSync(join(out, name), sourcemap ? `${js.text}\n//# sourceMappingURL=${name}.map\n` : js.text);
  if (map) writeFileSync(join(out, `${name}.map`), map.text);
  outputs.push(name);
  for (const input of Object.keys(result.metafile.inputs)) {
    const path = resolve(src, input);
    if (path.startsWith(src + sep)) removed.add(relative(src, path).split(sep).join('/'));
  }
  modules.forEach((item, i) => replacements.set(item.tag, i === 0 ? `<script type="module" src="${name}"></script>` : ''));
  for (const warning of result.warnings) warnings.push(`module bundle: ${warning.text}`);
}

for (const group of groups) {
  if (group.kind === 'module') continue;
  const files = group.items.map((item) => item.file);
  const code = files.map((file) => readFileSync(join(src, file), 'utf8'));
  if (group.kind === 'css') {
    const result = await esbuild.transform(code.join('\n'), { loader: 'css', minify: true, legalComments: 'none' });
    const name = `app.${hash(result.code)}.css`;
    writeFileSync(join(out, name), result.code);
    outputs.push(name);
    group.items.forEach((item, i) => replacements.set(item.tag, i === 0 ? `<link rel="stylesheet" href="${name}" />` : ''));
  } else {
    // Classic scripts share the global scope: concatenating them keeps their meaning; minify leaves top-level names.
    const result = await esbuild.transform(code.join('\n;\n'), { loader: 'js', minify: true, target: 'es2020', legalComments: 'none' });
    const name = `scripts.${hash(result.code)}.js`;
    writeFileSync(join(out, name), result.code);
    outputs.push(name);
    const defer = group.kind === 'defer' ? ' defer' : '';
    group.items.forEach((item, i) => replacements.set(item.tag, i === 0 ? `<script${defer} src="${name}"></script>` : ''));
  }
  files.forEach((file) => removed.add(file));
}

for (const [tag, replacement] of replacements) {
  if (replacement) html = html.replace(tag, replacement);
  else {
    // Merged away: drop the whole line when the tag was alone on it.
    const at = html.indexOf(tag);
    const lineStart = html.lastIndexOf('\n', at) + 1;
    const lineEnd = html.indexOf('\n', at + tag.length);
    const alone = !html.slice(lineStart, at).trim() && !html.slice(at + tag.length, lineEnd === -1 ? undefined : lineEnd).trim();
    html = alone ? html.slice(0, lineStart) + html.slice(lineEnd === -1 ? html.length : lineEnd + 1) : html.replace(tag, '');
  }
}

// ------------------------------------------------------------------ copy everything else
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '__MACOSX' || name === '.DS_Store' || name.startsWith('.git')) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [relative(src, path).split(sep).join('/')];
  });

for (const file of walk(src)) {
  if (file === 'index.html' || removed.has(file) || /\.test\.(m?js|ts)$/.test(file)) continue;
  mkdirSync(dirname(join(out, file)), { recursive: true });
  cpSync(join(src, file), join(out, file));
}
writeFileSync(join(out, 'index.html'), html);

// ------------------------------------------------------------------ patterns a bundle cannot follow
for (const file of removed) {
  if (!/\.(m?js)$/.test(file)) continue;
  const text = readFileSync(join(src, file), 'utf8');
  if (/\bimport\(\s*[^'"`\s)]/.test(text)) warnings.push(`${file}: dynamic import() with a computed path is not bundled`);
  if (/new\s+URL\([^)]*import\.meta\.url/.test(text)) warnings.push(`${file}: new URL(..., import.meta.url) paths change after bundling`);
  if (/new\s+(Shared)?Worker\(/.test(text)) warnings.push(`${file}: workers are not bundled; keep their files outside the bundle`);
}

console.log(JSON.stringify({ outputs, removed: [...removed].sort(), warnings }));
