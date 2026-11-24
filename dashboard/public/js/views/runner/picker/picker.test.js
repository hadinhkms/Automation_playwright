/**
 * dashboard/public/js/views/runner/picker/picker.test.js
 * Unit tests of the pure Script Picker modules (ESM, loaded with dynamic import).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const load = (name) => import(`./${name}.js`);
const CONFIG = {
  specs: ['tests/api/g.spec.js', 'tests/dashboard/internal.spec.js', 'tests/e2e/desktop/a.spec.js', 'tests/e2e/desktop/dang-nhap.spec.js', 'tests/e2e/mobile/b.spec.js'],
  specTags: { 'tests/api/g.spec.js': ['@api'], 'tests/e2e/desktop/a.spec.js': ['@e2e', '@smoke', '@REQ-001'], 'tests/e2e/desktop/dang-nhap.spec.js': ['@e2e'], 'tests/e2e/mobile/b.spec.js': ['@mobile'] },
  specProjects: { 'tests/e2e/desktop/a.spec.js': ['Desktop Smoke Tests'], 'tests/e2e/desktop/dang-nhap.spec.js': ['Desktop Regression Tests', 'Desktop Smoke Tests'], 'tests/e2e/mobile/b.spec.js': ['Mobile Chrome Smoke Tests', 'Mobile Safari Smoke Tests'] },
};

test('text: fold ignores case and accents; highlight escapes HTML and marks matches', async () => {
  const { fold, highlight, keywords, escapeHtml } = await load('pickerText');
  assert.equal(fold('Đăng Nhập'), 'dang nhap');
  assert.deepEqual(keywords('  @Smoke  đăng '), ['smoke', 'dang']);
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(highlight('dang-nhap.spec.js', ['dang']), '<mark>dang</mark>-nhap.spec.js');
  assert.equal(highlight('<b>dang', ['dang']), '&lt;b&gt;<mark>dang</mark>');
});

test('model: drops tests/dashboard, groups by folder, infers platform, hides REQ/AC codes from tag chips', async () => {
  const { buildCatalog, platformOf } = await load('pickerModel');
  const c = buildCatalog(CONFIG);
  assert.equal(c.files.length, 4);
  assert.ok(!c.byPath.has('tests/dashboard/internal.spec.js'));
  assert.deepEqual(c.groups.map((g) => g.label), ['api', 'e2e / desktop', 'e2e / mobile']);
  assert.deepEqual(c.tags.map((t) => t.tag), ['@e2e', '@api', '@mobile', '@smoke']);
  assert.equal(platformOf('tests/e2e/mobile-web/x.spec.js'), 'Mobile web');
  assert.equal(platformOf('tests/misc/x.spec.js'), 'Khác');
});

test('filter: keywords AND, chips of a group OR, groups AND each other', async () => {
  const { buildCatalog } = await load('pickerModel');
  const { filterFiles } = await load('pickerFilter');
  const files = buildCatalog(CONFIG).files;
  const names = (opts) => filterFiles(files, opts).map((f) => f.name);
  assert.deepEqual(names({ query: 'đăng nhập' }), ['dang-nhap.spec.js']);
  assert.deepEqual(names({ query: 'req-001' }), ['a.spec.js']);
  assert.deepEqual(names({ query: 'e2e smoke' }), ['a.spec.js']); // AND: path/tag has e2e and tag has smoke
  assert.deepEqual(names({ platforms: new Set(['API', 'Mobile web']) }).sort(), ['b.spec.js', 'g.spec.js']);
  assert.deepEqual(names({ platforms: new Set(['Desktop']), tags: new Set(['@smoke']) }), ['a.spec.js']);
});

test('state: tri-state of a group and group toggle only touch visible files', async () => {
  const { createState, groupCheck, toggleGroup, toggleFile, pruneMissing } = await load('pickerState');
  const { buildCatalog } = await load('pickerModel');
  const catalog = buildCatalog(CONFIG);
  const group = catalog.groups[1].files; // two desktop files
  const state = createState();
  assert.equal(groupCheck(state, group), 'false');
  toggleFile(state, group[0].path);
  assert.equal(groupCheck(state, group), 'mixed');
  toggleGroup(state, group); // mixed -> all
  assert.equal(groupCheck(state, group), 'true');
  toggleGroup(state, [group[0]]); // acts on the visible one only
  assert.deepEqual([...state.selected], [group[1].path]);
  state.selected.add('tests/gone.spec.js');
  assert.equal(pruneMissing(state, catalog), 1);
});

test('payload: default projects keep one device family; spec:"all" when everything is selected; tags[] only with the switch', async () => {
  const { buildCatalog } = await load('pickerModel');
  const { createState } = await load('pickerState');
  const p = await load('pickerPayload');
  const catalog = buildCatalog(CONFIG);
  const [api, a, dang, b] = ['tests/api/g.spec.js', 'tests/e2e/desktop/a.spec.js', 'tests/e2e/desktop/dang-nhap.spec.js', 'tests/e2e/mobile/b.spec.js'].map((x) => catalog.byPath.get(x));
  assert.deepEqual(p.defaultProjects(dang), ['Desktop Regression Tests', 'Desktop Smoke Tests']);
  assert.deepEqual(p.defaultProjects(b), ['Mobile Chrome Smoke Tests']);
  assert.deepEqual(p.defaultProjects(api), []);
  assert.equal(p.runCount([a, dang, b], p.projectsFor([a, dang, b])), 4);
  assert.equal(p.multiDeviceNote([b], p.projectsFor([b])), 'b.spec.js chạy được trên 2 thiết bị; đang chọn Mobile Chrome.');
  const controls = { environment: 'qc', workers: 2, headed: false };
  const state = createState();
  [a, b].forEach((f) => state.selected.add(f.path));
  let body = p.buildPayload(state, catalog, controls);
  assert.deepEqual(body.specs, [a.path, b.path]);
  assert.equal(body.spec, undefined);
  state.tags.add('@smoke');
  assert.equal(p.buildPayload(state, catalog, controls).tags, undefined);
  state.tagOnly = true;
  assert.deepEqual(p.buildPayload(state, catalog, controls).tags, ['@smoke']);
  catalog.files.forEach((f) => state.selected.add(f.path));
  body = p.buildPayload(state, catalog, controls);
  assert.equal(body.spec, 'all');
  assert.equal(body.specs, undefined);
  assert.equal(p.commandPreview({ spec: 'all', projects: ['X'] }, catalog), 'npx playwright test --project="X"');
  assert.match(p.commandPreview({ specs: ['tests/e2e/a b.spec.js'] }, catalog), /"tests\/e2e\/a b\.spec\.js"/);
});
