/**
 * Tự đóng popup banner quảng cáo/nhắc đăng nhập ngay khi nó xuất hiện.
 *
 * QC hiện popup "Khoan đã, Hình như bạn chưa đăng nhập?" (img[alt="Banner"], src *popup-remind*)
 * khoảng 25-30s sau khi tải trang, cùng các banner chiến dịch dạng ReactModal + img[alt="Banner"]
 * và popup mời mở app .mbep-popup.mbep-popup-show (overlay fixed che cả header).
 * Thời điểm bật ngẫu nhiên so với bước test nên các lần đóng "tại chỗ" (closeAllPopupsIfVisible) và
 * page.addLocatorHandler (không chạy với locator.waitFor / click force) đều bỏ sót.
 *
 * Guard chạy trong trang (init script) và click nút X thật của popup → React tự đóng modal,
 * không ẩn/xoá node React quản lý. Đặt PW_KEEP_GUEST_POPUPS=1 để tắt khi cần test chính popup này.
 */
function guestPopupGuardScript() {
  if (window.__svGuestPopupGuard) return;
  window.__svGuestPopupGuard = true;

  const BANNER_SELECTOR = '.ReactModal__Content img[alt="Banner" i], .ReactModal__Content img[src*="popup-remind" i]';

  const clickClose = (container) => {
    const icon = container && container.querySelector('.svicon-close');
    if (!icon) return;
    const target = icon.closest('[class*="cursor-pointer"], button') || icon;
    target.click();
  };

  const closeBannerPopups = () => {
    document.querySelectorAll(BANNER_SELECTOR).forEach((img) => clickClose(img.closest('.ReactModal__Content')));
    // Popup mời mở app ("Việc vững vàng, đón xuân SANG"...): .mbep-popup.mbep-popup-show, overlay che cả header
    document.querySelectorAll('.mbep-popup.mbep-popup-show').forEach(clickClose);
  };

  const start = () => {
    closeBannerPopups();
    new MutationObserver(closeBannerPopups).observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
}

async function installGuestPopupGuard(context) {
  if (process.env.PW_KEEP_GUEST_POPUPS === '1') return false;
  if (context.__svGuestPopupGuardInstalled) return true;
  await context.addInitScript(guestPopupGuardScript);
  context.__svGuestPopupGuardInstalled = true;
  return true;
}

module.exports = { guestPopupGuardScript, installGuestPopupGuard };
