'use strict';

const {
  NAVIGATION_MATCHERS,
  WEAK_EXISTENCE_MATCHERS,
  KNOWN_NON_NAVIGATION_MATCHERS,
  PLAYWRIGHT_SAFE_CALL_WHITELIST,
  SAFE_STANDALONE_CALLS,
  JS_CONTROL_KEYWORDS,
  SAFE_EXPECT_HELPERS,
  extractVerifiedHelperImports,
  blankOutImports,
} = require('./sourcesAssertionConstants');
const { findMatchingDelimiter } = require('./sourcesDelimiterScanner');
const { tokenizeAndSanitize } = require('./sourcesTokenizer');
const {
  extractTestCallbackBody,
  extractPageAliases,
  normalizePageReceiver,
} = require('./sourcesCallbackExtractor');

function collectVerifiedHelpers(rawText, options) {
  const verifiedHelpers = extractVerifiedHelperImports(rawText);
  if (options && options.fileLines) {
    for (const [k, v] of extractVerifiedHelperImports(options.fileLines)) verifiedHelpers.set(k, v);
  }
  if (options && options.fileText) {
    for (const [k, v] of extractVerifiedHelperImports(options.fileText)) verifiedHelpers.set(k, v);
  }
  if (options && options.verifiedHelpers instanceof Map) {
    for (const [k, v] of options.verifiedHelpers) verifiedHelpers.set(k, v);
  }
  return verifiedHelpers;
}

function analyzeTestAssertions(bodyInput, options = {}) {
  const rawText = Array.isArray(bodyInput) ? bodyInput.join('\n') : String(bodyInput || '');
  const verifiedHelpers = collectVerifiedHelpers(rawText, options);

  let bodyText = blankOutImports(rawText);
  let paramsText = options.paramsText;

  if (paramsText === undefined) {
    const bodyLines = bodyText.split('\n');
    const testStartLineIdx = bodyLines.findIndex((l) =>
      /^\s*(?:test|it)(?:\s*\.\s*(?:only|skip|fixme|fail))?\s*\(/.test(l),
    );
    if (testStartLineIdx !== -1) {
      const extracted = extractTestCallbackBody(bodyLines, testStartLineIdx + 1);
      if (!extracted.ok) {
        return { kind: 'unknown', matchers: [], reason: extracted.reason, weakExistenceOnly: false };
      }
      bodyText = extracted.bodyText;
      paramsText = extracted.paramsText;
    }
  }

  const sanitized = tokenizeAndSanitize(bodyText);
  if (!sanitized.ok) {
    return { kind: 'unknown', matchers: [], reason: sanitized.reason, weakExistenceOnly: false };
  }

  const cleanText = sanitized.cleanText;
  const pageAliases = extractPageAliases(paramsText, cleanText);
  const allMatchers = [];
  const navMatchers = [];
  const nonNavMatchers = [];
  const strongNonNavMatchers = [];
  const verifiedHelperCalls = [];
  const consumedSpans = [];

  const expectWordRe = /(?<![A-Za-z0-9_$.])\bexpect\b/g;
  let m;
  while ((m = expectWordRe.exec(cleanText)) !== null) {
    const idx = m.index;
    const afterExpect = cleanText.slice(idx + 6);
    const mProp = afterExpect.match(/^\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
    let openParen = -1;
    if (mProp) {
      const prop = mProp[1];
      if (prop === 'soft') {
        const mParen = afterExpect.slice(mProp[0].length).match(/^\s*\(/);
        if (!mParen) return { kind: 'unknown', matchers: allMatchers, reason: 'incomplete-expect-soft', weakExistenceOnly: false };
        openParen = idx + 6 + mProp[0].length + mParen[0].length - 1;
      } else if (SAFE_EXPECT_HELPERS.has(prop)) {
        const mParen = afterExpect.slice(mProp[0].length).match(/^\s*\(/);
        if (mParen) {
          const hOpen = idx + 6 + mProp[0].length + mParen[0].length - 1;
          const hClose = findMatchingDelimiter(cleanText, hOpen, '(', ')');
          if (hClose === -1) return { kind: 'unknown', matchers: allMatchers, reason: 'unclosed-expect-helper', weakExistenceOnly: false };
          consumedSpans.push([idx, hClose + 1]);
          continue;
        }
        return { kind: 'unknown', matchers: allMatchers, reason: `unsupported-expect-property:${prop}`, weakExistenceOnly: false };
      } else {
        return { kind: 'unknown', matchers: allMatchers, reason: `unsupported-expect-variant:expect.${prop}`, weakExistenceOnly: false };
      }
    } else {
      const mParen = afterExpect.match(/^\s*\(/);
      if (!mParen) return { kind: 'unknown', matchers: allMatchers, reason: 'unsupported-expect-usage', weakExistenceOnly: false };
      openParen = idx + 6 + mParen[0].length - 1;
    }

    const closeParen = findMatchingDelimiter(cleanText, openParen, '(', ')');
    if (closeParen === -1) return { kind: 'unknown', matchers: allMatchers, reason: 'unclosed-expect-paren', weakExistenceOnly: false };

    const receiver = normalizePageReceiver(cleanText.slice(openParen + 1, closeParen));
    const tailMatch = cleanText.slice(closeParen + 1).match(
      /^(?:\s*\.\s*(?:not|resolves|rejects))*\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/,
    );
    if (!tailMatch) return { kind: 'unknown', matchers: allMatchers, reason: 'dynamic-or-incomplete-expect-chain', weakExistenceOnly: false };

    const hasNotModifier = /\.\s*not\b/.test(tailMatch[0]);
    const matcher = tailMatch[1];
    const matcherOpenParen = closeParen + 1 + tailMatch[0].length - 1;
    if (findMatchingDelimiter(cleanText, matcherOpenParen, '(', ')') === -1) {
      return { kind: 'unknown', matchers: allMatchers, reason: 'unclosed-matcher-paren', weakExistenceOnly: false };
    }

    consumedSpans.push([idx, closeParen + 1], [closeParen + 1, matcherOpenParen + 1]);

    if (NAVIGATION_MATCHERS.has(matcher)) {
      if (!pageAliases.has(receiver)) {
        return { kind: 'unknown', matchers: [...allMatchers, matcher], reason: `non-page-navigation-receiver:${receiver || 'unknown'}`, weakExistenceOnly: false };
      }
      navMatchers.push(matcher);
      allMatchers.push(matcher);
    } else if (KNOWN_NON_NAVIGATION_MATCHERS.has(matcher)) {
      nonNavMatchers.push(matcher);
      allMatchers.push(matcher);
      const isWeak =
        (!hasNotModifier && WEAK_EXISTENCE_MATCHERS.has(matcher)) ||
        (hasNotModifier && (matcher === 'toBeNull' || matcher === 'toBeUndefined'));
      if (!isWeak) strongNonNavMatchers.push(matcher);
    } else {
      return { kind: 'unknown', matchers: [...allMatchers, matcher], reason: `custom-or-unknown-matcher:${matcher}`, weakExistenceOnly: false };
    }
  }

  if (verifiedHelpers.size > 0) {
    const helperCallRe = /(\.\s*)?\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    let hm;
    while ((hm = helperCallRe.exec(cleanText)) !== null) {
      if (hm[1] || !verifiedHelpers.has(hm[2])) continue;
      if (/\b(?:function|new)\s+$/.test(cleanText.slice(0, hm.index))) continue;
      const canonical = verifiedHelpers.get(hm[2]);
      const tag = `helper:${canonical}`;
      allMatchers.push(tag);
      nonNavMatchers.push(tag);
      strongNonNavMatchers.push(tag);
      verifiedHelperCalls.push(canonical);
      consumedSpans.push([hm.index, hm.index + hm[0].length - 1]);
    }
  }

  if (nonNavMatchers.length > 0) {
    const weakExistenceOnly = strongNonNavMatchers.length === 0;
    return {
      kind: 'mixed',
      matchers: allMatchers,
      reason: weakExistenceOnly ? 'only-weak-existence-matchers' : 'has-non-navigation-matchers',
      weakExistenceOnly,
      verifiedHelperCalls,
    };
  }

  const maskedChars = Array.from(cleanText);
  for (const [s, e] of consumedSpans) {
    for (let k = s; k < e; k++) if (maskedChars[k] !== '\n') maskedChars[k] = ' ';
  }
  const remainderText = maskedChars.join('');
  if (/\]\s*\(/.test(remainderText)) {
    return { kind: 'unknown', matchers: allMatchers, reason: 'dynamic-bracket-call', weakExistenceOnly: false };
  }

  const callRe = /(\.\s*)?\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  let cm;
  while ((cm = callRe.exec(remainderText)) !== null) {
    const isMethod = Boolean(cm[1]);
    const name = cm[2];
    if (!isMethod && JS_CONTROL_KEYWORDS.has(name)) continue;
    if (!isMethod && /\b(?:function|new)\s+$/.test(remainderText.slice(0, cm.index))) continue;
    if (isMethod && !PLAYWRIGHT_SAFE_CALL_WHITELIST.has(name)) {
      return { kind: 'unknown', matchers: allMatchers, reason: `unresolved-method-call:${name}`, weakExistenceOnly: false };
    }
    if (!isMethod && !SAFE_STANDALONE_CALLS.has(name)) {
      return { kind: 'unknown', matchers: allMatchers, reason: `unresolved-helper-call:${name}`, weakExistenceOnly: false };
    }
  }

  if (navMatchers.length > 0) {
    return { kind: 'navigation-only', matchers: allMatchers, reason: 'only-page-navigation-matchers', weakExistenceOnly: false };
  }
  return { kind: 'none', matchers: [], reason: 'no-assertions', weakExistenceOnly: false };
}

module.exports = { analyzeTestAssertions };

