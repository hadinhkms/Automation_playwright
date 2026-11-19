/**
 * dashboard/public/js/views/mobile/mobileSpecList.js
 * Frame 2 test picker: spec files with their platform scope (S-02) and the tag filter.
 */
import { el, empty } from './mobileRender.js';

/** S-02: where a spec runs. */
const SCOPE_BADGE = { shared: ['A+iOS', 'Dùng chung: chạy trên Android và iOS'], android: ['A', 'Chỉ Android'], ios: ['iOS', 'Chỉ iOS'] };

export function renderSpecs(container, specs, selected, specDir) {
  container.replaceChildren();
  if (specs.length === 0) {
    container.append(empty('Chưa có file test', `Tạo file *.native.js trong ${specDir}/ rồi bấm làm mới.`));
    return;
  }
  specs.forEach((s) => {
    const row = el('label', 'mobile-spec');
    const box = el('input');
    box.type = 'checkbox';
    box.dataset.spec = s.path;
    box.checked = selected.has(s.path);
    const text = el('span');
    text.append(el('strong', 'mobile-mono', s.name), el('small', '', `${s.tests.length} test${s.tags.length ? ' · ' + s.tags.join(' ') : ''}`));
    const scope = SCOPE_BADGE[s.scope] || SCOPE_BADGE.android;
    const badge = el('span', `mobile-scope is-${s.scope || 'android'}`, scope[0]);
    badge.title = scope[1];
    row.title = s.path;
    row.append(box, text, badge);
    container.append(row);
  });
}

export function renderTags(container, tags, active) {
  container.replaceChildren();
  if (tags.length === 0) { container.append(el('span', 'mobile-hint', 'Chưa có tag nào trong tên test.')); return; }
  tags.forEach((t) => {
    const btn = el('button', `mobile-tag${t === active ? ' is-active' : ''}`, t);
    btn.type = 'button';
    btn.dataset.tag = t;
    btn.setAttribute('aria-pressed', String(t === active));
    container.append(btn);
  });
}
