/**
 * dashboard/public/js/views/mobile/mobileSuiteHandoff.js
 * Hands an `android-native` Test Suite over to the Mobile App view (AC-206).
 * Test Suites stores the suite here and opens Mobile App; the Mobile slice takes it once on mount.
 */

const KEY = 'dashboard_mobile_pending_suite';
const MAX_AGE_MS = 60000;
const TAG = /^@[\w-]{1,40}$/;

export function stashSuiteForMobile(id, suite) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      id, label: suite.label || id, specs: suite.specs, grep: (suite.grep || '').trim(), at: Date.now(),
    }));
    return true;
  } catch (_) {
    return false;
  }
}

/** Returns and clears the pending suite; stale entries (older than a minute) are dropped. */
export function takePendingSuite() {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const suite = raw ? JSON.parse(raw) : null;
    return suite && Date.now() - suite.at < MAX_AGE_MS ? suite : null;
  } catch (_) {
    return null;
  }
}

/**
 * Maps a suite onto the Mobile form: "all" (or no list) means every native spec in the catalog.
 * Returns { specs, tag, missing, badTag }.
 */
export function resolveSuiteForRun(suite, catalogSpecs) {
  const known = catalogSpecs.map((s) => s.path);
  const wanted = Array.isArray(suite.specs) && suite.specs.length ? suite.specs : known;
  return {
    specs: wanted.filter((p) => known.includes(p)),
    missing: wanted.filter((p) => !known.includes(p)),
    tag: TAG.test(suite.grep) ? suite.grep : '',
    badTag: Boolean(suite.grep) && !TAG.test(suite.grep),
  };
}
