/**
 * dashboard/public/js/views/runner/picker/pickerTree.js
 * HTML of the ARIA tree (HANDOFF 5): role="tree", 2 levels, aria-checked true|false|mixed, roving tabindex.
 * Every dynamic string goes through escapeHtml / highlight.
 */
import { escapeHtml, highlight, keywords } from './pickerText.js';
import { groupCheck } from './pickerState.js';

const BOX_ICON = { true: 'ph-check', mixed: 'ph-minus', false: '' };

const box = (check, act) => `<span class="sp-box" role="presentation" data-act="${act}" data-state="${check}">${BOX_ICON[check] ? `<i class="ph-bold ${BOX_ICON[check]}"></i>` : ''}</span>`;

function tagChips(tags, kws) {
  const shown = tags.slice(0, 3).map((t) => `<span class="sp-tag">${highlight(t, kws)}</span>`).join('');
  return `${shown}${tags.length > 3 ? `<span class="sp-tag sp-tag-more">+${tags.length - 3}</span>` : ''}`;
}

const badge = (st) => `<span class="sp-hist sp-hist-${st.kind}"><i class="ph-bold ${st.icon}" aria-hidden="true"></i> ${escapeHtml(st.text)}</span>`;

function fileRow(file, i, total, state, kws, focusKey, statusFor) {
  const on = state.selected.has(file.path);
  const st = statusFor(file.path);
  const label = `${file.path}, ${i + 1} trong ${total}, ${on ? 'đã chọn' : 'chưa chọn'}${st.kind === 'none' ? '' : `, ${st.text}`}`;
  return `<li role="treeitem" class="sp-file${on ? ' is-on' : ''}" data-path="${escapeHtml(file.path)}" data-key="f:${escapeHtml(file.path)}" aria-level="2" aria-checked="${on}" aria-label="${escapeHtml(label)}" tabindex="${focusKey === `f:${file.path}` ? 0 : -1}">
    <div class="sp-row" data-act="file">${box(String(on), 'file')}<span class="sp-fname" title="${escapeHtml(file.path)}">${highlight(file.name, kws)}</span><span class="sp-tags">${tagChips(file.tags, kws)}</span>${badge(st)}</div></li>`;
}

function groupRow(group, visible, state, kws, focusKey, statusFor) {
  const check = groupCheck(state, visible);
  const open = !state.collapsed.has(group.key) || kws.length > 0 || state.platforms.size > 0 || state.tags.size > 0;
  const done = visible.filter((f) => state.selected.has(f.path)).length;
  const count = visible.length === group.files.length ? `${done} / ${visible.length} đã chọn` : `${done} / ${visible.length} đang hiện`;
  const label = `${group.label}, ${open ? 'đã mở' : 'đã đóng'}, ${check === 'mixed' ? `chọn một phần, ${done} trên ${visible.length}` : (check === 'true' ? 'đã chọn' : 'chưa chọn')}`;
  return `<li role="treeitem" class="sp-group" data-group="${escapeHtml(group.key)}" data-key="g:${escapeHtml(group.key)}" aria-level="1" aria-expanded="${open}" aria-checked="${check}" aria-label="${escapeHtml(label)}" tabindex="${focusKey === `g:${group.key}` ? 0 : -1}">
    <div class="sp-row sp-grow"><i class="ph-bold ph-caret-right sp-arrow" data-act="expand" aria-hidden="true"></i>${box(check, 'group')}<span class="sp-gname" data-act="expand">${highlight(group.label, kws)}</span><span class="sp-count">${count}</span></div>
    <ul role="group"${open ? '' : ' hidden'}>${visible.map((f, i) => fileRow(f, i, visible.length, state, kws, focusKey, statusFor)).join('')}</ul></li>`;
}

/** `visibleByGroup`: Map(groupKey -> visible files). Groups with no visible file are not rendered. */
export function renderTree(catalog, visibleByGroup, state, focusKey, statusFor = () => ({ kind: 'none', icon: 'ph-circle-dashed', text: 'Chưa chạy' })) {
  const kws = keywords(state.query);
  const rows = catalog.groups.filter((g) => (visibleByGroup.get(g.key) || []).length).map((g) => groupRow(g, visibleByGroup.get(g.key), state, kws, focusKey, statusFor));
  return `<ul role="tree" class="sp-tree" aria-multiselectable="true" aria-label="Script test">${rows.join('')}</ul>`;
}

/** First focusable key when none is remembered. */
export function firstKey(catalog, visibleByGroup) {
  const g = catalog.groups.find((x) => (visibleByGroup.get(x.key) || []).length);
  return g ? `g:${g.key}` : '';
}
