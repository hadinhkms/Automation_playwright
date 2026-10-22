'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaDocsList.js
 * Quản lý danh sách tài liệu bên trái và liên kết file trong QA Docs.
 * Line budget: <= 150 lines (role: module).
 */

export function docLink(docsSlice, relPath, label) {
  const slice = docsSlice.qaSlice;
  const td = slice._el('td');
  const btn = slice._el('button', label || relPath, 'qa-file-link qa-mono');
  btn.type = 'button';
  btn.title = `Mở ${relPath}`;
  const handler = () => docsSlice.openDocument(relPath);
  btn.addEventListener('click', handler);
  slice._renderDisposers.push(() => btn.removeEventListener('click', handler));
  td.appendChild(btn);
  return td;
}

export function docListItem(docsSlice, doc) {
  const slice = docsSlice.qaSlice;
  const active = slice.activeDocPath === doc.path;
  const btn = slice._el('div', null, `qa-doc-item dashboard-list-card${active ? ' is-active active' : ''}`);
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');
  btn.setAttribute('aria-current', active ? 'true' : 'false');

  const isReq = doc.kind === 'requirement' || (doc.path && doc.path.startsWith('requirements'));
  const iconClass = isReq ? 'ph-file-text' : 'ph-check-square-offset';
  const iconWrap = slice._el('div', null, 'qa-doc-icon dashboard-list-card__icon');
  iconWrap.appendChild(slice._el('i', null, `ph-bold ${iconClass}`));
  btn.appendChild(iconWrap);

  const body = slice._el('div', null, 'qa-doc-item-body dashboard-list-card__body');
  body.appendChild(slice._el('span', doc.name, 'qa-doc-item-name'));

  const ids = doc.ids || [];
  if (ids.length) {
    const idsWrap = slice._el('div', null, 'qa-doc-item-ids');
    const shown = ids.slice(0, 3);
    for (const id of shown) idsWrap.appendChild(slice._el('span', id, 'qa-doc-id-chip'));
    if (ids.length > 3) idsWrap.appendChild(slice._el('span', `+${ids.length - 3}`, 'qa-doc-id-chip qa-doc-id-chip--more'));
    body.appendChild(idsWrap);
  }
  btn.appendChild(body);

  const handler = () => docsSlice.openDocument(doc.path);
  btn.addEventListener('click', handler);
  slice._renderDisposers.push(() => btn.removeEventListener('click', handler));
  return btn;
}

export function renderDocList(docsSlice, root) {
  const slice = docsSlice.qaSlice;
  const r = root || slice._root();
  const list = r && r.querySelector('#qa-docs-list');
  const empty = r && r.querySelector('#qa-docs-list-empty');
  if (!list || !empty) return;
  list.textContent = '';

  const needle = (slice.docFilter || '').trim().toLowerCase();
  const matches = (slice.documents || []).filter((d) => !needle
    || d.path.toLowerCase().includes(needle)
    || (d.ids || []).some((id) => id.toLowerCase().includes(needle)));

  empty.hidden = matches.length > 0;
  const countEl = r && r.querySelector('#qa-docs-count');
  if (countEl) countEl.textContent = String(matches.length);

  const GROUPS = [
    { kind: 'requirement', label: 'Requirement' },
    { kind: 'test-case', label: 'Test case' },
  ];
  for (const group of GROUPS) {
    const items = matches.filter((d) => d.kind === group.kind);
    if (!items.length) continue;
    list.appendChild(slice._el('p', `${group.label} (${items.length})`, 'qa-docs-group'));
    for (const doc of items) list.appendChild(docListItem(docsSlice, doc));
  }
}
