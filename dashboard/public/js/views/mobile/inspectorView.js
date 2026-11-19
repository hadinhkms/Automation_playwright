/**
 * dashboard/public/js/views/mobile/inspectorView.js
 * Paints the Inspector from its state: session status, screenshot with the selected element boxed,
 * attributes, and locator suggestions with match counts (PLAN-25 P4, AC-402).
 */

const $ = (id) => document.getElementById(id);

const STATUS = {
  idle: ['Chưa mở', 'is-idle'], starting: ['Đang mở…', 'is-running'], ready: ['Đang mở', 'is-passed'],
  busy: ['Đang chạy lệnh', 'is-running'], closed: ['Đã đóng', 'is-stopped'],
};
const KIND_LABEL = {
  id: 'resource-id', accessibility: 'Accessibility id', uiautomator: 'UiSelector', predicate: 'iOS predicate',
  classChain: 'iOS class chain', text: 'Text', xpath: 'XPath tương đối',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Device units → displayed pixels. Android bounds are pixels; iOS uses points, so the window size decides. */
export function displayScale(img, snapshot) {
  const deviceWidth = snapshot?.window?.width || img.naturalWidth || 1;
  return img.clientWidth / deviceWidth;
}

export function renderStatus(s) {
  const [label, cls] = STATUS[s.status] || STATUS.idle;
  const pill = $('insp-status');
  pill.textContent = label;
  pill.className = `mobile-pill ${cls}`;
  const open = s.status === 'ready' || s.status === 'busy';
  $('insp-start-btn').disabled = s.status !== 'idle' && s.status !== 'closed' ? true : Boolean(s.blocker);
  $('insp-stop-btn').disabled = !(open || s.status === 'starting');
  const node = s.selected !== null ? s.nodes[s.selected] : null;
  const canAct = s.status === 'ready';
  $('insp-refresh-btn').disabled = !canAct;
  $('insp-back-btn').disabled = !canAct || s.platform !== 'android';
  $('insp-tap-btn').disabled = !canAct || !node?.rect;
  $('insp-type-input').disabled = !canAct || !s.locator;
  $('insp-type-btn').disabled = !canAct || !s.locator;
  $('insp-target').textContent = s.target || '–';
  $('insp-hint').textContent = s.message || (s.status === 'idle' || s.status === 'closed' ? s.blocker : '');
  $('insp-expiry').textContent = open && s.expiresAt
    ? `Tự đóng lúc ${new Date(s.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} nếu không thao tác.`
    : '';
}

export function renderStage(s) {
  const img = $('insp-shot');
  const box = $('insp-box');
  const has = Boolean(s.snapshot?.screenshot);
  img.hidden = !has;
  $('insp-stage-empty').hidden = has;
  $('insp-stage').classList.toggle('is-loading', s.status === 'busy' || s.status === 'starting');
  const node = s.selected !== null ? s.nodes[s.selected] : null;
  if (!has || !node?.rect || !img.complete || !img.clientWidth) { box.hidden = true; return; }
  const k = displayScale(img, s.snapshot);
  Object.assign(box.style, { left: `${node.rect.x * k}px`, top: `${node.rect.y * k}px`, width: `${node.rect.w * k}px`, height: `${node.rect.h * k}px` });
  box.hidden = false;
}

export function renderProps(s) {
  const list = $('insp-props');
  list.replaceChildren();
  const node = s.selected !== null ? s.nodes[s.selected] : null;
  if (!node) { list.append(el('p', 'mobile-hint', 'Bấm lên ảnh hoặc một dòng trong cây để xem thuộc tính.')); return; }
  Object.entries(node.attrs).forEach(([k, v]) => {
    if (v === '' || v === undefined) return;
    list.append(el('dt', '', k), el('dd', 'mobile-mono', v));
  });
}

function countPill(count) {
  if (count === null || count === undefined) return el('span', 'mobile-pill is-warn', 'Không đếm được');
  if (count === 1) return el('span', 'mobile-pill is-passed', '1 khớp');
  return el('span', `mobile-pill ${count === 0 ? 'is-failed' : 'is-warn'}`, `${count} khớp`);
}

export function renderSuggestions(s) {
  const box = $('insp-suggest');
  box.replaceChildren();
  $('insp-add').hidden = !s.suggestions?.length;
  if (s.selected === null) { box.append(el('p', 'mobile-hint', 'Chọn một phần tử để xem gợi ý locator.')); return; }
  if (!s.suggestions) { box.append(el('p', 'mobile-hint', 'Đang đếm số phần tử khớp…')); return; }
  const unique = s.suggestions.filter((g) => g.count === 1);
  if (unique.length === 1 && unique[0].kind === 'xpath') box.append(el('p', 'insp-warn', 'Chỉ có XPath khớp đúng 1 phần tử. XPath dễ gãy khi giao diện đổi, nên nhờ dev thêm resource-id / accessibility id.'));
  if (!unique.length) box.append(el('p', 'insp-warn', 'Chưa có locator nào khớp đúng 1 phần tử.'));
  s.suggestions.forEach((g, i) => {
    const row = el('label', `insp-sugg${g.locator === s.locator ? ' is-chosen' : ''}`);
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'insp-locator';
    radio.value = String(i);
    radio.checked = g.locator === s.locator;
    const body = el('span', 'insp-sugg-body');
    const head = el('span', 'insp-sugg-head');
    head.append(el('strong', '', KIND_LABEL[g.kind] || g.kind), countPill(g.count));
    body.append(head, el('code', 'mobile-mono', g.locator), el('small', 'mobile-mono', g.code));
    const copy = el('button', 'btn-icon-subtle');
    copy.type = 'button';
    copy.dataset.copy = g.locator;
    copy.title = 'Sao chép locator';
    copy.setAttribute('aria-label', `Sao chép locator ${KIND_LABEL[g.kind] || g.kind}`);
    copy.append(el('i', 'ph-bold ph-copy'));
    row.append(radio, body, copy);
    box.append(row);
  });
}

export function renderInspector(s) {
  renderStatus(s);
  renderStage(s);
  renderProps(s);
  renderSuggestions(s);
  $('insp-count').textContent = s.nodes.length ? `${s.nodes.length} phần tử` : '';
}
