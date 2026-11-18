/**
 * dashboard/public/js/views/mobile/mobileSlice.js
 * Mobile App view: device list, run configuration and live WDIO/Appium execution.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { readFormOptions, runBlocker, loadPrefs, savePrefs } from './mobileForm.js';
import { renderView, renderRunPanel } from './mobileView.js';
import { MobileBuilds } from './mobileBuilds.js';
import { takePendingSuite, resolveSuiteForRun } from './mobileSuiteHandoff.js';

const $ = (id) => document.getElementById(id);

export class MobileSlice {
  constructor() {
    this._disposers = [];
    this._gen = 0;
    this._source = null;
    this.state = { platform: 'android', devices: null, doctor: null, catalog: null, udid: '', apk: '', suite: null, specs: new Set(), tag: '', run: null, webBusy: false };
    this.builds = new MobileBuilds({
      on: (t, e, f) => this._on(t, e, f),
      getSelected: () => this.state.apk,
      onUploaded: (relPath) => { this.state.apk = relPath; this.loadCatalog(this._gen); },
      onDeleted: () => { this.state.apk = ''; this.loadCatalog(this._gen); },
      notify: (m) => this._notify(m),
    });
  }

  async mount() {
    if (!$('mobile-workspace')) return;
    this.unmount();
    const gen = ++this._gen;
    this._loadPrefs();
    this._bind();
    this._connect();
    this._render();
    const pending = takePendingSuite();
    await Promise.all([this.loadCatalog(gen), this.loadDevices(gen), this.loadDoctor(gen), this.loadState(gen)]);
    if (pending && gen === this._gen) this.runSuite(pending);
  }

  /** AC-206: a suite from Test Suites fills the form and starts when nothing blocks it. */
  runSuite(suite) {
    const plan = resolveSuiteForRun(suite, this.state.catalog?.specs || []);
    Object.assign(this.state, { specs: new Set(plan.specs), tag: plan.tag, suite: { id: suite.id, label: suite.label } });
    this._render();
    const why = plan.badTag ? `Tag "${suite.grep}" không dùng được cho test native (chỉ một tag dạng @ten-tag).`
      : plan.missing.length ? `Không tìm thấy ${plan.missing[0]} trong tests/native/android/.` : runBlocker(this.state, readFormOptions(this.state));
    if (why) return this._notify(`Suite "${suite.label}" chưa chạy được: ${why}`);
    this._notify(`Đang chạy suite "${suite.label}".`);
    return this.startRun();
  }

  unmount() {
    this._gen += 1;
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
      if (platform) { this.state.platform = platform.dataset.platform; this._render(); }
    });
    this._on(root, 'change', (e) => {
      if (e.target.id === 'mobile-apk-select') this.state.apk = e.target.value;
      if (e.target.dataset.spec || e.target.id === 'mobile-spec-all') this.state.suite = null;
      if (e.target.dataset.spec) {
        e.target.checked ? this.state.specs.add(e.target.dataset.spec) : this.state.specs.delete(e.target.dataset.spec);
      } else if (e.target.id === 'mobile-spec-all') {
        this.state.specs = new Set(e.target.checked ? (this.state.catalog?.specs || []).map((s) => s.path) : []);
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

  _connect() {
    if (typeof EventSource === 'undefined') return;
    this._source = new EventSource('/api/events');
    this._source.onmessage = ({ data }) => {
      let event;
      try { event = JSON.parse(data); } catch (_) { return; }
      if (event.type === 'mobile_log') this._appendLog(event.payload.text);
      if (event.type === 'mobile_status') { this.state.run = event.payload; this._renderRunPanel(); }
      if (event.type === 'status') { this.state.webBusy = event.payload?.status === 'running'; this._renderRunPanel(); }
    };
  }

  async _load(gen, key, url) {
    try {
      const data = await apiClient.get(url);
      if (gen === this._gen) this.state[key] = data;
    } catch (err) {
      if (gen === this._gen) this.state[key] = key === 'devices' ? { available: false, error: err.message, devices: [] } : { error: err.message, checks: [], specs: [], tags: [], apps: [] };
    }
    if (gen === this._gen) this._render();
  }

  async loadDevices(gen) {
    await this._load(gen, 'devices', '/api/mobile/devices');
    const ready = (this.state.devices?.devices || []).filter((d) => d.ready);
    if (gen === this._gen && !ready.some((d) => d.serial === this.state.udid)) { this.state.udid = ready[0]?.serial || ''; this._render(); }
  }

  loadDoctor(gen) { return this._load(gen, 'doctor', '/api/mobile/doctor'); }

  async loadCatalog(gen) {
    await this._load(gen, 'catalog', '/api/mobile/catalog?platform=android');
    if (gen !== this._gen) return;
    const known = new Set((this.state.catalog?.specs || []).map((s) => s.path));
    this.state.specs = new Set([...this.state.specs].filter((s) => known.has(s)));
    if (this.state.specs.size === 0 && known.size) this.state.specs = new Set(known);
    const defaults = this.state.catalog?.defaults || {};
    if (!$('mobile-package-input').value && defaults.appPackage) {
      $('mobile-package-input').value = defaults.appPackage;
      $('mobile-activity-input').value = defaults.appActivity || '';
    }
    this._render();
  }

  async loadState(gen) {
    try {
      const [mobile, web] = await Promise.all([apiClient.get('/api/mobile/state'), apiClient.get('/api/state')]);
      if (gen !== this._gen) return;
      this.state.run = mobile.activeRun || mobile.lastRun;
      this.state.webBusy = Boolean(web.activeRun);
      $('mobile-log').textContent = mobile.logs.map((l) => l.text).join('');
      this._renderRunPanel();
    } catch (_) {}
  }

  _render() { if ($('mobile-workspace')) renderView(this.state); }

  _renderRunPanel() { if ($('mobile-workspace')) renderRunPanel(this.state); }

  _savePrefs() { savePrefs(this.state); }

  _loadPrefs() { loadPrefs(this.state); }

  async startRun() {
    const opts = readFormOptions(this.state);
    if (runBlocker(this.state, opts)) return;
    $('mobile-run-btn').disabled = true;
    $('mobile-log').textContent = '';
    try {
      const run = await apiClient.post('/api/mobile/run', opts);
      if (this.state.run?.id !== run.id) this.state.run = run;
      this._renderRunPanel();
    } catch (err) {
      this._renderRunPanel();
      $('mobile-run-hint').textContent = `Không chạy được: ${err.message}`;
      this._notify(`Không chạy được: ${err.message}`);
    }
  }

  async stopRun() {
    try { await apiClient.post('/api/mobile/stop', {}); } catch (err) { this._notify(err.message); }
  }

  _appendLog(text) {
    const log = $('mobile-log');
    if (!log) return;
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.append(document.createTextNode(text));
    if (log.textContent.length > 200000) log.textContent = log.textContent.slice(-150000);
    if (nearBottom) log.scrollTop = log.scrollHeight;
  }

  _notify(message) { eventBus.emit('ui:notify', { message }); }
}

export const mobileSlice = new MobileSlice();
