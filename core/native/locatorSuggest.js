'use strict';

/**
 * Locator suggestions for one element picked in the native Inspector (PLAN-25 P4, BR-402).
 * Input: the element's page-source attributes (+ `index`, 1-based position among nodes of the same class).
 * Output: prefixed locators (core/native/locators.js) in priority order: id / accessibility id →
 * UiSelector (Android) or predicate / class chain (iOS) → text → relative XPath, which always comes last.
 */

const LONG_TEXT = 60;

function quote(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function jsString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** XPath string literal; null when the text holds both quote kinds (XPath 1.0 cannot escape them). */
function xpathLiteral(value) {
  if (!String(value).includes('"')) return `"${value}"`;
  if (!String(value).includes("'")) return `'${value}'`;
  return null;
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function relativeXpath(type, attr, value, index) {
  const literal = value ? xpathLiteral(value) : null;
  if (literal) return `//${type}[@${attr}=${literal}]`;
  return `(//${type})[${Math.max(1, Number(index) || 1)}]`;
}

function androidSuggestions(a) {
  const id = clean(a['resource-id']);
  const desc = clean(a['content-desc']);
  const text = clean(a.text);
  const cls = clean(a.class) || 'android.view.View';
  const list = [];
  if (id) list.push({ kind: 'id', locator: `id:${id}`, code: `this.byId(${jsString(id)})` });
  // A long description is usually data (job title, price…): it changes, so it is not offered as an exact id.
  if (desc && desc.length <= LONG_TEXT) list.push({ kind: 'accessibility', locator: `~${desc}`, code: `this.byAccessibilityId(${jsString(desc)})` });
  let uia = `new UiSelector().className("${quote(cls)}")`;
  if (text && text.length > LONG_TEXT) uia += `.textStartsWith("${quote(text.slice(0, 40))}")`;
  else if (text) uia += `.text("${quote(text)}")`;
  else if (desc && desc.length > LONG_TEXT) uia += `.descriptionStartsWith("${quote(desc.slice(0, 40))}")`;
  else if (desc) uia += `.description("${quote(desc)}")`;
  else uia += `.instance(${Math.max(0, (Number(a.index) || 1) - 1)})`;
  list.push({ kind: 'uiautomator', locator: `uia:${uia}`, code: `$('android=${uia.replace(/'/g, "\\'")}')` });
  if (text && text.length <= LONG_TEXT) list.push({ kind: 'text', locator: `text:${text}`, code: `this.byText(${jsString(text)})` });
  const value = text || desc;
  const xpath = relativeXpath(cls, text ? 'text' : 'content-desc', value.length <= LONG_TEXT ? value : '', a.index);
  list.push({ kind: 'xpath', locator: `xpath:${xpath}`, code: `$(${jsString(xpath)})` });
  return list;
}

function iosSuggestions(a) {
  const name = clean(a.name);
  const label = clean(a.label);
  const type = clean(a.type) || 'XCUIElementTypeOther';
  const list = [];
  if (name) list.push({ kind: 'accessibility', locator: `~${name}`, code: `this.byAccessibilityId(${jsString(name)})` });
  const pred = label ? `type == "${type}" AND label == "${quote(label)}"` : `type == "${type}"`;
  list.push({ kind: 'predicate', locator: `pred:${pred}`, code: `$('-ios predicate string:${pred.replace(/'/g, "\\'")}')` });
  const chain = label ? `**/${type}[\`label == "${quote(label)}"\`]` : `**/${type}[${Math.max(1, Number(a.index) || 1)}]`;
  list.push({ kind: 'classChain', locator: `chain:${chain}`, code: `$('-ios class chain:${chain.replace(/'/g, "\\'")}')` });
  if (label && label.length <= LONG_TEXT) list.push({ kind: 'text', locator: `text:${label}`, code: `this.byText(${jsString(label)})` });
  const xpath = relativeXpath(type, 'label', label, a.index);
  list.push({ kind: 'xpath', locator: `xpath:${xpath}`, code: `$(${jsString(xpath)})` });
  return list;
}

/** Ranked suggestions; the caller adds `count` from the device. */
function suggestLocators(attrs, platform) {
  const a = attrs && typeof attrs === 'object' ? attrs : {};
  return platform === 'ios' ? iosSuggestions(a) : androidSuggestions(a);
}

/** camelCase name for `static locators`, ASCII only, from id → accessibility id → text → class. */
function suggestName(attrs, platform) {
  const a = attrs || {};
  const id = clean(a['resource-id']).split(':id/').pop();
  const raw = platform === 'ios'
    ? clean(a.name) || clean(a.label) || clean(a.type).replace(/^XCUIElementType/, '')
    : id || clean(a['content-desc']) || clean(a.text) || clean(a.class).split('.').pop();
  const words = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .split(/[^A-Za-z0-9]+/).filter(Boolean).slice(0, 5);
  const name = words.map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() : w.charAt(0).toUpperCase()) + w.slice(1)).join('');
  if (!name) return 'element';
  return (/^[A-Za-z]/.test(name) ? name : `el${name}`).slice(0, 40);
}

module.exports = { suggestLocators, suggestName, LONG_TEXT };
