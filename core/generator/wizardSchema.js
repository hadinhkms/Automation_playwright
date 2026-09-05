const crypto = require('crypto');

const SCHEMA_VERSION = 1;
const SUPPORTED_PLATFORMS = ['desktop', 'mobile-web'];
const STEP_TYPES = ['Given', 'When', 'Then', 'And'];
const SAFE_SPEC_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.spec\.js$/;

function normalizeScenario(input = {}) {
  const tags = Array.isArray(input.tags)
    ? input.tags
    : String(input.tags || '').split(/\s+/).filter(Boolean);
  return {
    schemaVersion: Number(input.schemaVersion || SCHEMA_VERSION),
    featureName: String(input.featureName || '').trim(),
    scenarioName: String(input.scenarioName || '').trim(),
    fileName: String(input.fileName || '').trim(),
    platform: String(input.platform || 'desktop'),
    tags: tags.map((tag) => String(tag).trim()).filter(Boolean),
    precondition: input.precondition && typeof input.precondition === 'object' ? input.precondition : {},
    dataSources: Array.isArray(input.dataSources) ? input.dataSources : [],
    pageObjects: Array.isArray(input.pageObjects) ? input.pageObjects : [],
    steps: Array.isArray(input.steps) ? input.steps.map((step) => ({
      ...step,
      stepType: step?.stepType || 'When',
      actionId: step?.actionId || '',
      title: String(step?.title || '').trim(),
      dataRef: step?.dataRef || step?.dataSource || null,
      evidence: step?.evidence === false ? false : (step?.evidence || null),
    })) : [],
    allowCustomCode: input.allowCustomCode === true,
  };
}

function validateScenario(input, { actionIds = [], fixtureIds = [], previewMode = false } = {}) {
  const scenario = normalizeScenario(input);
  const errors = [];
  const warnings = [];
  if (scenario.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion phải là ${SCHEMA_VERSION}.`);
  if (!scenario.featureName) {
    if (!previewMode) errors.push('Thiếu featureName.');
    else warnings.push('Thiếu featureName.');
  }
  if (!scenario.scenarioName) {
    if (!previewMode) errors.push('Thiếu scenarioName.');
    else warnings.push('Thiếu scenarioName.');
  }
  if (scenario.fileName && !SAFE_SPEC_FILE.test(scenario.fileName)) errors.push('fileName phải là tên .spec.js an toàn.');
  if (!SUPPORTED_PLATFORMS.includes(scenario.platform)) errors.push(`Platform không được hỗ trợ: ${scenario.platform}.`);
  if (scenario.tags.some((tag) => !/^@[a-zA-Z][\w-]*$/.test(tag))) {
    if (!previewMode) errors.push('Tags phải có dạng @tag.');
    else warnings.push('Tags phải có dạng @tag.');
  }
  if (!scenario.steps.length) warnings.push('Kịch bản chưa có bước nào.');

  scenario.steps.forEach((step, index) => {
    if (!step || typeof step !== 'object') return errors.push(`Bước ${index + 1} không hợp lệ.`);
    if (!STEP_TYPES.includes(step.stepType || 'When')) {
      if (!previewMode) errors.push(`Bước ${index + 1} có stepType không hợp lệ.`);
      else warnings.push(`Bước ${index + 1} có stepType không hợp lệ.`);
    }
    if (!step.actionId) {
      if (!previewMode) errors.push(`Bước ${index + 1} chưa chọn action.`);
      else warnings.push(`Bước ${index + 1} chưa chọn action.`);
    } else if (!actionIds.includes(step.actionId) && step.actionId !== 'custom_code') {
      if (!previewMode) errors.push(`Action không tồn tại: ${step.actionId}.`);
      else warnings.push(`Action không tồn tại: ${step.actionId}.`);
    }
    if (['click_element', 'fill_text'].includes(step.actionId) && !String(step.locator || '').trim()) {
      if (!previewMode) errors.push(`Action ${step.actionId} ở bước ${index + 1} cần locator.`);
      else warnings.push(`Action ${step.actionId} ở bước ${index + 1} cần locator.`);
    }
    if (step.actionId === 'navigate_url' && !String(step.url || '').trim()) {
      if (!previewMode) errors.push(`Action navigate_url ở bước ${index + 1} cần URL.`);
      else warnings.push(`Action navigate_url ở bước ${index + 1} cần URL.`);
    }
    if (step.actionId === 'custom_code' && !scenario.allowCustomCode) errors.push('custom_code cần allowCustomCode=true.');
    if (step.actionId === 'custom_code' && !String(step.code || '').trim()) {
      if (!previewMode) errors.push(`Bước ${index + 1} thiếu custom code.`);
      else warnings.push(`Bước ${index + 1} thiếu custom code.`);
    }
    if (step.dataSource && typeof step.dataSource !== 'object') errors.push(`dataSource ở bước ${index + 1} không hợp lệ.`);
    if (step.dataSource && (!step.dataSource.file || !step.dataSource.variable || !step.dataSource.dataPath)) {
      if (!previewMode) errors.push(`dataSource ở bước ${index + 1} phải có file, variable và dataPath.`);
      else warnings.push(`dataSource ở bước ${index + 1} phải có file, variable và dataPath.`);
    }
    if (step.dataRef && (!step.dataRef.variable || !String(step.dataRef.path || '').trim())) {
      if (!previewMode) errors.push(`dataRef ở bước ${index + 1} phải có variable và path.`);
      else warnings.push(`dataRef ở bước ${index + 1} phải có variable và path.`);
    }
    if (step.evidence && typeof step.evidence === 'object' && step.evidence.name && !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(step.evidence.name)) {
      errors.push(`Tên evidence ở bước ${index + 1} không hợp lệ.`);
    }
  });

  scenario.pageObjects.forEach((pageObject, index) => {
    if (typeof pageObject === 'string') {
      if (!pageObject.startsWith('pages/')) errors.push(`pageObjects[${index}] phải thuộc pages/.`);
      return;
    }
    if (!pageObject || !pageObject.fixture) errors.push(`pageObjects[${index}] thiếu fixture.`);
    else if (fixtureIds.length && !fixtureIds.includes(pageObject.fixture)) warnings.push(`Fixture chưa có metadata: ${pageObject.fixture}.`);
  });
  scenario.dataSources.forEach((source, index) => {
    const isBasicValid = source && typeof source === 'object' && /^data\/[A-Za-z0-9._-]+\.json$/.test(String(source.file || '')) && /^[A-Za-z][A-Za-z0-9_]*$/.test(String(source.variable || ''));
    if (!isBasicValid || (!previewMode && !String(source.dataPath || '').trim())) {
      if (!previewMode) errors.push(`dataSources[${index}] phải có file data/, variable và dataPath hợp lệ.`);
      else warnings.push(`dataSources[${index}] chưa cấu hình dataPath hợp lệ.`);
    }
  });
  return { scenario, errors, warnings };
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashText(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

module.exports = {
  SCHEMA_VERSION,
  SUPPORTED_PLATFORMS,
  STEP_TYPES,
  normalizeScenario,
  validateScenario,
  stableSerialize,
  hashText,
};
