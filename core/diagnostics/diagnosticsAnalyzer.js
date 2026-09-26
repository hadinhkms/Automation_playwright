const { maskSecrets } = require('../ai/copilotService');

const MAX_INPUT_LENGTH = 100000;

function evidence(kind, value) {
  return value ? [{ kind, value: maskSecrets(String(value)).slice(0, 2000) }] : [];
}

function stripAnsi(str) {
  return typeof str === 'string' ? str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '') : (str || '');
}

function analyzeDiagnostics(input = {}) {
  const serialized = JSON.stringify(input);
  if (serialized.length > MAX_INPUT_LENGTH) throw new Error('Diagnostic artifact vượt quá giới hạn.');
  const rawCombined = [input.error, input.message, input.stack, input.testTitle, input.stepTitle]
    .filter(Boolean)
    .map(stripAnsi)
    .join('\n');
  const errorText = maskSecrets(rawCombined);

  const CATEGORY_MAP = {
    'locator-not-found': 'test_bug',
    'script-error': 'test_bug',
    'fixture-error': 'test_bug',
    'covered-by-overlay': 'flaky',
    'test-timeout': 'flaky',
    'navigation-timeout': 'environment',
    'assertion-mismatch': 'product_bug',
    'unknown': 'unknown'
  };

  const findings = [];
  const common = { step: input.stepTitle || input.testTitle || null, url: input.url || null };
  const add = (code, message, confidence, fix, sources) => {
    findings.push({
      code,
      category: CATEGORY_MAP[code] || 'test_bug',
      message,
      evidence: [...evidence('error', errorText), ...sources],
      confidence,
      suggestedFix: fix ? { type: fix.type, preview: fix.preview, requiresConfirmation: true } : null,
      ...common
    });
  };

  if (/ReferenceError|TypeError|SyntaxError|is not defined|is not a function/i.test(errorText)) {
    add('script-error', 'Lỗi thực thi mã nguồn kiểm thử (script bug, thiếu import hoặc gọi hàm sai).', 0.98, { type: 'code-fix', preview: 'Sửa lỗi cú pháp hoặc khai báo hàm trong file spec/fixture.' }, [...evidence('stack', input.stack || input.error)]);
  }

  if (/intercept|covered|overlay|modal|obscure|element is not receiving events|to be hidden|detached from dom/i.test(errorText)) {
    add('covered-by-overlay', 'Phần tử có thể đang bị popup, dialog, lớp phủ che khuất, hoặc bị detach khỏi DOM.', 0.96, { type: 'timeout-or-dismiss-overlay', preview: 'Thêm bước đóng popup hoặc tăng timeout có kiểm soát.' }, [...evidence('screenshot', input.screenshot)]);
  }

  if (/test timeout of \d+ms exceeded/i.test(errorText)) {
    add('test-timeout', 'Thời gian thực thi của test vượt quá giới hạn tổng (hung process hoặc mạng chậm).', 0.95, { type: 'timeout-increase-or-split', preview: 'Tăng test timeout trong config hoặc chia nhỏ kịch bản kiểm thử.' }, [...evidence('test-step', input.testTitle)]);
  }

  const isElementFoundAssertion = /Received:\s*visible|expect\(.*not\.toBeVisible|toHaveURL|Received string:|Expected string:|received.*expected|expected.*received|Received: 500|Expected: 200/i.test(errorText);
  const isElementNotFound = /element\(s\)\s+not\s+found|element\s+not\s+found|no element|strict mode violation|element is not an? <|Element is not a </i.test(errorText);

  if (isElementFoundAssertion && !isElementNotFound) {
    add('assertion-mismatch', 'Kết quả thực tế không khớp với điều kiện kiểm tra nghiệp vụ (phần tử tồn tại nhưng trạng thái/dữ liệu sai).', 0.95, { type: 'assertion-review', preview: 'Xem expected/received và chỉnh assertion sau khi xác nhận nghiệp vụ.' }, [...evidence('test-step', input.stepTitle)]);
  } else if (/expect\(|toBeVisible|toHaveText|toContainText|toHaveValue|assertion.*fail/i.test(errorText) && !isElementNotFound) {
    add('assertion-mismatch', 'Kết quả kiểm tra không thỏa mãn điều kiện mong đợi.', 0.90, { type: 'assertion-review', preview: 'Xem expected/received và chỉnh assertion sau khi xác nhận nghiệp vụ.' }, [...evidence('test-step', input.stepTitle)]);
  }

  if (isElementNotFound || /waiting for (locator|getBy).*(to be visible|to be enabled)/i.test(errorText)) {
    if (!/intercepts pointer events/i.test(errorText)) {
      add('locator-not-found', 'Không tìm thấy phần tử, locator sai, hoặc phần tử không đúng kiểu thẻ HTML.', 0.94, { type: 'selector-update', preview: 'Xem diff selector mới trước khi cập nhật Page Object.' }, [...evidence('locator', input.locator)]);
    }
  }

  if (/navigation timeout|page\.goto|net::err|exceeded.*navigation/i.test(errorText)) {
    add('navigation-timeout', 'Điều hướng không hoàn tất trong thời gian cho phép.', 0.92, { type: 'timeout', preview: 'Tăng navigation timeout và kiểm tra URL/môi trường.' }, [...evidence('url', input.url)]);
  }

  if (/fixture|beforeAll|beforeEach|authSetup|cannot read propert|undefined/i.test(errorText)) {
    add('fixture-error', 'Fixture hoặc tiền điều kiện không khởi tạo đúng.', 0.78, { type: 'fixture-review', preview: 'Kiểm tra fixture, dữ liệu test và thứ tự tiền điều kiện.' }, [...evidence('console', input.consoleLogs)]);
  }

  if (!findings.length) add('unknown', 'Chưa đủ bằng chứng để xác định nguyên nhân gốc.', 0.2, null, [...evidence('trace', input.trace)]);

  const topFinding = findings.slice().sort((a, b) => b.confidence - a.confidence)[0];
  const topCategory = topFinding ? topFinding.category : 'unknown';

  return { version: 1, deterministic: true, findings, topCategory, masked: true };
}

module.exports = { MAX_INPUT_LENGTH, analyzeDiagnostics };
