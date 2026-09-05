const { validateScenario, SCHEMA_VERSION } = require('../generator/wizardSchema');

const MAX_PROMPT_LENGTH = 4000;
const DEFAULT_QUOTA = 20;
const WINDOW_MS = 60 * 60 * 1000;

function maskSecrets(value) {
  if (typeof value === 'string') {
    return value
      .replace(/(['"]?)(password|passwd|otp|token|secret|webhook(?:url)?)(['"]?)\s*[:=]\s*(['"]?)[^'"\s,}]+\4/gi, '$1$2$3: "[REDACTED]"')
      .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
      .replace(/([?&](?:token|otp|password|secret)=)[^&\s]+/gi, '$1[REDACTED]');
  }
  if (Array.isArray(value)) return value.map(maskSecrets);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /password|passwd|otp|token|secret|webhook/i.test(key) ? '[REDACTED]' : maskSecrets(item)]));
  return value;
}

function rejectPromptInjection(prompt) {
  return /ignore\s+(all\s+)?previous|system\s+prompt|reveal\s+(your|the)\s+instructions|bypass\s+(the\s+)?schema/i.test(prompt);
}

function localProvider(prompt) {
  const lower = prompt.toLowerCase();
  const steps = [];
  if (/đăng nhập|login|sign in/.test(lower)) steps.push({ stepType: 'Given', title: 'Người dùng đăng nhập', actionId: 'auth_login_precondition' });
  if (/mở|truy cập|navigate|điều hướng/.test(lower)) steps.push({ stepType: steps.length ? 'When' : 'Given', title: 'Người dùng mở trang kiểm thử', actionId: 'navigate_url', url: 'https://example.com' });
  if (/nhập|điền|fill/.test(lower)) steps.push({ stepType: 'When', title: 'Người dùng nhập dữ liệu', actionId: 'fill_text', locator: 'input' });
  if (/bấm|nhấn|click/.test(lower)) steps.push({ stepType: 'When', title: 'Người dùng bấm phần tử', actionId: 'click_element', locator: 'button' });
  if (/kiểm tra|xác minh|verify|hiển thị|visible/.test(lower)) steps.push({ stepType: 'Then', title: 'Hệ thống hiển thị kết quả mong đợi', actionId: 'assert_visible', locator: 'body' });
  if (!steps.length) steps.push({ stepType: 'When', title: 'Người dùng thực hiện luồng kiểm thử', actionId: 'click_element', locator: 'button' });
  return { schemaVersion: SCHEMA_VERSION, featureName: 'Kịch bản được tạo từ prompt', scenarioName: prompt.slice(0, 100), platform: /mobile|điện thoại/.test(lower) ? 'mobile-web' : 'desktop', tags: ['@aiGenerated', '@e2e'], precondition: {}, dataSources: [], pageObjects: [], steps };
}

function createCopilotService({ provider = localProvider, quota = DEFAULT_QUOTA, now = () => Date.now(), timeoutMs = 5000, maxRetries = 1 } = {}) {
  const requests = [];
  return {
    async generateState({ prompt, context = {} } = {}) {
      if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('Prompt không được để trống.');
      if (prompt.length > MAX_PROMPT_LENGTH) throw new Error(`Prompt vượt quá giới hạn ${MAX_PROMPT_LENGTH} ký tự.`);
      if (rejectPromptInjection(prompt)) throw new Error('Prompt chứa yêu cầu không được phép.');
      const current = now();
      while (requests.length && requests[0] <= current - WINDOW_MS) requests.shift();
      if (requests.length >= quota) throw new Error('Đã vượt quota AI trong cửa sổ hiện tại.');
      requests.push(current);
      const safePrompt = maskSecrets(prompt);
      const safeContext = maskSecrets(context);
      let state;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          state = await Promise.race([
            Promise.resolve(provider({ prompt: safePrompt, context: safeContext })),
            new Promise((_, reject) => setTimeout(() => reject(new Error('AI provider timeout.')), timeoutMs)),
          ]);
          break;
        } catch (_) {
          if (attempt === maxRetries) state = localProvider(safePrompt);
        }
      }
      const validation = validateScenario(state, { actionIds: ['auth_login_precondition', 'navigate_url', 'fill_text', 'click_element', 'assert_visible'] });
      if (validation.errors.length) throw new Error(`AI trả về structured state không hợp lệ: ${validation.errors.join(' ')}`);
      return { state: validation.scenario, provider: provider === localProvider ? 'local' : 'configured-with-fallback', auditId: `ai_${current}_${requests.length}`, warnings: validation.warnings };
    },
  };
}

module.exports = { MAX_PROMPT_LENGTH, maskSecrets, rejectPromptInjection, localProvider, createCopilotService };
