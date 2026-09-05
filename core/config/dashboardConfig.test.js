const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_CONFIG,
  normalizeDashboardConfig,
  publicDashboardConfig,
} = require('./dashboardConfig');

test('public dashboard config hides registration bearer token', () => {
  const config = normalizeDashboardConfig(DEFAULT_CONFIG);
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
      branch: 'vl24h.north',
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
        baseURL: 'https://seeker.vl24hv2.qc.sieuviet-team.com',
        apiBaseURL: 'https://api.vl24hv2.qc.sieuviet-team.com',
        carthingsURL: 'https://qc.carthings.vn',
        companyURL: 'https://company.carthings.vn',
      },
    },
  });

  assert.equal(result.environments.qc.carthingsURL, undefined);
  assert.equal(result.environments.qc.companyURL, undefined);
  assert.equal(result.environments.qc.baseURL, 'https://seeker.vl24hv2.qc.sieuviet-team.com');
});

