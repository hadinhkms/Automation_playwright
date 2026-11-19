/**
 * dashboard/services/mobileBuildService.js
 * Upload / delete app builds in apps/ (REQ-201, BR-201, BR-202).
 * Uploads stream into apps/<name>.part and are renamed only when complete, so apps/ never holds half a file.
 */
const fs = require('fs');
const path = require('path');

const MAX_BUILD_BYTES = 300 * 1024 * 1024;
const BUILD_EXTENSIONS = { android: ['.apk'], ios: ['.ipa', '.app.zip'] };
const ALL_EXTENSIONS = Object.values(BUILD_EXTENSIONS).flat();
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const uploading = new Set();

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function appsDir(root) {
  return path.join(root, 'apps');
}

/** BR-202: plain file name, allowed characters only, no path, no hidden file, known extension. */
/** `platform` omitted: any known build type (.apk, .ipa, .app.zip). */
function validateBuildName(rawName, platform) {
  const name = String(rawName || '');
  const exts = platform ? BUILD_EXTENSIONS[platform] || [] : ALL_EXTENSIONS;
  if (!NAME_PATTERN.test(name) || name.includes('..')) {
    throw httpError(400, 'Tên file chỉ được chứa chữ, số, dấu chấm, gạch dưới, gạch ngang; không có đường dẫn hay file ẩn.');
  }
  if (!exts.some((ext) => name.toLowerCase().endsWith(ext))) {
    throw httpError(400, `Chỉ nhận file ${exts.join(', ')}.`);
  }
  return name;
}

function buildInfo(root, name) {
  const stat = fs.statSync(path.join(appsDir(root), name));
  return { path: `apps/${name}`, name, sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString() };
}

/**
 * Streams the request body into apps/<name>.part, then renames it.
 * Rejects with 400 (empty), 409 (exists / being uploaded / in use), 413 (> 300 MB).
 */
async function saveBuild(root, request, rawName, { overwrite = false, isInUse = () => false } = {}) {
  const name = validateBuildName(rawName);
  const declared = Number(request.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BUILD_BYTES) throw httpError(413, 'File vượt quá 300 MB.');
  const finalPath = path.join(appsDir(root), name);
  if (uploading.has(name)) throw httpError(409, `"${name}" đang được tải lên ở nơi khác.`);
  if (isInUse(`apps/${name}`)) throw httpError(409, `"${name}" đang được lượt chạy hiện tại dùng.`);
  if (fs.existsSync(finalPath) && !overwrite) throw httpError(409, `Đã có build "${name}". Xác nhận ghi đè để thay thế.`);

  uploading.add(name);
  const partPath = `${finalPath}.part`;
  try {
    fs.mkdirSync(appsDir(root), { recursive: true });
    const bytes = await streamToFile(request, partPath);
    if (bytes === 0) throw httpError(400, 'File rỗng (0 byte).');
    if (isInUse(`apps/${name}`)) throw httpError(409, `"${name}" đang được lượt chạy hiện tại dùng.`);
    fs.renameSync(partPath, finalPath);
    return buildInfo(root, name);
  } catch (err) {
    fs.rmSync(partPath, { force: true });
    throw err;
  } finally {
    uploading.delete(name);
  }
}

/** Writes the body to a new file; aborts with 413 past the limit or rejects when the client disconnects. */
function streamToFile(request, filePath) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let done = false;
    const out = fs.createWriteStream(filePath, { flags: 'wx' });
    const fail = (err) => {
      if (done) return;
      done = true;
      request.unpipe(out);
      out.destroy();
      out.once('close', () => reject(err));
      if (out.closed) reject(err);
    };
    request.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BUILD_BYTES) {
        fail(httpError(413, 'File vượt quá 300 MB.'));
        request.resume();
      }
    });
    request.on('close', () => { if (!request.complete) fail(httpError(400, 'Tải lên bị huỷ giữa chừng.')); });
    request.on('error', (err) => fail(httpError(400, `Tải lên lỗi: ${err.message}`)));
    out.on('error', (err) => fail(err.code === 'EEXIST' ? httpError(409, 'File tạm đang được dùng, thử lại sau.') : err));
    // 'close' (not 'finish'): the file handle must be released before the rename on Windows.
    out.on('close', () => {
      if (done) return;
      done = true;
      if (!request.complete) reject(httpError(400, 'Tải lên bị huỷ giữa chừng.'));
      else resolve(bytes);
    });
    request.pipe(out);
  });
}

function deleteBuild(root, rawName, { isInUse = () => false } = {}) {
  const name = validateBuildName(rawName);
  const filePath = path.join(appsDir(root), name);
  if (!fs.existsSync(filePath)) throw httpError(404, `Không tìm thấy build "${name}".`);
  if (uploading.has(name)) throw httpError(409, `"${name}" đang được tải lên.`);
  if (isInUse(`apps/${name}`)) throw httpError(409, `Không xoá được: "${name}" đang được lượt chạy hiện tại dùng.`);
  fs.rmSync(filePath, { force: true });
  return { deleted: `apps/${name}` };
}

module.exports = { saveBuild, deleteBuild, validateBuildName, MAX_BUILD_BYTES };
