const { JobNearMePage } = require('../desktop/JobNearMePage');

/**
 * Bottom sheet "Khám phá việc làm gần tôi" trên Mobile Web.
 * Dùng chung locator trong sheet với Desktop; khác điểm vào ở Home (ô "Việc làm gần tôi").
 */
class MobileJobNearMePage extends JobNearMePage {
  constructor(page, featureName) {
    super(page, featureName);
    this.homeJobNearMeEntry = page.getByText('Việc làm gần tôi', { exact: true });
  }

  async openFromHomeEntryPoint() {
    await Promise.all([
      this.page.waitForURL(/\/tim-kiem-viec-lam/, { timeout: 30000 }),
      this.clickElement(this.homeJobNearMeEntry),
    ]);
    await this.expectDialogOpen();
  }
}

module.exports = { MobileJobNearMePage };
