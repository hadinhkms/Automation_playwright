/**
 * dashboard/public/js/views/suites/settingsRevisionGuard.js
 * Optimistic concurrency for /api/settings on the client: remembers the latest `revision` (GET or
 * PUT 200), sends it as `baseRevision` on every PUT from any UI path (fetch level), and on 409
 * CONFIG_CONFLICT keeps the form untouched and offers a reload. Also remembers the suites the server
 * really holds. Classic script + CommonJS. Strict ceiling <= 150 lines.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SettingsRevisionGuard = factory();
})(typeof self !== 'undefined' ? self : this, function() {
  const state = { revision: undefined, serverSuites: undefined, conflict: null };

  function isSettingsUrl(input) {
    const raw = typeof input === 'string' ? input : (input && input.url) || '';
    try { return new URL(raw, 'http://local').pathname === '/api/settings'; } catch (_) { return false; }
  }

  /** Adds baseRevision to a JSON PUT body; leaves anything else (or an unknown revision) alone. */
  function withBaseRevision(init, revision) {
    if (!revision || !init || typeof init.body !== 'string') return init;
    try {
      const body = JSON.parse(init.body);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return init;
      // an explicit baseRevision (read-modify-write by the Script Picker) wins over the page's remembered one
      return Object.assign({}, init, { body: JSON.stringify(Object.assign({}, body, { baseRevision: body.baseRevision || revision })) });
    } catch (_) { return init; }
  }

  /** Reads revision / server suites out of a settings response; returns true on a 409 conflict. */
  function record(method, status, body) {
    if (!body || typeof body !== 'object') return false;
    if (status === 409 && body.code === 'CONFIG_CONFLICT') { state.conflict = body; return true; }
    if (status < 200 || status >= 300) return false;
    // The revision belongs to what the user SEES: a PUT 200 (the form is re-rendered from it), the first
    // GET of the page, or a form render (setRenderedRevision). Any other background GET must not move it,
    // or a stale tab would pick up a newer revision and overwrite the other tab's save.
    if (typeof body.revision === 'string' && (method === 'PUT' || state.revision === undefined)) state.revision = body.revision;
    const suites = method === 'PUT' ? body.settings && body.settings.suites : body.suites;
    if (suites && typeof suites === 'object') state.serverSuites = JSON.parse(JSON.stringify(suites));
    return false;
  }

  /** Called when the Settings form is rendered from a GET body: that is the data the user now edits. */
  function setRenderedRevision(revision) {
    if (typeof revision !== 'string' || !revision) return;
    state.revision = revision;
    state.conflict = null;
    if (typeof document !== 'undefined') {
      const box = document.getElementById('settings-conflict-banner');
      if (box) box.style.display = 'none';
    }
  }

  function showBanner(doc, message, onReload) {
    let box = doc.getElementById('settings-conflict-banner');
    if (!box) {
      box = doc.createElement('div');
      box.id = 'settings-conflict-banner';
      box.setAttribute('role', 'alert');
      box.style.cssText = 'position:fixed;left:50%;bottom:72px;transform:translateX(-50%);z-index:9999;background:#fff3cd;color:#664d03;border:1px solid #ffda6a;border-radius:8px;padding:10px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,.2)';
      const text = doc.createElement('span');
      text.id = 'settings-conflict-text';
      const btn = doc.createElement('button');
      btn.id = 'settings-conflict-reload';
      btn.type = 'button';
      btn.textContent = 'Tải lại (bỏ thay đổi chưa lưu)';
      btn.addEventListener('click', onReload);
      box.append(text, btn);
      doc.body.appendChild(box);
    }
    box.querySelector('#settings-conflict-text').textContent = `${message} Dữ liệu bạn đang sửa vẫn nằm trên form nhưng chưa được lưu; "Tải lại" sẽ BỎ các thay đổi chưa lưu đó.`;
    box.style.display = 'flex';
  }

  function install(win) {
    const doc = win.document;
    const origFetch = win.fetch.bind(win);
    const reload = async () => {
      try { if (typeof win.openSettings === 'function') await win.openSettings(); else await origFetch('/api/settings'); }
      finally { const box = doc.getElementById('settings-conflict-banner'); if (box) box.style.display = 'none'; state.conflict = null; }
    };

    win.fetch = async function guardedFetch(input, init) {
      if (!isSettingsUrl(input)) return origFetch(input, init);
      const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      const res = await origFetch(input, method === 'PUT' ? withBaseRevision(init, state.revision) : init);
      if (method === 'GET' || method === 'PUT') {
        let body = null;
        try { body = await res.clone().json(); } catch (_) { /* non-JSON body: nothing to record */ }
        const handled = init && init.headers && init.headers['X-Settings-Conflict'] === 'handled'; // the caller reports the conflict itself
        if (record(method, res.status, body) && !handled) showBanner(doc, body.error || 'Cấu hình đã được thay đổi ở nơi khác.', reload);
      }
      return res;
    };
    if (typeof win.renderSettings === 'function') {
      const origRender = win.renderSettings;
      win.renderSettings = function guardedRender(settings) {
        const result = origRender.apply(this, arguments);
        setRenderedRevision(settings && settings.revision);
        return result;
      };
    }
    // Learn the revision (and server suites) this page started from, even if Settings is never opened.
    win.fetch('/api/settings').catch(() => null);
  }

  if (typeof window !== 'undefined' && window.document && typeof window.fetch === 'function') install(window);

  return {
    state, isSettingsUrl, withBaseRevision, record, setRenderedRevision, install,
    getServerSuites: () => state.serverSuites,
  };
});
