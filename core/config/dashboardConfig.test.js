const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_CONFIG,
  normalizeDashboardConfig,
  publicDashboardConfig,
} = require('./dashboardConfig');

test('public dashboard config hides registration bearer token', () => {
  const config = normalizeDashboardConfig({
    ...DEFAULT_CONFIG,
    api: {
      ...DEFAULT_CONFIG.api,
      registrationBearerToken: 'sample-bearer-token',
    },
  });
  const publicConfig = publicDashboardConfig(config);

  assert.equal(publicConfig.api.registrationBearerToken, '');
  assert.equal(publicConfig.api.hasRegistrationBearerToken, true);
});

test('settings payload without a token keeps the existing bearer token', () => {
  const config = normalizeDashboardConfig({
    ...DEFAULT_CONFIG,
    api: {
      ...DEFAULT_CONFIG.api,
      registrationBearerToken: 'original-token',
    },
  });
  const saved = normalizeDashboardConfig({
    ...config,
    api: {
      branch: 'main.north',
      lang: 'vi',
      registerRetries: 2,
      registerTimeout: 30000,
      consentRetries: 2,
      consentTimeout: 30000,
    },
  }, config);

  assert.equal(saved.api.registrationBearerToken, 'original-token');
});

test('dashboard config rejects invalid environment URLs', () => {
  assert.throws(
    () => normalizeDashboardConfig({
      ...DEFAULT_CONFIG,
      environments: {
        qc: {
          label: 'QC',
          baseURL: 'not-a-url',
          apiBaseURL: DEFAULT_CONFIG.environments.qc.apiBaseURL,
        },
      },
    }),
    /valid http\(s\) URL/
  );
});

test('normalizeDashboardConfig strips legacy project-specific keys', () => {
  const result = normalizeDashboardConfig({
    ...DEFAULT_CONFIG,
    environments: {
      qc: {
        label: 'QC',
        baseURL: 'https://qc.example.com',
        apiBaseURL: 'https://api.example.com',
        carthingsURL: 'https://qc.other-domain.com',
        companyURL: 'https://company.other-domain.com',
      },
    },
  });

  assert.equal(result.environments.qc.carthingsURL, undefined);
  assert.equal(result.environments.qc.companyURL, undefined);
  assert.equal(result.environments.qc.baseURL, 'https://qc.example.com');
});

test('normalizePort handles static port, random, auto, and fallbacks', () => {
  const { normalizePort, getProjectHashPort } = require('./dashboardConfig');
  assert.equal(normalizePort(4180), 4180);
  assert.equal(normalizePort('4185'), 4185);
  assert.equal(normalizePort('random'), 'random');
  assert.equal(normalizePort(0), 'random');
  assert.equal(normalizePort('0'), 'random');
  assert.equal(normalizePort('auto'), 'auto');
  assert.equal(normalizePort('invalid', 4180), 4180);
  assert.equal(normalizePort(999999, 4180), 4180);

  const hashPort = getProjectHashPort('d:\\_Automation-Project');
  assert.equal(typeof hashPort, 'number');
  assert.ok(hashPort >= 4180 && hashPort <= 4280);
});


