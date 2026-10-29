'use strict';

/**
 * Unit test cho parseFrontMatter() và loadRequirements() thuộc tầng ĐỌC NGUỒN của tools/qa.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { loadRequirements, parseFrontMatter } = require('./sources');
const { withRepo, lineOf, asWindowsFile, REQ_FULL } = require('../__tests__/sourcesFixture');

// ===========================================================================
// parseFrontMatter
// ===========================================================================

test('parseFrontMatter: không có front-matter -> offset 0 và body giữ nguyên từng ký tự', () => {
  const text = '# REQ-001\n\n### AC-001: x\n';
  const r = parseFrontMatter(text);
  assert.deepEqual(r.data, {});
  assert.equal(r.body, text, 'không được cắt xén gì khi file không mở front-matter');
  assert.equal(r.offset, 0);
});

test('parseFrontMatter: có front-matter -> data đủ khoá, body bắt đầu sau dấu đóng, offset đếm đúng', () => {
  const r = parseFrontMatter('---\nid: REQ-001\ntitle: Đăng nhập\n---\n\n# REQ-001\n');
  assert.deepEqual(r.data, { id: 'REQ-001', title: 'Đăng nhập' });
  assert.ok(!r.body.includes('id: REQ-001'), 'front-matter không được lọt xuống body');
  assert.ok(r.body.includes('# REQ-001'));
  assert.equal(r.offset, 3);
});

test('parseFrontMatter: offset lớn lên đúng bằng số dòng metadata thêm vào', () => {
  for (const keyCount of [1, 2, 5, 9]) {
    const keys = Array.from({ length: keyCount }, (_, i) => `k${i}: v${i}`).join('\n');
    const r = parseFrontMatter(`---\n${keys}\n---\nbody\n`);
    assert.equal(Object.keys(r.data).length, keyCount);
    assert.equal(r.offset, keyCount + 1, `front-matter ${keyCount} khoá phải cho offset ${keyCount + 1}`);
  }
});

test('parseFrontMatter: mở mà không đóng -> coi như không có front-matter, body nguyên vẹn', () => {
  const text = '---\nid: REQ-001\n\n# REQ-001\n\n### AC-001: x\n';
  const r = parseFrontMatter(text);
  assert.deepEqual(r.data, {});
  assert.equal(r.body, text);
  assert.equal(r.offset, 0);
});

test('parseFrontMatter: giá trị bọc nháy đơn/kép bị bóc và cắt khoảng trắng thừa', () => {
  const r = parseFrontMatter('---\na: "Đăng nhập"\nb: \'Auth squad\'\nc:    spaced   \n---\nbody\n');
  assert.equal(r.data.a, 'Đăng nhập', 'nháy kép phải bị bóc, nếu không title in ra kèm dấu nháy');
  assert.equal(r.data.b, 'Auth squad');
  assert.equal(r.data.c, 'spaced');
});

test('parseFrontMatter: khoá khai mà bỏ trống giá trị -> chuỗi rỗng', () => {
  const r = parseFrontMatter('---\nid:\ntitle:   \n---\nbody\n');
  assert.equal(r.data.id, '');
  assert.equal(r.data.title, '');
  assert.ok('id' in r.data, 'khoá vẫn phải tồn tại để phân biệt "bỏ trống" với "không khai"');
});

test('parseFrontMatter: dòng không theo khuôn key: value bị bỏ qua, không làm hỏng khoá khác', () => {
  const r = parseFrontMatter('---\n# ghi chú\n- một gạch đầu dòng\nid: REQ-001\n---\nbody\n');
  assert.deepEqual(r.data, { id: 'REQ-001' });
});

test('parseFrontMatter: front-matter rỗng vẫn cho offset đúng', () => {
  const r = parseFrontMatter('---\n---\nbody\n');
  assert.deepEqual(r.data, {});
  assert.equal(r.offset, 1);
  assert.ok(r.body.includes('body'));
});

// ===========================================================================
// loadRequirements
// ===========================================================================

test('loadRequirements: đọc đủ id/title/status/version/risk/owner/testCaseFile từ front-matter', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    assert.equal(req.id, 'REQ-001');
    assert.equal(req.title, 'Đăng nhập bằng email và mật khẩu');
    assert.equal(req.status, 'Ready for Test');
    assert.equal(req.version, '1.0');
    assert.equal(req.risk, 'High');
    assert.equal(req.owner, 'Auth squad');
    assert.equal(req.testCaseFile, 'test-cases/REQ-001.md');
    assert.equal(req.file, 'requirements/REQ-001.md', 'đường dẫn phải tính từ gốc repo và dùng dấu /');
    assert.equal(req.missingFrontMatter, undefined);
  });
});

test('loadRequirements: khoá không khai -> status "Unknown", các trường còn lại là chuỗi rỗng', () => {
  withRepo({ 'requirements/a.md': '---\nid: REQ-002\n---\n\n### AC-001: x\n' }, (root) => {
    const [req] = loadRequirements(root);
    assert.equal(req.status, 'Unknown', '"Unknown" là cờ để drift không nhầm với Draft');
    assert.equal(req.title, '');
    assert.equal(req.version, '');
    assert.equal(req.risk, '');
    assert.equal(req.owner, '');
    assert.equal(req.testCaseFile, '');
  });
});

test('loadRequirements: thiếu id -> { id: null, missingFrontMatter: true } với acs/rules rỗng', () => {
  withRepo(
    {
      'requirements/a.md': '---\ntitle: Không có id\n---\n\n### AC-001: vẫn có AC\n',
      'requirements/b.md': '# Không có front-matter\n\n### AC-001: x\n',
      'requirements/c.md': '---\nid:\n---\n\n### AC-001: id bỏ trống\n',
    },
    (root) => {
      const reqs = loadRequirements(root);
      assert.equal(reqs.length, 3);
      for (const req of reqs) {
        assert.equal(req.id, null, `${req.file} không có id nên id phải là null`);
        assert.equal(req.missingFrontMatter, true);
        assert.deepEqual(req.acs, [], 'không có id thì AC không gắn được vào đâu');
        assert.deepEqual(req.rules, []);
      }
    },
  );
});

test('loadRequirements: thư mục requirements không tồn tại -> mảng rỗng, không ném', () => {
  withRepo({ 'README.md': '# repo trống' }, (root) => {
    assert.deepEqual(loadRequirements(root), []);
  });
});

test('loadRequirements: README.md bị bỏ qua, kể cả viết hoa README.MD', () => {
  withRepo(
    {
      'requirements/README.md': '# Hướng dẫn\n\n### AC-001: ví dụ trong tài liệu\n',
      'requirements/REQ-001.md': REQ_FULL,
    },
    (root) => {
      assert.deepEqual(loadRequirements(root).map((r) => r.id), ['REQ-001']);
    },
  );
  withRepo(
    {
      'requirements/README.MD': '---\nid: REQ-777\n---\n',
      'requirements/REQ-001.md': REQ_FULL,
    },
    (root) => {
      assert.deepEqual(loadRequirements(root).map((r) => r.id), ['REQ-001']);
    },
  );
});

test('loadRequirements: file .MD viết HOA vẫn phải đọc được', () => {
  withRepo({ 'requirements/REQ-002.MD': '---\nid: REQ-002\n---\n\n### AC-001: hoa\n' }, (root) => {
    const reqs = loadRequirements(root);
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].id, 'REQ-002');
    assert.equal(reqs[0].acs.length, 1);
  });
});

test('loadRequirements: file không phải markdown bị bỏ qua', () => {
  withRepo(
    {
      'requirements/note.txt': '---\nid: REQ-888\n---\n',
      'requirements/draft.md.bak': '---\nid: REQ-889\n---\n',
      'requirements/REQ-001.md': REQ_FULL,
    },
    (root) => {
      assert.deepEqual(loadRequirements(root).map((r) => r.id), ['REQ-001']);
    },
  );
});

test('loadRequirements: ba biến thể heading AC (":", "-", không dấu ngăn) đều đọc được', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    assert.deepEqual(req.acs.map((a) => a.id), ['AC-001', 'AC-002', 'AC-003', 'AC-004']);
    const byId = new Map(req.acs.map((a) => [a.id, a]));
    assert.equal(byId.get('AC-001').title, 'Đăng nhập thành công với credential hợp lệ');
    assert.equal(
      byId.get('AC-002').title,
      'Credential sai bị từ chối',
      'dấu ngăn "-" không được dính vào tiêu đề',
    );
    assert.equal(byId.get('AC-003').title, 'Email sai định dạng bị chặn ở client', 'heading #### vẫn là AC');
  });
});

test('loadRequirements: heading AC không có tiêu đề -> title rỗng chứ không phải AC biến mất', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    const ac4 = req.acs.find((a) => a.id === 'AC-004');
    assert.ok(ac4, 'AC chưa kịp đặt tiêu đề vẫn là một AC phải phủ');
    assert.equal(ac4.title, '');
  });
});

test('loadRequirements: số dòng AC là số dòng THẬT trong file (đã cộng front-matter)', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    const byId = new Map(req.acs.map((a) => [a.id, a]));
    assert.equal(byId.get('AC-001').line, lineOf(REQ_FULL, '### AC-001:'));
    assert.equal(byId.get('AC-002').line, lineOf(REQ_FULL, '### AC-002 -'));
    assert.equal(byId.get('AC-003').line, lineOf(REQ_FULL, '#### AC-003'));
    assert.equal(byId.get('AC-001').line, 16);
    assert.equal(byId.get('AC-004').line, 26);
  });
});

test('loadRequirements: mã sai quy ước rơi vào nearMisses chứ không biến mất', () => {
  const text = `---
id: REQ-001
---

### AC-001: đúng quy ước

### AC-8: thiếu số 0

### AC_012 dùng gạch dưới

### ac-005: viết thường

### AC-0012: bốn chữ số
`;
  withRepo({ 'requirements/a.md': text }, (root) => {
    const [req] = loadRequirements(root);
    assert.deepEqual(req.acs.map((a) => a.id), ['AC-001'], 'chỉ mã đúng quy ước mới thành AC');
    assert.deepEqual(
      req.nearMisses.map((n) => n.raw),
      ['AC-8', 'AC_012', 'ac-005', 'AC-0012'],
      'bốn mã hỏng phải được nêu tên để commands.js bắn dinh-danh-sai-quy-uoc',
    );
    assert.equal(req.nearMisses[0].line, lineOf(text, '### AC-8:'), 'nearMiss cũng phải trỏ đúng dòng thật');
  });
});

test('loadRequirements: mã đúng quy ước không bị xếp nhầm vào nearMisses', () => {
  withRepo(
    {
      'requirements/a.md':
        '---\nid: REQ-001\n---\n\n### AC-001: x\n\n### TC-001: tham chiếu\n\n## REQ-002 liên quan\n',
    },
    (root) => {
      const [req] = loadRequirements(root);
      assert.deepEqual(req.nearMisses, [], 'AC/TC/REQ viết đủ ba chữ số là hợp lệ, không phải near miss');
    },
  );
});

test('loadRequirements: bảng Rules and validation rút đủ 6 cột, bỏ header và dòng phân cách', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    assert.equal(req.rules.length, 2, 'header "Field/rule" và dòng |---| không được thành rule');
    const email = req.rules[0];
    assert.equal(email.field, 'Email');
    assert.equal(email.valid, '`a@b.com`');
    assert.equal(email.invalid, '`not-an-email`');
    assert.equal(email.boundary, '254, 255');
    assert.equal(email.expected, 'Lỗi tại trường');
  });
});

test('loadRequirements: cột Test cases rút được nhiều mã TC, ô trống -> mảng rỗng', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    assert.deepEqual(req.rules[0].testCases, ['TC-004', 'TC-012']);
    assert.deepEqual(req.rules[1].testCases, [], 'ô trống phải là mảng rỗng, không phải [""]');
  });
});

test('loadRequirements: bảng nằm dưới heading khác không bị hút vào rules', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    assert.deepEqual(
      req.rules.map((r) => r.field),
      ['Email', 'Password'],
      'bảng Non-functional nằm dưới heading khác, không được lẫn vào rules',
    );
  });
});

test('loadRequirements: dòng mẫu <field> của template được trả nguyên ở tầng đọc', () => {
  withRepo(
    {
      'requirements/a.md': `---
id: REQ-001
---

## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
| <field> | <...> | <...> | <...> | <...> | TC-0xx |
`,
    },
    (root) => {
      const [req] = loadRequirements(root);
      assert.equal(req.rules.length, 1);
      assert.equal(req.rules[0].field, '<field>');
      assert.deepEqual(req.rules[0].testCases, [], 'TC-0xx không phải mã hợp lệ nên không được nhận');
    },
  );
});

test('loadRequirements: requirementsDir khai trong options được tôn trọng', () => {
  withRepo({ 'docs/requirements/REQ-001.md': REQ_FULL }, (root) => {
    assert.deepEqual(loadRequirements(root), [], 'không khai thì vẫn chỉ nhìn requirements/');
    const reqs = loadRequirements(root, { requirementsDir: 'docs/requirements' });
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].id, 'REQ-001');
    assert.equal(
      reqs[0].file,
      'docs/requirements/REQ-001.md',
      'file phải tính từ gốc repo, không phải từ thư mục tài liệu',
    );
  });
});

test('loadRequirements: mỗi file là một bản ghi, AC không lẫn giữa các requirement', () => {
  withRepo(
    {
      'requirements/REQ-001.md': '---\nid: REQ-001\n---\n\n### AC-001: một\n\n### AC-002: hai\n',
      'requirements/REQ-002.md': '---\nid: REQ-002\n---\n\n### AC-001: ba\n',
    },
    (root) => {
      const reqs = loadRequirements(root);
      const byId = new Map(reqs.map((r) => [r.id, r]));
      assert.equal(byId.size, 2);
      assert.equal(byId.get('REQ-001').acs.length, 2);
      assert.equal(byId.get('REQ-002').acs.length, 1);
    },
  );
});

test('loadRequirements: file lưu kèm BOM + CRLF vẫn đọc đủ front-matter và số dòng AC không lệch', () => {
  withRepo({ 'requirements/REQ-001.md': asWindowsFile(REQ_FULL) }, (root) => {
    const [req] = loadRequirements(root);
    assert.equal(req.id, 'REQ-001');
    assert.equal(req.title, 'Đăng nhập bằng email và mật khẩu');
    assert.equal(req.acs.length, 4);
    assert.equal(req.acs[0].line, lineOf(REQ_FULL, '### AC-001:'));
    assert.equal(
      req.acs[0].title,
      'Đăng nhập thành công với credential hợp lệ',
      'ký tự \\r không được dính vào tiêu đề',
    );
    assert.equal(req.rules.length, 2, 'bảng markdown cũng phải sống sót qua CRLF');
  });
});
