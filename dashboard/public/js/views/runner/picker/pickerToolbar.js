/**
 * dashboard/public/js/views/runner/picker/pickerToolbar.js
 * HTML above the tree: quick suite chips, search box, filter chips, result line (HANDOFF 3, 4, 6).
 * History chips ("Fail lần trước", "Chạy gần đây") and "Lưu thành suite" belong to later phases: not rendered.
 */
import { escapeHtml } from './pickerText.js';

const chip = (attrs, label, on) => `<button type="button" class="sp-chip${on ? ' is-on' : ''}" ${attrs} aria-pressed="${Boolean(on)}">${on ? '<i class="ph-bold ph-check" aria-hidden="true"></i>' : ''}${label}</button>`;

/** Single suites with an explicit file list; composite (parent) suites are not chips in phase 1. */
export function quickSuites(suites = {}) {
  return Object.entries(suites).filter(([, s]) => s && s.type !== 'composite' && Array.isArray(s.specs) && s.specs.length).map(([key, s]) => ({ key, label: s.label || key, specs: s.specs }));
}

function suiteRow(list, catalog) {
  if (!list.length) return '';
  const one = (s) => `<button type="button" class="sp-chip sp-chip-quick" data-suite="${escapeHtml(s.key)}"><i class="ph-bold ph-stack" aria-hidden="true"></i>Suite: ${escapeHtml(s.label)} (${s.specs.filter((p) => catalog.byPath.has(p)).length})</button>`;
  const more = list.length > 3 ? `<details class="sp-more"><summary>Thêm suite</summary>${list.slice(3).map(one).join('')}</details>` : '';
  return `<div class="sp-quick" role="group" aria-label="Chọn nhanh"><span class="sp-grouplabel">Chọn nhanh</span>${list.slice(0, 3).map(one).join('')}${more}</div>`;
}

/** Result line + select-all + clear: re-rendered on every keystroke without touching the search input. */
export function renderResultsLine({ state, found, activeFilters }) {
  const allOn = found.length > 0 && found.every((f) => state.selected.has(f.path));
  return `<span id="sp-count" role="status" aria-live="polite">${found.length ? `Tìm thấy ${found.length} script` : 'Không có script nào khớp'}</span>
    ${found.length ? `<button type="button" class="sp-link" data-act="select-found">${allOn ? `Bỏ chọn kết quả (${found.length})` : `Chọn tất cả (${found.length})`}</button>` : ''}
    ${activeFilters || state.query ? '<button type="button" class="sp-link" data-act="clear-filters">Xóa bộ lọc</button>' : ''}`;
}

export function renderToolbar({ catalog, state, suites, found, filtersOpen, activeFilters }) {
  const plat = catalog.platforms.map((p) => chip(`data-platform="${escapeHtml(p.label)}"`, `${escapeHtml(p.label)} ${p.count}`, state.platforms.has(p.label))).join('');
  const tags = catalog.tags.map((t) => chip(`data-tag="${escapeHtml(t.tag)}"`, `${escapeHtml(t.tag)} ${t.count}`, state.tags.has(t.tag))).join('');
  const tagOnly = state.tags.size ? `<label class="sp-switch"><input type="checkbox" id="sp-tagonly"${state.tagOnly ? ' checked' : ''}> Chỉ chạy test mang tag đã chọn</label>
    <p class="sp-hint">${state.tagOnly ? `Chỉ test mang ${escapeHtml([...state.tags].join(' | '))}.` : 'Sẽ chạy toàn bộ test trong mỗi file, kể cả test không mang tag.'}</p>` : '';
  return `${suiteRow(quickSuites(suites), catalog)}
  <div class="sp-search"><label for="sp-search">Tìm script</label><div class="sp-searchbox"><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i>
    <input id="sp-search" type="search" autocomplete="off" placeholder="Tên file, @tag hoặc mã REQ-001…" value="${escapeHtml(state.query)}" aria-controls="sp-tree-wrap">
    <button type="button" class="sp-clear" data-act="clear-query" aria-label="Xóa từ khóa tìm"${state.query ? '' : ' hidden'}><i class="ph-bold ph-x" aria-hidden="true"></i></button></div></div>
  <details class="sp-filters" id="sp-filters"${filtersOpen ? ' open' : ''}><summary>Bộ lọc${activeFilters ? ` (${activeFilters})` : ''}</summary>
    <div class="sp-filtergroup" role="group" aria-label="Nền tảng"><span class="sp-grouplabel">Nền tảng</span>${plat}<p class="sp-hint">Khớp bất kỳ nền tảng nào đã chọn.</p></div>
    ${catalog.tags.length ? `<div class="sp-filtergroup" role="group" aria-label="Tag"><span class="sp-grouplabel">Tag</span>${tags}<p class="sp-hint">Khớp bất kỳ tag nào đã chọn.</p>${tagOnly}</div>` : ''}
  </details>
  <div class="sp-results" id="sp-results">${renderResultsLine({ state, found, activeFilters })}</div>`;
}
