# Test Verification Matrix: Plan 09 (Modularization & Scalability)

**Document:** `_Plan_implement/plan09-evidence/test-matrix.md`  
**Phase:** Phase 0 & Phase 1 Deliverable  
**Owner:** Senior QA Engineer (10+ Years Experience)  
**Standard:** Risk-based testing, equivalence partitioning, boundary value analysis.

---

## 1. Master Plan Test Cases Mapping (TC-01 through TC-11)

| TC ID | Tiêu đề kịch bản | Phạm vi áp dụng | Lệnh kiểm thử thực tế | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|
| **TC-01** | Dashboard Studio Isolated Boot | Phase 0, 1 | `npx playwright test tests/dashboard/smoke.spec.js` | Boots on ephemeral port, renders shell container | **PASS** (3.2s) |
| **TC-02** | Baseline Audit & Policy Compliance | Phase 0, 1 | `powershell -File D:\_Master_Process\master.ps1 audit dashboard` | `server.js` cleared (was 2618 lines, now 156 lines; limit 250) | **PASS** (0 new violations) |
| **TC-03** | Route Cataloging & Signature Integrity | Phase 0, 1 | `node scripts/audit-dashboard-routes.js` | 91 API endpoints detected across 12 router files | **PASS** (100% matched) |
| **TC-04** | Framework Structure & Conventions Check | Phase 0, 1 | `npm run check:framework` | 7 specs, 3 POMs validated | **PASS** |
| **TC-05** | WindowBridge Global Action Interop | Phase 0 Spike | `npx playwright test tests/dashboard/spike-esm-coexistence.spec.js -g "SPIKE-01-A"` | ESM action exposed to `window` without ReferenceError | **PASS** (2.4s) |
| **TC-06** | EventBus Cross-Slice Decoupling | Phase 0 Spike | `npx playwright test tests/dashboard/spike-esm-coexistence.spec.js -g "SPIKE-01-B"` | Event emission decouples state from direct mutation | **PASS** (5.3s) |
| **TC-07** | Single Ownership & Mutation Guard | Phase 0 Spike | `npx playwright test tests/dashboard/spike-esm-coexistence.spec.js -g "SPIKE-01-C"` | Exactly 1 mutation per action, 0 duplicate event fires | **PASS** (1.5s) |
| **TC-08** | Ephemeral Workspace & Clean Teardown | Phase 0, 1 | Playwright fixture `fixtureWorkspace.js` | Auto-removes `.tmp-workspace-*` on finish | **PASS** |
| **TC-09** | Path Traversal & Security Boundary | Phase 1 | `safeChildPath` unit tests & route guards | Blocks `../` escaping base directories (403/404) | **PASS** |
| **TC-10** | CSS & Style Integrity (Visual Parity) | Phase 2 (Upcoming) | Automated visual diff + manual viewport checks | Chờ triển khai Phase 2 | **PENDING** |
| **TC-11** | Keyboard & Editor Parity | Phase 5 (Upcoming) | Tab navigation, Monacofile keybindings, dirty state | Chờ triển khai Phase 5 | **PENDING** |

---

## 2. Risk-Based Testing Paths (Senior QA Evaluation)

### A. Happy Paths (Luồng Chuẩn)
- Server boots with dynamic ephemeral port.
- All 91 HTTP endpoints resolve to their extracted handlers without 404/500 errors.
- Live SSE stream (`/api/events`) connects and stays alive with `Connection: keep-alive`.

### B. Validation-Failure & Boundary Paths
- Attempting to access `/api/code` or `/api/resource` with a path escaping the project root (e.g. `../../secret.txt`) is trapped by `safeChildPath` and rejected.
- Large payloads (> 1 MB) sent to `/api/code` or `/api/resource` yield `413 Payload Too Large`.
- Malformed JSON in request bodies yields `400 Bad Request` with Vietnamese error message.

### C. Concurrency & Collision Paths
- Triggering `/api/run` while a run is already active yields `409 Conflict` (`Đang có một test run khác.`).
- Triggering mutations while AI Agent is actively working yields `409 Conflict` (`Agent đang làm việc...`).
- Modifying a file with mismatching `expectedHash` / `expectedRevision` triggers `409 Conflict`.

### D. Process Resiliency & Teardown Paths
- `SIGINT` / `SIGTERM` signals cleanly terminate child processes (Playwright runner, Codegen recorder) and remove `.dashboard-server.json`.
- `EADDRINUSE` port collision triggers automatic retry up to 20 times to find a free port.
