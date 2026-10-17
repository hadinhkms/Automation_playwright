'use strict';

function mapProjectName(p, key) {
  if (!p || p === 'all') {
    return key === 'mobile'
      ? ['Mobile Chrome Smoke Tests', 'Mobile Chrome Regression Tests']
      : ['Desktop Smoke Tests', 'Desktop Regression Tests'];
  }
  const lower = p.toLowerCase();
  if (lower === 'chromium' || lower.includes('desktop chrome')) {
    return ['Desktop Smoke Tests', 'Desktop Regression Tests'];
  }
  if (lower === 'mobile-chrome' || lower.includes('pixel')) {
    return ['Mobile Chrome Smoke Tests', 'Mobile Chrome Regression Tests'];
  }
  if (lower === 'mobile-safari' || lower.includes('iphone')) {
    return ['Mobile Safari Smoke Tests', 'Mobile Safari Regression Tests'];
  }
  return [p];
}

function resolveConfiguredSuiteArgs(suite, config, matchedEntry) {
  const args = [];
  console.log(`[Suite Runner] Đang chạy kịch bản: ${suite.label || matchedEntry[0]}`);

  if (suite.type === 'composite' || (Array.isArray(suite.suites) && suite.suites.length > 0)) {
    const childKeys = Array.isArray(suite.suites) ? suite.suites : [];
    console.log(`[Composite Suite] Kịch bản cha kích hoạt ${childKeys.length} kịch bản con: ${childKeys.join(', ')}`);
    const compSpecs = [];
    const compProjects = [];
    let compWorkers = suite.workers || 2;
    const compGreps = [];

    for (const childKey of childKeys) {
      const childSuite = config.suites?.[childKey];
      if (!childSuite) continue;
      if (Array.isArray(childSuite.specs) && childSuite.specs.length > 0 && childSuite.specs !== 'all') {
        compSpecs.push(...childSuite.specs);
      } else if (childSuite.spec && childSuite.spec !== 'all') {
        compSpecs.push(childSuite.spec);
      }
      if (childSuite.project && childSuite.project !== 'all') {
        compProjects.push(...mapProjectName(childSuite.project, childSuite.platform));
      } else if (childSuite.platform === 'mobile') {
        compProjects.push('Mobile Chrome Smoke Tests', 'Mobile Chrome Regression Tests');
      } else if (childSuite.platform === 'desktop') {
        compProjects.push('Desktop Smoke Tests', 'Desktop Regression Tests');
      }
      if (childSuite.grep) compGreps.push(childSuite.grep);
      if (childSuite.workers) compWorkers = Math.max(compWorkers, childSuite.workers);
    }

    if (compSpecs.length > 0) args.push(...[...new Set(compSpecs)]);
    for (const proj of [...new Set(compProjects)]) args.push(`--project=${proj}`);
    if (compGreps.length > 0) args.push('--grep', compGreps.join('|'));
    if (compWorkers) args.push(`--workers=${compWorkers}`);
  } else if (suite.platforms && typeof suite.platforms === 'object') {
    const activePlatforms = Object.entries(suite.platforms).filter(([, p]) => p.enabled !== false);
    const multiSpecs = [];
    const multiProjects = [];
    let customWorkers = suite.workers || 2;

    for (const [pKey, pVal] of activePlatforms) {
      if (Array.isArray(pVal.specs) && pVal.specs.length > 0 && pVal.specs !== 'all') {
        multiSpecs.push(...pVal.specs);
      }
      if (pVal.project && pVal.project !== 'all') {
        multiProjects.push(...mapProjectName(pVal.project, pKey));
      } else if (pKey === 'mobile') {
        multiProjects.push('Mobile Chrome Smoke Tests', 'Mobile Chrome Regression Tests');
      } else if (pKey === 'desktop') {
        multiProjects.push('Desktop Smoke Tests', 'Desktop Regression Tests');
      }
      if (pVal.workers) customWorkers = Math.max(customWorkers, pVal.workers);
    }

    if (multiSpecs.length > 0) args.push(...[...new Set(multiSpecs)]);
    for (const proj of [...new Set(multiProjects)]) args.push(`--project=${proj}`);
    if (suite.grep) args.push('--grep', suite.grep);
    if (customWorkers) args.push(`--workers=${customWorkers}`);
  } else {
    if (Array.isArray(suite.specs) && suite.specs.length > 0 && suite.specs !== 'all') args.push(...suite.specs);
    else if (suite.spec && suite.spec !== 'all') args.push(suite.spec);
    if (suite.project && suite.project !== 'all') args.push(`--project=${suite.project}`);
    if (suite.grep) args.push('--grep', suite.grep);
    if (suite.workers) args.push(`--workers=${suite.workers}`);
  }
  return args;
}

module.exports = { mapProjectName, resolveConfiguredSuiteArgs };
