/**
 * dashboard/public/js/views/data/deleteButtonsGuard.js
 * NB-03: "Xóa file" (Data), "Xóa kịch bản" (BDD) and "Xóa Fixture" were bound by app.js with
 * `document.getElementById(...)?.addEventListener` while it loads, but those buttons live in templates
 * loaded later, so the optional call silently bound nothing. One delegated capture listener now handles
 * them whenever the template exists, reusing app.js's confirm modal, request() and list reloaders.
 * Classic script loaded after app.js (app.js is frozen by check:limits). Strict ceiling <= 150 lines.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DeleteButtonsGuard = factory();
})(typeof self !== 'undefined' ? self : this, function() {
  const SELECTOR = '#data-delete-file-btn, #script-delete-btn, #btn-delete-fixture';
  const JSON_HEADERS = { 'Content-Type': 'application/json' };

  function tell(message) { try { notify(message); } catch (_) { /* notify missing: nothing to show with */ } }
  function esc(value) { return typeof escapeHtml === 'function' ? escapeHtml(value) : String(value); }

  function deleteDataFile() {
    const file = typeof currentDataFile === 'undefined' ? null : currentDataFile;
    if (!file) return tell('Vui lòng chọn một tệp dữ liệu để xóa.');
    showConfirmDeleteModal({
      title: 'Xác nhận xóa tệp dữ liệu',
      subtitle: 'Tệp dữ liệu JSON sẽ bị xóa khỏi thư mục data/',
      targetName: file,
      targetPath: `data/${file}`,
      iconClass: 'ph-bold ph-database',
      message: `Hệ thống sẽ tự động lưu 1 bản sao lưu trong <code>.dashboard-backups/</code> trước khi xóa tệp <strong>${esc(file)}</strong>. Bạn có chắc chắn muốn xóa vĩnh viễn?`,
      onConfirm: async () => {
        const res = await request('/api/data/delete-dataset', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ fileName: file }) });
        tell(`🗑️ ${res.message || 'Đã xóa tệp dữ liệu thành công!'}`);
        currentDataFile = null;
        await loadDataFilesList();
        if (typeof datasetsCache !== 'undefined' && datasetsCache.length > 0) await selectDataset(datasetsCache[0].fileName);
      },
    });
  }

  function deleteScript() {
    const script = typeof currentSelectedScript === 'undefined' ? null : currentSelectedScript;
    if (!script) return tell('Vui lòng chọn một kịch bản để xóa.');
    const path = script.relativePath || script.fileName;
    showConfirmDeleteModal({
      title: 'Xác nhận xóa kịch bản test',
      subtitle: 'Kịch bản Playwright BDD sẽ bị xóa vĩnh viễn khỏi thư mục tests/',
      targetName: script.scenarioName || script.fileName,
      targetPath: path,
      iconClass: script.platform === 'mobile-web' ? 'ph-bold ph-device-mobile' : 'ph-bold ph-desktop',
      message: `Hệ thống sẽ tự động lưu 1 bản sao lưu trong <code>.dashboard-backups/</code> trước khi xóa kịch bản <strong>${esc(script.fileName)}</strong>. Bạn có chắc chắn muốn xóa vĩnh viễn?`,
      onConfirm: async () => {
        const res = await request('/api/builder/delete-script', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ spec: path }) });
        tell(`🗑️ ${res.message || 'Đã xóa kịch bản thành công!'}`);
        currentSelectedScript = null;
        await loadProjectScripts();
      },
    });
  }

  function deleteFixture() {
    // The Fixtures list is rendered by fixturesSlice, which records the selection on window; the app.js
    // `let` stays null there, so the old handler returned on its first line even when it was bound.
    const legacy = typeof currentSelectedFixture === 'undefined' ? null : currentSelectedFixture;
    const fx = (typeof window !== 'undefined' && window.currentSelectedFixture) || legacy;
    if (!fx || !fx.isCustom) return tell('Chỉ có thể xóa Custom Fixture đã chọn.');
    showConfirmDeleteModal({
      title: 'Xác nhận xóa Custom Fixture',
      subtitle: 'File mã nguồn fixture sẽ bị xóa khỏi core/fixtures/custom/',
      targetName: fx.name,
      targetPath: fx.sourceFile || `core/fixtures/custom/${fx.name}.fixture.js`,
      iconClass: 'ph-bold ph-flask',
      message: `File được sao lưu an toàn tại <code>.dashboard-backups/fixtures/</code> trước khi xóa fixture <strong>${esc(fx.name)}</strong>. Bạn có chắc chắn muốn xóa vĩnh viễn?`,
      onConfirm: async () => {
        const res = await request(`/api/fixtures/${encodeURIComponent(fx.name)}`, { method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ expectedRevision: fx.revision }) });
        if (res && res.success === false) throw new Error(res.error || 'Không thể xóa fixture');
        tell(`🗑️ ${(res && res.message) || `Đã xóa fixture '${fx.name}' thành công!`}`);
        if (typeof currentSelectedFixture !== 'undefined') currentSelectedFixture = null;
        if (typeof window !== 'undefined' && window.currentSelectedFixture) window.currentSelectedFixture = null;
        await loadFixturesList();
      },
    });
  }

  const ACTIONS = { 'data-delete-file-btn': deleteDataFile, 'script-delete-btn': deleteScript, 'btn-delete-fixture': deleteFixture };

  function install(doc) {
    if (!doc || doc.__deleteButtonsGuardBound) return;
    doc.__deleteButtonsGuardBound = true;
    doc.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
      if (!btn || !ACTIONS[btn.id]) return;
      e.preventDefault();
      e.stopImmediatePropagation(); // any legacy/slice listener on the same button must not run a second time
      ACTIONS[btn.id]();
    }, true);
  }

  if (typeof document !== 'undefined') install(document);
  return { install, SELECTOR, ACTIONS };
});
