/**
 * dashboard/public/js/views/mobile/mobileView.js
 * Paints the whole Mobile App view from slice state.
 */
import * as R from './mobileRender.js';
import { readFormOptions, runBlocker, commandPreview } from './mobileForm.js';

const $ = (id) => document.getElementById(id);

export function renderView(s) {
  const ios = s.platform === 'ios';
  document.querySelectorAll('#mobile-workspace [data-platform]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.platform === s.platform)));
  $('mobile-ios-note').hidden = !ios;
  $('mobile-android-pane').hidden = ios;
  R.renderDevices($('mobile-device-list'), s.devices, s.udid);
  R.renderDoctor($('mobile-doctor-list'), s.doctor);

  const cat = s.catalog || {};
  const specs = cat.specs || [];
  const apkSelect = $('mobile-apk-select');
  R.renderApkOptions(apkSelect, cat.apps || [], s.apk || apkSelect.value);
  s.apk = apkSelect.value;
  R.renderApkMeta($('mobile-apk-meta'), (cat.apps || []).find((a) => a.path === s.apk));
  $('mobile-apk-delete').disabled = !s.apk || (s.run?.status === 'running' && s.run?.options?.app?.path === s.apk);
  R.renderSpecs($('mobile-spec-list'), specs, s.specs, 'tests/native/android');
  R.renderTags($('mobile-tag-list'), cat.tags || [], s.tag);
  const all = $('mobile-spec-all');
  all.checked = specs.length > 0 && s.specs.size === specs.length;
  all.indeterminate = s.specs.size > 0 && s.specs.size < specs.length;
  all.disabled = specs.length === 0;

  const installed = $('mobile-mode-installed').checked;
  $('mobile-apk-group').hidden = installed;
  $('mobile-installed-group').hidden = !installed;
  $('mobile-noreset').disabled = installed;

  const ready = (s.devices?.devices || []).filter((d) => d.ready).length;
  $('mobile-stat-devices').textContent = s.devices ? String(ready) : '–';
  $('mobile-stat-specs').textContent = s.catalog ? String(specs.length) : '–';
  $('mobile-stat-toolchain').textContent = !s.doctor ? '–' : s.doctor.ready ? 'Đủ' : 'Thiếu';
  renderRunPanel(s);
}

export function renderRunPanel(s) {
  const opts = readFormOptions(s);
  const run = s.run;
  const busy = run?.status === 'running' || run?.status === 'stopping';
  const blocker = busy ? '' : runBlocker(s, opts);
  $('mobile-command').textContent = busy && run.command ? run.command : commandPreview(opts);
  $('mobile-run-hint').textContent = blocker;
  $('mobile-run-btn').disabled = busy || Boolean(blocker);
  $('mobile-stop-btn').disabled = run?.status !== 'running';
  R.renderRunStatus($('mobile-run-status'), run);
  R.renderResults($('mobile-results'), run);
  R.renderEvidence($('mobile-evidence'), run);
  const done = run && !busy ? run.results || [] : null;
  $('mobile-stat-last').textContent = done ? `${done.filter((r) => r.status === 'passed').length}/${done.length}` : '–';
}
