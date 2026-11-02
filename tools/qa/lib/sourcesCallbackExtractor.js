'use strict';

const { findMatchingDelimiter } = require('./sourcesDelimiterScanner');
const { tokenizeAndSanitize } = require('./sourcesTokenizer');

function extractTestCallbackBody(fileLines, startLine = 1) {
  const lines = Array.isArray(fileLines) ? fileLines : String(fileLines || '').split('\n');
  const startIdx = Math.max(0, (startLine || 1) - 1);
  const tailText = lines.slice(startIdx).join('\n');
  const mTest = tailText.match(/^\s*(?:test|it)(?:\s*\.\s*(?:only|skip|fixme|fail))?\s*\(/);
  if (!mTest) return { ok: false, reason: 'cannot-locate-test-call' };
  const openParen = tailText.indexOf('(', mTest.index);
  const closeParen = findMatchingDelimiter(tailText, openParen, '(', ')');
  if (closeParen === -1) return { ok: false, reason: 'unclosed-test-call' };

  const callInner = tailText.slice(openParen + 1, closeParen);
  const sanitizedCall = tokenizeAndSanitize(callInner);
  if (!sanitizedCall.ok) return { ok: false, reason: sanitizedCall.reason };

  const topCommas = [];
  let pDepth = 0;
  let bDepth = 0;
  let kDepth = 0;
  for (let i = 0; i < sanitizedCall.cleanText.length; i++) {
    const ch = sanitizedCall.cleanText[i];
    if (ch === '(') pDepth++;
    else if (ch === ')') pDepth--;
    else if (ch === '{') bDepth++;
    else if (ch === '}') bDepth--;
    else if (ch === '[') kDepth++;
    else if (ch === ']') kDepth--;
    else if (ch === ',' && pDepth === 0 && bDepth === 0 && kDepth === 0) topCommas.push(i);
  }
  if (topCommas.length === 0) return { ok: false, reason: 'missing-test-callback' };

  const argRanges = [];
  let prev = 0;
  for (const commaIdx of topCommas) {
    argRanges.push([prev, commaIdx]);
    prev = commaIdx + 1;
  }
  argRanges.push([prev, callInner.length]);
  while (
    argRanges.length > 0 &&
    !sanitizedCall.cleanText.slice(argRanges[argRanges.length - 1][0], argRanges[argRanges.length - 1][1]).trim()
  ) {
    argRanges.pop();
  }
  if (argRanges.length < 2) return { ok: false, reason: 'missing-test-callback' };

  const [cbRelStart, cbRelEnd] = argRanges[argRanges.length - 1];
  const cbRaw = callInner.slice(cbRelStart, cbRelEnd);
  const cbClean = sanitizedCall.cleanText.slice(cbRelStart, cbRelEnd);
  const endLine = startIdx + tailText.slice(0, closeParen + 1).split('\n').length;

  let arrowIdx = -1;
  pDepth = 0;
  bDepth = 0;
  kDepth = 0;
  for (let i = 0; i < cbClean.length - 1; i++) {
    const ch = cbClean[i];
    if (ch === '(') pDepth++;
    else if (ch === ')') pDepth--;
    else if (ch === '{') bDepth++;
    else if (ch === '}') bDepth--;
    else if (ch === '[') kDepth++;
    else if (ch === ']') kDepth--;
    else if (ch === '=' && cbClean[i + 1] === '>' && pDepth === 0 && bDepth === 0 && kDepth === 0) {
      arrowIdx = i;
      break;
    }
  }

  if (arrowIdx !== -1) {
    const headRaw = cbRaw.slice(0, arrowIdx);
    const headClean = cbClean.slice(0, arrowIdx);
    let paramsText = '';
    const pOpen = headClean.indexOf('(');
    if (pOpen !== -1) {
      const pClose = findMatchingDelimiter(headClean, pOpen, '(', ')');
      if (pClose === -1) return { ok: false, reason: 'unclosed-callback-params' };
      paramsText = headRaw.slice(pOpen + 1, pClose).trim();
    } else {
      const mIdent = headClean.match(/^\s*(?:async\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*$/);
      if (!mIdent) return { ok: false, reason: 'invalid-arrow-params' };
      paramsText = mIdent[1];
    }

    const afterArrowClean = cbClean.slice(arrowIdx + 2);
    const firstNonWs = afterArrowClean.search(/\S/);
    if (firstNonWs === -1) return { ok: false, reason: 'empty-arrow-body' };
    const bodyStartInCb = arrowIdx + 2 + firstNonWs;

    if (cbClean[bodyStartInCb] === '{') {
      const bodyCloseInCb = findMatchingDelimiter(cbClean, bodyStartInCb, '{', '}');
      if (bodyCloseInCb === -1) return { ok: false, reason: 'unclosed-callback-body' };
      if (cbClean.slice(bodyCloseInCb + 1).trim() !== '') {
        return { ok: false, reason: 'unexpected-tokens-after-callback-body' };
      }
      const bodyOffsetInTail = openParen + 1 + cbRelStart + bodyStartInCb + 1;
      const bodyStartLine = startIdx + tailText.slice(0, bodyOffsetInTail).split('\n').length;
      return { ok: true, paramsText, bodyText: cbRaw.slice(bodyStartInCb + 1, bodyCloseInCb), bodyStartLine, endLine };
    }

    const bodyOffsetInTail = openParen + 1 + cbRelStart + bodyStartInCb;
    const bodyStartLine = startIdx + tailText.slice(0, bodyOffsetInTail).split('\n').length;
    return { ok: true, paramsText, bodyText: cbRaw.slice(bodyStartInCb), bodyStartLine, endLine };
  }

  const mFn = cbClean.match(/^\s*(?:async\s+)?function(?:\s+[A-Za-z_$][A-Za-z0-9_$]*)?\s*\(/);
  if (mFn) {
    const pOpen = cbClean.indexOf('(', mFn.index);
    const pClose = findMatchingDelimiter(cbClean, pOpen, '(', ')');
    if (pClose === -1) return { ok: false, reason: 'unclosed-callback-params' };
    const paramsText = cbRaw.slice(pOpen + 1, pClose).trim();
    const bOpen = cbClean.indexOf('{', pClose + 1);
    if (bOpen === -1) return { ok: false, reason: 'missing-function-body' };
    const bClose = findMatchingDelimiter(cbClean, bOpen, '{', '}');
    if (bClose === -1) return { ok: false, reason: 'unclosed-callback-body' };
    if (cbClean.slice(bClose + 1).trim() !== '') return { ok: false, reason: 'unexpected-tokens-after-callback-body' };
    const bodyOffsetInTail = openParen + 1 + cbRelStart + bOpen + 1;
    const bodyStartLine = startIdx + tailText.slice(0, bodyOffsetInTail).split('\n').length;
    return { ok: true, paramsText, bodyText: cbRaw.slice(bOpen + 1, bClose), bodyStartLine, endLine };
  }

  return { ok: false, reason: 'non-inline-callback' };
}

function extractPageAliases(paramsText, cleanBodyText) {
  const aliases = new Set();
  const rawParams = paramsText === undefined ? '{ page }' : String(paramsText).trim();
  if (rawParams.includes('{')) {
    const braceOpen = rawParams.indexOf('{');
    const braceClose = findMatchingDelimiter(rawParams, braceOpen, '{', '}');
    const destructured = braceClose !== -1 ? rawParams.slice(braceOpen + 1, braceClose) : rawParams;
    const mAlias = destructured.match(/(?:^|[,{\s])page\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
    if (mAlias) aliases.add(mAlias[1]);
    else if (/(?:^|[,{\s])page(?:\s*=|\s*[,}\s]|$)/.test(destructured)) aliases.add('page');
  } else if (rawParams === 'page') {
    aliases.add('page');
  }
  const declRe = /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([^;,\n]+)/g;
  let m;
  while ((m = declRe.exec(cleanBodyText)) !== null) {
    const lhs = m[1];
    const rhs = m[2].trim();
    if (aliases.has(rhs)) aliases.add(lhs);
    else if (aliases.has(lhs)) aliases.delete(lhs);
  }
  return aliases;
}

function normalizePageReceiver(rawReceiver) {
  let r = String(rawReceiver || '').trim();
  while (r.startsWith('(') && r.endsWith(')') && findMatchingDelimiter(r, 0, '(', ')') === r.length - 1) {
    r = r.slice(1, -1).trim();
  }
  return r.replace(/\s+as\s+[A-Za-z_$][A-Za-z0-9_$.<>]*$/, '').trim();
}

module.exports = {
  extractTestCallbackBody,
  extractPageAliases,
  normalizePageReceiver,
};

