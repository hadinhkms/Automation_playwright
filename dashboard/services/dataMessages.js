/**
 * dashboard/services/dataMessages.js
 * core/utils/dataManager.js (over its line cap, so frozen by check:limits) still throws a few messages
 * without Vietnamese diacritics. The data routes pass every error through here so the UI shows proper text.
 */
const PHRASES = [
  ['da ton tai trong thu muc', 'đã tồn tại trong thư mục'],
  ['khong ton tai trong thu muc', 'không tồn tại trong thư mục'],
];

function accentDataMessage(message) {
  if (typeof message !== 'string') return message;
  return PHRASES.reduce((text, [plain, accented]) => text.split(plain).join(accented), message);
}

module.exports = { accentDataMessage };
