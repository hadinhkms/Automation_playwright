/**
 * dashboard/services/nativePageObjectGenerator.js
 * Inspector → shared native Screen (PLAN-25 P4, BR-401/402, I-02): preview, draft under
 * .dashboard-drafts/pages/native/screens/, and create in pages/native/screens/ only when the user confirms.
 * An existing Screen is never replaced: its `static locators` gets the current platform's cells (merge).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { validateElements, renderScreen, readLocators, mergeLocators, missingFor } = require('../../core/native/screenSource');

const SCREEN_DIR = path.join('pages', 'native', 'screens');
const DRAFT_DIR = path.join('.dashboard-drafts', 'pages', 'native', 'screens');
const CLASS_PATTERN = /^[A-Z][A-Za-z0-9]{0,48}Screen$/;
const MAX_SOURCE = 200 * 1024;

function fail(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

/** "đăng nhập" / "login" / "LoginScreen" → "LoginScreen". */
function toClassName(raw) {
  const words = String(raw || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .split(/[^A-Za-z0-9]+/).filter(Boolean);
  const base = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('').replace(/Screen$/, '');
  const name = `${base}Screen`;
  if (!CLASS_PATTERN.test(name) || base.length === 0) throw fail(400, 'Tên Screen phải bắt đầu bằng chữ cái Latin (ví dụ: Login, JobList).');
  return name;
}

const rel = (...parts) => path.join(...parts).replace(/\\/g, '/');

/** Hand-edited source from the shared editor must still be a loadable Screen of that class. */
function checkSource(source, className) {
  if (typeof source !== 'string' || !source.trim() || source.length > MAX_SOURCE) throw fail(400, 'Mã nguồn Screen trống hoặc quá lớn.');
  try { new vm.Script(source, { filename: `${className}.js` }); } catch (err) { throw fail(400, `Mã nguồn có lỗi cú pháp: ${err.message}`); }
  if (!new RegExp(`class\\s+${className}\\s+extends\\s+NativeBasePage\\b`).test(source) || !/module\.exports/.test(source)) {
    throw fail(400, `Mã nguồn phải khai báo "class ${className} extends NativeBasePage" và module.exports.`);
  }
  return source;
}

/** Builds the Screen source for a request; nothing is written. */
function buildScreen(root, body = {}) {
  const platform = body.platform === 'ios' ? 'ios' : 'android';
  const className = toClassName(body.name);
  const file = path.join(root, SCREEN_DIR, `${className}.js`);
  const exists = fs.existsSync(file);
  let elements;
  try { elements = validateElements(body.elements, platform); } catch (err) { throw fail(400, err.message); }
  let source;
  let changes = { added: elements.map((e) => e.name), updated: [] };
  if (exists && body.merge === true) {
    try { ({ source, ...changes } = mergeLocators(fs.readFileSync(file, 'utf8'), platform, elements)); } catch (err) { throw fail(400, err.message); }
  } else {
    source = renderScreen(className, platform, elements);
  }
  const missing = missingFor(readLocators(source).entries, platform === 'android' ? 'ios' : 'android');
  return { className, platform, path: rel(SCREEN_DIR, `${className}.js`), exists, merge: exists && body.merge === true, source, ...changes, missing };
}

/** mode: preview (200) · draft (200, .dashboard-drafts only) · create (201, pages/native/screens). */
function handlePageObject(root, body = {}) {
  const mode = body.mode || 'preview';
  if (!['preview', 'draft', 'create'].includes(mode)) throw fail(400, 'mode phải là preview, draft hoặc create.');
  const screen = buildScreen(root, body);
  if (body.source !== undefined) screen.source = checkSource(body.source, screen.className);
  if (mode === 'preview') return { status: 200, body: screen };

  const draftFile = path.join(root, DRAFT_DIR, `${screen.className}.js`);
  if (mode === 'draft') {
    fs.mkdirSync(path.dirname(draftFile), { recursive: true });
    fs.writeFileSync(draftFile, screen.source, 'utf8');
    return { status: 200, body: { ...screen, draft: rel(DRAFT_DIR, `${screen.className}.js`) } };
  }
  // EDGE-404: never overwrite an existing Screen unless the user chose to add locators into it.
  if (screen.exists && !screen.merge) throw fail(409, `${screen.path} đã có. Chọn "Thêm vào Screen có sẵn" hoặc đặt tên khác.`, { exists: true });
  checkSource(screen.source, screen.className);
  const target = path.join(root, screen.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, screen.source, 'utf8');
  fs.rmSync(draftFile, { force: true });
  return { status: 201, body: { ...screen, created: true } };
}

/** Existing Screens with their locator names and the cells still missing per platform (I-02 target list). */
function listScreens(root) {
  const dir = path.join(root, SCREEN_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => /^[A-Z]\w*Screen\.js$/.test(n)).sort().map((n) => {
    const { entries, editable } = readLocators(fs.readFileSync(path.join(dir, n), 'utf8'));
    return {
      className: n.replace(/\.js$/, ''), path: rel(SCREEN_DIR, n), editable,
      locators: Object.keys(entries), missing: { android: missingFor(entries, 'android'), ios: missingFor(entries, 'ios') },
    };
  });
}

module.exports = { handlePageObject, listScreens, toClassName, buildScreen };
