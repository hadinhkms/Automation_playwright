'use strict';

const uiLayoutChecks = require('./ui-layout-checks');
const uiResponsiveChecks = require('./ui-responsive-checks');

module.exports = {
  ...uiLayoutChecks,
  ...uiResponsiveChecks,
};

