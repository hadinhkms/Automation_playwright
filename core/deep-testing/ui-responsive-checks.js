'use strict';

const { expect } = require('@playwright/test');
const { DEFAULT_VIEWPORTS, evaluateInteractiveA11yInScope } = require('./ui-geometry-dom');
const {
  expectNoHorizontalScroll,
  expectPairwiseNoOverlap,
  expectNotOccluded,
} = require('./ui-layout-checks');

async function expectInteractiveA11y(scope, options = {}) {
  const timeout = options.timeout ?? 2500;
  const maxElements = options.maxElements ?? 50;

  await expect(async () => {
    const res = await evaluateInteractiveA11yInScope(scope, maxElements);
    expect(res.visibleInteractiveCount, 'Phải có ít nhất 1 phần tử tương tác hiển thị').toBeGreaterThan(0);
    expect(res.violations, `Vi phạm Interactive Accessibility: ${res.violations.join('; ')}`).toEqual([]);
  }).toPass({ timeout });
}

async function expectResponsiveIntegrity(page, options = {}) {
  const viewports = options.viewports ?? DEFAULT_VIEWPORTS;
  const required = options.requiredLocators ?? options.checkLocators ?? [];
  const optional = options.optionalLocators ?? [];
  const initialViewport = page.viewportSize();

  try {
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await expectNoHorizontalScroll(page, vp.name, { timeout: options.timeout });

      const activeLocators = [];
      for (const reqLoc of required) {
        const target = reqLoc.first();
        await expect(target, `[${vp.name}] Required locator phải hiển thị trên viewport ${vp.width}x${vp.height}`).toBeVisible();
        await expectNotOccluded(target, { timeout: options.timeout });
        activeLocators.push(target);
      }

      for (const optLoc of optional) {
        if ((await optLoc.count()) > 0 && (await optLoc.first().isVisible())) {
          await expectNotOccluded(optLoc.first(), { timeout: options.timeout });
          activeLocators.push(optLoc.first());
        }
      }

      if (activeLocators.length >= 2) {
        await expectPairwiseNoOverlap(activeLocators, { timeout: options.timeout });
      }
    }
  } finally {
    if (initialViewport) {
      await page.setViewportSize(initialViewport).catch(() => {});
    }
  }
}

async function expectNoBrokenImages(page) {
  const broken = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img'))
      .filter((img) => {
        const st = window.getComputedStyle(img);
        return (
          st.display !== 'none' &&
          st.visibility !== 'hidden' &&
          img.getBoundingClientRect().width > 0 &&
          (!img.complete || img.naturalWidth === 0)
        );
      })
      .map((img) => img.getAttribute('src') || '<unnamed-img>'),
  );
  expect(broken, `Phát hiện ảnh bị vỡ: ${broken.join(', ')}`).toEqual([]);
}

module.exports = {
  expectInteractiveA11y,
  expectResponsiveIntegrity,
  expectNoBrokenImages,
};

