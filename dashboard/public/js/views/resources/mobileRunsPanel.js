/**
 * dashboard/public/js/views/resources/mobileRunsPanel.js
 * "Mobile" group of the Reports view (REQ-202, AC-204): run history, results, evidence, JUnit download.
 * It sits beside the legacy report/evidence explorer and only toggles its own containers.
 */
import { apiClient } from '../../core/apiClient.js';
import { renderRunList, renderRunDetail, runTitle, appLabel } from './mobileRunsRender.js';

const $ = (id) => document.getElementById(id);

export class MobileRunsPanel {
  constructor() {
    this.runs = null;
    this.error = '';
    this.selectedId = '';
    this._disposers = [];
    this._gen = 0;
  }

  mount() {
    const view = $('resources-view');
    if (!view || !$('mobile-runs-pane')) return;
    this.unmount();
    this._on(document, 'click', (e) => {
      const seg = e.target.closest('#resources-view .resource-seg-btn');
      if (seg) this.setCategory(seg.dataset.category);
      const item = e.target.closest('#mobile-runs-list [data-run-id]');
      if (item) this.select(item.dataset.runId);
    });
    this._on($('resource-search'), 'input', () => { if (this.isActive()) this.renderList(); });
    this._on($('resource-refresh-btn'), 'click', () => this.load());
    const active = document.querySelector('#resources-view .resource-seg-btn.active')?.dataset.category;
    this.setCategory(active || 'reports');
    this.load();
  }

  unmount() {
    this._gen += 1;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _on(target, evt, fn) {
    if (!target) return;
    target.addEventListener(evt, fn);
    this._disposers.push(() => target.removeEventListener(evt, fn));
  }

  isActive() {
    return $('resources-view')?.dataset.resCat === 'mobile';
  }

  setCategory(category) {
    const view = $('resources-view');
    if (!view || !category) return;
    view.dataset.resCat = category;
    const on = category === 'mobile';
    $('mobile-runs-pane').hidden = !on;
    $('mobile-run-detail').hidden = !on;
    if (!on) return;
    const search = $('resource-search');
    if (search) search.placeholder = 'Tìm lượt chạy theo spec, app, thiết bị, suite...';
    this.renderList();
    this.renderDetail();
  }

  async load() {
    const gen = ++this._gen;
    try {
      const { runs } = await apiClient.get('/api/mobile/runs?limit=30');
      if (gen !== this._gen) return;
      this.runs = runs;
      this.error = '';
    } catch (err) {
      if (gen !== this._gen) return;
      this.error = err.message;
    }
    if (!this.runs?.some((r) => r.id === this.selectedId)) this.selectedId = this.runs?.[0]?.id || '';
    const badge = $('badge-mobile-count');
    if (badge) badge.textContent = String(this.runs?.length || 0);
    if (this.isActive()) { this.renderList(); this.renderDetail(); }
  }

  filtered() {
    const query = ($('resource-search')?.value || '').trim().toLowerCase();
    if (!query || !this.runs) return this.runs;
    return this.runs.filter((r) => [runTitle(r), appLabel(r.app), r.device?.name, r.device?.udid, r.status, r.grep, ...(r.specs || [])]
      .some((v) => String(v || '').toLowerCase().includes(query)));
  }

  renderList() {
    const list = $('mobile-runs-list');
    if (!list) return;
    const runs = this.filtered();
    renderRunList(list, runs, this.selectedId, this.error, ($('resource-search')?.value || '').trim());
    const count = $('mobile-runs-count');
    if (count) count.textContent = `${runs?.length || 0} lượt`;
  }

  renderDetail() {
    const detail = $('mobile-run-detail');
    if (detail) renderRunDetail(detail, this.runs?.find((r) => r.id === this.selectedId) || null);
  }

  select(id) {
    this.selectedId = id;
    this.renderList();
    this.renderDetail();
  }
}

export const mobileRunsPanel = new MobileRunsPanel();
