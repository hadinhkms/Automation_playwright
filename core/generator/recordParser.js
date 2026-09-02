const fs = require('fs');
const path = require('path');
const {
  generateLocatorName,
  analyzeLocatorWarnings,
  sanitizeToIdentifier,
} = require('./namingUtils');

/**
 * Phân tích mã nguồn raw Playwright Codegen thành cấu trúc Intermediate JSON Actions
 * @param {string} rawScript
 * @returns {{ scenarioName: string, detectedUrl: string, actionsCount: number, actions: Array, globalWarnings: string[] }}
 */
function parsePlaywrightScript(rawScript) {
  if (!rawScript || typeof rawScript !== 'string') {
    return { scenarioName: 'recorded scenario', detectedUrl: '', actionsCount: 0, actions: [], globalWarnings: [] };
  }

  const lines = rawScript.split(/\r?\n/);
  const actions = [];
  const globalWarnings = [];
  let detectedUrl = '';
  let scenarioName = 'Thao tác giao diện người dùng';

  // Trích xuất tên test nếu có: test('...', async ({ page }) => {
  const testTitleMatch = rawScript.match(/test\(\s*['"`]([^'"`]+)['"`]/);
  if (testTitleMatch && testTitleMatch[1] !== 'test') {
    scenarioName = testTitleMatch[1];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;

    // 1. Navigation: await page.goto('...')
    const gotoMatch = line.match(/(?:await\s+)?page\.goto\(\s*['"`]([^'"`]+)['"`]/);
    if (gotoMatch) {
      detectedUrl = gotoMatch[1];
      actions.push({
        id: `act_${actions.length + 1}`,
        type: 'goto',
        url: detectedUrl,
        raw: line,
        summary: `Điều hướng đến: ${detectedUrl}`,
        warnings: [],
      });
      continue;
    }

    // 2. Click: await page.locator(...).click(...) hoặc await page.getBy*(...).click(...)
    const clickMatch = line.match(/(?:await\s+)?(page\.(?:locator|getByRole|getByLabel|getByPlaceholder|getByTestId|getByText)[^;]+)\.click\s*\(([^)]*)\)/);
    if (clickMatch) {
      const locatorExpr = clickMatch[1].trim();
      const locatorVar = generateLocatorName(locatorExpr);
      const warnings = analyzeLocatorWarnings(locatorExpr);
      actions.push({
        id: `act_${actions.length + 1}`,
        type: 'click',
        locator: locatorExpr,
        locatorVar,
        raw: line,
        summary: `Click vào ${locatorVar}`,
        warnings,
      });
      continue;
    }

    // 3. Fill: await page.locator(...).fill('value')
    const fillMatch = line.match(/(?:await\s+)?(page\.(?:locator|getByRole|getByLabel|getByPlaceholder|getByTestId|getByText)[^;]+)\.fill\s*\(\s*(['"`].*?['"`]|[^)]+)\s*\)/);
    if (fillMatch) {
      const locatorExpr = fillMatch[1].trim();
      const value = fillMatch[2].replace(/^['"`]|['"`]$/g, '');
      const locatorVar = generateLocatorName(locatorExpr);
      const warnings = analyzeLocatorWarnings(locatorExpr);
      actions.push({
        id: `act_${actions.length + 1}`,
        type: 'fill',
        locator: locatorExpr,
        locatorVar,
        value,
        raw: line,
        summary: `Nhập '${value}' vào ${locatorVar}`,
        warnings,
      });
      continue;
    }

    // 4. Select Option: await page.locator(...).selectOption(...)
    const selectMatch = line.match(/(?:await\s+)?(page\.(?:locator|getByRole|getByLabel|getByPlaceholder|getByTestId|getByText)[^;]+)\.selectOption\s*\(\s*(['"`].*?['"`]|[^)]+)\s*\)/);
    if (selectMatch) {
      const locatorExpr = selectMatch[1].trim();
      const value = selectMatch[2].replace(/^['"`]|['"`]$/g, '');
      const locatorVar = generateLocatorName(locatorExpr);
      const warnings = analyzeLocatorWarnings(locatorExpr);
      actions.push({
        id: `act_${actions.length + 1}`,
        type: 'select',
        locator: locatorExpr,
        locatorVar,
        value,
        raw: line,
        summary: `Chọn option '${value}' tại ${locatorVar}`,
        warnings,
      });
      continue;
    }

    // 5. Check / Uncheck
    const checkMatch = line.match(/(?:await\s+)?(page\.(?:locator|getByRole|getByLabel|getByPlaceholder|getByTestId|getByText)[^;]+)\.(check|uncheck)\s*\(/);
    if (checkMatch) {
      const locatorExpr = checkMatch[1].trim();
      const actionType = checkMatch[2];
      const locatorVar = generateLocatorName(locatorExpr);
      const warnings = analyzeLocatorWarnings(locatorExpr);
      actions.push({
        id: `act_${actions.length + 1}`,
        type: actionType,
        locator: locatorExpr,
        locatorVar,
        raw: line,
        summary: `${actionType === 'check' ? 'Tick chọn' : 'Bỏ chọn'} ${locatorVar}`,
        warnings,
      });
      continue;
    }

    // 6. Assertions: await expect(page.locator(...)).toBeVisible()
    const expectMatch = line.match(/(?:await\s+)?expect\s*\(\s*(page\.[^)]+)\s*\)\.(toBeVisible|toBeHidden|toHaveText|toContainText|toHaveValue|toBeEnabled|toBeDisabled)\s*\(([^)]*)\)/);
    if (expectMatch) {
      const locatorExpr = expectMatch[1].trim();
      const assertionType = expectMatch[2];
      const expectedVal = expectMatch[3] ? expectMatch[3].trim() : '';
      const locatorVar = generateLocatorName(locatorExpr);
      const warnings = analyzeLocatorWarnings(locatorExpr);
      actions.push({
        id: `act_${actions.length + 1}`,
        type: 'assertion',
        locator: locatorExpr,
        locatorVar,
        assertionType,
        expectedVal,
        raw: line,
        summary: `Kiểm tra: ${locatorVar} ${assertionType}(${expectedVal})`,
        warnings,
      });
      continue;
    }
  }

  // Tổng hợp cảnh báo chung
  actions.forEach((act) => {
    if (act.warnings && act.warnings.length > 0) {
      act.warnings.forEach((w) => {
        const fullWarn = `[${act.id}] (${act.summary}): ${w}`;
        if (!globalWarnings.includes(fullWarn)) globalWarnings.push(fullWarn);
      });
    }
  });

  return {
    scenarioName,
    detectedUrl,
    actionsCount: actions.length,
    actions,
    globalWarnings,
  };
}

/**
 * Quét toàn bộ Page Objects trong thư mục pages/
 * @param {'desktop' | 'mobile-web'} platform
 * @param {string} rootDir
 */
function scanPages(platform = 'desktop', rootDir = process.cwd()) {
  const pagesDir = path.join(rootDir, 'pages', platform);
  const result = [];

  if (!fs.existsSync(pagesDir)) return result;

  const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const fullPath = path.join(pagesDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');

    // 1. Trích xuất Class Name
    const classMatch = content.match(/class\s+([A-Za-z0-9_]+)\s+extends\s+([A-Za-z0-9_]+)/);
    const className = classMatch ? classMatch[1] : path.basename(file, '.js');
    const baseClass = classMatch ? classMatch[2] : 'BasePage';

    // 2. Trích xuất Locators trong constructor
    const locators = [];
    const locatorRegex = /this\.([a-zA-Z0-9_]+)\s*=\s*(?:page|this\.page)\.([a-zA-Z0-9_().,'"`\s{}://=-]+);/g;
    let locMatch;
    while ((locMatch = locatorRegex.exec(content)) !== null) {
      locators.push({
        name: locMatch[1],
        expression: `page.${locMatch[2].trim()}`,
      });
    }

    // 3. Trích xuất Methods
    const methods = [];
    const methodRegex = /(?:async\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{/g;
    let methMatch;
    while ((methMatch = methodRegex.exec(content)) !== null) {
      const methodName = methMatch[1];
      if (methodName !== 'constructor' && !methodName.startsWith('_')) {
        const params = methMatch[2].trim().split(',').map((p) => p.trim()).filter(Boolean);
        methods.push({
          name: methodName,
          params,
        });
      }
    }

    result.push({
      className,
      fileName: file,
      relativePath: `pages/${platform}/${file}`,
      baseClass,
      locators,
      methods,
    });
  }

  return result;
}

module.exports = {
  parsePlaywrightScript,
  scanPages,
};
