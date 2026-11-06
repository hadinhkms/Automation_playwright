/**
 * Custom Fixtures: Page Objects Shortcuts
 * Cung cấp shortcut trực tiếp vào các page objects thông dụng từ pages container
 * Giúp các kịch bản test có thể khai báo trực tiếp { homePage, loginPopup, ... }
 */

const { MobileJobApplyNoCVPage } = require('../../../pages/mobile-web/MobileJobApplyNoCVPage');
const { MobileJobApplyPage } = require('../../../pages/mobile-web/MobileJobApplyPage');
const { MobilePopupConsent } = require('../../../pages/mobile-web/MobilePopupConsent');

/**
 * Page Object mobile-web đặt tên `Mobile<Tên>.js`, trong khi PageContainer chỉ tìm `<Tên>Page.js`
 * (vd. 'loginPopup' → 'LoginPopupPage.js') nên `pages.loginPopup` luôn lỗi trên mobile.
 * Trên mobile, shortcut khởi tạo trực tiếp class Mobile*; desktop vẫn đi qua PageContainer.
 */
const MOBILE_SHORTCUTS = {
  homePage: () => require('../../../pages/mobile-web/MobileHomePage').MobileHomePage,
  loginPopup: () => require('../../../pages/mobile-web/MobileLoginPopup').MobileLoginPopup,
  popupConsent: () => MobilePopupConsent,
  onboardingPopup: () => require('../../../pages/mobile-web/MobileOnboardingPopup').MobileOnboardingPopup,
  userProfilePage: () => require('../../../pages/mobile-web/MobileUserProfilePage').MobileUserProfilePage,
  jobSearchPage: () => require('../../../pages/mobile-web/MobileJobSearchPage').MobileJobSearchPage,
};

const isMobilePlatform = (pageObjectsPlatform, isMobile) => {
  const platform = String(pageObjectsPlatform || 'auto').toLowerCase();
  if (platform === 'auto') return Boolean(isMobile);
  return platform.startsWith('mobile');
};

const shortcut = (name) => async ({ pages, page, featureName, pageObjectsPlatform, isMobile }, use) => {
  if (isMobilePlatform(pageObjectsPlatform, isMobile)) {
    const PageClass = MOBILE_SHORTCUTS[name]();
    await use(new PageClass(page, featureName));
    return;
  }
  await use(pages[name]);
};

module.exports = {
  homePage: shortcut('homePage'),
  loginPopup: shortcut('loginPopup'),
  popupConsent: shortcut('popupConsent'),
  onboardingPopup: shortcut('onboardingPopup'),
  userProfilePage: shortcut('userProfilePage'),
  jobSearchPage: shortcut('jobSearchPage'),
  createJobApplyPage: async ({}, use) => {
    await use((p) => new MobileJobApplyPage(p));
  },
  createJobApplyNoCVPage: async ({}, use) => {
    await use((p) => new MobileJobApplyNoCVPage(p));
  },
  createPopupConsent: async ({}, use) => {
    await use((p) => new MobilePopupConsent(p));
  },
};
