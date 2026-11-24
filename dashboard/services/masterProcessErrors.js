/**
 * dashboard/services/masterProcessErrors.js
 * Lỗi có statusCode cho /api/mp/*: route chuyển thẳng statusCode này (mặc định 500 chỉ dành cho lỗi thật).
 */
function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** Không có Hub trên máy này: dịch vụ phụ thuộc chưa sẵn sàng (503), không phải lỗi máy chủ (500). */
function hubNotFoundError() {
  return httpError(503, 'Không tìm thấy Master Process Hub. Đặt biến môi trường MASTER_PROCESS_ROOT trỏ tới thư mục chứa master.py, hoặc cài Hub tại D:/_Master_Process.');
}

/** Ký tự điều khiển (\0, \r, \n, ...) không bao giờ hợp lệ trong đường dẫn target. */
function controlCharError() {
  return httpError(400, 'Target path chứa ký tự điều khiển không hợp lệ.');
}

const hasControlChars = (value) => /[\u0000-\u001f\u007f]/.test(String(value ?? ''));

module.exports = { httpError, hubNotFoundError, controlCharError, hasControlChars };
