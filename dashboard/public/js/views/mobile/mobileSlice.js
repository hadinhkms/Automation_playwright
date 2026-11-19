/**
 * dashboard/public/js/views/mobile/mobileSlice.js
 * Mobile App view: devices, run configuration and live WDIO/Appium execution for Android and iOS (remote Mac).
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { loadPrefs, savePrefs } from './mobileForm.js';
import { renderView, renderRunPanel } from './mobileView.js';
import { MobileBuilds } from './mobileBuilds.js';
import { takePendingSuite, runSuiteIn } from './mobileSuiteHandoff.js';
import { connectEvents, loadRunState, startRun } from './mobileLive.js';
import { swapPlatform, applyProfile, applyCatalog } from './mobilePlatform.js';
import { InspectorSlice } from './inspectorSlice.js';

const $ = (id) => document.getElementById(id);

export class MobileSlice {
  constructor() {
    this._disposers = [];
    this._gen = 0;
    this._source = null;
    this.state = { platform: 'android', devices: null, doctor: null, catalog: null, udid: '', androidUdid: '', iosDevice: '', apk: '', suite: null, specs: new Set(), tag: '', run: null, webBusy: false };
    this.builds = new MobileBuilds({
      on: (t, e, f) => this._on(t, e, f),
      getSelected: () => this.state.apk,
      getPlatform: () => this.state.platform,
      onUploaded: (relPath) => { this.state.apk = relPath; this.loadCatalog(this._gen); },
      onDeleted: () => { this.state.apk = ''; this.loadCatalog(this._gen); },
      notify: (m) => this._notify(m),
    });
    this.inspector = new InspectorSlice(this);
  }

  async mount() {
    if (!$('mobile-workspace')) return;
    this.unmount();
    const gen = ++this._gen;
    loadPrefs(this.state);
    const pending = takePendingSuite();
    if (pending) this.state.platform = 'android';
    this.state.androidUdid = this.state.udid;
    if (this.state.platform === 'ios') this.state.udid = this.state.iosDevice;
    this._bind();
    this.inspector.mount();
    this._source = connectEvents(this);
    this._render();
    await Promise.all([this.loadPlatform(gen), loadRunState(this, gen)]);
    if (pending && gen === this._gen) this.runSuite(pending);
  }

  loadPlatform(gen) {
    return Promise.all([this.loadCatalog(gen), this.loadDevices(gen), this.loadDoctor(gen)]);
  }

  /** AC-206: a suite from Test Suites fills the form and starts when nothing blocks it. */
  runSuite(suite) { return runSuiteIn(this, suite); }

  unmount() {
    this._gen += 1;
    this.inspector.unmount();
    this.builds.dispose();
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
    if (this._source) { this._source.close(); this._source = null; }
  }

  _on(target, evt, fn) {
    if (!target) return;
    target.addEventListener(evt, fn);
    this._disposers.push(() => target.removeEventListener(evt, fn));
  }

  _bind() {
    const root = $('mobile-workspace');
    this._on(root, 'click', (e) => {
      const device = e.target.closest('[data-udid]');
      const tag = e.target.closest('[data-tag]');
      const platform = e.target.closest('[data-platform]');
      if (device) { this.state.udid = device.dataset.udid; this._savePrefs(); this._render(); }
      if (tag) { this.state.suite = null; this.state.tag = this.state.tag === tag.dataset.tag ? '' : tag.dataset.tag; this._render(); }
      if (platform && swapPlatform(this.state, platform.dataset.platform)) { this._savePrefs(); this._render(); this.loadPlatform(this._gen); }
    });
    this._on(root, 'change', (e) => {
      const t = e.target;
      if (t.id === 'mobile-apk-select') this.state.apk = t.value;
      if (t.id === 'mobile-profile-select') applyProfile((this.state.catalog?.profiles || []).find((p) => p.id === t.value), this.state.platform);
      if (t.dataset.spec || t.id === 'mobile-spec-all') this.state.suite = null;
      if (t.dataset.spec) {
        t.checked ? this.state.specs.add(t.dataset.spec) : this.state.specs.delete(t.dataset.spec);
      } else if (t.id === 'mobile-spec-all') {
        this.state.specs = new Set(t.checked ? (this.state.catalog?.specs || []).map((s) => s.path) : []);
      }
      this._savePrefs();
      this._render();
    });
    this._on(root, 'input', (e) => { if (e.target.matches('input[type="text"]')) { this._savePrefs(); this._renderRunPanel(); } });
    this._on($('mobile-refresh-btn'), 'click', () => { const g = this._gen; this.loadDevices(g); this.loadCatalog(g); });
    this._on($('mobile-doctor-btn'), 'click', () => { this.state.doctor = null; this._render(); this.loadDoctor(this._gen); });
    this._on($('mobile-run-btn'), 'click', () => this.startRun());
    this._on($('mobile-stop-btn'), 'click', () => this.stopRun());
    this._on($('mobile-clear-log'), 'click', () => { $('mobile-log').textContent = ''; });
    this.builds.bind();
    this._on($('mobile-copy-btn'), 'click', () => navigator.clipboard?.writeText($('mobile-command').textContent).then(() => this._notify('Đã sao chép lệnh.'), () => {}));
  }

  /** Loads one platform-specific resource; a reply that arrives after a platform switch is dropped. */
  async _load(gen, key, path) {
    const platform = this.state.platform;
    const stale = () => gen !== this._gen || platform !== this.state.platform;
    try {
      const data = await apiClient.get(`${path}?platform=${platform}`);
      if (!stale()) this.state[key] = data;
    } catch (err) {
      if (!stale()) this.state[key] = key === 'devices' ? { available: false, error: err.message, devices: [] } : { error: err.message, checks: [], specs: [], tags: [], apps: [], profiles: [] };
    }
    if (!stale()) this._render();
    return !stale();
  }

  async loadDevices(gen) {
    if (!(await this._load(gen, 'devices', '/api/mobile/devices'))) return;
    const ready = (this.state.devices?.devices || []).filter((d) => d.ready);
    if (!ready.some((d) => d.serial === this.state.udid)) { this.state.udid = ready[0]?.serial || ''; this._render(); }
  }

  loadDoctor(gen) { return this._load(gen, 'doctor', '/api/mobile/doctor'); }

  async loadCatalog(gen) {
    if (!(await this._load(gen, 'catalog', '/api/mobile/catalog'))) return;
    applyCatalog(this.state);
    this._render();
  }

  _render() { if ($('mobile-workspace')) { renderView(this.state); this.inspector.syncContext(); } }

  _renderRunPanel() { if ($('mobile-workspace')) { renderRunPanel(this.state); this.inspector.syncContext(); } }

  _savePrefs() { savePrefs(this.state); }

  startRun() { return startRun(this); }

  async stopRun() {
    try { await apiClient.post('/api/mobile/stop', {}); } catch (err) { this._notify(err.message); }
  }

  _notify(message) { eventBus.emit('ui:notify', { message }); }
}

export const mobileSlice = new MobileSlice();
