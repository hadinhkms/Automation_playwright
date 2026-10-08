# Backend Route Contracts & API Specifications

**Document:** `_Plan_implement/plan09-evidence/contracts.md`  
**Phase:** Phase 0 & Phase 1 Deliverable  
**Owner:** Backend Lead / Tech Lead  
**Scope:** Formal contract specifications for all modularized endpoints extracted from `dashboard/server.js`.

---

## 1. Global Route Standards & Error Conventions

1. **Content-Type**: All API responses use `application/json; charset=utf-8` unless serving files or SSE streams.
2. **Standard Error Schema**:
   ```json
   {
     "error": "Mô tả lỗi tiếng Việt chuẩn xác",
     "code": "OPTIONAL_ERROR_CODE",
     "valid": false
   }
   ```
3. **HTTP Status Codes**:
   - `200 OK`: Successful read/update/delete operation.
   - `201 Created`: Successful creation of new entity (e.g. Page, Custom Fixture).
   - `202 Accepted`: Long-running async execution initiated (e.g. Test Run, UI Mode).
   - `400 Bad Request`: Validation failure or missing required fields.
   - `403 Forbidden`: Attempted modification of protected/core assets (e.g. core fixtures, framework docs by non-dev).
   - `404 Not Found`: Target file, resource, or entity does not exist.
   - `409 Conflict`: Concurrency conflict (active test run, active recording, or disk hash mismatch).
   - `413 Payload Too Large`: Content payload exceeds 1 MB limit.
   - `422 Unprocessable Entity`: Syntax error, malformed script, or invalid wizard schema.
   - `500 Internal Server Error`: Unhandled disk I/O, subprocess spawn, or git failure.

---

## 2. Contracts by Domain Module

### A. Runner Routes (`dashboard/routes/runnerRoutes.js`)
- `POST /api/run`:
  - Request: `{ spec?: string, specs?: string[], project?: string, projects?: string[], environment?: string, workers?: number, grep?: string, headed?: boolean, viewport?: { width: number, height: number }, suiteLabel?: string }`
  - Response: `202 Accepted` -> `{ id: string, status: "running", startedAt: string, mode: "test", options: object, command: string }`
  - Fault: `409 Conflict` if another run is active; `400 Bad Request` if options fail validation.
- `POST /api/ui`:
  - Request: Same as `/api/run`
  - Response: `202 Accepted` (spawn with `--ui`)
- `POST /api/stop`:
  - Request: Empty
  - Response: `202 Accepted` -> `{ message: "Đã gửi yêu cầu dừng." }`
  - Fault: `409 Conflict` if no run active.
- `GET /api/state`:
  - Response: `200 OK` -> `{ activeRun: object | null, lastRun: object | null, logs: Array }`
- `GET /api/events`:
  - Response: `200 OK` (SSE `text/event-stream`) streaming `{ type: "log" | "status", payload: any }`
- `POST /api/shutdown`:
  - Response: `200 OK` -> triggers graceful process termination.

### B. Recorder Routes (`dashboard/routes/recorderRoutes.js`)
- `POST /api/recorder/start`:
  - Request: `{ url: string, platform?: "desktop" | "mobile-web", browser?: string, device?: string, viewport?: string, force?: boolean }`
  - Response: `200 OK` -> `{ message: string, fileName: string, outputPath: string, url: string }`
- `POST /api/recorder/stop`:
  - Response: `200 OK` -> `{ message: string, fileName: string, rawScript: string, actionsCount: number, actions: Array, detectedUrl: string, scenarioName: string }`
- `POST /api/recorder/scan-pages`:
  - Request: `{ platform: "desktop" | "mobile-web" }`
  - Response: `200 OK` -> `{ platform: string, pages: Array }`
- `POST /api/recorder/convert`:
  - Request: `{ rawScript: string, platform: string, isNewPage?: boolean, pageClassName?: string, ... }`
  - Response: `200 OK` -> `{ pageObjectCode: string, specCode: string, ... }`
- `POST /api/recorder/save-draft`:
  - Request: `{ pomFile: object, specFile: object }`
  - Response: `200 OK` -> `{ success: true, files: Array }`

### C. Visual BDD Routes (`dashboard/routes/bddRoutes.js`)
- `GET /api/builder/scripts`:
  - Response: `200 OK` -> `{ scripts: Array<{ fileName: string, relativePath: string, testCount: number, ... }> }`
- `POST /api/builder/compile`:
  - Request: Visual Scenario State
  - Response: `200 OK` | `422 Unprocessable` -> `{ valid: boolean, specCode?: string, specRelativePath?: string, errors?: Array }`
- `POST /api/builder/validate-spec`:
  - Request: Visual Scenario State
  - Response: `200 OK` | `422 Unprocessable` (executes `node --check` in sandbox)
- `POST /api/builder/save`:
  - Request: Visual Scenario State + `expectedHash?`
  - Response: `200 OK` | `409 Conflict` (Optimistic Concurrency Control)
- `POST /api/builder/insert-step`:
  - Request: `{ scriptPath: string, actionType: string, actionName: string, ... }`
  - Response: `200 OK` -> Inserts BDD step and creates `.dashboard-backups/` backup.
- `POST /api/builder/create-script`:
  - Request: `{ fileName: string, platform: string, featureName: string, ... }`
  - Response: `200 OK` -> Generates spec file with precondition annotations.

### D. Object Repository Routes (`dashboard/routes/pageRoutes.js`)
- `GET /api/object-repository/pages`: Lists all POM classes and readiness scores.
- `GET /api/object-repository/page?file=...`: Details of a specific Page Object.
- `POST /api/object-repository/update-locator`: Updates element selector with AST verification.
- `POST /api/object-repository/create-page`: Generates new POM class.
- `DELETE /api/object-repository/page`: Deletes POM with automatic backup to `.dashboard-backups/pages/`.
- `GET /api/core/capabilities`: Returns available core assertion & action capabilities.

### E. Fixture & Hook Routes (`dashboard/routes/fixtureRoutes.js`)
- `GET /api/fixtures`: Scans all built-in and custom fixtures.
- `POST /api/fixtures/validate`: Static syntax check (`node --check`) for custom fixture source.
- `POST /api/fixtures`: Creates custom fixture in `core/fixtures/custom/`.
- `PUT /api/fixtures/:name`: Updates custom fixture with `expectedRevision` SHA-256 conflict guard.
- `DELETE /api/fixtures/:name`: Deletes custom fixture with auto-backup.

### F. Resource & Code Routes (`dashboard/routes/resourceRoutes.js`)
- `GET /api/resources`: Lists documents, test data, evidence, and report files.
- `GET /api/code-files`: Lists all white-listed source code files.
- `GET /api/code?path=...`: Reads source file with 1 MB limit.
- `PUT /api/code`: Saves source file with `new Function()` validation and auto-backup.
- `DELETE /api/artifact`: Deletes evidence or report folders with safe traversal check.
- Static serving: `/report/latest`, `/reports/*`, `/evidence/*`, `/tools/*`.

### G. AI & System Routes (`dashboard/routes/aiRoutes.js`, `dashboard/routes/systemRoutes.js`)
- `GET /api/config`: Central project config, environments, projects, specs, branding.
- `GET /api/health`: Health status (`appName`, `workspaceRoot`, `port`, `pid`).
- `GET/PUT /api/settings`: Dashboard settings CRUD with `.dashboard-backups` copy.
- `POST /api/remote-run`: Dispatches GitHub Actions workflow via Discord QA Bot env.
- `POST /api/ai/test-connection`: Validates AI credentials (Gemini, OpenAI, DeepSeek).
- `POST /api/ai/inline-suggest`: Low-latency AI autocomplete proxy.
- `POST /api/diagnostics/analyze`: Rule-based failure analyzer.

---

## 3. Security Rào Chắn & Path Traversal Guard Contract

All file path operations MUST adhere to `safeChildPath`:
```js
function safeChildPath(base, requestedPath) {
  const resolved = path.resolve(base, `.${requestedPath}`);
  return resolved === base || resolved.startsWith(`${base}${path.sep}`) ? resolved : null;
}
```
Any request resolving outside `base` returns `null` and yields `403 Forbidden` or `404 Not Found`.
