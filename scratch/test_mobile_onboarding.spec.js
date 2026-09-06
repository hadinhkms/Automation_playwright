const { test, expect } = require('../core/fixtures/mobileWebTest');
const onboardingData = require('../data/onboardingData.json');

test('Test Mobile Onboarding Modal Close Mechanism', async ({
  authenticatedUser,
  onboardingPopup,
  page,
}) => {
  test.setTimeout(120000);

  // Step 1: select location
  await expect(onboardingPopup.locationInput).toBeVisible({ timeout: 30000 });
  await onboardingPopup.selectLocationButton(onboardingData.location.button);
  await onboardingPopup.selectLocationOption(onboardingData.location.option);
  await onboardingPopup.clickNextAndWaitForNextStep(onboardingPopup.step2Title);

  // Step 2: industry
  await expect(onboardingPopup.industryDropdown).toBeVisible({ timeout: 15000 });
  await onboardingPopup.clickElement(onboardingPopup.industryDropdown);

  const container = page.locator('[data-test-id="select__modal-menu__container"]');
  console.log('Container visible:', await container.isVisible());

  // Click industry option
  const option = page.locator('[data-test-id="common__select-menu"]').getByRole('heading', { name: onboardingData.industry }).first();
  await option.click();
  console.log('Clicked option:', onboardingData.industry);

  // Take screenshot 1
  await page.screenshot({ path: 'scratch/mobile_step2_after_click_option.png' });

  // Now let's test how to close the container!
  // What elements are clickable or how can we close it?
  // Let's test clicking the backdrop / outside / coordinate:
  // e.g. click outside: click position (10, 10) or click the backdrop div
  const backdrop = container.locator('> div.absolute.inset-0');
  console.log('Backdrop count:', await backdrop.count());

  // Check if pressing Enter closes it
  // Or clicking the search icon
  // Or clicking common__select__modal-menu__anchor
  // Let's check event listeners or inspect
  const listeners = await page.evaluate(() => {
    const el = document.querySelector('[data-test-id="select__modal-menu__container"]');
    if (!el) return 'No container';
    return {
      classList: el.className,
      style: el.getAttribute('style'),
      childCount: el.children.length,
      children: Array.from(el.children).map(c => ({
        tag: c.tagName,
        className: c.className,
        testId: c.getAttribute('data-test-id'),
        text: c.textContent.trim().substring(0, 40)
      }))
    };
  });
  console.log('Container info:', JSON.stringify(listeners, null, 2));

  // Try clicking outside container:
  // In Playwright mobile, page.mouse.click(5, 5) or similar?
  // Let's test if clicking the backdrop or clicking (200, 20) or clicking the step2Title or pressing Escape works
});
