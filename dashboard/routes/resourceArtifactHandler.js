/**
 * dashboard/routes/resourceArtifactHandler.js
 * Artifact deletion and static file serving helpers for resourceRoutes.js.
 */
const fs = require('fs');
const path = require('path');
const { listResources } = require('../services/resourceService');
const { sendJson, parseBody, safeChildPath } = require('./routeUtils');

function safeDecodeUri(raw) {
  try { return decodeURIComponent(raw); } catch { return null; }
}

function countFolderArtifacts(dir) {
  const res = { files: 0, traceAndVideo: 0 };
  if (!fs.existsSync(dir)) return res;
  const visit = (cur) => {
    try {
      for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, e.name);
        if (e.isDirectory()) visit(full);
        else if (e.isFile()) {
          res.files += 1;
          if (/\.(zip|trace|webm)$/i.test(e.name)) res.traceAndVideo += 1;
        }
      }
    } catch {}
  };
  visit(dir);
  return res;
}

function serveFile(response, filePath, cache = false) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return sendJson(response, 404, { error: 'Không tìm thấy tài nguyên.' });
  }
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.webm': 'video/webm', '.zip': 'application/zip', '.woff2': 'font/woff2',
  };
  response.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Cache-Control': cache ? 'public, max-age=31536000' : 'no-store, no-cache, must-revalidate, max-age=0',
  });
  fs.createReadStream(filePath).pipe(response);
}

async function handleDeleteArtifact(request, response, root, reportDir, evidenceDir) {
  try {
    const { path: artPath = '', type = '' } = await parseBody(request);
    const res = listResources(false, root);
    if (type === 'evidence' && res.evidence.includes(artPath)) {
      const target = safeChildPath(evidenceDir, `/${artPath}`);
      if (!target || !fs.statSync(target).isFile()) throw new Error('Evidence không hợp lệ.');
      fs.unlinkSync(target);
      return sendJson(response, 200, { message: 'Đã xóa evidence.' }) || true;
    }
    if (type === 'evidence-folder') {
      const norm = artPath.replace(/^\/+|\/+$/g, '');
      const hasItem = norm && res.evidence.some((i) => i.startsWith(`${norm}/`));
      const target = hasItem ? safeChildPath(evidenceDir, `/${norm}`) : null;
      if (!target || target === evidenceDir || !target.startsWith(`${evidenceDir}${path.sep}`) || !fs.statSync(target).isDirectory()) {
        throw new Error('Folder evidence không hợp lệ.');
      }
      fs.rmSync(target, { recursive: true, force: true });
      return sendJson(response, 200, { message: 'Đã xóa folder evidence và toàn bộ ảnh bên trong.' }) || true;
    }
    if (type === 'report-folder' || type === 'report') {
      const norm = artPath.replace(/^\/+|\/+$/g, '');
      const target = type === 'report'
        ? path.dirname(safeChildPath(reportDir, `/${artPath}`) || '')
        : safeChildPath(reportDir, `/${norm}`);
      if (!target || target === reportDir || !target.startsWith(`${reportDir}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
        throw new Error('Báo cáo không hợp lệ.');
      }
      const del = countFolderArtifacts(target);
      fs.rmSync(target, { recursive: true, force: true });
      return sendJson(response, 200, { message: `Đã xóa folder báo cáo (${del.files} file, ${del.traceAndVideo} trace/video).` }) || true;
    }
    sendJson(response, 404, { error: 'Artifact không tồn tại hoặc không hợp lệ.' });
  } catch (e) { sendJson(response, 400, { error: e.message }); }
  return true;
}

module.exports = { safeDecodeUri, serveFile, handleDeleteArtifact };

