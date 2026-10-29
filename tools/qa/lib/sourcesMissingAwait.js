'use strict';

const {
  ASYNC_MATCHERS,
  extractVerifiedHelperImports,
  blankOutImports,
} = require('./sourcesAssertionConstants');
const { matchingParen, isInsidePromiseCombinator } = require('./sourcesDelimiterScanner');
const { tokenizeAndSanitize } = require('./sourcesTokenizer');

function findMissingAwaits(bodyLines, firstLineNo, asyncMatchers = ASYNC_MATCHERS, verifiedHelpers = null) {
  const linesArr = Array.isArray(bodyLines) ? bodyLines : String(bodyLines || '').split('\n');
  const text = linesArr.join('\n');
  const effectiveMatchers = asyncMatchers instanceof Set ? asyncMatchers : ASYNC_MATCHERS;
  const effectiveHelpers = extractVerifiedHelperImports(text);
  if (asyncMatchers instanceof Map) {
    for (const [k, v] of asyncMatchers) effectiveHelpers.set(k, v);
  }
  if (verifiedHelpers instanceof Map) {
    for (const [k, v] of verifiedHelpers) effectiveHelpers.set(k, v);
  }

  const out = [];
  const re = /\bexpect(?:\.soft)?\s*\(/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const open = text.indexOf('(', m.index);
    const close = matchingParen(text, open);
    if (close === -1) continue;
    const after = text.slice(close + 1);
    const tail = after.match(/^(?:\s*\.\s*(?:not|resolves|rejects))*\s*\.\s*([A-Za-z][A-Za-z0-9]*)\s*\(/);
    if (!tail || !effectiveMatchers.has(tail[1])) continue;
    if (/(?:\b(?:await|return|yield)|=>)\s*$/.test(text.slice(0, m.index))) continue;
    const lineOffset = text.slice(0, m.index).split('\n').length - 1;
    out.push({
      line: firstLineNo + lineOffset,
      column: m.index - (text.lastIndexOf('\n', m.index - 1) + 1),
      matcher: tail[1],
      text: (linesArr[lineOffset] || '').trim(),
    });
  }

  if (effectiveHelpers.size > 0) {
    const noImportsText = blankOutImports(text);
    const sanitized = tokenizeAndSanitize(noImportsText);
    const scanText = sanitized.ok ? sanitized.cleanText : noImportsText;
    const helperRe = /(\.\s*)?\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    let hm;
    while ((hm = helperRe.exec(scanText)) !== null) {
      const isMethod = Boolean(hm[1]);
      const localName = hm[2];
      if (isMethod || !effectiveHelpers.has(localName)) continue;
      const prefix = scanText.slice(0, hm.index);
      if (/\b(?:function|new)\s+$/.test(prefix)) continue;
      if (/(?:\b(?:await|return|yield)|=>)\s*$/.test(prefix)) continue;
      if (isInsidePromiseCombinator(scanText, hm.index)) continue;

      const canonicalName = effectiveHelpers.get(localName);
      const lineOffset = text.slice(0, hm.index).split('\n').length - 1;
      out.push({
        line: firstLineNo + lineOffset,
        column: hm.index - (text.lastIndexOf('\n', hm.index - 1) + 1),
        matcher: `helper:${canonicalName}`,
        helper: canonicalName,
        localName,
        text: (linesArr[lineOffset] || '').trim(),
      });
    }
  }

  out.sort((a, b) => a.line - b.line || a.column - b.column);
  return out;
}

module.exports = { ASYNC_MATCHERS, findMissingAwaits };
