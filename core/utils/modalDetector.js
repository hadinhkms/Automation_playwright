/**
 * modalDetector.js - Phat hien Modal / Popup / Dialog / Drawer dang hien thi
 */
async function isModalOrPopupVisible(page) {
  try {
    return await page.evaluate(() => {
      if (
        document.body.classList.contains('modal-open') ||
        document.body.classList.contains('overflow-hidden') ||
        document.documentElement.classList.contains('modal-open') ||
        document.body.style.overflow === 'hidden'
      ) {
        return true;
      }

      const modalSelectors = [
        'dialog[open]', '[role="dialog"]', '[role="alertdialog"]', '[aria-modal="true"]',
        '.modal.show', '.modal.in', '.modal:not([style*="display: none"])',
        '[class*="modal"][class*="open"]', '[class*="modal"][class*="active"]', '[class*="modal"][class*="show"]',
        '[class*="popup"][class*="open"]', '[class*="popup"][class*="active"]', '[class*="popup"][class*="show"]',
        '.onboarding-modal', '.onboarding-popup', '.swal2-container', '.swal2-shown',
        '.ant-modal-root', '.ant-modal-wrap', '.MuiDialog-root', '.MuiModal-root',
        '#common__modal', '.mbep-popup', 'div[id*="popup"]', 'div[id*="modal"]',
        'div[id*="onboarding"]', 'div[data-test-id*="modal"]', 'div[data-test-id*="popup"]',
        'div[data-test-id*="apply-method-selector"]', 'div[class*="bottom-sheet"]', 'div[class*="drawer"]'
      ];

      const isVisibleModal = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          style.display !== 'none' && style.visibility !== 'hidden' &&
          Number(style.opacity) !== 0 && rect.width >= 100 && rect.height >= 80 &&
          (style.position === 'fixed' || style.position === 'absolute')
        );
      };

      return modalSelectors.some((selector) => Array.from(document.querySelectorAll(selector)).some(isVisibleModal));
    });
  } catch (e) {
    return false;
  }
}

module.exports = { isModalOrPopupVisible };
