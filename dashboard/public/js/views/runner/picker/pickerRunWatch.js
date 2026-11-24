/**
 * dashboard/public/js/views/runner/picker/pickerRunWatch.js
 * Follows the run state for the picker without opening any connection of its own: the Dừng button (the app
 * toggles it for EVERY run) and the page-wide "qa-studio:sse" CustomEvent that core/sseShare.js re-emits from the
 * single shared /api/events stream. The server records a run AFTER publishing its final status and then emits
 * `history`: reload on it; two timers are only a safety net. Also reloads the footer on the run controls.
 */
export function watchRun({ win, doc, ctx, renderFoot, refreshHistory }) {
  const timers = new Set();
  let lastHistoryEvent = 0;
  const onSse = (e) => { if (e.detail && e.detail.type === 'history') { lastHistoryEvent = Date.now(); refreshHistory(); } };
  win.addEventListener('qa-studio:sse', onSse);
  const scheduleFallback = () => {
    const endedAt = Date.now();
    [1500, 4000].forEach((ms) => { const t = setTimeout(() => { timers.delete(t); if (lastHistoryEvent < endedAt) refreshHistory(); }, ms); timers.add(t); });
  };

  const stop = doc.querySelector('#stop-button');
  ctx.running = stop ? !stop.disabled : false; // L3: coming back to the screen mid-run shows "Đang chạy…"
  if (ctx.ownRun && !ctx.running) { ctx.notice = 'Run đã kết thúc.'; ctx.ownRun = false; } // M-1: our run ended while we were away
  const onStop = () => { ctx.stopRequested = true; };
  stop?.addEventListener('click', onStop);
  const watcher = stop ? new win.MutationObserver(() => {
    const was = ctx.running; ctx.running = !stop.disabled;
    if (was && !ctx.running) {
      if (ctx.ownRun) { // L4: the message only for a run this picker started
        ctx.notice = ctx.stopRequested ? 'Đã dừng run.' : 'Run đã kết thúc.'; ctx.runError = ''; ctx.ownRun = false; ctx.stopRequested = false;
      }
      scheduleFallback(); // any run (also one started elsewhere) changes the history
    }
    renderFoot();
  }) : null;
  watcher?.observe(stop, { attributes: true, attributeFilter: ['disabled'] });
  const controls = ['#environment', '#workers', '#headed'].map((s) => doc.querySelector(s)).filter(Boolean);
  controls.forEach((el) => el.addEventListener('change', renderFoot));

  return () => { // L1: everything added here is removed here
    win.removeEventListener('qa-studio:sse', onSse);
    timers.forEach(clearTimeout);
    watcher?.disconnect();
    stop?.removeEventListener('click', onStop);
    controls.forEach((el) => el.removeEventListener('change', renderFoot));
  };
}
