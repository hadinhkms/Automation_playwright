# Local sample for Plan 07 verification

`sample.html` is deterministic, contains no credentials, and makes no external requests.
The opt-in `withMockSample` fixture starts an HTTP server on loopback with an OS-assigned port
and closes it after its worker finishes. Existing external sample specs are unchanged.

Run from the project root after installing dependencies and Playwright browsers:

```powershell
npx playwright test sample_container_mock.spec.js --project="Desktop Smoke Tests" --project="Mobile Chrome Smoke Tests" --project="Mobile Safari Smoke Tests"
```

The two specs verify the exact heading, manual construction compatibility, alias identity,
page identity and featureName. Existing Page Object capture methods provide the initial
evidence; subsequent checks do not change the visible page.

This smoke test does not certify all Plan 07 contracts. In particular, custom mobile project
names, nested page discovery, fixture inspection and filesystem containment require their
own regression tests. See the Plan 07 implementation review.

Commit this mock HTML, its README, `core/fixtures/mockSampleTest.js` and the two
`sample_container_mock.spec.js` files together if sharing these tests with a satellite.
The mock is optional and is not required to start the Dashboard or run other project tests.
