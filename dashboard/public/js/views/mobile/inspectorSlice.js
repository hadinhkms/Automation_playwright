/**
 * dashboard/public/js/views/mobile/inspectorSlice.js
 * Native Inspector inside the Mobile App view (PLAN-25 P4): one Appium session per tab (key), screenshot +
 * element tree, locator suggestions with match counts, tap / type / Back, and Screen generation.
 * The session is closed when the view is left or the tab goes away (REQ-402); the server closes it after 10 idle minutes.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { readFormOptions } from './mobileForm.js';
import { parseSource, hitTest, locatorInput, defaultCollapsed, revealNode, renderTree } from './inspectorTree.js';
import { renderInspector, renderStage, renderSuggestions, renderStatus, displayScale } from './inspectorView.js';
import { InspectorScreenBuilder } from './inspectorScreen.js';
import { bindInspector } from './inspectorEvents.js';

const $ = (id) => document.getElementById(id);
const API = '/api/mobile/inspector';
const IDLE_MS = 10 * 60 * 1000;
const CLOSED = { idle: 'Phiên đã tự đóng sau 10 phút không thao tác.', lost: 'Phiên đã đóng: thiết bị hoặc Appium mất kết nối.', shutdown: 'Dashboard đã tắt, phiên đã đóng.' };

export class InspectorSlice {
  constructor(mobile) {
    this.mobile = mobile;
    this.key = `tab-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
    this.state = { status: 'idle', platform: 'android', target: '', blocker: '', message: '', snapshot: null, nodes: [], selected: null, collapsed: new Set(), filter: '', suggestions: null, locator: '', picked: [], screens: [], expiresAt: null, owned: false, mode: 'run' };
    this.builder = new InspectorScreenBuilder({ state: this.state, notify: (m) => this.notify(m) });
    this._disposers = [];
  }

  mount() {
    this.unmount();
    this._disposers = bindInspector(this);
    this.setMode(this.state.mode);
    this.syncContext();
    this.builder.loadScreens();
  }

  /** Leaving the view closes this tab's session (REQ-402); keepalive lets the request outlive navigation. */
  unmount() {
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
    if (this.state.owned) this.release('stopped');
  }

  release(reason) {
    fetch(`${API}/stop`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: this.key }) }).catch(() => {});
    this.closed(reason === 'stopped' ? '' : CLOSED[reason] || '');
  }

  setMode(mode) {
    this.state.mode = mode === 'inspect' ? 'inspect' : 'run';
    const inspect = this.state.mode === 'inspect';
    document.querySelectorAll('[data-mobile-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mobileMode === this.state.mode)));
    $('mobile-workspace').hidden = inspect;
    $('mobile-inspector').hidden = !inspect;
    $('mobile-mode-note').hidden = !inspect;
    if (inspect) { this.syncContext(); this.render(); }
  }

  /** Device and app come from the run form (frame 1/2 of "Chạy test"). */
  syncContext() {
    const m = this.mobile.state;
    const opts = readFormOptions(m);
    const app = opts.app?.appPackage || opts.app?.bundleId || opts.app?.path || opts.app?.url || '';
    if (!this.state.owned) this.state.platform = m.platform;
    this.state.target = [opts.deviceName || opts.udid || opts.device, app].filter(Boolean).join(' · ');
    const busy = m.run?.status === 'running' || m.run?.status === 'stopping';
    this.state.blocker = busy ? 'Đang có lượt chạy Mobile App.' : m.webBusy ? 'Đang có lượt chạy Playwright.'
      : !m.udid ? 'Chưa chọn thiết bị ở chế độ Chạy test.' : !app ? 'Chưa chọn app ở chế độ Chạy test (hồ sơ app, APK hoặc package).' : '';
    this._opts = opts;
    if ($('mobile-inspector') && !$('mobile-inspector').hidden) renderStatus(this.state);
  }

  render() { renderInspector(this.state); this.renderTree(); this.builder.render(); }

  renderTree() {
    const { nodes, selected, collapsed, filter } = this.state;
    renderTree($('insp-tree'), nodes, { selectedId: selected, collapsed, filter });
  }

  notify(message) { eventBus.emit('ui:notify', { message }); }

  closed(message) {
    Object.assign(this.state, { status: 'closed', owned: false, expiresAt: null, message });
    this.render();
  }

  /** Runs one API call; a 404/503 means the server already closed the session. */
  async call(fn) {
    try {
      const result = await fn();
      if (this.state.owned) this.state.expiresAt = Date.now() + IDLE_MS;
      return result;
    } catch (err) {
      if (this.state.owned && (err.status === 404 || err.status === 503)) this.closed(err.message);
      else { this.state.message = err.message; if (this.state.status === 'busy') this.state.status = 'ready'; this.render(); }
      return null;
    }
  }

  async start() {
    this.syncContext();
    if (this.state.blocker) return;
    Object.assign(this.state, { status: 'starting', message: 'Đang mở phiên Appium trên thiết bị (có thể mất tới 60 giây)…', owned: true, platform: this._opts.platform });
    this.render();
    const ok = await this.call(() => apiClient.post(`${API}/start`, { ...this._opts, key: this.key }, { timeout: 180000 }));
    if (!ok) { if (this.state.status === 'starting') this.closed(this.state.message); return; }
    Object.assign(this.state, { status: 'ready', message: '' });
    await this.refresh();
  }

  async stop() {
    if (!this.state.owned) return;
    await this.call(() => apiClient.post(`${API}/stop`, { key: this.key }));
    this.closed('');
  }

  async refresh() {
    this.state.status = 'busy';
    renderStatus(this.state);
    const snap = await this.call(() => apiClient.get(`${API}/snapshot`, { key: this.key }, { timeout: 60000 }));
    if (!snap) return;
    const { nodes, error } = parseSource(snap.source, snap.platform);
    Object.assign(this.state, { status: 'ready', snapshot: snap, nodes, selected: null, suggestions: null, locator: '', collapsed: defaultCollapsed(nodes), message: error });
    $('insp-shot').src = `data:image/png;base64,${snap.screenshot}`;
    this.render();
  }

  /** Click on the screenshot → element under the point (EDGE-402: nothing there, nothing selected). */
  pickAt(event) {
    const img = $('insp-shot');
    if (img.hidden || !this.state.nodes.length) return;
    const box = img.getBoundingClientRect();
    const k = displayScale(img, this.state.snapshot);
    const node = hitTest(this.state.nodes, (event.clientX - box.left) / k, (event.clientY - box.top) / k);
    if (node) this.select(node.id);
    else { this.state.message = 'Không có phần tử ở vị trí này.'; renderStatus(this.state); }
  }

  async select(id) {
    const node = this.state.nodes[id];
    if (!node) return;
    Object.assign(this.state, { selected: id, suggestions: null, locator: '', message: '' });
    revealNode(this.state.nodes, this.state.collapsed, id);
    this.render();
    $('insp-tree').querySelector(`[data-node="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    const found = await this.call(() => apiClient.post(`${API}/find`, { key: this.key, element: locatorInput(node) }));
    if (!found || this.state.selected !== id) return;
    this.state.suggestions = found.suggestions;
    this.state.locator = (found.suggestions.find((g) => g.count === 1) || found.suggestions[0])?.locator || '';
    $('insp-el-name').value = found.name;
    const parent = this.state.nodes[node.parent];
    const clickable = node.attrs.clickable === 'true' || parent?.attrs.clickable === 'true' || /Button|Cell|Link/.test(node.tag);
    $('insp-el-action').value = /EditText|TextField|SearchField/.test(node.tag) ? 'type'
      : clickable ? 'tap' : node.attrs.text || node.attrs.label ? 'read' : 'visible';
    this.render();
  }

  chooseLocator(index) {
    const g = this.state.suggestions?.[index];
    if (g) { this.state.locator = g.locator; renderSuggestions(this.state); renderStatus(this.state); }
  }

  /** tap (centre of the selected element) · type (into it, with the chosen locator) · back; then re-snapshot. */
  async act(type) {
    const node = this.state.nodes[this.state.selected];
    const body = { key: this.key, type };
    if (type === 'tap') Object.assign(body, { x: Math.round(node.rect.x + node.rect.w / 2), y: Math.round(node.rect.y + node.rect.h / 2) });
    if (type === 'type') Object.assign(body, { locator: this.state.locator, text: $('insp-type-input').value });
    this.state.status = 'busy';
    renderStatus(this.state);
    if (!(await this.call(() => apiClient.post(`${API}/action`, body)))) return;
    await new Promise((r) => setTimeout(r, 700));
    if (this.state.owned) await this.refresh();
  }

  /** SSE `mobile_inspector`: the server closed this tab's session (idle, lost device, shutdown). */
  onEvent(payload) {
    if (payload?.active === false && this.state.owned && CLOSED[payload.reason]) this.closed(CLOSED[payload.reason]);
  }

  redrawStage() { renderStage(this.state); }
}
