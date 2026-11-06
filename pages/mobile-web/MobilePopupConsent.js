const { PopupConsent } = require('../desktop/PopupConsent');

/**
 * Consent "Đồng ý cho phép xử lý dữ liệu cá nhân" trên Mobile Web: dùng chung hành vi desktop
 * (PopupConsent.scrollContentToEndIfDisabled cuộn hết văn bản để mở khoá nút "Đồng ý").
 */
class MobilePopupConsent extends PopupConsent {}

module.exports = { MobilePopupConsent };
