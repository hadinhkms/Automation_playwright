/**
 * dashboard/routes/resourceRoutes.js
 * Handles Resource Explorer, Code Editor, Artifact Deletion, and Report/Evidence Serving.
 */
const fs = require('fs');
const path = require('path');
const {
  listResources, isDeveloperRequest, readResourceBody,
  resolveResource, createBackup, newestReport,
} = require('../services/resourceService');
const { sendJson, parseBody, safeChildPath } = require('./routeUtils');
const { safeDecodeUri, serveFile, handleDeleteArtifact } = require('./resourceArtifactHandler');

const CODE_ROOTS = ['tests', 'pages', 'core'];
const ENGINE_TOOLS_DIR = path.resolve(__dirname, '../../tools');

function listCodeFiles(root) {
  const files = [];
  const visit = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) visit(full);
      else if (e.isFile() && /\.(js|cjs|mjs|json)$/i.test(e.name)) {
        files.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  };
  CODE_ROOTS.forEach((r) => visit(path.join(root, r)));
  return files.sort();
}

function resolveCodeFile(filePath, root) {
  if (!listCodeFiles(root).includes(filePath)) return null;
  const abs = path.resolve(root, filePath);
  return CODE_ROOTS.some((r) => abs.startsWith(`${path.join(root, r)}${path.sep}`)) ? abs : null;
}

async function handleResourceRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();
  const reportDir = path.join(root, 'playwright-report');
  const evidenceDir = path.join(root, 'evidence');
  const toolsDir = path.join(root, 'tools');
  const engineToolsDir = context.engineDir ? path.join(context.engineDir, 'tools') : ENGINE_TOOLS_DIR;

  if (request.method === 'GET' && url.pathname === '/api/resources') {
    const isDev = isDeveloperRequest(request);
    return sendJson(response, 200, { ...listResources(isDev, root), isDeveloper: isDev }) || true;
  }
  if (request.method === 'GET' && url.pathname === '/api/code-files') {
    return sendJson(response, 200, { files: listCodeFiles(root) }) || true;
  }
  if (request.method === 'GET' && url.pathname === '/api/code') {
    const filePath = url.searchParams.get('path') || '';
    const abs = resolveCodeFile(filePath, root);
    if (!abs) return sendJson(response, 404, { error: 'File mã nguồn không hợp lệ.' }) || true;
    if (fs.statSync(abs).size > 1_048_576) return sendJson(response, 413, { error: 'File mã nguồn lớn hơn giới hạn 1 MB.' }) || true;
    return sendJson(response, 200, { path: filePath, content: fs.readFileSync(abs, 'utf8'), editable: true }) || true;
  }
  if (request.method === 'PUT' && url.pathname === '/api/code') {
    try {
      const body = await parseBody(request);
      const filePath = String(body.path || '');
      const isDev = isDeveloperRequest(request);
      if ((filePath === 'core/fixtures/baseTest.js' || filePath === 'core/fixtures/mobileWebTest.js') && !isDev) {
        return sendJson(response, 403, { error: `File '${filePath}' là Fixture nền tảng cốt lõi của framework, được bảo vệ chỉ đọc.` }) || true;
      }
      const abs = resolveCodeFile(filePath, root);
      if (!abs) return sendJson(response, 403, { error: 'File mã nguồn này không được phép chỉnh sửa.' }) || true;
      const content = String(body.content ?? '');
      if (Buffer.byteLength(content, 'utf8') > 1_048_576) return sendJson(response, 413, { error: 'Nội dung lớn hơn giới hạn 1 MB.' }) || true;
      if (filePath.endsWith('.json')) JSON.parse(content); else new Function(content);
      const backup = createBackup(filePath, abs, root);
      fs.writeFileSync(abs, content, 'utf8');
      sendJson(response, 200, { message: 'Đã lưu source file.', backup });
    } catch (e) { sendJson(response, 400, { error: `Không thể lưu: ${e.message}` }); }
    return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/resource') {
    const isDev = isDeveloperRequest(request);
    const res = readResourceBody(url.searchParams.get('path') || '', url.searchParams.get('reveal') === 'true', isDev, root);
    if (!res) return sendJson(response, 404, { error: 'Resource không hợp lệ.' }) || true;
    if (res.error) return sendJson(response, res.status, { error: res.error }) || true;
    return sendJson(response, 200, res) || true;
  }
  if (request.method === 'PUT' && url.pathname === '/api/resource') {
    try {
      const isDev = isDeveloperRequest(request);
      const body = await parseBody(request);
      const resPath = String(body.path || '');
      const abs = resolveResource(resPath, isDev, root);
      if (!abs) return sendJson(response, 404, { error: 'Resource không tồn tại.' }) || true;
      if (resPath.endsWith('.md') && !isDev) return sendJson(response, 403, { error: 'Tài liệu chuẩn của framework được bảo vệ. Chỉ nhà phát triển mới có quyền chỉnh sửa.' }) || true;
      if (!resPath.startsWith('data/') && !resPath.endsWith('.md')) return sendJson(response, 403, { error: 'Resource này không được phép chỉnh sửa.' }) || true;
      const content = String(body.content ?? '');
      if (Buffer.byteLength(content, 'utf8') > 1_048_576) return sendJson(response, 413, { error: 'Nội dung lớn hơn giới hạn 1 MB.' }) || true;
      if (resPath.endsWith('.json')) JSON.parse(content);
      const backup = createBackup(resPath, abs, root);
      fs.writeFileSync(abs, content, 'utf8');
      sendJson(response, 200, { message: 'Đã lưu thay đổi.', backup });
    } catch (e) { sendJson(response, 400, { error: e instanceof SyntaxError ? 'JSON không hợp lệ.' : e.message }); }
    return true;
  }
  if (request.method === 'DELETE' && url.pathname === '/api/artifact') {
    return handleDeleteArtifact(request, response, root, reportDir, evidenceDir);
  }
  if (request.method === 'GET' && url.pathname === '/report/latest') {
    const report = newestReport(root);
    if (!report) return sendJson(response, 404, { error: 'Chưa có Playwright report.' }) || true;
    const rel = path.relative(reportDir, report).split(path.sep).map(encodeURIComponent).join('/');
    response.writeHead(302, { Location: `/reports/${rel}` });
    response.end();
    return true;
  }
  if (request.method === 'GET' && url.pathname.startsWith('/reports/')) {
    const req = safeDecodeUri(url.pathname.slice('/reports'.length));
    if (req === null) return sendJson(response, 400, { error: 'URL report không hợp lệ.' }) || true;
    serveFile(response, safeChildPath(reportDir, req), true);
    return true;
  }
  if (request.method === 'GET' && url.pathname.startsWith('/evidence/')) {
    const req = safeDecodeUri(url.pathname.slice('/evidence'.length));
    if (req === null || !/\.(png|jpe?g|webp)$/i.test(req)) return sendJson(response, 404, { error: 'Evidence không hợp lệ.' }) || true;
    serveFile(response, safeChildPath(evidenceDir, req), true);
    return true;
  }
  if (request.method === 'GET' && url.pathname.startsWith('/tools/')) {
    const req = safeDecodeUri(url.pathname.slice('/tools'.length));
    if (req === null) return sendJson(response, 400, { error: 'URL tool không hợp lệ.' }) || true;
    const localTool = safeChildPath(toolsDir, req);
    const resolvedTool = (localTool && fs.existsSync(localTool)) ? localTool : safeChildPath(engineToolsDir, req);
    serveFile(response, resolvedTool);
    return true;
  }
  return false;
}

module.exports = { handleResourceRoutes, serveFile };
