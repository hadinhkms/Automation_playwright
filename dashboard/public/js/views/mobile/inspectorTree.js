/**
 * dashboard/public/js/views/mobile/inspectorTree.js
 * Inspector page source (PLAN-25 P4, TECH-403): parse the Appium XML with DOMParser, keep every attribute,
 * compute screen rectangles (Android `bounds`, iOS x/y/width/height), hit-test a click, and render the tree.
 */

const BIG_TREE = 800;

function rectOf(attrs, platform) {
  if (platform === 'ios') {
    const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => Number(attrs[k]));
    return [x, y, w, h].every(Number.isFinite) ? { x, y, w, h } : null;
  }
  const m = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(attrs.bounds || '');
  return m ? { x: +m[1], y: +m[2], w: m[3] - m[1], h: m[4] - m[2] } : null;
}

/** Flat node list in document order; `classIndex` is the 1-based position among nodes of the same class. */
export function parseSource(xml, platform) {
  const doc = new DOMParser().parseFromString(String(xml || ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return { nodes: [], error: 'Không đọc được cây phần tử (XML lỗi).' };
  const nodes = [];
  const perClass = new Map();
  const walk = (el, parent, depth) => {
    const attrs = {};
    for (const a of el.attributes) attrs[a.name] = a.value;
    const tag = attrs.class || attrs.type || el.tagName;
    perClass.set(tag, (perClass.get(tag) || 0) + 1);
    const node = { id: nodes.length, parent, depth, tag, attrs, rect: rectOf(attrs, platform), classIndex: perClass.get(tag), children: [] };
    nodes.push(node);
    if (parent !== null) nodes[parent].children.push(node.id);
    for (const child of el.children) walk(child, node.id, depth + 1);
  };
  const root = doc.documentElement;
  // Android wraps everything in <hierarchy>; iOS starts at XCUIElementTypeApplication.
  if (root.tagName === 'hierarchy') for (const child of root.children) walk(child, null, 0);
  else walk(root, null, 0);
  return { nodes, error: '' };
}

/** Smallest element whose rectangle contains the point; null when nothing is there (EDGE-402). */
export function hitTest(nodes, x, y) {
  let best = null;
  for (const n of nodes) {
    const r = n.rect;
    if (!r || r.w <= 0 || r.h <= 0 || x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) continue;
    if (!best || r.w * r.h <= best.rect.w * best.rect.h) best = n;
  }
  return best;
}

/** Attributes sent to /find: page-source attributes plus the class position used by positional locators. */
export function locatorInput(node) {
  return { ...node.attrs, class: node.attrs.class || node.tag, type: node.attrs.type || node.tag, index: node.classIndex };
}

export function shortTag(tag) {
  return String(tag).replace(/^XCUIElementType/, '').split('.').pop();
}

export function nodeLabel(node) {
  const a = node.attrs;
  const hint = [(a['resource-id'] || '').split(':id/').pop(), a.text, a['content-desc'], a.name, a.label]
    .map((v) => String(v || '').replace(/^[\s,]+/, '').trim()).find(Boolean) || '';
  return hint ? `${shortTag(node.tag)} · ${hint.length > 40 ? `${hint.slice(0, 40)}…` : hint}` : shortTag(node.tag);
}

/** Large sources start collapsed below depth 2 (EDGE-401); small ones fully open. */
export function defaultCollapsed(nodes) {
  if (nodes.length <= BIG_TREE) return new Set();
  return new Set(nodes.filter((n) => n.depth >= 2 && n.children.length).map((n) => n.id));
}

/** Opens every ancestor of `id` so the selected row is visible. */
export function revealNode(nodes, collapsed, id) {
  for (let p = nodes[id]?.parent; p !== null && p !== undefined; p = nodes[p].parent) collapsed.delete(p);
}

function matches(node, needle) {
  const a = node.attrs;
  return [a['resource-id'], a.text, a['content-desc'], a.name, a.label, node.tag].some((v) => v && String(v).toLowerCase().includes(needle));
}

/** Rows for the tree panel; with a filter the matches are listed flat. */
export function renderTree(container, nodes, { selectedId = null, collapsed = new Set(), filter = '' } = {}) {
  const frag = document.createDocumentFragment();
  const needle = filter.trim().toLowerCase();
  const visible = [];
  if (needle) nodes.forEach((n) => { if (matches(n, needle)) visible.push(n); });
  else {
    const hidden = new Set();
    nodes.forEach((n) => {
      if (n.parent !== null && (hidden.has(n.parent) || collapsed.has(n.parent))) { hidden.add(n.id); return; }
      visible.push(n);
    });
  }
  visible.slice(0, 3000).forEach((n) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `insp-node${n.id === selectedId ? ' is-selected' : ''}`;
    row.dataset.node = String(n.id);
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-selected', String(n.id === selectedId));
    row.style.setProperty('--depth', String(needle ? 0 : n.depth));
    const toggle = document.createElement('span');
    toggle.className = 'insp-toggle';
    if (n.children.length && !needle) {
      toggle.dataset.toggle = String(n.id);
      toggle.textContent = collapsed.has(n.id) ? '▸' : '▾';
      row.setAttribute('aria-expanded', String(!collapsed.has(n.id)));
    }
    const label = document.createElement('span');
    label.textContent = nodeLabel(n);
    row.append(toggle, label);
    frag.append(row);
  });
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'mobile-hint';
    empty.textContent = nodes.length ? 'Không có phần tử khớp bộ lọc.' : 'Chưa có cây phần tử.';
    frag.append(empty);
  }
  container.replaceChildren(frag);
}
