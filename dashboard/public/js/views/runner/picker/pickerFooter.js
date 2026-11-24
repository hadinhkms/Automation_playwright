/**
 * dashboard/public/js/views/runner/picker/pickerFooter.js
 * The run bar (HANDOFF 8): summary, "Xem lệnh", primary run button, inline errors.
 */
import { escapeHtml } from './pickerText.js';

export function summaryText(i) {
  const n = i.all ? `Tất cả (${i.count}) script` : `${i.count} script`;
  const hidden = i.hidden ? ` (${i.hidden} đang ẩn bởi bộ lọc)` : '';
  const parts = [`<strong>${n}</strong>${hidden}`];
  if (i.projects.length) parts.push(escapeHtml(i.projects.join(', ')));
  if (i.runs && i.projects.length) parts.push(`${i.runs} lượt chạy`);
  parts.push(escapeHtml(i.env || ''), `${i.workers} luồng`);
  if (i.tagLine) parts.push(escapeHtml(i.tagLine));
  return parts.filter(Boolean).join(' · ');
}

export function runLabel(i) {
  if (i.running) return 'Đang chạy…';
  return i.all ? `Chạy tất cả (${i.count}) script` : `Chạy ${i.count} script`;
}

export function renderFooter(i) {
  const reason = i.frozen ? 'Chạy test đang bị đóng băng (xem Cài đặt).' : (i.count === 0 ? 'Chọn ít nhất 1 script để chạy' : '');
  const big = i.count >= i.warnAt ? `<p class="sp-banner" role="status">Bạn đã chọn ${i.count} script — chạy có thể mất lâu. <button type="button" class="sp-link" data-act="focus-tree">Chọn bớt</button></p>` : '';
  const notice = i.notice ? `<p class="sp-banner" role="status">${escapeHtml(i.notice)}</p>` : '';
  const err = i.error ? `<p class="sp-error" role="alert">${escapeHtml(i.error)}</p>` : '';
  const note = i.multiDevice ? `<p class="sp-hint">${escapeHtml(i.multiDevice)} <button type="button" class="sp-link" data-act="open-projects">Chọn thêm</button></p>` : '';
  return `${big}${notice}${err}${note}<div class="sp-runbar">
    <p class="sp-summary" aria-live="polite">${summaryText(i)}</p>
    <details class="sp-cmd"><summary>Xem lệnh</summary><pre tabindex="0">${escapeHtml(i.command)}</pre><button type="button" class="sp-link" data-act="copy-cmd">Sao chép lệnh</button></details>
    <div class="sp-runrow"><button type="button" class="sp-run" id="sp-run" data-act="run"${i.canRun ? '' : ' disabled'}>${i.running ? '' : '<i class="ph-fill ph-play" aria-hidden="true"></i> '}${runLabel(i)}</button>${reason ? `<span class="sp-reason">${reason}</span>` : ''}</div></div>`;
}

/** Project row (OPEN-7): the chosen projects read-only, "Đổi" opens the chips to override. */
export function renderProjects({ chosen, options, override, open }) {
  if (!options.length) return '';
  const chips = options.map((p) => `<button type="button" class="sp-chip${chosen.includes(p) ? ' is-on' : ''}" data-project="${escapeHtml(p)}" aria-pressed="${chosen.includes(p)}">${chosen.includes(p) ? '<i class="ph-bold ph-check" aria-hidden="true"></i>' : ''}${escapeHtml(p)}</button>`).join('');
  return `<div class="sp-projects"><span class="sp-grouplabel">Project</span> ${chosen.length ? chosen.map((p) => `<span class="sp-tag">${escapeHtml(p)}</span>`).join(' ') : '<span class="sp-hint">tự chọn theo file</span>'}
    <button type="button" class="sp-link" data-act="open-projects" aria-expanded="${open}">${override ? 'Đặt lại' : 'Đổi'}</button>${open ? `<div class="sp-projlist" role="group" aria-label="Project">${chips}</div>` : ''}</div>`;
}
