/**
 * dashboard/public/js/views/qa/batch/batchPreviewRender.js
 * Dựng nội dung modal xem trước (PLAN-18 mục 6.3): danh sách mục bị bỏ qua kèm hành động kế
 * tiếp, thẻ file có checkbox tri-state, bản vá gộp theo hunk, lựa chọn xử lý test bị skip.
 * Hàm thuần DOM: nhận dữ liệu + trạng thái tick, không gắn listener.
 */

import { renderHunk } from './batchDiffView.js';

const KIND_LABEL = {
  'assertion-thieu-await': 'Thiếu await',
  'test-bi-skip-am-tham': 'Test bị skip',
  'test-thieu-tag-req': 'Thiếu tag REQ',
  'test-khong-co-ma-tc': 'Thiếu mã TC',
};
const NEXT_LABEL = {
  scaffold: 'Tạo requirement',
  autofix: 'Chuẩn hoá traceability',
  openDoc: 'Mở tài liệu',
  detail: 'Chi tiết',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Bản vá cùng file có hunk y hệt (vd. nhiều test cùng describe thiếu tag) gộp thành một dòng. */
function groupPatches(patches) {
  const groups = new Map();
  patches.forEach((patch) => {
    const id = JSON.stringify(patch.hunk);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(patch);
  });
  return [...groups.values()];
}

export function renderSkippedItems(list, skipped) {
  list.textContent = '';
  skipped.forEach((item) => {
    const li = el('li', 'qa-batch-skipped-item');
    li.append(el('span', 'qa-gap-location', item.where || item.findingKey), el('span', 'qa-batch-skipped-reason', item.reason));
    if (item.nextAction && item.kind) {
      const btn = el('button', 'qa-gap-action', NEXT_LABEL[item.nextAction.type] || NEXT_LABEL.detail);
      btn.type = 'button';
      btn.dataset.batchNext = item.nextAction.type;
      btn.dataset.findingKey = item.findingKey;
      if (item.nextAction.target) btn.dataset.target = item.nextAction.target;
      li.append(btn);
    }
    list.append(li);
  });
}

function renderSkipChoice(patch) {
  const wrap = el('div', 'qa-batch-choice');
  wrap.setAttribute('role', 'radiogroup');
  wrap.setAttribute('aria-label', 'Cách xử lý test bị skip');
  [['wip', 'Cách ly bằng @wip'], ['unskip', 'Kích hoạt lại']].forEach(([mode, text]) => {
    const opt = el('label', 'qa-batch-choice-opt');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = `qa-skip-${patch.findingKey}`;
    radio.value = mode;
    radio.dataset.skipKey = patch.findingKey;
    radio.checked = (patch.choice && patch.choice.skipMode) === mode;
    opt.append(radio, el('span', null, text));
    wrap.append(opt);
  });
  return wrap;
}

function renderGroup(group, ticked) {
  const first = group[0];
  const item = el('div', 'qa-batch-patch');
  const label = el('label', 'qa-batch-patch-head');
  const box = el('input');
  box.type = 'checkbox';
  box.dataset.patchKeys = group.map((p) => p.findingKey).join(',');
  box.checked = group.every((p) => ticked.has(p.findingKey));
  const lines = group.map((p) => p.line).join(', ');
  const kind = KIND_LABEL[first.kind] || first.kind;
  label.append(box, el('span', null, group.length > 1
    ? `${kind} · áp dụng cho ${group.length} lỗi (dòng ${lines})`
    : `${kind} · dòng ${lines}`));
  if (first.risk === 'behavior') label.append(el('span', 'qa-badge qa-badge-warn', 'Đổi hành vi'));
  item.append(label);
  if (group.length === 1 && first.kind === 'test-bi-skip-am-tham') item.append(renderSkipChoice(first));
  item.append(renderHunk(first.hunk));
  return item;
}

/** Thẻ một file: checkbox tri-state + nút thu gọn (aria-expanded) + các bản vá. */
export function renderPlanCard(card, { ticked, expanded }) {
  const keys = card.patches.map((p) => p.findingKey);
  const picked = keys.filter((k) => ticked.has(k)).length;
  const wrap = el('section', 'qa-batch-card');
  const head = el('div', 'qa-batch-card-head');
  const fileBox = el('input');
  fileBox.type = 'checkbox';
  fileBox.dataset.batchFile = card.relPath;
  fileBox.checked = picked === keys.length;
  fileBox.indeterminate = picked > 0 && picked < keys.length;
  fileBox.setAttribute('aria-label', `Chọn mọi bản vá trong ${card.relPath}`);
  const toggle = el('button', 'qa-batch-card-toggle');
  toggle.type = 'button';
  toggle.dataset.cardToggle = card.relPath;
  toggle.setAttribute('aria-expanded', String(expanded));
  const caret = el('i', `ph-bold ${expanded ? 'ph-caret-down' : 'ph-caret-right'}`);
  caret.setAttribute('aria-hidden', 'true');
  toggle.append(caret, el('span', 'qa-batch-card-file', card.relPath), el('span', 'qa-batch-card-meta', `${picked}/${keys.length} bản vá`));
  head.append(fileBox, toggle);
  const body = el('div', 'qa-batch-card-body');
  body.hidden = !expanded;
  groupPatches(card.patches).forEach((group) => body.append(renderGroup(group, ticked)));
  wrap.append(head, body);
  return wrap;
}
