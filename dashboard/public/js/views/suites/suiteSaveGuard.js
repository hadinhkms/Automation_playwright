/**
 * dashboard/public/js/views/suites/suiteSaveGuard.js
 * Guards for Settings / Suites saves (NB-01, NB-02): never send a config section that was not
 * loaded or edited, and never report success for a rejected save. Classic script + CommonJS so
 * app.js (classic) and node:test can both use it. Strict ceiling <= 150 lines.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SuiteSaveGuard = factory();
})(typeof self !== 'undefined' ? self : this, function() {
  let editedSinceRender = false;

  function markSuiteFormEdited() { editedSinceRender = true; }
  function resetSuiteFormEdited() { editedSinceRender = false; }
  function isSuiteFormEdited() { return editedSinceRender; }

  /** True only when the Settings form was rendered from server data (env cards + default env). */
  function settingsFormReady(doc) {
    if (!doc || typeof doc.querySelector !== 'function') return false;
    const hasEnvCards = Boolean(doc.querySelector('.env-card'));
    const defaultEnv = doc.querySelector('#settings-default-environment');
    return hasEnvCards && Boolean(defaultEnv && defaultEnv.value);
  }

  /** Suites form re-serialises only after a real user edit, never from a stale or unloaded form. */
  function shouldSyncSuiteForm(doc) {
    if (!isSuiteFormEdited()) return false;
    return Boolean(doc && typeof doc.querySelector === 'function' && doc.querySelector('#suite-field-key'));
  }

  /** Suites to send: the edited cache only for an explicit Suites save, else what the server has. */
  function pickSuitesForSave({ includeSuites, cachedSuites, savedSuites, settingsSuites }) {
    if (includeSuites) return Object.assign({}, cachedSuites || {});
    return JSON.parse(JSON.stringify(savedSuites !== undefined ? savedSuites : (settingsSuites || {})));
  }

  /** Without a loaded Settings form send only suites; the server keeps the other sections. */
  function toSavePayload(payload, { settingsReady }) {
    if (settingsReady) return payload;
    return { suites: payload.suites };
  }

  /** Keep the suite's current project selectable even when the Playwright catalog lacks it. */
  function keepCurrentOption(options, current) {
    if (current && !options.includes(current)) options.push(current);
    return options;
  }

  /** Delegated listener: any input/change inside the suite editor counts as a user edit. */
  function bindEditTracking(doc) {
    if (!doc || doc.__suiteSaveGuardBound) return;
    doc.__suiteSaveGuardBound = true;
    const handler = (e) => {
      const target = e && e.target;
      if (target && typeof target.closest === 'function' && target.closest('#suite-editor-form')) markSuiteFormEdited();
    };
    doc.addEventListener('input', handler, true);
    doc.addEventListener('change', handler, true);
  }

  /**
   * Wrap app.js globals from outside (app.js is frozen by check:limits). Function declarations of a
   * classic script are window properties, so internal calls by name hit these wrappers.
   */
  function install(win) {
    const doc = win.document;
    const state = { lastPutError: null, creating: false };
    bindEditTracking(doc);
    // The Suites button is disabled for exactly the duration of its save (app.js), so it tells a Suites
    // save from a Settings save without any flag that could stay set after an exception.
    const suitesSaving = () => Boolean(doc.querySelector('#suites-save-btn:disabled'));

    // Suites the server really holds (never the draft cache, which also feeds savedSuitesCache).
    const serverSuites = () => (win.SettingsRevisionGuard ? win.SettingsRevisionGuard.getServerSuites() : undefined);
    const wrap = (name, make) => { if (typeof win[name] === 'function') win[name] = make(win[name]); };
    const isSettingsPut = (url, o) => url === '/api/settings' && o && o.method === 'PUT';

    wrap('request', (orig) => async function guardedRequest(url, o) {
      try { return await orig.apply(this, arguments); } catch (err) {
        if (isSettingsPut(url, o)) state.lastPutError = err;
        throw err;
      }
    });
    wrap('syncCurrentSuiteFromInputs', (orig) => function guardedSync() {
      return shouldSyncSuiteForm(doc) ? orig.apply(this, arguments) : undefined;
    });
    wrap('renderSuitesView', (orig) => function guardedRender() {
      resetSuiteFormEdited();
      return orig.apply(this, arguments);
    });
    wrap('collectSettingsPayload', (orig) => function guardedCollect() {
      const payload = orig.apply(this, arguments);
      const suites = pickSuitesForSave({
        includeSuites: suitesSaving(), cachedSuites: payload.suites,
        savedSuites: serverSuites(),
        settingsSuites: typeof settingsCache === 'undefined' || !settingsCache ? {} : settingsCache.suites,
      });
      return toSavePayload(Object.assign({}, payload, { suites }), { settingsReady: settingsFormReady(doc) });
    });
    wrap('saveSettings', (orig) => async function guardedSave() {
      const fromSuites = suitesSaving();
      state.lastPutError = null;
      await orig.apply(this, arguments);
      // saveSettings reports its own error; the Suites button must not follow it with a success toast.
      if (fromSuites && state.lastPutError) throw state.lastPutError;
    });
    // app.js binds createNewSuite twice (direct + delegated click); one click must make one suite.
    wrap('createNewSuite', (orig) => function guardedCreate() {
      if (state.creating) return undefined;
      state.creating = true;
      setTimeout(() => { state.creating = false; }, 0); // both bindings run in the same click task
      return orig.apply(this, arguments);
    });
    wrap('updateSuitePlatformContext', (orig) => function guardedContext(platform, current) {
      const result = orig.apply(this, arguments);
      const select = doc.querySelector('#suite-platform-project') || doc.querySelector('#suite-field-project');
      const wanted = current && current.project;
      if (select && wanted) {
        const options = Array.from(select.options).map((o) => o.value);
        if (keepCurrentOption(options.slice(), wanted).length > options.length) select.add(new Option(wanted, wanted));
        select.value = wanted;
      }
      return result;
    });
  }

  if (typeof window !== 'undefined' && window.document) install(window);

  return {
    markSuiteFormEdited, resetSuiteFormEdited, isSuiteFormEdited,
    settingsFormReady, shouldSyncSuiteForm, pickSuitesForSave, toSavePayload,
    keepCurrentOption, bindEditTracking, install,
  };
});
