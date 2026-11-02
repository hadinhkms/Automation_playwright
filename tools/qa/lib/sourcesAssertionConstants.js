'use strict';

const ASYNC_MATCHERS = new Set([
  'toBeVisible', 'toBeHidden', 'toHaveText', 'toContainText', 'toBeEnabled',
  'toBeDisabled', 'toHaveValue', 'toHaveValues', 'toBeChecked', 'toHaveCount',
  'toHaveAttribute', 'toHaveURL', 'toHaveTitle', 'toBeAttached', 'toBeInViewport',
  'toBeFocused', 'toBeEmpty', 'toBeEditable', 'toHaveClass', 'toHaveId',
  'toHaveCSS', 'toHaveJSProperty', 'toHaveScreenshot', 'toHaveAccessibleName',
  'toHaveAccessibleDescription', 'toHaveRole', 'toPass',
]);

const NAVIGATION_MATCHERS = new Set(['toHaveURL', 'toHaveTitle']);
const WEAK_EXISTENCE_MATCHERS = new Set(['toBeDefined', 'toBeTruthy']);

const VERIFIED_UI_HELPERS = new Set([
  'expectNoHorizontalScroll', 'expectNoHorizontalOverflow', 'expectNoTextOverflow',
  'expectPairwiseNoOverlap', 'expectNoOverlap', 'expectContainedIn',
  'expectContainedWithin', 'expectNotOccluded', 'expectInteractiveA11y',
  'expectResponsiveIntegrity', 'expectNoBrokenImages', 'expectMaxLengthEnforced',
]);

const VERIFIED_GUARD_HELPERS = new Set([
  'expectIdempotentSubmit', 'expectSafeXssRender', 'expectStatePersistence',
  'expectBoundaryRejected', 'expectPerformanceBudget',
  'expectNetworkFaultRecovery', 'expectMultiTabConcurrency',
]);

const VERIFIED_FIXTURE_HELPERS = new Set(['expectExpectedError']);

const VERIFIED_DEEP_HELPERS = new Set([
  ...VERIFIED_UI_HELPERS,
  ...VERIFIED_GUARD_HELPERS,
  ...VERIFIED_FIXTURE_HELPERS,
]);

const KNOWN_NON_NAVIGATION_MATCHERS = new Set([
  'toBeVisible', 'toBeHidden', 'toHaveText', 'toContainText', 'toBeEnabled',
  'toBeDisabled', 'toHaveValue', 'toHaveValues', 'toBeChecked', 'toHaveCount',
  'toHaveAttribute', 'toBeAttached', 'toBeInViewport', 'toBeFocused',
  'toBeEmpty', 'toBeEditable', 'toHaveClass', 'toHaveId', 'toHaveCSS',
  'toHaveJSProperty', 'toHaveScreenshot', 'toHaveAccessibleName',
  'toHaveAccessibleDescription', 'toHaveRole', 'toPass', 'toBeOK',
  'toBe', 'toEqual', 'toStrictEqual', 'toContain', 'toContainEqual',
  'toHaveLength', 'toBeTruthy', 'toBeFalsy', 'toBeNull', 'toBeUndefined',
  'toBeDefined', 'toBeNaN', 'toBeInstanceOf', 'toBeGreaterThan',
  'toBeGreaterThanOrEqual', 'toBeLessThan', 'toBeLessThanOrEqual',
  'toBeCloseTo', 'toMatch', 'toMatchObject', 'toHaveProperty',
  'toThrow', 'toThrowError',
]);

const PLAYWRIGHT_SAFE_CALL_WHITELIST = new Set([
  'goto', 'reload', 'goBack', 'goForward', 'setContent', 'bringToFront', 'close',
  'isClosed', 'pause', 'setViewportSize', 'viewportSize', 'setExtraHTTPHeaders',
  'setDefaultTimeout', 'setDefaultNavigationTimeout', 'addInitScript',
  'addScriptTag', 'addStyleTag', 'exposeFunction', 'exposeBinding',
  'route', 'unroute', 'unrouteAll', 'routeFromHAR', 'continue', 'fulfill',
  'abort', 'fallback', 'screenshot', 'pdf', 'video',
  'locator', 'getByRole', 'getByText', 'getByLabel', 'getByPlaceholder',
  'getByAltText', 'getByTitle', 'getByTestId', 'frameLocator', 'frame', 'frames',
  'mainFrame', 'contentFrame', 'ownerFrame', 'first', 'last', 'nth', 'filter',
  'and', 'or', ' describe',
  'click', 'dblclick', 'tap', 'fill', 'type', 'press', 'pressSequentially',
  'clear', 'check', 'uncheck', 'setChecked', 'selectOption', 'setInputFiles',
  'focus', 'blur', 'hover', 'dragTo', 'scrollIntoViewIfNeeded', 'dispatchEvent',
  'down', 'up', 'move', 'wheel', 'insertText',
  'waitForURL', 'waitForLoadState', 'waitForSelector', 'waitForFunction',
  'waitForTimeout', 'waitForEvent', 'waitForRequest', 'waitForResponse', 'waitFor',
  'evaluate', 'evaluateHandle', 'evaluateAll',
  'title', 'url', 'content', 'innerText', 'textContent', 'innerHTML',
  'inputValue', 'getAttribute', 'isVisible', 'isHidden', 'isEnabled',
  'isDisabled', 'isChecked', 'isEditable', 'count', 'all', 'allInnerTexts',
  'allTextContents', 'boundingBox',
  'context', 'page', 'pages', 'browser', 'newPage', 'newContext',
  'cookies', 'addCookies', 'clearCookies', 'storageState', 'grantPermissions',
  'clearPermissions', 'setGeolocation', 'setOffline',
  'request', 'fetch', 'get', 'post', 'put', 'delete', 'patch', 'head', 'dispose',
  'json', 'text', 'body', 'headers', 'headersArray', 'status', 'statusText', 'ok',
  'requireEnv', 'trim', 'toLowerCase', 'toUpperCase', 'slice', 'substring',
  'replace', 'replaceAll', 'split', 'join', 'includes', 'startsWith', 'endsWith',
  'match', 'exec', 'padStart', 'padEnd', 'charAt', 'indexOf', 'lastIndexOf',
  'map', 'forEach', 'find', 'findIndex', 'some', 'every', 'reduce', 'flat',
  'flatMap', 'push', 'pop', 'shift', 'unshift', 'concat', 'sort', 'reverse',
  'keys', 'values', 'entries', 'from', 'isArray', 'parse', 'stringify', 'now',
  'floor', 'ceil', 'round', 'max', 'min', 'abs', 'random', 'toString', 'valueOf',
  'log', 'warn', 'error', 'debug', 'info',
  'String', 'Number', 'Boolean', 'Array', 'Object', 'Date', 'RegExp', 'Error',
  'URL', 'URLSearchParams', 'Map', 'Set', 'Promise', 'resolve', 'reject', 'race',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI', 'setTimeout', 'clearTimeout',
]);

const SAFE_STANDALONE_CALLS = new Set([
  'requireEnv', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Date',
  'RegExp', 'Error', 'URL', 'URLSearchParams', 'Map', 'Set', 'Promise',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI', 'setTimeout', 'clearTimeout',
]);

const JS_CONTROL_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'await',
  'typeof', 'void', 'delete', 'throw', 'case', 'new', 'async', 'yield',
]);

const SAFE_EXPECT_HELPERS = new Set([
  'any', 'anything', 'arrayContaining', 'objectContaining',
  'stringContaining', 'stringMatching', 'closeTo',
]);

function extractVerifiedHelperImports(fileInput) {
  const raw = Array.isArray(fileInput) ? fileInput.join('\n') : String(fileInput || '');
  const map = new Map();
  if (!raw) return map;
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  const importPatterns = [
    /\bimport\s+(?!type\b)\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g,
    /\b(?:const|let|var)\s+\{([\s\S]*?)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const importRe of importPatterns) {
    let m;
    while ((m = importRe.exec(stripped)) !== null) {
      const specifiersBlock = m[1];
      const modulePath = m[2].trim().replace(/\\/g, '/');
      let allowedSet = null;
      if (/(?:^|\/|@)(?:support|deep-testing)\/(?:ui-checks|ui-layout-checks|ui-responsive-checks)(?:\.[jt]s)?$/.test(modulePath)) {
        allowedSet = VERIFIED_UI_HELPERS;
      } else if (/(?:^|\/|@)(?:support|deep-testing)\/(?:deep-guards|resilience-guards|security-guards)(?:\.[jt]s)?$/.test(modulePath)) {
        allowedSet = VERIFIED_GUARD_HELPERS;
      } else if (/(?:^|\/|@)(?:fixtures\/(?:base\.fixture|test-fixtures)|deep-testing(?:\/index)?)(?:\.[jt]s)?$/.test(modulePath)) {
        allowedSet = VERIFIED_DEEP_HELPERS;
      }
      if (!allowedSet) continue;
      for (const part of specifiersBlock.split(',')) {
        const cleaned = part.trim();
        if (!cleaned || /^type\s+/.test(cleaned)) continue;
        const mSpec = cleaned.match(/^([A-Za-z_$][A-Za-z0-9_$]*)(?:(?:\s+as\s+|\s*:\s*)([A-Za-z_$][A-Za-z0-9_$]*))?$/);
        if (!mSpec) continue;
        if (allowedSet.has(mSpec[1])) map.set(mSpec[2] || mSpec[1], mSpec[1]);
      }
    }
  }
  return map;
}

function blankOutImports(text) {
  return String(text || '').replace(
    /\bimport\s+(?:type\s+)?\{[\s\S]*?\}\s*from\s*['"][^'"]+['"]\s*;?|\bimport\s+[^;\n]+from\s*['"][^'"]+['"]\s*;?/g,
    (match) => match.replace(/[^\n]/g, ' '),
  );
}

module.exports = {
  ASYNC_MATCHERS,
  NAVIGATION_MATCHERS,
  WEAK_EXISTENCE_MATCHERS,
  VERIFIED_DEEP_HELPERS,
  KNOWN_NON_NAVIGATION_MATCHERS,
  PLAYWRIGHT_SAFE_CALL_WHITELIST,
  SAFE_STANDALONE_CALLS,
  JS_CONTROL_KEYWORDS,
  SAFE_EXPECT_HELPERS,
  extractVerifiedHelperImports,
  blankOutImports,
};

