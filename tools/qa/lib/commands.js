'use strict';

/**
 * Facade 6 phép join & phân tích truy vết trên dữ liệu QA đã chuẩn hoá.
 */

const { SEVERITY_RANK, collect, coverage } = require('./commandsCore');
const { gaps } = require('./commandsGapsSpecs');
const { impact, drift } = require('./commandsDrift');
const { matrix, summary } = require('./commandsMatrixSummary');

module.exports = {
  collect,
  coverage,
  gaps,
  impact,
  drift,
  matrix,
  summary,
  SEVERITY_RANK,
};
