/**
 * dashboard/public/js/views/suites/nativeSuiteExtension.js
 * Adds the `android-native` platform to Test Suites (REQ-201..203 scope item 5, AC-206).
 *
 * The suite editor lives in the legacy app.js, which is far over the line budget and cannot take new code.
 * Its top-level functions are global, so this module wraps them: the original runs first, then native
 * suites get their own spec list, preview and Run action. Desktop / Mobile Web behaviour is unchanged.
 */
import { apiClient } from '../../core/apiClient.js';
import { stashSuiteForMobile } from '../mobile/mobileSuiteHandoff.js';
import { NATIVE, renderNativeChecklist, setNativeChrome, renderNativePreview, patchSidebar } from './nativeSuiteRender.js';

const $ = (id) => document.getElementById(id);
let catalog = null;
let catalogRequest = null;
let catalogAt = 0;

const suites = () => window.dashboardSuites || {};
const checkedPlatform = () => document.querySelector('input[name="suite-single-platform"]:checked')?.value;
const sync = () => window.syncCurrentSuiteFromInputs?.();

/** Native spec list, refreshed when older than 30 s so new *.native.js files show up. */
function loadCatalog() {
  if (catalogRequest && Date.now() - catalogAt > 30000) catalogRequest = null;
  if (!catalogRequest) {
    catalogAt = Date.now();
    catalogRequest = apiClient.get('/api/mobile/catalog?platform=android')
      .then((data) => { catalog = data; })
      .catch((err) => { catalog = { error: err.message, specs: [] }; catalogRequest = null; })
      .then(() => { if (checkedPlatform() === NATIVE) refreshNative(); });
  }
  return catalogRequest;
}

function currentNativeSuite() {
  const id = $('suite-active-key-label')?.textContent.trim();
  const suite = suites()[id];
  return suite?.platform === NATIVE ? { id, suite } : null;
}

function refreshNative() {
  const current = currentNativeSuite();
  const selected = Array.isArray(current?.suite.specs) ? current.suite.specs : [];
  renderNativeChecklist(catalog, selected, sync);
  if (current) renderNativePreview(current.id, current.suite, catalog);
}

function wrap(name, make) {
  const original = window[name];
  if (typeof original !== 'function' || original.nativeWrapped) return;
  const wrapped = make(original);
  wrapped.nativeWrapped = true;
  window[name] = wrapped;
}

function install() {
  wrap('updateSuitePlatformContext', (original) => function updateSuitePlatformContext(platform, values = {}) {
    const native = platform === NATIVE || checkedPlatform() === NATIVE;
    original.call(this, native ? 'desktop' : platform, values);
    setNativeChrome(native);
    if (!native) return;
    loadCatalog();
    renderNativeChecklist(catalog, Array.isArray(values.specs) ? values.specs : [], sync);
  });

  wrap('loadSuiteIntoEditor', (original) => function loadSuiteIntoEditor(id, suite) {
    original.call(this, id, suite);
    const native = suite?.platform === NATIVE && suite.type !== 'composite';
    const radio = document.querySelector(`input[name="suite-single-platform"][value="${NATIVE}"]`);
    if (radio && native) radio.checked = true;
    setNativeChrome(native);
  });

  wrap('updateSuitePreview', (original) => function updateSuitePreview(id, suite) {
    original.call(this, id, suite);
    if (suite?.platform === NATIVE && suite.type !== 'composite') renderNativePreview(id, suite, catalog);
  });

  wrap('renderSuitesSidebarList', (original) => function renderSuitesSidebarList(...args) {
    original.apply(this, args);
    patchSidebar(suites());
  });

  /** The Playwright runner and composite suites cannot run native specs, so they never see native suites. */
  wrap('renderRunnerSuiteOptions', (original) => function renderRunnerSuiteOptions(all, activeId) {
    const web = Object.fromEntries(Object.entries(all || {}).filter(([, s]) => s?.platform !== NATIVE));
    return original.call(this, web, activeId);
  });

  wrap('renderCompositeChildrenList', (original) => function renderCompositeChildrenList(...args) {
    original.apply(this, args);
    document.querySelectorAll('#suite-composite-children-list .suite-child-cb').forEach((cb) => {
      if (suites()[cb.value]?.platform === NATIVE) cb.closest('.suite-child-card-label')?.remove();
    });
  });

  /** AC-206: "Chạy" on a native suite opens Mobile App, which runs exactly the suite's specs. */
  wrap('runCurrentSuiteNow', (original) => function runCurrentSuiteNow() {
    sync();
    const current = currentNativeSuite();
    if (!current || window.isCurrentSuiteDirty?.()) return original.call(this);
    if (!stashSuiteForMobile(current.id, current.suite)) return window.notify?.('Trình duyệt chặn sessionStorage, không chuyển được suite sang Mobile App.');
    document.querySelector('.view-tab[data-view="mobile-view"]')?.click();
    return undefined;
  });
}

// app.js (classic script) is evaluated before the module graph, so its globals exist here.
install();
