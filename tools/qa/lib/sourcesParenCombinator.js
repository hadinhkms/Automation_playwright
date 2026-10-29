'use strict';

function matchingParen(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      if (nl === -1) return -1;
      i = nl;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function isInsidePromiseCombinator(text, targetIdx) {
  const combRe = /\bPromise\s*\.\s*(?:all|allSettled)\s*\(/g;
  let m;
  while ((m = combRe.exec(text)) !== null) {
    if (m.index >= targetIdx) break;
    const open = text.indexOf('(', m.index);
    if (open === -1 || open >= targetIdx) continue;
    const close = matchingParen(text, open);
    if (close !== -1 && close > targetIdx) return true;
  }
  return false;
}

module.exports = {
  matchingParen,
  isInsidePromiseCombinator,
};

