'use strict';

/**
 * Cross-platform locators for native Screens (PLAN-25 S-01).
 * A Screen declares `static locators = { name: { android: 'id:...', ios: '~...' } }`;
 * this module turns one entry into a WebdriverIO selector for the running platform.
 *
 * Prefixes: id: · ~ (accessibility id) · text: · uia: (UiSelector, Android) ·
 * pred: (NSPredicate, iOS) · chain: (class chain, iOS) · xpath:
 */

const PLATFORMS = ['android', 'ios'];

function quote(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const BUILDERS = {
  'id:': {
    android: (v) => `android=new UiSelector().resourceId("${quote(v)}")`,
    // XCUITest has no resource-id; the accessibility identifier plays that role.
    ios: (v) => `~${v}`,
  },
  'text:': {
    android: (v) => `android=new UiSelector().text("${quote(v)}")`,
    ios: (v) => `-ios predicate string:label == "${quote(v)}" OR value == "${quote(v)}"`,
  },
  'uia:': { android: (v) => `android=${v}` },
  'pred:': { ios: (v) => `-ios predicate string:${v}` },
  'chain:': { ios: (v) => `-ios class chain:${v}` },
  'xpath:': { android: (v) => v, ios: (v) => v },
};

/** Converts one prefixed locator string into a WebdriverIO selector for `platform`. */
function toSelector(locator, platform) {
  if (!PLATFORMS.includes(platform)) throw new Error(`[locators] Unknown platform "${platform}"`);
  const raw = String(locator || '').trim();
  if (!raw) throw new Error('[locators] Empty locator');
  if (raw.startsWith('~')) return raw;
  const prefix = Object.keys(BUILDERS).find((p) => raw.startsWith(p));
  if (!prefix) throw new Error(`[locators] Unknown prefix in "${raw}" (use id:, ~, text:, uia:, pred:, chain:, xpath:)`);
  const build = BUILDERS[prefix][platform];
  if (!build) throw new Error(`[locators] Prefix "${prefix}" is not supported on ${platform}: "${raw}"`);
  return build(raw.slice(prefix.length));
}

const QUERY_PREFIXES = [
  ['android=', '-android uiautomator'],
  ['-ios predicate string:', '-ios predicate string'],
  ['-ios class chain:', '-ios class chain'],
  ['~', 'accessibility id'],
];

/**
 * W3C `{ using, value }` for `POST /session/:id/elements`, derived from toSelector so the Inspector
 * counts matches with exactly the strategy a Screen will use at run time (P4 AC-402).
 */
function toWebDriverQuery(locator, platform) {
  const selector = toSelector(locator, platform);
  const hit = QUERY_PREFIXES.find(([prefix]) => selector.startsWith(prefix));
  return hit ? { using: hit[1], value: selector.slice(hit[0].length) } : { using: 'xpath', value: selector };
}

/** Picks `locators[name][platform]`; a missing entry is reported with the Screen name so the gap is obvious. */
function resolveLocator(locators, name, platform, screenName = 'Screen') {
  const entry = locators && Object.prototype.hasOwnProperty.call(locators, name) ? locators[name] : undefined;
  if (!entry) throw new Error(`[locators] ${screenName} has no locator "${name}"`);
  const value = typeof entry === 'string' ? entry : entry[platform];
  if (!value) throw new Error(`[locators] ${screenName}.${name} has no ${platform} locator yet`);
  return toSelector(value, platform);
}

/** Lists locator names that still lack a value for `platform` (Dashboard / Inspector warnings). */
function missingLocators(locators, platform) {
  return Object.entries(locators || {})
    .filter(([, entry]) => typeof entry !== 'string' && !(entry && entry[platform]))
    .map(([name]) => name);
}

module.exports = { toSelector, toWebDriverQuery, resolveLocator, missingLocators, PLATFORMS };
