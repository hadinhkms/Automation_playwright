'use strict';

const { expect } = require('@playwright/test');
const {
  DEFAULT_VIEWPORTS,
  boxesOverlap,
  waitForLayoutStability,
  evaluateTextOverflowInScope,
  evaluateContainmentAndAncestorClip,
  evaluateOcclusionOnElement,
} = require('./ui-geometry-dom');

function pageOf(scope) {
  return 'mainFrame' in scope ? scope : scope.page();
}

async function expectNoHorizontalScroll(page, label = 'viewport', options = {}) {
  const tolerancePx = options.tolerancePx ?? 1;
  const timeout = options.timeout ?? 2500;

  await expect(async () => {
    await waitForLayoutStability(page, 16);
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
      return { scrollWidth, clientWidth: doc.clientWidth };
    });
    expect(
      metrics.scrollWidth - metrics.clientWidth,
      `[${label}] Trang bị tràn khung ngang: scrollWidth (${metrics.scrollWidth}px) > clientWidth (${metrics.clientWidth}px)`,
    ).toBeLessThanOrEqual(tolerancePx);
  }).toPass({ timeout });
}

async function expectNoHorizontalOverflow(page, tolerancePx = 1) {
  await expectNoHorizontalScroll(page, 'viewport', { tolerancePx });
}

async function expectNoTextOverflow(
  scope,
  selectors = 'h1,h2,h3,h4,p,span,label,button,a,td,th,li,[data-testid]',
  options = {},
) {
  const page = pageOf(scope);
  const timeout = options.timeout ?? 2500;
  const settleMs = options.settleMs ?? 180;

  await expect(async () => {
    await waitForLayoutStability(page, settleMs);
    const res = await evaluateTextOverflowInScope(scope, selectors, {
      allowEllipsis: Boolean(options.allowEllipsis),
      allowScrollable: Boolean(options.allowScrollable),
    });
    expect(
      res.visibleCount,
      `expectNoTextOverflow: Bắt buộc có ít nhất 1 phần tử hiển thị khớp selector "${selectors}"`,
    ).toBeGreaterThan(0);
    expect(res.offenders, `Phát hiện tràn chữ (Text Overflow) tại: ${res.offenders.join('; ')}`).toEqual([]);

    if (options.optionalSelectors) {
      const optRes = await evaluateTextOverflowInScope(scope, options.optionalSelectors, {
        allowEllipsis: Boolean(options.allowEllipsis),
        allowScrollable: Boolean(options.allowScrollable),
      });
      expect(optRes.offenders, `Phát hiện tràn chữ trên optional selector tại: ${optRes.offenders.join('; ')}`).toEqual([]);
    }
  }).toPass({ timeout });
}

async function expectPairwiseNoOverlap(locators, options) {
  const tolerancePx = typeof options === 'number' ? options : (options?.tolerancePx ?? 1);
  const timeout = typeof options === 'number' ? 2500 : (options?.timeout ?? 2500);
  expect(locators.length, 'expectPairwiseNoOverlap cần ít nhất 2 locator').toBeGreaterThanOrEqual(2);

  await expect(async () => {
    const boxes = [];
    for (let i = 0; i < locators.length; i++) {
      const loc = locators[i];
      const visible = await loc.isVisible();
      expect(visible, `Phần tử #${i} không hiển thị (isVisible=false)`).toBe(true);
      const box = await loc.boundingBox();
      expect(box, `Phần tử #${i} phải có boundingBox hợp lệ`).not.toBeNull();
      expect(box.width, `Phần tử #${i} có width <= 0`).toBeGreaterThan(0);
      expect(box.height, `Phần tử #${i} có height <= 0`).toBeGreaterThan(0);
      boxes.push({ index: i, box });
    }

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        expect(
          boxesOverlap(a.box, b.box, tolerancePx),
          `Phần tử #${a.index} và #${b.index} bị đè lên nhau: ${JSON.stringify(a.box)} vs ${JSON.stringify(b.box)}`,
        ).toBe(false);
      }
    }
  }).toPass({ timeout });
}

async function expectNoOverlap(locatorA, locatorB, tolerancePx = 1) {
  await expectPairwiseNoOverlap([locatorA, locatorB], { tolerancePx });
}

async function expectContainedIn(child, parent, tolerancePx = 1, options = {}) {
  const timeout = options.timeout ?? 2500;
  const checkAncestorClips = options.checkAncestorClips ?? true;

  await expect(async () => {
    await expect(child).toBeVisible();
    await expect(parent).toBeVisible();
    const res = await evaluateContainmentAndAncestorClip(child, parent, tolerancePx, checkAncestorClips);
    expect(res.ok, res.reason).toBe(true);
  }).toPass({ timeout });
}

const expectContainedWithin = expectContainedIn;

async function expectNotOccluded(locator, options = {}) {
  const timeout = options.timeout ?? 2500;
  const samplePoints = options.samplePoints ?? ['center', 'corners'];
  if (options.scrollIntoView !== false) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
  }

  await expect(async () => {
    await expect(locator, 'Phần tử mục tiêu phải hiển thị trước khi đo che khuất').toBeVisible();
    const res = await evaluateOcclusionOnElement(locator, samplePoints);
    expect(res.ok, `Phần tử bị che khuất (occluded): ${res.reason}`).toBe(true);
  }).toPass({ timeout });
}

module.exports = {
  DEFAULT_VIEWPORTS,
  boxesOverlap,
  expectNoHorizontalScroll,
  expectNoHorizontalOverflow,
  expectNoTextOverflow,
  expectPairwiseNoOverlap,
  expectNoOverlap,
  expectContainedIn,
  expectContainedWithin,
  expectNotOccluded,
};

