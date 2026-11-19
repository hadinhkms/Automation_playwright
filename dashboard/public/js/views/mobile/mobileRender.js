/**
 * dashboard/public/js/views/mobile/mobileRender.js
 * DOM builders for the Mobile App view. Every value is set via textContent.
 */

export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function formatSize(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function empty(title, message) {
  const box = el('div', 'mobile-empty');
  box.append(el('strong', '', title), el('p', '', message));
  return box;
}

const STATE_LABEL = { device: 'Sẵn sàng', unauthorized: 'Chưa cho phép', offline: 'Mất kết nối' };

export function renderDevices(container, data, selectedUdid) {
  container.replaceChildren();
  if (!data) { container.append(el('p', 'mobile-hint', 'Đang tìm thiết bị...')); return; }
  if (!data.available) { container.append(empty('Không đọc được thiết bị', data.error)); return; }
  if (data.devices.length === 0) {
    const help = data.platform === 'ios'
      ? 'Khai báo simulator hoặc iPhone trong Cấu hình hệ thống → Mobile / iOS.'
      : 'Cắm điện thoại qua USB, bật USB debugging, hoặc mở một emulator rồi bấm làm mới.';
    container.append(empty('Chưa có thiết bị nào', help));
    return;
  }
  data.devices.forEach((d) => {
    const card = el('button', `mobile-device${d.serial === selectedUdid ? ' is-selected' : ''}`);
    card.type = 'button';
    card.dataset.udid = d.serial;
    card.disabled = !d.ready;
    card.setAttribute('aria-pressed', String(d.serial === selectedUdid));
    const top = el('span', 'mobile-device-top');
    top.append(el('strong', '', d.model || d.serial), el('span', `mobile-pill ${d.ready ? 'is-passed' : 'is-warn'}`, STATE_LABEL[d.state] || d.state));
    const os = d.osLabel || (d.androidVersion ? `Android ${d.androidVersion}` : '');
    const meta = [d.osLabel ? d.udid : d.serial, os, d.emulator ? (d.osLabel ? 'Simulator' : 'Emulator') : ''].filter(Boolean).join(' · ');
    card.append(top, el('small', 'mobile-mono', meta));
    if (d.hint) card.append(el('small', 'mobile-hint', d.hint));
    container.append(card);
  });
}

export function renderDoctor(list, doctor) {
  list.replaceChildren();
  if (!doctor) { list.append(el('li', 'mobile-hint', 'Đang kiểm tra...')); return; }
  if (doctor.error) { list.append(el('li', 'is-bad', `Không kiểm tra được: ${doctor.error}`)); return; }
  doctor.checks.forEach((c) => {
    const item = el('li', c.ok ? 'is-ok' : 'is-bad');
    item.append(el('i', `ph-bold ${c.ok ? 'ph-check-circle' : 'ph-warning-circle'}`));
    const text = el('span');
    text.append(el('strong', '', c.label), el('small', '', c.ok ? c.detail : c.hint));
    item.append(text);
    list.append(item);
  });
}

export function renderApkOptions(select, apps, selected, extLabel = '.apk') {
  select.replaceChildren();
  if (apps.length === 0) {
    const opt = el('option', '', `Chưa có file ${extLabel} trong apps/`);
    opt.value = '';
    select.append(opt);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  apps.forEach((a) => {
    const opt = el('option', '', `${a.name} · ${formatSize(a.sizeBytes)}`);
    opt.value = a.path;
    opt.selected = a.path === selected;
    select.append(opt);
  });
}

/** Package and version read by aapt2 (TECH-202); empty when build-tools are missing. */
export function renderApkMeta(node, app) {
  node.textContent = app?.packageName ? [app.packageName, app.versionName && `v${app.versionName}`, app.label].filter(Boolean).join(' · ') : '';
}

const RUN_LABEL = { running: 'Đang chạy', stopping: 'Đang dừng', passed: 'Đạt', failed: 'Lỗi', stopped: 'Đã dừng' };
const PHASE_LABEL = { starting: 'Khởi động Appium và cài app', testing: 'Đang chạy test' };

export function renderRunStatus(pill, run) {
  const status = run?.status || 'idle';
  pill.className = `mobile-pill is-${status === 'running' || status === 'stopping' ? 'running' : status}`;
  pill.textContent = run ? (RUN_LABEL[status] || status) + (status === 'running' && PHASE_LABEL[run.phase] ? ` · ${PHASE_LABEL[run.phase]}` : '') : 'Chưa chạy';
}

export function renderResults(container, run) {
  container.replaceChildren();
  if (!run?.results?.length) return;
  const passed = run.results.filter((r) => r.status === 'passed').length;
  const skipped = run.results.filter((r) => r.status === 'skipped').length;
  container.append(el('div', 'mobile-subhead', `Kết quả: ${passed}/${run.results.length} đạt${skipped ? ` · ${skipped} bỏ qua` : ''}`));
  run.results.forEach((r) => {
    const row = el('div', 'mobile-result');
    const [label, cls] = r.status === 'passed' ? ['Đạt', 'is-passed'] : r.status === 'skipped' ? ['Bỏ qua', 'is-stopped'] : ['Lỗi', 'is-failed'];
    row.append(el('span', '', r.title), el('span', `mobile-pill ${cls}`, label));
    container.append(row);
  });
}

export function renderEvidence(container, run) {
  container.replaceChildren();
  if (!run?.evidence?.length) return;
  container.append(el('div', 'mobile-subhead', 'Ảnh bằng chứng'));
  const grid = el('div', 'mobile-evidence-grid');
  run.evidence.forEach((e) => {
    const link = el('a');
    link.href = e.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.title = e.name;
    const img = el('img');
    img.src = e.url;
    img.alt = e.name;
    img.loading = 'lazy';
    link.append(img);
    grid.append(link);
  });
  container.append(grid);
}
