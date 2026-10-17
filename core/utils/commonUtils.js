const { withLocalOverrides } = require('./localExtensions');

let UiActions;
try {
  UiActions = require('./uiActions').UiActions;
} catch {
  UiActions = class UiActions {};
}

let ScreenshotHelper, getFormattedDate;
try {
  const sh = require('./screenshotHelper');
  ScreenshotHelper = sh.ScreenshotHelper;
  getFormattedDate = sh.getFormattedDate;
} catch {
  ScreenshotHelper = class ScreenshotHelper {};
  getFormattedDate = () => ({ dateStr: '', timeStr: '' });
}

let vnData;
try {
  vnData = require('./vnData');
} catch {
  vnData = null;
}

const generateRandomVNPhone = (opts) => (vnData ? vnData.generatePhone(vnData.createRng(opts?.seed), opts) : '0981234567');
const generateRandomEmail = () => `test_auto_${Date.now()}@example.com`;

const baseExports = {
  ScreenshotHelper,
  UiActions,
  getFormattedDate,
  generateRandomVNPhone,
  generateRandomEmail,
  generateVnCccd: (opts) => vnData?.generateCccd(vnData.createRng(opts?.seed), opts).cccd,
  generateVnMst: (opts) => vnData?.generateMst(vnData.createRng(opts?.seed), opts),
  generateVnPhone: (opts) => vnData?.generatePhone(vnData.createRng(opts?.seed), opts),
  generateVnFullName: (opts) => vnData?.generateFullName(vnData.createRng(opts?.seed), opts).fullName,
  generateVnPersona: (opts) => vnData?.generateRecords({ type: 'persona', count: 1, seed: opts?.seed, options: opts }).records[0]
};

module.exports = withLocalOverrides('commonUtils.local.js', baseExports);
