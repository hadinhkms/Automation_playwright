const path = require('path');

function getFormattedDate(date) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return { dateStr: `${yy}-${mm}-${dd}`, timeStr: `${hh}-${min}-${ss}` };
}

function resolveEvidenceDir(featureName, runDateInfo, fallbackRunId) {
  let scriptName = '', configuredRunId = '', testFilePath = '', projectName = '';
  try {
    const { test } = require('@playwright/test');
    const info = test.info();
    if (info && info.file) {
      scriptName = path.basename(info.file).replace(/\.spec\.js$|\.js$/, '');
      configuredRunId = info.config?.metadata?.runId || '';
      testFilePath = info.file;
      projectName = info.project?.name || '';
    }
  } catch (e) {}

  if (!scriptName) scriptName = String(featureName || 'unknown');
  const safeName = scriptName.replace(/[^a-zA-Z0-9-_\s.]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').trim();
  const runId = String(configuredRunId || process.env.QA_RUN_ID || fallbackRunId).replace(/[^a-zA-Z0-9-_]+/g, '-');
  let runFolder = `[${runId}] evidence`;
  const parts = runId.split('-');
  if (parts.length >= 8) {
    runFolder = `[${parts.slice(0, 3).join('-')} ${parts.slice(3, 7).join('-')} ${parts.slice(7).join('-')}] evidence`;
  }

  let platformStr = '';
  if (testFilePath) {
    const norm = testFilePath.replace(/\\/g, '/').toLowerCase();
    if (norm.includes('/mobile-web/') || norm.includes('.mobile.')) platformStr = 'mobile-web';
    else if (norm.includes('/desktop/')) platformStr = 'desktop';
    else if (norm.includes('/api/')) platformStr = 'api';
  }
  if (!platformStr && projectName) {
    const lower = projectName.toLowerCase();
    if (lower.includes('mobile')) platformStr = 'mobile-web';
    else if (lower.includes('desktop')) platformStr = 'desktop';
    else if (lower.includes('api')) platformStr = 'api';
  }
  if (!platformStr && process.env.QA_PLATFORM) platformStr = process.env.QA_PLATFORM;
  if (!platformStr) platformStr = 'desktop';

  return `evidence/${runDateInfo.dateStr}/${platformStr}/${safeName}/${runFolder}`;
}

module.exports = { getFormattedDate, resolveEvidenceDir };
