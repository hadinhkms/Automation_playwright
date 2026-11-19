/**
 * dashboard/public/js/views/resources/mobileRunsRender.js
 * DOM builders for the Mobile group of the Reports view. Every value goes through textContent.
 */
import { el } from '../mobile/mobileRender.js';

const STATUS = { passed: 'Đạt', failed: 'Lỗi', stopped: 'Đã dừng' };
const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' });

export function formatDate(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : dateFormat.format(new Date(t));
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} phút ${s % 60} giây` : `${s} giây`;
}

export function runTitle(run) {
  if (run.suite?.label) return run.suite.label;
  const names = (run.specs || []).map((p) => p.split('/').pop());
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ') || 'Lượt chạy app native';
}

function score(run) {
  const results = run.results || [];
  return results.length ? `${results.filter((r) => r.status === 'passed').length}/${results.length} đạt` : 'Không có kết quả';
}

export function appLabel(app) {
  if (!app) return '—';
  return app.type === 'apk' ? app.path : [app.appPackage, app.appActivity].filter(Boolean).join(' / ');
}

function pill(status) {
  return el('span', `mobile-pill is-${status}`, STATUS[status] || status);
}

function empty(title, message) {
  const box = el('div', 'mobile-empty');
  box.append(el('strong', '', title), el('p', '', message));
  return box;
}

export function renderRunList(container, runs, selectedId, error, query = '') {
  container.replaceChildren();
  if (error) { container.append(empty('Không tải được lịch sử', error)); return; }
  if (!runs) { container.append(el('p', 'mobile-hint', 'Đang tải lịch sử lượt chạy...')); return; }
  if (runs.length === 0) {
    container.append(query ? empty('Không có lượt chạy phù hợp', `Không lượt nào khớp "${query}". Thử từ khoá khác hoặc xoá ô tìm kiếm.`)
      : empty('Chưa có lượt chạy nào', 'Chạy test ở Tiện ích → Mobile App, lượt chạy sẽ xuất hiện tại đây.'));
    return;
  }
  runs.forEach((run) => {
    const item = el('button', `mobile-run-item${run.id === selectedId ? ' is-selected' : ''}`);
    item.type = 'button';
    item.dataset.runId = run.id;
    item.setAttribute('aria-pressed', String(run.id === selectedId));
    const top = el('span', 'mobile-run-top');
    top.append(el('strong', '', runTitle(run)), pill(run.status));
    const meta = [formatDate(run.startedAt), run.device?.name || run.device?.udid, score(run)].filter(Boolean).join(' · ');
    item.append(top, el('small', '', meta));
    container.append(item);
  });
}

function metaRow(list, label, value, mono = false) {
  list.append(el('dt', '', label), el('dd', mono ? 'mobile-mono' : '', value || '—'));
}

function resultsSection(run) {
  const box = el('section', 'mobile-results');
  const results = run.results || [];
  box.append(el('div', 'mobile-subhead', `Kết quả: ${score(run)}`));
  if (results.length === 0) box.append(el('p', 'mobile-hint', 'Lượt chạy dừng trước khi có kết quả test. Xem log ở Mobile App nếu lượt vừa chạy.'));
  results.forEach((r) => {
    const row = el('div', 'mobile-result');
    row.append(el('span', '', r.title), pill(r.status === 'skipped' ? 'stopped' : r.status));
    if (r.status === 'skipped') row.lastChild.textContent = 'Bỏ qua';
    box.append(row);
  });
  return box;
}

function evidenceSection(run) {
  const box = el('section', 'mobile-evidence');
  box.append(el('div', 'mobile-subhead', `Ảnh bằng chứng (${(run.evidence || []).length})`));
  if (!run.evidence?.length) { box.append(el('p', 'mobile-hint', 'Lượt chạy này không chụp ảnh nào.')); return box; }
  const grid = el('div', 'mobile-evidence-grid');
  run.evidence.forEach((e) => {
    const link = el('a');
    Object.assign(link, { href: e.url, target: '_blank', rel: 'noopener', title: e.name });
    const img = el('img');
    Object.assign(img, { src: e.url, alt: e.name, loading: 'lazy' });
    img.addEventListener('error', () => link.classList.add('is-missing'), { once: true });
    link.append(img);
    grid.append(link);
  });
  box.append(grid);
  return box;
}

export function renderRunDetail(container, run) {
  container.replaceChildren();
  if (!run) { container.append(empty('Chọn một lượt chạy', 'Kết quả, ảnh bằng chứng và file JUnit sẽ hiển thị tại đây.')); return; }
  const head = el('header', 'mobile-run-head');
  const titles = el('div', 'mobile-head-text');
  titles.append(el('span', 'pm-section-tag', `LƯỢT CHẠY APP NATIVE · ${String(run.platform || '').toUpperCase()}`), el('h2', '', runTitle(run)),
    el('small', 'mobile-hint', [formatDate(run.startedAt), formatDuration(run.durationMs)].filter(Boolean).join(' · ')));
  head.append(titles, pill(run.status));

  const meta = el('dl', 'mobile-run-meta');
  metaRow(meta, 'Thiết bị', [run.device?.name, run.device?.udid].filter(Boolean).join(' · '));
  metaRow(meta, 'App', appLabel(run.app), true);
  if (run.suite) metaRow(meta, 'Test Suite', `${run.suite.label} (${run.suite.id})`);
  metaRow(meta, 'Tag', run.grep);
  metaRow(meta, 'File test', (run.specs || []).join('\n'), true);
  metaRow(meta, 'Lệnh', run.command, true);

  const actions = el('div', 'mobile-actions');
  if (run.junit) {
    const link = el('a', 'mobile-download');
    link.append(el('i', 'ph-bold ph-download-simple'), el('span', '', `Tải JUnit (${run.junit.tests} testcase)`));
    Object.assign(link, { href: `/api/mobile/runs/${encodeURIComponent(run.id)}/junit`, download: `junit-${run.id}.xml` });
    actions.append(link);
  } else {
    actions.append(el('span', 'mobile-hint', 'Không có file JUnit cho lượt này (lượt bị dừng hoặc Appium không khởi động).'));
  }
  container.append(head, meta, resultsSection(run), evidenceSection(run), actions);
}
