/**
 * pageStability.js - Kiem tra va cho trang on dinh layout & loading hidden
 */
async function waitForPageStable(page, options = {}) {
  const { maxWaitMs = 5000, stableFrameCount = 5 } = options;
  try {
    await page.evaluate(async ({ maxWaitMs, stableFrameCount }) => {
      const startedAt = performance.now();
      let previousSignature = '';
      let stableFrames = 0;

      const hasRunningAnimations = () => {
        if (typeof document.getAnimations !== 'function') return false;
        return document.getAnimations({ subtree: true }).some((a) => a.playState === 'running' || a.pending);
      };

      const getLayoutSignature = () => {
        const elements = Array.from(document.querySelectorAll('body, body *'));
        const parts = [window.scrollX, window.scrollY, document.documentElement.scrollWidth, document.documentElement.scrollHeight];
        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          const s = window.getComputedStyle(el);
          if (s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0 && rect.width > 1 && rect.height > 1 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth) {
            parts.push(Math.round(rect.left * 2) / 2, Math.round(rect.top * 2) / 2, Math.round(rect.width * 2) / 2, Math.round(rect.height * 2) / 2);
            if (parts.length > 1200) break;
          }
        }
        return parts.join('|');
      };

      while (performance.now() - startedAt < maxWaitMs) {
        await new Promise((res) => requestAnimationFrame(res));
        const sig = getLayoutSignature();
        if (sig === previousSignature && !hasRunningAnimations()) {
          if (++stableFrames >= stableFrameCount) return;
        } else {
          stableFrames = 0;
          previousSignature = sig;
        }
      }
    }, { maxWaitMs, stableFrameCount });
  } catch (e) {}
}

async function waitForVisualLoadingHidden(page, options = {}) {
  const { timeout = 15000 } = options;
  try {
    await page.waitForFunction(() => {
      const selectors = ['.overlay-loading', '.ant-skeleton', '.ant-spin', '.skeleton', '.skeleton-loading', '.react-loading-skeleton', '[class*="skeleton"]', '[class*="Skeleton"]', '[class*="shimmer"]', '[class*="animate-pulse"]', '[aria-busy="true"]', '[role="progressbar"]'];
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0 && r.width > 1 && r.height > 1 && r.bottom >= 0 && r.right >= 0 && r.top <= window.innerHeight && r.left <= window.innerWidth;
      };
      return !selectors.some((sel) => Array.from(document.querySelectorAll(sel)).some(isVisible));
    }, null, { timeout });
  } catch (e) {}
}

async function scrollPageForStabilization(page) {
  try {
    await page.evaluate(async () => {
      const step = 400, delay = 150, max = document.documentElement.scrollHeight - window.innerHeight;
      for (let p = 0; p <= max; p += step) {
        window.scrollTo(0, Math.min(p, max));
        await new Promise((r) => setTimeout(r, delay));
      }
      window.scrollTo(0, 0);
    });
  } catch (e) {}
}

module.exports = { waitForPageStable, waitForVisualLoadingHidden, scrollPageForStabilization };
