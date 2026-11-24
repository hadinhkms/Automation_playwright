/**
 * dashboard/services/frameworkUpdateLoader.js
 * scripts/update-framework chỉ có trong bản checkout repo (package.json "files" không đóng gói
 * scripts/). Nạp lười: bản cài từ package vẫn khởi động được và route trả 501 rõ ràng.
 */
const NOT_AVAILABLE = {
  ok: false,
  error: 'Cập nhật Framework chỉ có trong bản checkout repo (git clone), không có trong bản cài từ package.',
};

/** @returns {Function|null} updateFramework, hoặc null nếu module không được đóng gói. */
function loadUpdateFramework() {
  try {
    return require('../../scripts/update-framework').updateFramework;
  } catch (error) {
    // Chỉ khi CHÍNH scripts/update-framework vắng (dòng đầu message). Thiếu module con của nó
    // (Require stack vẫn nhắc update-framework.js) là lỗi thật và phải được ném lên.
    const firstLine = String(error.message).split('\n')[0];
    if (error.code === 'MODULE_NOT_FOUND' && /^Cannot find module '[^']*[\\/]update-framework(?:\.js)?'/.test(firstLine)) return null;
    throw error;
  }
}

module.exports = { loadUpdateFramework, NOT_AVAILABLE };
