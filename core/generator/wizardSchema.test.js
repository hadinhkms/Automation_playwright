const test = require('node:test');
const assert = require('node:assert/strict');
const { validateScenario, normalizeScenario } = require('./wizardSchema');

test('Wizard schema accepts a structured dependency-first state', () => {
  const result = validateScenario({
    schemaVersion: 1,
    fileName: 'apply-flow-bdd.spec.js',
    featureName: 'Apply flow',
    scenarioName: 'Successful apply',
    platform: 'desktop',
    tags: ['@e2e'],
    pageObjects: ['pages/desktop/HomePage.js'],
    dataSources: [{ file: 'data/applyJobData.json', variable: 'applyData', dataPath: 'noCVApply.job1' }],
    steps: [{ stepType: 'When', actionId: 'click_element', locator: 'button' }],
  }, { actionIds: ['click_element'] });
  assert.deepEqual(result.errors, []);
  assert.equal(normalizeScenario({}).schemaVersion, 1);
});

test('Wizard schema rejects unsafe filenames and incomplete data sources', () => {
  const result = validateScenario({
    schemaVersion: 1,
    fileName: '../unsafe.js',
    featureName: 'Flow',
    scenarioName: 'Scenario',
    dataSources: [{ file: 'data/users.json', variable: 'usersData' }],
    steps: [{ actionId: 'click_element', locator: 'button' }],
  }, { actionIds: ['click_element'] });
  assert.ok(result.errors.some((error) => error.includes('fileName')));
  assert.ok(result.errors.some((error) => error.includes('dataSources')));
});
