/**
 * core/ai/tasks/reviewSpec.js
 * Automated Playwright spec code review (QA-9).
 * Static lint rules run first (0 token), AI provides logical audit. Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ruleId: { type: 'string' },
          severity: { type: 'string', enum: ['error', 'warning', 'info'] },
          line: { type: 'number' },
          message: { type: 'string' },
          suggestion: { type: 'string' }
        },
        required: ['ruleId', 'severity', 'message']
      }
    },
    generalSuggestions: { type: 'array', items: { type: 'string' } }
  },
  required: ['score', 'findings']
};

function staticSpecReview(specCode = '') {
  const findings = [];
  const lines = specCode.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (/waitForTimeout\s*\(/i.test(line)) {
      findings.push({
        ruleId: 'PW-NO-WAIT-TIMEOUT',
        severity: 'error',
        line: lineNum,
        message: 'Sử dụng waitForTimeout() là anti-pattern gây flaky test.',
        suggestion: 'Dùng web-first assertions (expect(locator).toBeVisible()) hoặc waitForLoadState().'
      });
    }

    if (/\/(?:div|span|section)\[\d+\]/i.test(line)) {
      findings.push({
        ruleId: 'PW-BRITTLE-XPATH',
        severity: 'error',
        line: lineNum,
        message: 'Phát hiện XPath tuyệt đối chứa chỉ số mảng (/div[1]...).',
        suggestion: 'Chuyển sang Playwright locators như getByRole hoặc getByTestId.'
      });
    }

    if (/\btest\s*\(\s*['"`](?!.*@TC-)/i.test(line) && !line.includes('describe')) {
      findings.push({
        ruleId: 'PW-MISSING-TC-TAG',
        severity: 'warning',
        line: lineNum,
        message: 'Tiêu đề test case thiếu mã truy vết @TC-xxx.',
        suggestion: 'Bổ sung @TC-xxx vào tiêu đề test để hỗ trợ Living Documentation.'
      });
    }
  });

  if (!/expect\s*\(/i.test(specCode) && specCode.trim().length > 50) {
    findings.push({
      ruleId: 'PW-NO-ASSERTION',
      severity: 'error',
      line: 1,
      message: 'Test spec không chứa bất kỳ assertion (expect) nào.',
      suggestion: 'Bổ sung ít nhất một web-first assertion để kiểm chứng kết quả kỳ vọng.'
    });
  }

  const penalty = findings.reduce((acc, f) => acc + (f.severity === 'error' ? 20 : 10), 0);
  const score = Math.max(0, 100 - penalty);

  return {
    score,
    summary: findings.length === 0 ? 'Spec tuân thủ xuất sắc các quy chuẩn Playwright.' : `Phát hiện ${findings.length} vấn đề cần lưu ý.`,
    findings,
    generalSuggestions: findings.map((f) => f.suggestion)
  };
}

async function runReviewSpec({ specCode = '', filePath = '', signal = null, clientConfig = null } = {}) {
  const staticResult = staticSpecReview(specCode);

  const system = `Bạn là Senior QA Automation Lead & Playwright Code Reviewer.
Hãy rà soát đoạn mã test Playwright sau, tìm các lỗi tiềm ẩn (flaky, thiếu assertion, sai async/await, selector giòn).
Trả về JSON đúng schema.`;
  const user = `Đường dẫn file: ${filePath}
Mã nguồn test:
\`\`\`javascript
${specCode.slice(0, 4000)}
\`\`\``;

  try {
    const result = await callAi({
      task: 'reviewSpec',
      system,
      user,
      schema: SCHEMA,
      signal,
      clientConfig
    });

    if (result && typeof result.score === 'number' && Array.isArray(result.findings)) {
      const mergedFindings = [...staticResult.findings];
      for (const item of result.findings) {
        if (!mergedFindings.some((m) => m.ruleId === item.ruleId && m.line === item.line)) {
          mergedFindings.push(item);
        }
      }
      return {
        source: 'ai',
        score: Math.min(staticResult.score, result.score),
        summary: result.summary || staticResult.summary,
        findings: mergedFindings,
        generalSuggestions: result.generalSuggestions || staticResult.generalSuggestions
      };
    }
  } catch (err) {
    // Return static review
  }

  return {
    source: 'rule',
    ...staticResult
  };
}

module.exports = {
  runReviewSpec,
  staticSpecReview,
  SCHEMA
};
