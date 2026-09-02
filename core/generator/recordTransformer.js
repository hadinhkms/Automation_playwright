const path = require('path');
const { sanitizeToIdentifier } = require('./namingUtils');

/**
 * Sinh draft Page Object và draft BDD Spec theo quy chuẩn AI_PROMPTS.md
 */
function transformToPomAndSpec({
  platform = 'desktop',
  actions = [],
  isNewPage = true,
  pageClassName = 'CustomPage',
  baseClass = 'BasePage',
  existingPagePath = '',
  existingContent = '',
  methodName = 'performRecordedActions',
  featureName = 'Recorded Feature',
  testName = 'Thực hiện kịch bản thao tác đã ghi',
  includeEvidence = true,
  url = '',
}) {
  const cleanClassName = sanitizeToIdentifier(pageClassName, true) || 'CustomPage';
  const finalClassName = (cleanClassName.endsWith('Page') || cleanClassName.endsWith('Popup'))
    ? cleanClassName
    : `${cleanClassName}Page`;

  const cleanMethodName = sanitizeToIdentifier(methodName) || 'performRecordedActions';
  const cleanFeatureName = featureName.trim() || 'Recorded Feature';
  const cleanTestName = testName.trim() || 'Thực hiện kịch bản thao tác đã ghi';

  // 1. Thu thập locators duy nhất
  const locatorMap = new Map();
  const collectedWarnings = [];

  actions.forEach((act) => {
    if (act.locator && act.locatorVar) {
      if (!locatorMap.has(act.locatorVar)) {
        locatorMap.set(act.locatorVar, act.locator.replace(/^page\./, ''));
      }
    }
    if (act.warnings && act.warnings.length > 0) {
      act.warnings.forEach((w) => {
        const warnText = `[${act.type.toUpperCase()}] ${act.summary}: ${w}`;
        if (!collectedWarnings.includes(warnText)) collectedWarnings.push(warnText);
      });
    }
  });

  // 2. Tạo thân hàm Page Object method
  const methodLines = [];
  actions.forEach((act) => {
    if (act.type === 'goto') {
      methodLines.push(`    await this.navigate('${act.url}');`);
      if (includeEvidence) {
        methodLines.push(`    await this.capture('${sanitizeToIdentifier(finalClassName).toLowerCase()}_page_loaded');`);
      }
    } else if (act.type === 'click') {
      methodLines.push(`    await this.actions.click(this.${act.locatorVar});`);
    } else if (act.type === 'fill') {
      methodLines.push(`    await this.actions.fill(this.${act.locatorVar}, '${act.value || ''}');`);
    } else if (act.type === 'select') {
      methodLines.push(`    await this.${act.locatorVar}.selectOption('${act.value || ''}');`);
    } else if (act.type === 'check') {
      methodLines.push(`    await this.${act.locatorVar}.check();`);
    } else if (act.type === 'uncheck') {
      methodLines.push(`    await this.${act.locatorVar}.uncheck();`);
    }
  });

  if (includeEvidence && methodLines.length > 0) {
    methodLines.push(`    await this.capture('${sanitizeToIdentifier(cleanMethodName).toLowerCase()}_completed');`);
  }

  const methodCode = `  async ${cleanMethodName}() {\n${methodLines.join('\n')}\n  }`;

  // 3. Dựng mã Page Object
  let pomCode = '';
  let pomRelativePath = existingPagePath || `pages/${platform}/${finalClassName}.js`;

  if (isNewPage || !existingContent) {
    const locatorsCode = Array.from(locatorMap.entries())
      .map(([name, expr]) => `    this.${name} = page.${expr};`)
      .join('\n');

    pomCode = `const { ${baseClass} } = require('../${baseClass}');

class ${finalClassName} extends ${baseClass} {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} [featureName]
   */
  constructor(page, featureName) {
    super(page, featureName);

${locatorsCode ? locatorsCode : '    // Khởi tạo các locators'}
  }

${methodCode}
}

module.exports = { ${finalClassName} };
`;
  } else {
    // Bổ sung vào class hiện có
    let updatedContent = existingContent;
    
    // Thêm locator còn thiếu vào constructor
    const missingLocators = [];
    locatorMap.forEach((expr, name) => {
      const checkRegex = new RegExp(`this\\.${name}\\s*=`);
      if (!checkRegex.test(updatedContent)) {
        missingLocators.push(`    this.${name} = page.${expr};`);
      }
    });

    if (missingLocators.length > 0) {
      const constructorMatch = updatedContent.match(/(super\([^)]*\);)/);
      if (constructorMatch) {
        updatedContent = updatedContent.replace(
          constructorMatch[1],
          `${constructorMatch[1]}\n${missingLocators.join('\n')}`
        );
      }
    }

    // Thêm method mới trước dấu đóng ngoặc cuối
    const lastBraceIdx = updatedContent.lastIndexOf('}');
    if (lastBraceIdx !== -1) {
      updatedContent =
        updatedContent.slice(0, lastBraceIdx).trimEnd() +
        `\n\n${methodCode}\n}\n` +
        updatedContent.slice(lastBraceIdx + 1);
    }
    pomCode = updatedContent;
  }

  // 4. Dựng mã Spec BDD
  const pageVar = finalClassName.charAt(0).toLowerCase() + finalClassName.slice(1);
  const specFileName = `${sanitizeToIdentifier(cleanFeatureName).toLowerCase() || 'recorded_flow'}-bdd.spec.js`;
  const specRelativePath = `tests/e2e/${platform}/${specFileName}`;

  const fixtureImport = platform === 'mobile-web'
    ? "const { test } = require('../../../core/fixtures/mobileWebTest');"
    : "const { test } = require('../../../core/fixtures/baseTest');";

  const specCode = `${fixtureImport}
const { ${finalClassName} } = require('../../../pages/${platform}/${finalClassName}');

test.describe('Feature: ${cleanFeatureName} @record @e2e', () => {

  test('${cleanTestName}', async ({ page }) => {
    const ${pageVar} = new ${finalClassName}(page, '${sanitizeToIdentifier(cleanFeatureName).toLowerCase()}');

    await test.step('Given Người dùng truy cập và chuẩn bị trang kiểm thử', async () => {
${url ? `      await ${pageVar}.navigate('${url}');\n` : ''}    });

    await test.step('When Người dùng thực hiện các thao tác đã ghi', async () => {
      await ${pageVar}.${cleanMethodName}();
    });

    await test.step('Then Kiểm tra trạng thái hoàn tất thành công', async () => {
      // Bổ sung các web-first assertion tại đây nếu cần thiết
    });
  });

});
`;

  return {
    pomDraft: {
      relativePath: pomRelativePath,
      content: pomCode,
      isNewFile: isNewPage || !existingContent,
    },
    specDraft: {
      relativePath: specRelativePath,
      content: specCode,
    },
    warnings: collectedWarnings,
  };
}

module.exports = {
  transformToPomAndSpec,
};
