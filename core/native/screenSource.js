'use strict';

/**
 * Source code of a shared native Screen (PLAN-25 P4, UX §4.3 / I-02): render a new `*Screen.js`, read its
 * `static locators`, and write one platform's cell back without touching the other platform.
 * Only the one-line-per-locator layout below is rewritten; anything else is refused so hand-written code is never lost.
 */

const { toSelector } = require('./locators');

const NAME = /^[a-z][A-Za-z0-9]{0,39}$/;
const STR = "'(?:[^'\\\\]|\\\\.)*'";
const ENTRY = new RegExp(`^\\s*([a-z][A-Za-z0-9]{0,39})\\s*:\\s*\\{\\s*android\\s*:\\s*(null|${STR})\\s*,\\s*ios\\s*:\\s*(null|${STR})\\s*\\}\\s*,?\\s*(?://.*)?$`);
const BLOCK = /( *)static locators = \{([\s\S]*?)\n?\s*\};/;
const ACTIONS = ['tap', 'type', 'read', 'visible'];

function lit(value) {
  return value ? `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'` : 'null';
}

function unlit(token) {
  return token === 'null' ? null : token.slice(1, -1).replace(/\\(.)/g, '$1');
}

function cap(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function entryLine(name, entry, indent = '    ') {
  return `${indent}${name}: { android: ${lit(entry.android)}, ios: ${lit(entry.ios)} },`;
}

/** Validates picked elements for `platform`; throws with a user-facing message. */
function validateElements(elements, platform) {
  if (!Array.isArray(elements) || elements.length === 0 || elements.length > 40) throw new Error('Chọn từ 1 đến 40 phần tử.');
  const seen = new Set();
  return elements.map((e) => {
    const name = String(e?.name || '');
    const locator = String(e?.locator || '').trim();
    if (!NAME.test(name)) throw new Error(`Tên "${name}" phải là camelCase, bắt đầu bằng chữ thường, tối đa 40 ký tự.`);
    if (seen.has(name)) throw new Error(`Tên "${name}" bị trùng.`);
    seen.add(name);
    if (locator.length > 300 || /[\r\n]/.test(locator)) throw new Error(`Locator của "${name}" quá dài hoặc có xuống dòng.`);
    toSelector(locator, platform);
    return { name, locator, action: ACTIONS.includes(e.action) ? e.action : 'read' };
  });
}

function methodFor(e) {
  if (e.action === 'tap') return `  async tap${cap(e.name)}() {\n    await this.tap(this.el('${e.name}'));\n  }`;
  if (e.action === 'type') return `  async fill${cap(e.name)}(value) {\n    await this.type(this.el('${e.name}'), value);\n  }`;
  if (e.action === 'visible') return `  async is${cap(e.name)}Visible(timeout = 5000) {\n    return this.isVisible(this.el('${e.name}'), timeout);\n  }`;
  return `  async ${e.name}Text() {\n    return this.el('${e.name}').getText();\n  }`;
}

/** New Screen file following UX §4.3; the other platform's cells stay null until captured there. */
function renderScreen(className, platform, elements) {
  const screenKey = className.replace(/Screen$/, '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  const lines = elements.map((e) => entryLine(e.name, { android: platform === 'android' ? e.locator : null, ios: platform === 'ios' ? e.locator : null }));
  return [
    "'use strict';", '',
    "const { NativeBasePage } = require('../NativeBasePage');", '',
    '/** Shared Android/iOS screen. A null locator has not been captured on that platform yet. */',
    `class ${className} extends NativeBasePage {`,
    '  static locators = {', ...lines, '  };', '',
    '  constructor() {', `    super('${screenKey}');`, '  }', '',
    '  /** Waits until the screen is drawn (first element with a visibility check, else the first one). */',
    '  async waitUntilLoaded(timeout = 30000) {',
    `    await this.el('${(elements.find((e) => e.action === 'visible') || elements[0]).name}').waitForDisplayed({ timeout });`, '  }', '',
    elements.map(methodFor).join('\n\n'),
    '}', '', `module.exports = { ${className} };`, '',
  ].join('\n');
}

/** `{ entries, editable }` from a Screen's source; editable=false when the block is not in the one-line layout. */
function readLocators(source) {
  const match = BLOCK.exec(String(source || ''));
  if (!match) return { entries: {}, editable: false };
  const entries = {};
  let editable = true;
  match[2].split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//')).forEach((line) => {
    const m = ENTRY.exec(line);
    if (!m) { editable = false; return; }
    entries[m[1]] = { android: unlit(m[2]), ios: unlit(m[3]) };
  });
  return { entries, editable };
}

/** Writes `platform` cells of `elements` into the Screen (I-02); returns the new source and what changed. */
function mergeLocators(source, platform, elements) {
  const { entries, editable } = readLocators(source);
  if (!editable) throw new Error('Screen này không viết theo mẫu "tên: { android: …, ios: … }" mỗi dòng một locator. Hãy sửa tay trong editor.');
  const added = [];
  const updated = [];
  elements.forEach((e) => {
    if (!entries[e.name]) { entries[e.name] = { android: null, ios: null }; added.push(e.name); } else if (entries[e.name][platform] !== e.locator) updated.push(e.name);
    entries[e.name][platform] = e.locator;
  });
  const next = String(source).replace(BLOCK, (all, indent) => {
    const inner = `${indent}  `;
    const body = Object.entries(entries).map(([n, v]) => entryLine(n, v, inner)).join('\n');
    return `${indent}static locators = {\n${body}\n${indent}};`;
  });
  return { source: next, added, updated };
}

/** Names whose `platform` cell is still empty (the "thiếu locator iOS" warning). */
function missingFor(entries, platform) {
  return Object.entries(entries || {}).filter(([, v]) => !v?.[platform]).map(([n]) => n);
}

module.exports = { validateElements, renderScreen, readLocators, mergeLocators, missingFor, ACTIONS };
