/**
 * dashboard/routes/recorderDraftRoutes.js
 * Các endpoint không giữ trạng thái của Recorder: quét Page Object, chuyển bản ghi thành POM + spec, lưu bản nháp
 * (tách từ recorderRoutes.js để file đó xuống dưới vùng vàng).
 */
const { execSync } = require('child_process');
const { sendJson, parseBody } = require('./routeUtils');
const { parsePlaywrightScript, scanPages } = require('../../core/generator/recordParser');
const { transformToPomAndSpec } = require('../../core/generator/recordTransformer');
const { saveDraftFiles } = require('../../core/generator/recordWriter');
const { createBackup } = require('../services/resourceService');

async function handleRecorderDraftRoutes(request, response, url, root) {
  if (request.method === 'POST' && url.pathname === '/api/recorder/scan-pages') {
    try {
      const body = await parseBody(request);
      const platform = body.platform === 'mobile-web' ? 'mobile-web' : 'desktop';
      return sendJson(response, 200, { platform, pages: scanPages(platform, root) });
    } catch (err) {
      return sendJson(response, 400, { error: err.message });
    }
  }

  if (request.method === 'POST' && (url.pathname === '/api/recorder/convert' || url.pathname === '/api/recorder/generate-draft')) {
    try {
      const body = await parseBody(request);
      const platform = body.platform === 'mobile-web' ? 'mobile-web' : 'desktop';
      const parsed = parsePlaywrightScript(String(body.rawScript || ''));
      const result = transformToPomAndSpec({
        platform,
        actions: body.actions || parsed.actions,
        isNewPage: body.isNewPage !== false,
        pageClassName: body.pageClassName || 'CustomPage',
        baseClass: 'BasePage',
        methodName: body.methodName || 'performRecordedActions',
        featureName: body.featureName || 'Recorded Feature',
        testName: body.testName || 'Recorded Scenario',
        includeEvidence: body.includeEvidence !== false,
        url: parsed.detectedUrl || parsed.url || '',
      });
      return sendJson(response, 200, result);
    } catch (err) {
      return sendJson(response, 400, { error: err.message });
    }
  }

  if (request.method === 'POST' && (url.pathname === '/api/recorder/save-draft' || url.pathname === '/api/recorder/save')) {
    try {
      const body = await parseBody(request);
      const saveResult = saveDraftFiles({ ROOT: root, pomFile: body.pomFile, specFile: body.specFile, createBackupFn: createBackup, execSyncFn: execSync });
      return sendJson(response, 200, saveResult);
    } catch (err) {
      return sendJson(response, 400, { error: err.message });
    }
  }

  return false;
}

module.exports = { handleRecorderDraftRoutes };
