/**
 * dashboard/public/js/views/mobile/mobileSuiteHandoff.js
 * Hands an `android-native` Test Suite over to the Mobile App view (AC-206).
 * Test Suites stores the suite here and opens Mobile App; the Mobile slice takes it once on mount.
 */
import { readFormOptions, runBlocker } from './mobileForm.js';

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

/** Fills the slice from the suite and starts it, or explains why it cannot start. */
export function runSuiteIn(slice, suite) {
  const plan = resolveSuiteForRun(suite, slice.state.catalog?.specs || []);
  Object.assign(slice.state, { specs: new Set(plan.specs), tag: plan.tag, suite: { id: suite.id, label: suite.label } });
  slice._render();
  const why = plan.badTag ? `Tag "${suite.grep}" không dùng được cho test native (chỉ một tag dạng @ten-tag).`
    : plan.missing.length ? `Không tìm thấy ${plan.missing[0]} trong thư mục test native.` : runBlocker(slice.state, readFormOptions(slice.state));
  if (why) return slice._notify(`Suite "${suite.label}" chưa chạy được: ${why}`);
  slice._notify(`Đang chạy suite "${suite.label}".`);
  return slice.startRun();
}
