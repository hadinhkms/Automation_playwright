/**
 * dashboard/public/js/views/mobile/inspectorEvents.js
 * Event wiring for the Inspector: delegated listeners on its workspace plus window resize / pagehide.
 * Returns disposers so 20 mount/unmount cycles never stack listeners (OWN-04).
 */

const $ = (id) => document.getElementById(id);

export function bindInspector(slice) {
  const disposers = [];
  const on = (target, evt, fn) => {
    if (!target) return;
    target.addEventListener(evt, fn);
    disposers.push(() => target.removeEventListener(evt, fn));
  };
  const root = $('mobile-inspector');
  const b = slice.builder;

  document.querySelectorAll('[data-mobile-mode]').forEach((btn) => on(btn, 'click', () => slice.setMode(btn.dataset.mobileMode)));
  on($('insp-start-btn'), 'click', () => slice.start());
  on($('insp-stop-btn'), 'click', () => slice.stop());
  on($('insp-refresh-btn'), 'click', () => slice.refresh());
  on($('insp-back-btn'), 'click', () => slice.act('back'));
  on($('insp-tap-btn'), 'click', () => slice.act('tap'));
  on($('insp-type-btn'), 'click', () => slice.act('type'));
  on($('insp-stage'), 'click', (e) => slice.pickAt(e));
  on($('insp-shot'), 'load', () => slice.redrawStage());
  on($('insp-add-btn'), 'click', () => b.add());
  on($('insp-clear-picked'), 'click', () => b.clear());
  on($('insp-preview-btn'), 'click', () => b.send('preview'));
  on($('insp-draft-btn'), 'click', () => b.send('draft'));
  on($('insp-create-btn'), 'click', () => b.send('create'));
  on($('insp-filter'), 'input', (e) => { slice.state.filter = e.target.value; slice.renderTree(); });

  on(root, 'click', (e) => {
    const toggle = e.target.closest('[data-toggle]');
    const node = e.target.closest('[data-node]');
    const copy = e.target.closest('[data-copy]');
    const remove = e.target.closest('[data-remove]');
    if (toggle) {
      const id = Number(toggle.dataset.toggle);
      if (slice.state.collapsed.has(id)) slice.state.collapsed.delete(id); else slice.state.collapsed.add(id);
      slice.renderTree();
    } else if (node) {
      slice.select(Number(node.dataset.node));
    }
    if (copy) {
      e.preventDefault();
      navigator.clipboard?.writeText(copy.dataset.copy).then(() => slice.notify('Đã sao chép locator.'), () => {});
    }
    if (remove) b.remove(remove.dataset.remove);
  });
  on(root, 'change', (e) => {
    if (e.target.name === 'insp-locator') slice.chooseLocator(Number(e.target.value));
    if (e.target.name === 'insp-target-mode' || e.target.id === 'insp-screen-select') b.invalidate();
  });
  on($('insp-screen-name'), 'input', () => b.invalidate());

  on(window, 'resize', () => slice.redrawStage());
  // Closing or reloading the tab: the beacon still reaches the server, so the session does not wait 10 minutes.
  on(window, 'pagehide', () => {
    if (!slice.state.owned) return;
    navigator.sendBeacon?.('/api/mobile/inspector/stop', new Blob([JSON.stringify({ key: slice.key })], { type: 'application/json' }));
  });
  return disposers;
}
