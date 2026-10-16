// Pure formatters: no DOM, no Preact, no SDK (testable with Node).
// Each formatter takes (source, opts) and returns the formatted text, or throws a FormatError.
//   opts: { indentUnit: number, useTabs: boolean, sqlDialect: string, sqlKeywordCase: string, sqlFormatter?: object }

export class FormatError extends Error {
  constructor(message, line, column) {
    super(message);
    this.name = 'FormatError';
    this.line = line;      // 1-based, or undefined
    this.column = column;  // 1-based, or undefined
  }
}

export const LANGUAGES = [
  { id: 'xml', label: 'XML', mode: 'application/xml', ext: 'xml' },
  { id: 'json', label: 'JSON', mode: 'application/json', ext: 'json' },
  { id: 'sql', label: 'SQL', mode: 'text/x-sql', ext: 'sql' },
  { id: 'java', label: 'Java', mode: 'text/x-java', ext: 'java' },
];

export const languageById = (id) => LANGUAGES.find((l) => l.id === id) || LANGUAGES[0];

const indentString = (opts) => (opts.useTabs ? '\t' : ' '.repeat(Math.max(1, Number(opts.indentUnit) || 2)));

// 1-based line/column of a character offset
export function position(text, offset) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') { line++; col = 1; } else col++;
  }
  return { line, column: col };
}

function fail(text, offset, message) {
  const p = position(text, offset);
  throw new FormatError(message, p.line, p.column);
}

export function format(language, source, opts) {
  const o = opts || {};
  if (!source.trim()) return '';
  const formatter = { xml: formatXml, json: formatJson, sql: formatSql, java: formatJava }[language];
  if (!formatter) throw new FormatError('Unsupported language: ' + language);
  return formatter(source, o).replace(/\s+$/, '');
}

// ---------------------------------------------------------------- XML

function xmlTokens(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;
  const until = (end, start, what) => {
    const j = src.indexOf(end, start);
    if (j < 0) fail(src, start, 'Unterminated ' + what);
    return j + end.length;
  };
  while (i < n) {
    if (src[i] !== '<') {
      const j = src.indexOf('<', i);
      const end = j < 0 ? n : j;
      tokens.push({ type: 'text', value: src.slice(i, end), pos: i });
      i = end;
      continue;
    }
    if (src.startsWith('<!--', i)) {
      const end = until('-->', i + 4, 'comment');
      tokens.push({ type: 'comment', value: src.slice(i, end), pos: i });
      i = end;
    } else if (src.startsWith('<![CDATA[', i)) {
      const end = until(']]>', i + 9, 'CDATA section');
      tokens.push({ type: 'cdata', value: src.slice(i, end), pos: i });
      i = end;
    } else if (src.startsWith('<?', i)) {
      const end = until('?>', i + 2, 'processing instruction');
      tokens.push({ type: 'pi', value: src.slice(i, end), pos: i });
      i = end;
    } else if (src.startsWith('<!', i)) {
      // <!DOCTYPE ...> possibly with an internal subset [ ... ]
      let j = i + 2;
      let bracket = 0;
      let quote = '';
      for (; j < n; j++) {
        const c = src[j];
        if (quote) { if (c === quote) quote = ''; continue; }
        if (c === '"' || c === "'") quote = c;
        else if (c === '[') bracket++;
        else if (c === ']') bracket--;
        else if (c === '>' && bracket <= 0) break;
      }
      if (j >= n) fail(src, i, 'Unterminated declaration');
      tokens.push({ type: 'decl', value: src.slice(i, j + 1), pos: i });
      i = j + 1;
    } else {
      let j = i + 1;
      let quote = '';
      for (; j < n; j++) {
        const c = src[j];
        if (quote) { if (c === quote) quote = ''; continue; }
        if (c === '"' || c === "'") quote = c;
        else if (c === '<') fail(src, j, 'Unexpected "<" inside a tag');
        else if (c === '>') break;
      }
      if (j >= n) fail(src, i, quote ? 'Unterminated attribute value' : 'Unterminated tag');
      const raw = src.slice(i, j + 1);
      const close = /^<\//.test(raw);
      const self = /\/>$/.test(raw);
      const m = /^<\/?\s*([^\s/>]+)/.exec(raw);
      if (!m) fail(src, i, 'Invalid tag');
      tokens.push({ type: close ? 'close' : self ? 'self' : 'open', name: m[1], value: normalizeTag(raw), pos: i });
      i = j + 1;
    }
  }
  return tokens;
}

// collapse whitespace between attributes (never inside quoted values)
function normalizeTag(raw) {
  let out = '';
  let quote = '';
  let space = false;
  for (const c of raw) {
    if (quote) { out += c; if (c === quote) quote = ''; continue; }
    if (/\s/.test(c)) { space = true; continue; }
    if (space) {
      if (c !== '>' && c !== '/' && c !== '=' && !out.endsWith('=')) out += ' ';
      else if (c === '/' ) out += ' ';
      space = false;
    }
    if (c === '"' || c === "'") quote = c;
    out += c;
  }
  return out.replace(/<\/\s+/, '</').replace(/\s+>$/, '>');
}

export function formatXml(src, opts) {
  const unit = indentString(opts);
  const tokens = xmlTokens(src);
  const lines = [];
  const stack = [];
  const pad = () => unit.repeat(stack.length);
  const pushBlock = (text) => {
    // multi-line text/comment: keep the relative layout, re-indent each line
    const parts = text.split(/\r?\n/);
    const rest = parts.slice(1);
    const minIndent = rest.filter((l) => l.trim()).reduce((m, l) => Math.min(m, /^\s*/.exec(l)[0].length), Infinity);
    lines.push(pad() + parts[0].trim());
    rest.forEach((l) => lines.push(l.trim() ? pad() + l.slice(minIndent === Infinity ? 0 : minIndent).trimEnd() : ''));
  };

  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.type === 'text') {
      if (!t.value.trim()) continue;
      // text outside any element (e.g. a log prefix "[NET BLMS-1,10-14 16:44:31.509]:") is kept as-is on its own lines
      if (!stack.length) t.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((l) => lines.push(l));
      else pushBlock(t.value.trim());
    } else if (t.type === 'open') {
      // <a>text</a> and <a></a> stay on one line
      const next = tokens[k + 1];
      const after = tokens[k + 2];
      if (next && next.type === 'close' && next.name === t.name) {
        lines.push(pad() + t.value + next.value);
        k += 1;
        continue;
      }
      if (next && (next.type === 'text' || next.type === 'cdata') && after && after.type === 'close' && after.name === t.name
          && !/\n/.test(next.value.trim())) {
        lines.push(pad() + t.value + (next.type === 'text' ? next.value.trim() : next.value) + after.value);
        k += 2;
        continue;
      }
      lines.push(pad() + t.value);
      stack.push(t);
    } else if (t.type === 'close') {
      const open = stack.pop();
      if (!open) fail(src, t.pos, 'Unexpected closing tag </' + t.name + '>');
      if (open.name !== t.name) fail(src, t.pos, 'Expected </' + open.name + '> but found </' + t.name + '>');
      lines.push(pad() + t.value);
    } else if (t.type === 'comment' || t.type === 'cdata') {
      pushBlock(t.value);
    } else {
      lines.push(pad() + t.value);
    }
  }
  if (stack.length) {
    const open = stack[stack.length - 1];
    fail(src, open.pos, 'Unclosed tag <' + open.name + '>');
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------- JSON

// Validate with JSON.parse (good error messages), then re-indent the tokens so number literals keep their exact text
// (JSON.parse would round 12345678901234567890 and drop 1.0 -> 1).
export function formatJson(src, opts) {
  const text = src.replace(/^﻿/, '');
  try {
    JSON.parse(text);
  } catch (e) {
    const m = /position (\d+)/.exec(e.message);
    const lc = /line (\d+) column (\d+)/.exec(e.message);
    const msg = String(e.message).replace(/^JSON\.parse: /, '');
    if (lc) throw new FormatError(msg, Number(lc[1]), Number(lc[2]));
    if (m) fail(text, Number(m[1]), msg);
    throw new FormatError(msg);
  }
  const unit = indentString(opts);
  const re = /\s+|"(?:[^"\\]|\\.)*"|[{}[\]:,]|[^\s{}[\]:,"]+/gy;
  const tokens = [];
  let m;
  while ((m = re.exec(text))) if (!/^\s/.test(m[0])) tokens.push(m[0]);

  let out = '';
  let depth = 0;
  const nl = () => '\n' + unit.repeat(depth);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '{' || t === '[') {
      const closer = t === '{' ? '}' : ']';
      if (tokens[i + 1] === closer) { out += t + closer; i++; continue; }
      depth++;
      out += t + nl();
    } else if (t === '}' || t === ']') {
      depth--;
      out += nl() + t;
    } else if (t === ',') {
      out += ',' + nl();
    } else if (t === ':') {
      out += ': ';
    } else {
      out += t;
    }
  }
  return out + '\n';
}

// ---------------------------------------------------------------- SQL (sql-formatter, vendored)

export function formatSql(src, opts) {
  const lib = opts.sqlFormatter || (typeof globalThis !== 'undefined' ? globalThis.sqlFormatter : null);
  if (!lib) throw new FormatError('SQL formatter library is not loaded');
  try {
    return lib.format(src, {
      language: opts.sqlDialect || 'sql',
      tabWidth: Math.max(1, Number(opts.indentUnit) || 2),
      useTabs: !!opts.useTabs,
      keywordCase: opts.sqlKeywordCase || 'preserve',
    }).trimEnd() + '\n';
  } catch (e) {
    const lc = /line (\d+) column (\d+)/i.exec(e.message);
    throw new FormatError(String(e.message).split('\n')[0], lc ? Number(lc[1]) : undefined, lc ? Number(lc[2]) : undefined);
  }
}

// ---------------------------------------------------------------- Java

const JAVA_OPERATORS = [
  '>>>=', '<<=', '>>=', '>>>', '...', '>>', '->', '::', '++', '--', '&&', '||', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=',
  '%=', '&=', '|=', '^=', '<<',
];
const CONTROL = new Set(['if', 'for', 'while', 'switch', 'catch', 'synchronized', 'try', 'do', 'else', 'return', 'throw',
  'assert', 'yield', 'case', 'new', 'finally']);
const MODIFIERS = new Set(['public', 'private', 'protected', 'static', 'final', 'abstract', 'native', 'synchronized',
  'transient', 'volatile', 'strictfp', 'default', 'sealed']);
const UNARY_BEFORE = new Set(['return', 'case', 'throw', 'yield', 'assert', '(', '[', ',', '{', ';', '?', ':', '->']);

function javaTokens(src) {
  const tokens = [];
  const n = src.length;
  let i = 0;
  let ws = '';
  const push = (type, value, pos) => {
    tokens.push({ type, value, pos, nlBefore: (ws.match(/\n/g) || []).length, spaceBefore: ws.length > 0 });
    ws = '';
  };
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { ws += c; i++; continue; }
    const start = i;
    if (src.startsWith('//', i)) {
      let j = src.indexOf('\n', i);
      if (j < 0) j = n;
      push('lcomment', src.slice(i, j).trimEnd(), start);
      i = j;
    } else if (src.startsWith('/*', i)) {
      const j = src.indexOf('*/', i + 2);
      if (j < 0) fail(src, i, 'Unterminated comment');
      push('bcomment', src.slice(i, j + 2), start);
      i = j + 2;
    } else if (src.startsWith('"""', i)) {
      let j = i + 3;
      while (j < n && !src.startsWith('"""', j)) j += src[j] === '\\' ? 2 : 1;
      if (j >= n) fail(src, i, 'Unterminated text block');
      push('string', src.slice(i, j + 3), start);
      i = j + 3;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '\n') fail(src, i, 'Unterminated string literal');
        j += src[j] === '\\' ? 2 : 1;
      }
      if (j >= n) fail(src, i, 'Unterminated string literal');
      push('string', src.slice(i, j + 1), start);
      i = j + 1;
    } else if (c === '@' && /[A-Za-z_$]/.test(src[i + 1] || '')) {
      const m = /^@[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*/.exec(src.slice(i));
      const v = m[0].replace(/\s+/g, '');
      push(v === '@interface' ? 'word' : 'annotation', v, start);
      i += m[0].length;
    } else if (/[A-Za-z_$]/.test(c)) {
      const m = /^[\w$]+/.exec(src.slice(i));
      push('word', m[0], start);
      i += m[0].length;
    } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^(?:0[xX][\da-fA-F_]+[lL]?|0[bB][01_]+[lL]?|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?[fFdDlL]?)/.exec(src.slice(i));
      push('number', m[0], start);
      i += m[0].length;
    } else {
      const op = JAVA_OPERATORS.find((o) => src.startsWith(o, i));
      const v = op || c;
      push('punct', v, start);
      i += v.length;
    }
  }
  return tokens;
}

// Mark '<' ... '>' pairs that are type arguments/parameters (List<String>, Map<K, List<V>>, <T> void m(), new X<>()).
function markGenerics(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.value !== '<' || t.generic) continue;
    const prev = tokens[i - 1];
    if (prev && !(prev.type === 'word' || prev.value === '.' || prev.value === ',' || prev.type === 'annotation')) continue;
    let depth = 0;
    const range = [];
    let ok = false;
    for (let j = i; j < tokens.length; j++) {
      const v = tokens[j].value;
      const ty = tokens[j].type;
      if (v === '<') depth++;
      else if (v === '>') depth--;
      else if (v === '>>') depth -= 2;
      else if (v === '>>>') depth -= 3;
      else if (!(ty === 'word' || ty === 'annotation' || v === '?' || v === ',' || v === '.' || v === '[' || v === ']' || v === '&')) break;
      if (ty === 'word' && /^(?:instanceof|new|return)$/.test(v)) break;
      range.push(j);
      if (depth <= 0) { ok = depth === 0; break; }
    }
    if (ok) range.forEach((j) => { if (/^[<>]+$/.test(tokens[j].value) || tokens[j].value === '?' || tokens[j].value === '&') tokens[j].generic = true; });
  }
}

export function formatJava(src, opts) {
  const unit = indentString(opts);
  const tokens = javaTokens(src.replace(/\r\n?/g, '\n'));
  markGenerics(tokens);

  const out = [];                 // finished lines
  let cur = '';                   // line being built
  let curIndent = 0;
  // one frame per open brace: 'block' (class/method/statement bodies) or 'init' (array initializers).
  // indent = indent of the frame's contents; open = indent of the line holding '{' (where '}' goes back to).
  const frames = [{ type: 'block', paren: 0, indent: 0, open: 0, isSwitch: false, inCase: false }];
  let pendingSwitch = false;      // saw `switch`, waiting for its body
  let lineIsCaseLabel = false;
  let ternary = 0;
  let prev = null;                // previous code token (comments excluded)
  let annotationLine = false;     // the current line holds only annotations so far
  let annotationParens = 0;       // open parentheses of an annotation's arguments

  const top = () => frames[frames.length - 1];
  const contentIndent = () => top().indent + (top().isSwitch && top().inCase ? 1 : 0);
  const flush = () => {
    if (cur.trim()) out.push(unit.repeat(curIndent) + cur.trimEnd());
    cur = '';
  };
  const blankLine = () => { if (out.length && out[out.length - 1] !== '') out.push(''); };
  const startLine = (indent) => { flush(); curIndent = indent; lineIsCaseLabel = false; ternary = 0; annotationLine = false; annotationParens = 0; };
  // end the line after token i, unless a // comment follows on the same source line
  const breakAfter = (i) => {
    const next = tokens[i + 1];
    if (next && next.type === 'lcomment' && next.nlBefore === 0) return;
    startLine(contentIndent());
  };
  const glued = (next) => next && (/^[),;.\]]$/.test(next.value) || (next.type === 'word' && /^(?:else|catch|finally|while)$/.test(next.value)));

  const isUnaryContext = (p) => !p || UNARY_BEFORE.has(p.value)
    || (p.type === 'punct' && !/^[)\]}]$/.test(p.value) && !p.generic && p.value !== '++' && p.value !== '--');

  // spacing between the previous code token p and t
  function spaceBetween(p, t) {
    if (!p || !cur.trim()) return '';
    const v = t.value;
    const pv = p.value;
    if (v === ',' || v === ';' || v === '.' || v === '::' || pv === '.' || pv === '::') return '';
    if (v === ')' || v === ']') return '';
    if (pv === '(' || pv === '[') return '';
    if (p.unary) return '';
    if (v === '...') return '';
    if (v === ':' && t.caseColon) return '';
    if (t.generic && v === '<') return p.type === 'word' && MODIFIERS.has(pv) ? ' ' : '';
    if (t.generic && /^>+$/.test(v)) return '';
    if (p.generic && pv === '<') return '';
    if (p.generic && /^>+$/.test(pv)) return v === '(' || v === '[' || v === '::' ? '' : ' ';
    if (t.postfix) return '';
    if (v === '(') {
      if (p.type === 'word') return CONTROL.has(pv) && pv !== 'new' ? ' ' : '';
      if (p.type === 'annotation') return '';
      if (pv === ')' || pv === ']') return '';
      return ' ';
    }
    if (v === '[') return p.type === 'word' || pv === ']' || pv === ')' || p.type === 'string' ? '' : ' ';
    if (v === '{') return p.init || pv === '{' ? '' : ' ';
    if (v === '}' && p.emptyBlock) return '';
    if (v === '}' && t.init) return '';
    if (pv === '{' && p.init) return '';
    return ' ';
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const v = t.value;
    const f = top();

    // ---- comments
    if (t.type === 'lcomment' || t.type === 'bcomment') {
      const ownLine = t.nlBefore > 0 || !cur.trim();
      if (ownLine) {
        const indent = cur.trim() && f.type === 'block' && f.paren > 0 ? curIndent : contentIndent();
        startLine(indent);
        if (t.nlBefore > 1) blankLine();
      } else cur += ' ';
      if (t.type === 'lcomment') {
        cur += v;
        startLine(contentIndent());
      } else {
        const parts = v.split('\n');
        cur += parts[0];
        for (let k = 1; k < parts.length; k++) {
          const line = parts[k].trim();
          out.push(unit.repeat(curIndent) + cur.trimEnd());
          cur = /^\*/.test(line) ? ' ' + line : line;
        }
        const next = tokens[i + 1];
        if (ownLine && (!next || next.nlBefore > 0)) startLine(contentIndent());
        else cur += ' ';
      }
      continue;
    }

    // ---- classify the token in context
    if (v === '++' || v === '--') {
      if (prev && (prev.type === 'word' || prev.value === ')' || prev.value === ']') && !(prev.type === 'word' && CONTROL.has(prev.value))) t.postfix = true;
      else t.unary = true;
    } else if ((v === '-' || v === '+') && isUnaryContext(prev)) t.unary = true;
    else if (v === '!' || v === '~') t.unary = true;

    if (v === '{') {
      t.init = f.type === 'init' || !!(prev && (prev.value === '=' || prev.value === ']' || prev.value === '(' || prev.value === ','));
    }
    if (v === '}' && f.type === 'init') t.init = true;

    // ---- line breaks before the token
    if (v === '}' && !t.init && !(prev && prev.emptyBlock)) {
      if (cur.trim()) startLine(f.open);
      curIndent = f.open;
    } else if (t.nlBefore > 0 && cur.trim()) {
      // keep the author's break inside a statement (method chains, long argument lists)
      const contin = annotationLine || f.type === 'init' ? 0 : 2;
      startLine(contentIndent() + contin);
    } else if (!cur.trim()) {
      if (t.nlBefore > 1) blankLine();
      curIndent = contentIndent();
    }

    if (!cur.trim() && f.isSwitch && (v === 'case' || v === 'default')) {
      f.inCase = false;
      curIndent = contentIndent();
      lineIsCaseLabel = true;
    }
    if (v === ':' && f.isSwitch && lineIsCaseLabel && f.paren === 0 && ternary === 0) t.caseColon = true;

    // ---- emit
    if (!cur.trim()) annotationLine = t.type === 'annotation';
    else if (annotationLine && t.type !== 'annotation' && !(prev && prev.type === 'annotation' && v === '(') && annotationParens === 0) {
      annotationLine = false;
    }
    cur += spaceBetween(prev, t) + v;

    // ---- state + line breaks after the token
    if (v === '(' || v === '[') f.paren++;
    else if (v === ')' || v === ']') f.paren = Math.max(0, f.paren - 1);
    if (annotationLine && v === '(' && (annotationParens > 0 || (prev && prev.type === 'annotation'))) annotationParens++;
    else if (annotationParens > 0 && v === ')' && --annotationParens === 0) t.annotationEnd = true;
    if (t.type === 'word' && v === 'switch') pendingSwitch = true;
    if (v === '?' && !t.generic) ternary++;

    if (v === '{') {
      const next = tokens[i + 1];
      if (t.init) {
        frames.push({ type: 'init', paren: 0, indent: curIndent + 1, open: curIndent, isSwitch: false, inCase: false });
      } else {
        frames.push({ type: 'block', paren: 0, indent: curIndent + 1, open: curIndent, isSwitch: pendingSwitch, inCase: false });
        pendingSwitch = false;
        if (next && next.value === '}') t.emptyBlock = true;
        else breakAfter(i);
      }
    } else if (v === '}') {
      if (frames.length > 1) frames.pop();
      if (!t.init && !glued(tokens[i + 1])) breakAfter(i);
    } else if (v === ';' && f.type === 'block' && f.paren === 0) {
      breakAfter(i);
    } else if (t.caseColon) {
      f.inCase = true;
      if (!(tokens[i + 1] && tokens[i + 1].value === '{')) breakAfter(i);
    } else if (v === ':' && !t.generic && ternary > 0) {
      ternary--;
    } else if (annotationLine && (t.type === 'annotation' || t.annotationEnd)) {
      const next = tokens[i + 1];
      // keep annotations on their own line when the author did
      if (next && next.nlBefore > 0 && next.type !== 'annotation' && next.value !== '(') breakAfter(i);
    }

    prev = t;
  }
  flush();
  if (frames.length > 1) {
    throw new FormatError('Unbalanced braces: ' + (frames.length - 1) + ' "{" not closed');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
