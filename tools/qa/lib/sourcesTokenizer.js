'use strict';

const { canStartRegex, findMatchingDelimiter } = require('./sourcesDelimiterScanner');

function tokenizeAndSanitize(code) {
  const len = code.length;
  const cleanChars = new Array(len);
  for (let k = 0; k < len; k++) {
    cleanChars[k] = code[k] === '\n' ? '\n' : ' ';
  }

  const stack = [];
  let prevToken = '';
  let i = 0;

  while (i < len) {
    const ch = code[i];
    const next = code[i + 1];

    if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t') {
      i++;
      continue;
    }
    if (ch === '/' && next === '/') {
      const nl = code.indexOf('\n', i + 2);
      if (nl === -1) break;
      i = nl + 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = code.indexOf('*/', i + 2);
      if (close === -1) return { ok: false, reason: 'unclosed-block-comment' };
      i = close + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      cleanChars[i] = '"';
      let j = i + 1;
      let closed = false;
      while (j < len) {
        const c = code[j];
        if (c === '\\') {
          if (j + 1 >= len) return { ok: false, reason: 'unclosed-string-literal' };
          j += 2;
          continue;
        }
        if (c === '\n' || c === '\r') return { ok: false, reason: 'unclosed-string-literal' };
        if (c === quote) {
          cleanChars[j] = '"';
          closed = true;
          i = j + 1;
          prevToken = '"';
          break;
        }
        j++;
      }
      if (!closed) return { ok: false, reason: 'unclosed-string-literal' };
      continue;
    }
    if (ch === '`') {
      cleanChars[i] = '"';
      let j = i + 1;
      let closed = false;
      while (j < len) {
        const c = code[j];
        if (c === '\\') {
          if (j + 1 >= len) return { ok: false, reason: 'unclosed-template-literal' };
          j += 2;
          continue;
        }
        if (c === '$' && code[j + 1] === '{') {
          const exprEnd = findMatchingDelimiter(code, j + 1, '{', '}');
          if (exprEnd === -1) return { ok: false, reason: 'unclosed-template-interpolation' };
          const sub = tokenizeAndSanitize(code.slice(j + 2, exprEnd));
          if (!sub.ok) return sub;
          if (
            /\bexpect\b/.test(sub.cleanText) ||
            /(?:^|[^A-Za-z0-9_$])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/.test(sub.cleanText) ||
            /\]\s*\(/.test(sub.cleanText)
          ) {
            return { ok: false, reason: 'ambiguous-template-interpolation' };
          }
          j = exprEnd + 1;
          continue;
        }
        if (c === '`') {
          cleanChars[j] = '"';
          closed = true;
          i = j + 1;
          prevToken = '"';
          break;
        }
        j++;
      }
      if (!closed) return { ok: false, reason: 'unclosed-template-literal' };
      continue;
    }
    if (ch === '/' && canStartRegex(prevToken)) {
      cleanChars[i] = '"';
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < len) {
        const c = code[j];
        if (c === '\\') {
          if (j + 1 >= len || code[j + 1] === '\n' || code[j + 1] === '\r') {
            return { ok: false, reason: 'unclosed-regex-literal' };
          }
          j += 2;
          continue;
        }
        if (c === '\n' || c === '\r') return { ok: false, reason: 'unclosed-regex-literal' };
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) {
          cleanChars[j] = '"';
          let k = j + 1;
          while (k < len && /[A-Za-z0-9_$]/.test(code[k])) {
            if (!/[dgimsuvy]/.test(code[k])) return { ok: false, reason: 'invalid-regex-flags' };
            k++;
          }
          closed = true;
          i = k;
          prevToken = '"';
          break;
        }
        j++;
      }
      if (!closed) return { ok: false, reason: 'unclosed-regex-literal' };
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') {
      stack.push(ch);
      cleanChars[i] = ch;
      prevToken = ch;
      i++;
      continue;
    }
    if (ch === ')' || ch === '}' || ch === ']') {
      const expected = ch === ')' ? '(' : ch === '}' ? '{' : '[';
      if (stack.length === 0 || stack[stack.length - 1] !== expected) {
        return { ok: false, reason: 'mismatched-delimiter' };
      }
      stack.pop();
      cleanChars[i] = ch;
      prevToken = ch;
      i++;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_$]/.test(code[j])) j++;
      for (let k = i; k < j; k++) cleanChars[k] = code[k];
      prevToken = code.slice(i, j);
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[0-9A-Za-z_.]/.test(code[j])) j++;
      for (let k = i; k < j; k++) cleanChars[k] = code[k];
      prevToken = '0';
      i = j;
      continue;
    }
    cleanChars[i] = ch;
    prevToken = ch;
    i++;
  }

  if (stack.length > 0) return { ok: false, reason: 'unclosed-delimiter' };
  return { ok: true, cleanText: cleanChars.join('') };
}

module.exports = { tokenizeAndSanitize };

