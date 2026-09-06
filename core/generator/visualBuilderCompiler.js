const fs = require('fs');
const path = require('path');
const { sanitizeToIdentifier } = require('./namingUtils');
const { ASSERTION_DEFINITIONS, getAssertionDefinition } = require('./actionRegistry');
const {
  SCHEMA_VERSION,
  SUPPORTED_PLATFORMS,
  validateScenario,
  hashText,
} = require('./wizardSchema');

function compileAssertionStep(step) {
  const type = step.assertionType || step.actionId?.replace(/^assertion_/, '');
  const definition = getAssertionDefinition(type);
  if (!definition) return null;
    const target = definition.target === 'page' ? 'page' : `page.locator(${quote(step.locator || 'div')})`;
    const expected = definition.requiresValue
      ? definition.type === 'toHaveURL' ? `(new RegExp(${quote(step.expectedVal || '')}))` : `(${quote(step.expectedVal || '')})`
      : '()';
  return `      await expect(${target}).${definition.type}${expected};`;
}

function quote(value) {
  return JSON.stringify(String(value ?? ''));
}

function compilePresetStep(step, preset, context) {
  if (preset) return preset.codeTemplate(step, context);
  if (step.actionId === 'custom_code' && context.allowCustomCode) return String(step.code).trim();
  return null;
}

function resolveDataExpression(dataRef) {
  if (!dataRef || !dataRef.variable || !dataRef.path) return null;
  const segments = String(dataRef.path).split('.').filter(Boolean);
  if (!segments.every((segment) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment))) return null;
  return `${dataRef.variable}${segments.map((segment) => `.${segment}`).join('')}`;
}

function compileStepEvidence(step, context) {
  if (!step.evidence || step.evidence === false || !step.evidence.name) return '';
  const fixture = context.fixture || 'page';
  return `\n      await ${fixture}.capture(${quote(step.evidence.name)});`;
}

/**
 * Danh mục các mẫu hành động có sẵn (Preset Action Blocks)
 */
const PRESET_ACTIONS = [
  {
    id: 'auth_login_precondition',
    category: 'business',
    stepType: 'Given',
    name: 'Tiền điều kiện: Đăng nhập tự động bằng tài khoản hợp lệ (authSetup)',
    desc: 'Tạo tài khoản hoặc đăng nhập tự động trước khi vào luồng test, chụp ảnh bằng chứng ban đầu',
    fixture: 'authenticatedUser, homePage',
    codeTemplate: (step, ctx) => `      await homePage.expectHomepageVisible();
      await homePage.capture('precondition_logged_in_state');`,
  },
  {
    id: 'close_onboarding_popup',
    category: 'business',
    stepType: 'And',
    name: 'Đóng popup Onboarding nếu hiển thị',
    desc: 'Tự động kiểm tra và đóng popup giới thiệu/quảng cáo',
    fixture: 'onboardingPopup',
    codeTemplate: (step, ctx) => `      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });`,
  },
  {
    id: 'open_nocv_job_list',
    category: 'business',
    stepType: 'When',
    name: 'Xem danh sách việc làm không cần CV',
    desc: 'Đóng modal chặn và bấm link việc không cần CV trên trang chủ',
    fixture: 'homePage',
    codeTemplate: (step, ctx) => `      await homePage.closeBlockingModalIfVisible();
      await homePage.clickNoCVJobLink();
      await jobSearchPage.firstJobLink.waitFor({ state: 'visible', timeout: 15000 });`,
  },
  {
    id: 'select_first_job',
    category: 'business',
    stepType: 'When',
    name: 'Mở chi tiết việc làm đầu tiên và bắt đầu ứng tuyển',
    desc: 'Mở tab việc làm mới và khởi tạo trang JobApplyNoCVPage',
    fixture: 'jobSearchPage, createJobApplyNoCVPage',
    codeTemplate: (step, ctx) => `      const newPage = await jobSearchPage.clickFirstJob();
      jobApplyNoCVPage = createJobApplyNoCVPage(newPage);
      await jobApplyNoCVPage.capture('job_detail_opened', true);
      await jobApplyNoCVPage.startApplyNoCV({ otpCode: usersData[0]?.otp });`,
  },
  {
    id: 'fill_mini_profile',
    category: 'business',
    stepType: 'And',
    name: 'Điền thông tin Profile mini',
    desc: 'Tự động điền học vấn, năm sinh, địa điểm và nộp hồ sơ',
    fixture: 'jobApplyNoCVPage',
    codeTemplate: (step, ctx) => `      await jobApplyNoCVPage.capture('and_profile_start');
      await jobApplyNoCVPage.fillMiniProfile(applyData.noCVApply.job1);
      await jobApplyNoCVPage.capture('and_profile_filled');
      await jobApplyNoCVPage.submitProfile();
      await jobApplyNoCVPage.capture('and_profile_submitted');`,
  },
  {
    id: 'bulk_apply_all',
    category: 'business',
    stepType: 'And',
    name: 'Ứng tuyển hàng loạt các công việc gợi ý',
    desc: 'Bấm nút ứng tuyển tất cả việc làm phù hợp còn lại (Bulk Apply)',
    fixture: 'jobApplyNoCVPage, jobApplyPage',
    codeTemplate: (step, ctx) => {
      if (ctx?.pages?.some((p) => p.name === 'JobApplyPage') || (ctx?.fixture && ctx.fixture.includes('jobApplyPage'))) {
        return `      await jobApplyPage.bulkApply();\n      await jobApplyPage.capture('after_bulk_apply', true);`;
      }
      return `      const didBulkApply = await jobApplyNoCVPage.bulkApply(applyData.noCVApply.job2);\n      if (didBulkApply) {\n        await jobApplyNoCVPage.capture('and_bulk_apply_completed');\n      }`;
    },
  },
  {
    id: 'verify_applied_jobs',
    category: 'business',
    stepType: 'Then',
    name: 'Kiểm tra việc làm xuất hiện trong danh sách đã ứng tuyển',
    desc: 'Mở trang việc làm đã ứng tuyển và verify danh sách hiển thị',
    fixture: 'jobApplyNoCVPage, jobApplyPage',
    codeTemplate: (step, ctx) => {
      if (ctx?.pages?.some((p) => p.name === 'JobApplyPage') || (ctx?.fixture && ctx.fixture.includes('jobApplyPage'))) {
        return `      await jobApplyPage.openAppliedJobs();\n      await jobApplyPage.expectAppliedJobsVisible();\n      await jobApplyPage.capture('applied_jobs_list_visible', true);`;
      }
      return `      await jobApplyNoCVPage.openAppliedJobs();\n      await jobApplyNoCVPage.expectAppliedJobsVisible();\n      await jobApplyNoCVPage.capture('applied_jobs_list_visible', true);`;
    },
  },
  {
    id: 'navigate_url',
    category: 'interaction',
    stepType: 'Given',
    name: 'Mở đường dẫn URL',
    desc: 'Điều hướng trình duyệt đến một trang cụ thể',
    codeTemplate: (step, ctx) => `      await page.goto(${quote(step.url || 'https://seeker.vl24hv2.qc.sieuviet-team.com')});`,
  },
  {
    id: 'click_element',
    category: 'interaction',
    stepType: 'When',
    name: 'Bấm chuột (Click)',
    desc: 'Thực hiện click an toàn với cơ chế wait visible',
    codeTemplate: (step, ctx) => `      await page.locator(${quote(step.locator || 'button')}).click();`,
  },
  {
    id: 'fill_text',
    category: 'interaction',
    stepType: 'When',
    name: 'Nhập văn bản (Type/Fill)',
    desc: 'Nhập giá trị vào ô input',
    codeTemplate: (step, ctx) => `      await page.locator(${quote(step.locator || 'input')}).fill(${quote(step.value || '')});`,
  },
  {
    id: 'assert_visible',
    category: 'assertion',
    stepType: 'Then',
    name: 'Kiểm tra phần tử đang hiển thị (Visible)',
    desc: 'Xác nhận phần tử xuất hiện trên màn hình',
    codeTemplate: (step, ctx) => `      await expect(page.locator(${quote(step.locator || 'div')})).toBeVisible();`,
  },
  {
    id: 'assert_text',
    category: 'assertion',
    stepType: 'Then',
    name: 'Kiểm tra văn bản phần tử (Text)',
    desc: 'Xác nhận phần tử chứa đúng đoạn chữ mong đợi',
    codeTemplate: (step, ctx) => `      await expect(page.locator(${quote(step.locator || 'div')})).toContainText(${quote(step.expectedVal || '')});`,
  },
  {
    id: 'assert_url',
    category: 'assertion',
    stepType: 'Then',
    name: 'Kiểm tra chuyển trang đúng URL',
    desc: 'Xác nhận URL sau khi thao tác khớp đường dẫn mong đợi',
    codeTemplate: (step, ctx) => `      await expect(page).toHaveURL(new RegExp(${quote(step.expectedVal || '')}));`,
  },
];

/**
 * Biên dịch kịch bản dạng khối Visual Steps thành mã Playwright BDD Spec hoàn chỉnh
 * @param {Object} scenarioData
 * @returns {{ specRelativePath: string, specCode: string, requiredFixtures: string[], warnings: string[] }}
 */
function compileVisualScenario(scenarioData, options = {}) {
  const previewMode = Boolean(options?.previewMode || scenarioData?.previewMode);
  const {
    featureName = 'Tạo kịch bản kiểm thử trực quan',
    scenarioName = 'Thực hiện luồng thao tác người dùng',
    platform = 'desktop',
    tags = ['@e2e', '@visualBuilder'],
    steps = [],
  } = scenarioData || {};

  const actionIds = [
    ...PRESET_ACTIONS.map((preset) => preset.id),
    ...ASSERTION_DEFINITIONS.map((definition) => `assertion_${definition.type}`),
  ];
  const validation = validateScenario(scenarioData, { actionIds, previewMode });
  if (validation.errors.length > 0) {
    return {
      valid: false,
      specCode: '',
      specRelativePath: '',
      requiredFixtures: [],
      warnings: validation.warnings,
      errors: validation.errors,
      compiledHash: null,
    };
  }
  const normalized = validation.scenario;

  const cleanFeatureName = normalized.featureName;
  const cleanScenarioName = normalized.scenarioName;
  const cleanTagStr = normalized.tags.join(' ');

  const fileNameSlug = sanitizeToIdentifier(cleanFeatureName).toLowerCase() || 'visual_scenario';
  const specFileName = normalized.fileName || `${fileNameSlug}-bdd.spec.js`;
  const specRelativePath = `tests/e2e/${normalized.platform}/${specFileName}`;

  // 1. Phân tích các fixtures cần import
  const fixtureSet = new Set(['test']);
  const dataImports = new Set();
  let hasDynamicPages = false;

  normalized.dataSources.forEach((source) => {
    const variable = source.variable;
    dataImports.add(`const ${variable} = require('../../../${source.file}');`);
  });
  normalized.pageObjects.forEach((pageObject) => {
    const relativePath = typeof pageObject === 'string' ? pageObject : pageObject?.path || pageObject?.relativePath;
    if (relativePath) {
      const baseName = relativePath.split('/').pop().replace(/\.js$/, '');
      fixtureSet.add(baseName.charAt(0).toLowerCase() + baseName.slice(1));
    }
  });
  if (normalized.precondition.auth === 'authenticated') fixtureSet.add('authenticatedUser');
  if (normalized.precondition.closeOnboarding) fixtureSet.add('onboardingPopup');
  if (normalized.precondition.verifyLandingPage || normalized.precondition.captureInitial) fixtureSet.add('homePage');

  normalized.steps.forEach((step) => {
    const preset = PRESET_ACTIONS.find((p) => p.id === step.actionId);
    if (preset && preset.fixture) {
      preset.fixture.split(',').forEach((f) => fixtureSet.add(f.trim()));
    }
    if (step.actionId === 'auth_login_precondition' || step.actionId === 'select_first_job') {
      dataImports.add("const usersData = require('../../../data/users.json');");
    }
    if (step.actionId === 'fill_mini_profile' || step.actionId === 'bulk_apply_all') {
      dataImports.add("const applyData = require('../../../data/applyJobData.json');");
    }
    if (step.actionId === 'select_first_job') {
      hasDynamicPages = true;
    }
    if (step.actionId && (step.actionId.startsWith('assert_') || step.actionId.startsWith('assertion_'))) {
      fixtureSet.add('expect');
    }
  });

  const isMobile = normalized.platform === 'mobile-web';
  const fixtureImportPath = isMobile
    ? '../../../core/fixtures/mobileWebTest'
    : '../../../core/fixtures/baseTest';

  // 2. Tạo phần thân các bước BDD test.step()
  const stepBlocks = [];
  const preconditionLines = [];
  if (normalized.precondition.closeOnboarding) preconditionLines.push('      await onboardingPopup.closeIfVisible(undefined, { modalTimeout: 15000, closeBtnTimeout: 5000 });');
  if (normalized.precondition.verifyLandingPage) preconditionLines.push('      await homePage.expectHomepageVisible();');
  if (normalized.precondition.captureInitial) preconditionLines.push("      await homePage.capture('precondition_initial_state');");
  if (!preconditionLines.length) preconditionLines.push('      // Precondition đã sẵn sàng.');
  normalized.steps.forEach((step, idx) => {
    const stepType = step.stepType || (idx === 0 ? 'Given' : 'When');
    const stepTitle = step.title || step.name || `Bước ${idx + 1}`;
    const preset = PRESET_ACTIONS.find((p) => p.id === step.actionId);

    let stepBody = '';
    const assertionCode = compileAssertionStep(step);
    if (assertionCode) {
      stepBody = assertionCode;
    } else {
      stepBody = compilePresetStep(step, preset, { platform: normalized.platform, isMobile, allowCustomCode: normalized.allowCustomCode });
    }

    if (!stepBody) {
      const dataExpression = resolveDataExpression(step.dataRef || step.dataSource);
      if (step.actionId === 'fill_text' && dataExpression) {
        stepBody = `      await page.locator(${quote(step.locator || 'input')}).fill(${dataExpression});`;
      } else if (step.actionId === 'custom_code' && !normalized.allowCustomCode) {
        stepBody = '';
      }
    }

    if (!stepBody) {
      if (previewMode) {
        stepBody = '      // ⏳ Đang cấu hình hành động cho bước này trong Wizard...';
      } else {
        stepBody = '      throw new Error("BDD step has no executable action.");';
      }
    }

    const evidenceFixture = step.pageFixture || preset?.fixture?.split(',')[0]?.trim() || 'page';
    if (evidenceFixture === 'page') fixtureSet.add('page');
    stepBody += compileStepEvidence(step, { fixture: evidenceFixture });

    stepBlocks.push(`    await test.step(${quote(`${stepType} ${stepTitle}`)}, async () => {\n${stepBody}\n    });`);
  });

  // 3. Ghép thành file Spec hoàn chỉnh
  const fixturesArgList = Array.from(fixtureSet)
    .filter((f) => !(hasDynamicPages && f === 'jobApplyNoCVPage'))
    .filter((f) => f !== 'test' && f !== 'expect')
    .join(',\n    ');

  const specCode = `const { test, expect } = require('${fixtureImportPath}');
${Array.from(dataImports).join('\n')}

test.describe(${quote(`Feature: ${cleanFeatureName} ${cleanTagStr}`)}, () => {

  test(${quote(cleanScenarioName)}, async ({
    ${fixturesArgList || 'page'}
  }, testInfo) => {
    test.slow();
    test.setTimeout(600000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: ${quote(normalized.precondition.description || 'Khởi tạo bối cảnh và kiểm chứng tiền điều kiện kịch bản BDD')},
    });

    await test.step("Given Tiền điều kiện ban đầu", async () => {
${preconditionLines.join('\n')}
    });

${hasDynamicPages ? '    let jobApplyNoCVPage;\n' : ''}${stepBlocks.join('\n\n')}
  });
});
`;

  return {
    valid: true,
    schemaVersion: SCHEMA_VERSION,
    specRelativePath,
    specFileName,
    specCode,
    requiredFixtures: Array.from(fixtureSet),
    warnings: validation.warnings,
    errors: [],
    compiledHash: hashText(specCode),
  };
}

const FIXTURE_PAGE_MAP = {
  homePage: { name: 'HomePage.js', relativePath: 'pages/desktop/HomePage.js', className: 'HomePage' },
  loginPopup: { name: 'LoginPopup.js', relativePath: 'pages/desktop/LoginPopup.js', className: 'LoginPopup' },
  onboardingPopup: { name: 'OnboardingPopup.js', relativePath: 'pages/desktop/OnboardingPopup.js', className: 'OnboardingPopup' },
  popupConsent: { name: 'PopupConsent.js', relativePath: 'pages/desktop/PopupConsent.js', className: 'PopupConsent' },
  jobSearchPage: { name: 'JobSearchPage.js', relativePath: 'pages/desktop/JobSearchPage.js', className: 'JobSearchPage' },
  jobApplyPage: { name: 'JobApplyPage.js', relativePath: 'pages/desktop/JobApplyPage.js', className: 'JobApplyPage' },
  jobApplyNoCVPage: { name: 'JobApplyNoCVPage.js', relativePath: 'pages/desktop/JobApplyNoCVPage.js', className: 'JobApplyNoCVPage' },
  userProfilePage: { name: 'UserProfilePage.js', relativePath: 'pages/desktop/UserProfilePage.js', className: 'UserProfilePage' },
  createJobApplyPage: { name: 'JobApplyPage.js', relativePath: 'pages/desktop/JobApplyPage.js', className: 'JobApplyPage' },
  createJobApplyNoCVPage: { name: 'JobApplyNoCVPage.js', relativePath: 'pages/desktop/JobApplyNoCVPage.js', className: 'JobApplyNoCVPage' },
  mobileHomePage: { name: 'MobileHomePage.js', relativePath: 'pages/mobile-web/MobileHomePage.js', className: 'MobileHomePage' },
  mobileLoginPopup: { name: 'MobileLoginPopup.js', relativePath: 'pages/mobile-web/MobileLoginPopup.js', className: 'MobileLoginPopup' },
  mobileOnboardingPopup: { name: 'MobileOnboardingPopup.js', relativePath: 'pages/mobile-web/MobileOnboardingPopup.js', className: 'MobileOnboardingPopup' },
  mobilePopupConsent: { name: 'MobilePopupConsent.js', relativePath: 'pages/mobile-web/MobilePopupConsent.js', className: 'MobilePopupConsent' },
  mobileJobSearchPage: { name: 'MobileJobSearchPage.js', relativePath: 'pages/mobile-web/MobileJobSearchPage.js', className: 'MobileJobSearchPage' },
  mobileJobApplyNoCVPage: { name: 'MobileJobApplyNoCVPage.js', relativePath: 'pages/mobile-web/MobileJobApplyNoCVPage.js', className: 'MobileJobApplyNoCVPage' },
  mobileJobApplyPage: { name: 'MobileJobApplyPage.js', relativePath: 'pages/mobile-web/MobileJobApplyPage.js', className: 'MobileJobApplyPage' },
  mobileUserProfilePage: { name: 'MobileUserProfilePage.js', relativePath: 'pages/mobile-web/MobileUserProfilePage.js', className: 'MobileUserProfilePage' },
};

function getFixturePageMap(rootDir = process.cwd()) {
  const map = { ...FIXTURE_PAGE_MAP };
  const scanDirs = [
    { dir: 'pages/desktop', platform: 'desktop' },
    { dir: 'pages/mobile-web', platform: 'mobile-web' },
    { dir: 'pages', platform: 'base' },
  ];
  for (const item of scanDirs) {
    const fullDir = path.join(rootDir, item.dir);
    if (fs.existsSync(fullDir)) {
      const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.js'));
      for (const file of files) {
        const base = path.basename(file, '.js');
        const fix = base.charAt(0).toLowerCase() + base.slice(1);
        if (!map[fix]) {
          map[fix] = {
            name: file,
            relativePath: `${item.dir}/${file}`.replace(/\\/g, '/'),
            className: base,
          };
        }
      }
    }
  }
  return map;
}

/**
 * Trích xuất các bước BDD và metadata từ một file Spec có sẵn trong Framework
 * @param {string} filePath
 * @param {string} rootDir
 */
function parseExistingSpecFile(filePath, rootDir = process.cwd()) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Không tìm thấy file kịch bản: ${filePath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const normalizedPath = filePath.replace(/\\/g, '/');
  const isMobile = normalizedPath.includes('mobile-web');

  // 1. Trích xuất Feature Name & Tags (Chỉ lấy tags trong test.describe)
  let featureName = path.basename(filePath, '.spec.js');
  let tags = '';
  const descMatch = content.match(/test\.describe\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/i);
  if (descMatch) {
    const rawDescribeString = descMatch[1] || descMatch[2] || descMatch[3] || '';
    
    // Chỉ lấy tags nằm trong chuỗi của test.describe
    const describeTagMatches = rawDescribeString.match(/@[\w-]+/g) || [];
    tags = Array.from(new Set(describeTagMatches)).join(' ');

    const rawDesc = rawDescribeString.replace(/^Feature:\s*/i, '');
    featureName = rawDesc.replace(/@[\w-]+/g, '').trim();
  }

  // 2. Trích xuất Scenario Name
  let scenarioName = 'Kịch bản kiểm thử';
  const testMatch = content.match(/test\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/);
  if (testMatch) {
    scenarioName = (testMatch[1] || testMatch[2] || testMatch[3] || '').trim();
  }

  // 3. Trích xuất Data Source & Data Files
  let dataSource = 'none';
  const dataFiles = [];
  const dataRegex = /require\(\s*['"`](?:.*\/)?data\/([^'"`]+)['"`]\s*\)/gi;
  let dMatch;
  while ((dMatch = dataRegex.exec(content)) !== null) {
    const dName = dMatch[1];
    if (!dataFiles.some((d) => d.name === dName)) {
      dataFiles.push({
        name: dName,
        relativePath: `data/${dName}`,
      });
    }
  }
  if (dataFiles.length > 0) {
    dataSource = dataFiles[0].name;
  }

  // 4. Trích xuất Fixtures từ arguments của test()
  const fixtures = [];
  const argsMatch = content.match(/test\([^,]+,\s*async\s*\(\s*\{([^}]*)\}\s*\)/);
  if (argsMatch) {
    const rawArgs = argsMatch[1];
    rawArgs.split(',').forEach((arg) => {
      const trimmed = arg.trim();
      if (trimmed && trimmed !== 'page' && trimmed !== 'test' && trimmed !== 'expect') {
        fixtures.push(trimmed);
      }
    });
  }

  // 5. Trích xuất các Page Objects tham gia (1 script -> nhiều pages)
  const pageMap = new Map();
  const fixturePageMap = getFixturePageMap(rootDir);
  for (const [fixName, pageInfo] of Object.entries(fixturePageMap)) {
    const fixRegex = new RegExp(`\\b${fixName}\\b`);
    if (fixRegex.test(content) || fixtures.includes(fixName)) {
      const actRegex = new RegExp(`\\b${fixName}\\.([a-zA-Z0-9_]+)\\s*\\(`, 'g');
      const actions = [];
      let aMatch;
      while ((aMatch = actRegex.exec(content)) !== null) {
        const act = aMatch[1];
        if (!['capture', 'waitForLoadState', 'waitForTimeout'].includes(act) && !actions.includes(act)) {
          actions.push(act);
        }
      }

      if (fixName.startsWith('createJobApply')) {
        const boundVar = fixName === 'createJobApplyPage' ? 'jobApplyPage' : 'jobApplyNoCVPage';
        const boundActRegex = new RegExp(`\\b${boundVar}\\.([a-zA-Z0-9_]+)\\s*\\(`, 'g');
        let bMatch;
        while ((bMatch = boundActRegex.exec(content)) !== null) {
          const act = bMatch[1];
          if (!['capture', 'waitForLoadState', 'waitForTimeout'].includes(act) && !actions.includes(act)) {
            actions.push(act);
          }
        }
      }

      const existing = pageMap.get(pageInfo.relativePath);
      if (existing) {
        actions.forEach((a) => {
          if (!existing.actions.includes(a)) existing.actions.push(a);
        });
        existing.actionCount = existing.actions.length;
      } else {
        pageMap.set(pageInfo.relativePath, {
          name: pageInfo.name,
          className: pageInfo.className,
          relativePath: pageInfo.relativePath,
          actions,
          actionCount: actions.length,
        });
      }
    }
  }
  const pages = Array.from(pageMap.values());

  // 6. Trích xuất Steps từ test.step()
  const stepRegex = /await\s+test\.step\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)\s*,\s*async\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\}\s*\);/g;
  const steps = [];
  let match;
  while ((match = stepRegex.exec(content)) !== null) {
    const rawTitle = (match[1] || match[2] || match[3] || '').trim();
    const body = (match[4] || '').trim();
    let stepType = 'When';
    let cleanTitle = rawTitle;

    const typeMatch = rawTitle.match(/^(Given|When|Then|And)\s+(.+)$/i);
    if (typeMatch) {
      stepType = typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1).toLowerCase();
      if (stepType === 'And') stepType = 'And';
      cleanTitle = typeMatch[2].trim();
    }

    let matchedActionId = '';

    // 1. Kiểm tra chính xác các method invocation đặc trưng
    if (body.includes('.bulkApply(')) {
      matchedActionId = 'bulk_apply_all';
    } else if (body.includes('.openAppliedJobs(') || body.includes('.expectAppliedJobsVisible(')) {
      matchedActionId = 'verify_applied_jobs';
    } else if (body.includes('.fillMiniProfile(') || body.includes('.submitProfile(') || body.includes('.submitGuestProfile(')) {
      matchedActionId = 'fill_mini_profile';
    } else if (body.includes('.clickFirstJob(') || body.includes('.startApplyNoCV(')) {
      matchedActionId = 'select_first_job';
    } else if (body.includes('.clickNoCVJobLink(')) {
      matchedActionId = 'open_nocv_job_list';
    } else if (body.includes('onboardingPopup') && body.includes('.closeIfVisible(')) {
      matchedActionId = 'close_onboarding_popup';
    } else if (body.includes('.expectHomepageVisible(')) {
      matchedActionId = 'auth_login_precondition';
    } else if (body.includes('.goto(')) {
      matchedActionId = 'navigate_url';
    }

    // 2. Kiểm tra semantic từ tiêu đề bước
    if (!matchedActionId) {
      const lowerTitle = cleanTitle.toLowerCase();
      if (lowerTitle.includes('bulk apply') || lowerTitle.includes('hàng loạt') || lowerTitle.includes('apply tất cả')) {
        matchedActionId = 'bulk_apply_all';
      } else if (lowerTitle.includes('đã ứng tuyển')) {
        matchedActionId = 'verify_applied_jobs';
      } else if (lowerTitle.includes('profile mini')) {
        matchedActionId = 'fill_mini_profile';
      }
    }

    // 3. Khớp chính xác theo tên mẫu preset
    if (!matchedActionId) {
      const exactPreset = PRESET_ACTIONS.find((p) => p.name.toLowerCase() === cleanTitle.toLowerCase());
      if (exactPreset) {
        matchedActionId = exactPreset.id;
      }
    }

    // 4. Khớp assertion nếu có
    if (!matchedActionId) {
      const assertionMatch = body.match(/\.((?:toBeVisible|toBeHidden|toHaveText|toContainText|toHaveValue|toHaveURL|toBeEnabled|toBeDisabled))\s*\(/);
      if (assertionMatch) {
        matchedActionId = `assertion_${assertionMatch[1]}`;
      }
    }

    steps.push({
      id: `s_${Date.now()}_${steps.length + 1}`,
      stepType,
      title: cleanTitle,
      actionId: matchedActionId,
      code: body,
    });
  }

  return {
    filePath: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
    featureName,
    scenarioName,
    platform: isMobile ? 'mobile-web' : 'desktop',
    tags: tags || '@e2e @visualBuilder',
    dataSource,
    dataFiles,
    primaryDataFile: dataFiles[0]?.name || (dataSource !== 'none' ? dataSource : null),
    pages,
    pageCount: pages.length,
    fixtures,
    steps,
    stepCount: steps.length,
    specCode: content,
  };
}

/**
 * Quét toàn bộ kịch bản test hiện có trong framework
 * @param {string} rootDir
 */
function scanAllProjectScripts(rootDir = process.cwd()) {
  const scripts = [];
  const dirsToScan = [
    { dir: 'tests/e2e/desktop', platform: 'desktop' },
    { dir: 'tests/e2e/mobile-web', platform: 'mobile-web' },
    { dir: 'tests/api', platform: 'api' },
    { dir: 'tests/setup', platform: 'setup' },
  ];

  for (const item of dirsToScan) {
    const fullDir = path.join(rootDir, item.dir);
    if (fs.existsSync(fullDir)) {
      const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.spec.js') || f.endsWith('.setup.js') || f.endsWith('.js'));
      for (const file of files) {
        try {
          const relPath = path.join(item.dir, file).replace(/\\/g, '/');
          const parsed = parseExistingSpecFile(relPath, rootDir);
          scripts.push({
            id: path.basename(file, '.spec.js').replace(/\.setup$/, '').replace(/\.js$/, ''),
            fileName: file,
            relativePath: relPath,
            featureName: parsed.featureName,
            scenarioName: parsed.scenarioName,
            platform: item.platform,
            tags: parsed.tags,
            dataFiles: parsed.dataFiles,
            primaryDataFile: parsed.primaryDataFile,
            pages: parsed.pages,
            pageCount: parsed.pages.length,
            stepCount: parsed.steps.length,
            steps: parsed.steps,
            specCode: parsed.specCode,
          });
        } catch (err) {
          console.error(`Error parsing script ${file}:`, err.message);
        }
      }
    }
  }
  return scripts;
}

module.exports = {
  PRESET_ACTIONS,
  compileVisualScenario,
  parseExistingSpecFile,
  scanAllProjectScripts,
  getFixturePageMap,
};
