'use strict';

/**
 * tools/qa/lib/sourcesMissingAwait.js
 * Phát hiện lời gọi matcher bất đồng bộ của Playwright thiếu `await`/`return`/`yield`.
 */

const ASYNC_MATCHERS = new Set([
  'toBeVisible', 'toBeHidden', 'toHaveText', 'toContainText', 'toBeEnabled',
  'toBeDisabled', 'toHaveValue', 'toHaveValues', 'toBeChecked', 'toHaveCount',
  'toHaveAttribute', 'toHaveURL', 'toHaveTitle', 'toBeAttached', 'toBeInViewport',
  'toBeFocused', 'toBeEmpty', 'toBeEditable', 'toHaveClass', 'toHaveId',
  'toHaveCSS', 'toHaveJSProperty', 'toHaveScreenshot', 'toHaveAccessibleName',
  'toHaveAccessibleDescription', 'toHaveRole', 'toPass',
]);

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

function findMissingAwaits(bodyLines, firstLineNo, asyncMatchers = ASYNC_MATCHERS) {
  const text = bodyLines.join('\n');
  const out = [];
  const re = /\bexpect(?:\.soft)?\s*\(/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const open = text.indexOf('(', m.index);
    const close = matchingParen(text, open);
    if (close === -1) continue;
    const after = text.slice(close + 1);
    const tail = after.match(/^(?:\s*\.\s*(?:not|resolves|rejects))*\s*\.\s*([A-Za-z][A-Za-z0-9]*)\s*\(/);
    if (!tail || !asyncMatchers.has(tail[1])) continue;
    if (/\b(?:await|return|yield)\s*$/.test(text.slice(0, m.index))) continue;
    const lineOffset = text.slice(0, m.index).split('\n').length - 1;
    out.push({
      line: firstLineNo + lineOffset,
      column: m.index - (text.lastIndexOf('\n', m.index - 1) + 1),
      matcher: tail[1],
      text: (bodyLines[lineOffset] || '').trim(),
    });
  }
  return out;
}

module.exports = { ASYNC_MATCHERS, findMissingAwaits };

