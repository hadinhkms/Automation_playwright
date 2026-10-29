'use strict';

const { matchingParen, isInsidePromiseCombinator } = require('./sourcesParenCombinator');

const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'case', 'throw', 'typeof', 'void', 'delete', 'in',
  'instanceof', 'of', 'await', 'yield', 'new', 'else', 'do',
]);

const REGEX_PRECEDING_PUNCT = new Set([
  '(', '[', '{', ',', ';', ':', '?', '=', '!', '&', '|', '^', '~',
  '+', '-', '*', '%', '/', '<', '>',
]);

function canStartRegex(prevToken) {
  return prevToken === '' || REGEX_PRECEDING_PUNCT.has(prevToken) || REGEX_PRECEDING_KEYWORDS.has(prevToken);
}

function findMatchingDelimiter(code, openIdx, openChar = '(', closeChar = ')') {
  const len = code.length;
  if (code[openIdx] !== openChar) return -1;
  const stack = [openChar];
  let prevToken = openChar;
  let i = openIdx + 1;

  while (i < len) {
    const ch = code[i];
    const next = code[i + 1];

    if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '/' && next === '/') {
      const nl = code.indexOf('\n', i + 2);
      if (nl === -1) return -1;
      i = nl + 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = code.indexOf('*/', i + 2);
      if (close === -1) return -1;
      i = close + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      let closed = false;
      while (j < len) {
        if (code[j] === '\\') {
          if (j + 1 >= len) return -1;
          j += 2;
          continue;
        }
        if (code[j] === '\n' || code[j] === '\r') return -1;
        if (code[j] === quote) { closed = true; i = j + 1; prevToken = '"'; break; }
        j++;
      }
      if (!closed) return -1;
      continue;
    }
    if (ch === '`') {
      let j = i + 1;
      let closed = false;
      while (j < len) {
        if (code[j] === '\\') {
          if (j + 1 >= len) return -1;
          j += 2;
          continue;
        }
        if (code[j] === '$' && code[j + 1] === '{') {
          const exprEnd = findMatchingDelimiter(code, j + 1, '{', '}');
          if (exprEnd === -1) return -1;
          j = exprEnd + 1;
          continue;
        }
        if (code[j] === '`') { closed = true; i = j + 1; prevToken = '"'; break; }
        j++;
      }
      if (!closed) return -1;
      continue;
    }
    if (ch === '/' && canStartRegex(prevToken)) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < len) {
        if (code[j] === '\\') {
          if (j + 1 >= len || code[j + 1] === '\n' || code[j + 1] === '\r') return -1;
          j += 2;
          continue;
        }
        if (code[j] === '\n' || code[j] === '\r') return -1;
        if (code[j] === '[') inClass = true;
        else if (code[j] === ']') inClass = false;
        else if (code[j] === '/' && !inClass) {
          let k = j + 1;
          while (k < len && /[A-Za-z0-9_$]/.test(code[k])) k++;
          closed = true;
          i = k;
          prevToken = '"';
          break;
        }
        j++;
      }
      if (!closed) return -1;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') { stack.push(ch); prevToken = ch; i++; continue; }
    if (ch === ')' || ch === '}' || ch === ']') {
      const expected = ch === ')' ? '(' : ch === '}' ? '{' : '[';
      if (stack.length === 0 || stack[stack.length - 1] !== expected) return -1;
      stack.pop();
      prevToken = ch;
      if (stack.length === 0) return i;
      i++;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_$]/.test(code[j])) j++;
      prevToken = code.slice(i, j);
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[0-9A-Za-z_.]/.test(code[j])) j++;
      prevToken = '0';
      i = j;
      continue;
    }
    prevToken = ch;
    i++;
  }
  return -1;
}

module.exports = {
  canStartRegex,
  findMatchingDelimiter,
  matchingParen,
  isInsidePromiseCombinator,
};
