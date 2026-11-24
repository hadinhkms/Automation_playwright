/**
 * dashboard/services/logMasker.js
 * Che bí mật trong log của tiến trình con theo TỪNG DÒNG trước khi lưu bộ đệm/phát SSE. Dòng dở dang (chưa có
 * xuống dòng) được giữ lại tối đa FLUSH_MS để một bí mật bị cắt giữa hai chunk vẫn được che đủ; hết hạn hoặc khi
 * tiến trình kết thúc (flush) thì phát phần còn lại (đã che). Không đổi shape của sự kiện log.
 */
const FLUSH_MS = 200;
const MAX_PENDING = 8192; // dòng quá dài không xuống dòng: vẫn phải phát, tránh giữ vô hạn

function createLogMasker(mask, emit) {
  let pending = '';
  let timer = null;

  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (pending) { const text = pending; pending = ''; emit(mask(text)); }
  };

  function push(chunk) {
    const text = pending + String(chunk);
    const cut = text.lastIndexOf('\n');
    if (cut >= 0) {
      pending = text.slice(cut + 1);
      emit(mask(text.slice(0, cut + 1)));
    } else {
      pending = text;
    }
    if (timer) { clearTimeout(timer); timer = null; }
    if (pending.length > MAX_PENDING) flush();
    else if (pending) { timer = setTimeout(flush, FLUSH_MS); if (timer.unref) timer.unref(); }
  }

  return { push, flush };
}

module.exports = { createLogMasker, FLUSH_MS };
