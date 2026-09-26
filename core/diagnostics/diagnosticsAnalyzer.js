const { maskSecrets } = require('../ai/copilotService');

const MAX_INPUT_LENGTH = 100000;

function evidence(kind, value) {
  return value ? [{ kind, value: maskSecrets(String(value)).slice(0, 2000) }] : [];
}

function analyzeDiagnostics(input = {}) {
  const serialized = JSON.stringify(input);
  if (serialized.length > MAX_INPUT_LENGTH) throw new Error('Diagnostic artifact vượt quá giới hạn.');
  const errorText = maskSecrets([input.error, input.message, input.stack, input.testTitle, input.stepTitle].filter(Boolean).join('\n'));
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

  if (/strict mode violation|locator\s*\(|element\s+not\s+found|no element|waiting for (locator|getBy)/i.test(errorText)) {
    add('locator-not-found', 'Không tìm thấy phần tử hoặc locator không còn khớp với giao diện hiện tại.', 0.92, { type: 'selector-update', preview: 'Xem diff selector mới trước khi cập nhật Page Object.' }, [...evidence('locator', input.locator)]);
  }
  if (/intercept|covered|overlay|modal|obscures|element is not receiving events/i.test(errorText)) {
    add('covered-by-overlay', 'Phần tử có thể đang bị popup hoặc lớp phủ che khuất.', 0.93, { type: 'timeout-or-dismiss-overlay', preview: 'Thêm bước đóng popup hoặc tăng timeout có kiểm soát.' }, [...evidence('screenshot', input.screenshot)]);
  }
  if (/navigation timeout|page\.goto|net::err|exceeded.*navigation/i.test(errorText)) {
    add('navigation-timeout', 'Điều hướng không hoàn tất trong thời gian cho phép.', 0.9, { type: 'timeout', preview: 'Tăng navigation timeout và kiểm tra URL/môi trường.' }, [...evidence('url', input.url)]);
  }
  if (/test timeout of \d+ms exceeded/i.test(errorText)) {
    add('test-timeout', 'Thời gian thực thi của test vượt quá giới hạn tổng (hung process hoặc mạng chậm).', 0.91, { type: 'timeout-increase-or-split', preview: 'Tăng test timeout trong config hoặc chia nhỏ kịch bản kiểm thử.' }, [...evidence('test-step', input.testTitle)]);
  }
  if (/ReferenceError|TypeError|SyntaxError|is not defined|is not a function/i.test(errorText)) {
    add('script-error', 'Lỗi thực thi mã nguồn kiểm thử (script bug, thiếu import hoặc gọi hàm sai).', 0.92, { type: 'code-fix', preview: 'Sửa lỗi cú pháp hoặc khai báo hàm trong file spec/fixture.' }, [...evidence('stack', input.stack || input.error)]);
  }
  if (/expect\(|toBeVisible|toHaveText|toContainText|toHaveValue|toHaveURL|assertion.*fail|received.*expected/i.test(errorText)) {
    add('assertion-mismatch', 'Kết quả thực tế không khớp với điều kiện kiểm tra.', 0.94, { type: 'assertion-review', preview: 'Xem expected/received và chỉnh assertion sau khi xác nhận nghiệp vụ.' }, [...evidence('test-step', input.stepTitle)]);
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
