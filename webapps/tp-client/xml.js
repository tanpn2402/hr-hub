// Pure helpers: msgId, name suggestion, XML pretty-print.
// The formatter is the one of webapps/code-formatter (no XSLTProcessor: Chrome is removing XSLT and injects a warning
// banner into its output). Text outside the elements (log prefixes) is kept on its own lines.
export function getMsgId(xml) {
  const m = /msgId\s*=\s*"([^"]*)"/.exec(xml || '');
  return m ? m[1] : '';
}

export function suggestName(xml) {
  return getMsgId(xml);
}

// Returns the input unchanged when it is not well-formed.
export function formatXml(xml) {
  if (!xml || !xml.trim()) return xml;
  try {
    return prettyXml(xml).replace(/\s+$/, '');
  } catch (e) {
    return xml;
  }
}

class FormatError extends Error {
  constructor(message, line, column) {
    super(message);
    this.name = 'FormatError';
    this.line = line;      // 1-based, or undefined
    this.column = column;  // 1-based, or undefined
  }
}

function position(text, offset) {
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

function prettyXml(src) {
  const unit = '  ';
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

