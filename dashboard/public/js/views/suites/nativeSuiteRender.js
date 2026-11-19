/**
 * dashboard/public/js/views/suites/nativeSuiteRender.js
 * DOM for `android-native` suites inside the legacy Test Suites editor (spec checklist, preview, CLI).
 */
import { el } from '../mobile/mobileRender.js';

export const NATIVE = 'android-native';
const $ = (id) => document.getElementById(id);

/** Paths the suite runs: an explicit list, or every native spec when the scope is "all". */
export function nativeSpecList(suite, catalog) {
  const known = (catalog?.specs || []).map((s) => s.path);
  return Array.isArray(suite.specs) && suite.specs.length ? suite.specs : known;
}

export function nativeCommand(suite, catalog) {
  const parts = ['npx wdio run ./wdio.android.conf.js', ...nativeSpecList(suite, catalog).map((p) => `--spec ${p}`)];
  if (suite.grep) parts.push(`--mochaOpts.grep ${suite.grep}`);
  return parts.join(' ');
}

/** Checklist of native specs (tests/native/shared and tests/native/android) with the same classes the legacy sync reads (.suite-spec-cb). */
export function renderNativeChecklist(catalog, selected, onChange) {
  const box = $('suite-specs-checklist-container');
  if (!box) return;
  box.replaceChildren();
  if (!catalog) { box.append(el('p', 'suite-native-empty', 'Đang tải danh sách test native...')); return; }
  if (catalog.error || !catalog.specs?.length) {
    box.append(el('p', 'suite-native-empty', catalog.error ? `Không tải được test native: ${catalog.error}` : 'Chưa có file *.native.js trong tests/native/shared/ hoặc tests/native/android/.'));
  }
  (catalog.specs || []).forEach((spec) => {
    const row = el('label', 'suite-card-fields suite-spec-item');
    const cb = el('input', 'suite-spec-cb');
    Object.assign(cb, { type: 'checkbox', value: spec.path, checked: selected.includes(spec.path) });
    cb.addEventListener('change', onChange);
    const name = el('span', 'suite-spec-name');
    name.append(el('span', 'suite-spec-dir', spec.path.slice(0, spec.path.length - spec.name.length)), el('strong', '', spec.name));
    row.append(cb, name);
    box.append(row);
  });
  const count = $('suite-specs-count-label');
  if (count) count.textContent = `Đã chọn: ${box.querySelectorAll('.suite-spec-cb:checked').length} file`;
}

/** Platform pills, scope badge and the fields that do not apply to native runs. */
export function setNativeChrome(on) {
  $('suite-single-section')?.classList.toggle('is-native', on);
  $('single-plat-native-label')?.classList.toggle('active', on);
  if (on) {
    $('single-plat-desktop-label')?.classList.remove('active');
    $('single-plat-mobile-label')?.classList.remove('active');
    if ($('platform-scope-title-text')) $('platform-scope-title-text').textContent = 'Android native';
  }
}

function card(label, suite, catalog) {
  const box = el('div', 'suite-matrix-platform-card');
  const head = el('div', 'matrix-card-head');
  const title = el('div', 'matrix-card-title');
  title.append(el('i', 'ph-bold ph-android-logo'), el('strong', '', label));
  head.append(title, el('span', 'matrix-card-status-tag active', 'Android native'));
  const grid = el('div', 'matrix-card-grid');
  const specs = nativeSpecList(suite, catalog);
  [['Runner', 'WebdriverIO + Appium'], ['Thiết bị & app', 'Chọn ở Mobile App'],
    ['Tag', suite.grep || 'Không lọc'], ['Phạm vi test', `${specs.length} file native`]].forEach(([k, v]) => {
    const cell = el('div');
    cell.append(el('small', '', k), el('span', '', v));
    grid.append(cell);
  });
  box.append(head, grid);
  return box;
}

export function renderNativePreview(id, suite, catalog) {
  const pill = $('suite-matrix-summary-pill');
  if (pill) pill.replaceChildren(el('i', 'ph-bold ph-android-logo'), el('span', '', 'Suite Android native'));
  $('suite-matrix-cards')?.replaceChildren(card(suite.label || id, suite, catalog));
  if ($('suite-cli-command')) $('suite-cli-command').textContent = nativeCommand(suite, catalog);
  const tagsOf = new Map((catalog?.specs || []).map((s) => [s.path, s.tags]));
  const items = nativeSpecList(suite, catalog).map((path) => ({ path, name: path.split('/').pop(), platform: 'android', tags: tagsOf.get(path) || [], childOrigin: null }));
  if (typeof window.renderSuiteScriptsPreview === 'function') window.renderSuiteScriptsPreview(items);
}

/** Native badge in the sidebar; hides native suites under "Desktop" and others under "Native". */
export function patchSidebar(suites) {
  const filter = document.querySelector('.suite-filter-pill.active')?.dataset.filter || 'all';
  const list = $('suites-sidebar-list');
  list?.querySelectorAll('.suite-nav-item[data-suite-id]').forEach((item) => {
    const native = suites[item.dataset.suiteId]?.platform === NATIVE;
    if ((filter === 'desktop' && native) || (filter === NATIVE && !native)) { item.remove(); return; }
    const badge = item.querySelector('.suite-badge-desktop');
    if (native && badge) badge.replaceWith(Object.assign(el('span', 'suite-nav-badge suite-badge-native'), { innerHTML: '<i class="ph-bold ph-android-logo"></i> Native' }));
  });
  if (list && filter === NATIVE && !list.querySelector('.suite-nav-item')) {
    list.replaceChildren(el('div', 'suite-native-empty', 'Chưa có suite Android native. Tạo kịch bản mới rồi chọn nền tảng "Android native".'));
  }
}
