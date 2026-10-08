# Plan 09 Inventory: Routes, Views & Window Action Contracts

> **Ghi nhận tại:** 2026-09-10  
> **Nguồn phân tích:** `dashboard/server.js`, `dashboard/public/index.html`, `dashboard/public/app.js`

---

## 1. Danh Mục 13 Views & Shared Shell Trong `index.html`

| ID DOM View (`data-view`) | Tên Màn Hình / Phân Hệ | Nhóm Feature Slice Dự Kiến | Đợt Chuyển Đổi |
|---|---|---|---|
| `data-view` | Test Data Studio (JSON, CSV, Archetypes) | `views/data/` | 4.1 |
| `suites-view` | Test Suites Studio (Quản lý bộ test) | `views/suites/` | 4.2 |
| `fixtures-view` | Fixtures Studio (Custom Fixtures, Hooks) | `views/fixtures/` | 4.3 |
| `page-manager-view` | Page Manager (Object Repository, Locators) | `views/pages/` | 4.4 |
| `builder-view` | BDD Studio (Kịch bản BDD, 5 khối Accordion) | `views/bdd/` | 4.5 |
| `runner-view` | Test Runner (Chạy test, Terminal logs) | `views/runner/` | 4.6 |
| `recorder-view` | Codegen Recorder (Ghi thao tác Playwright) | `views/recorder/` | 4.7 |
| `git-view` | Git Sync (Commit, Push, Pull, Status) | `views/git/` | 4.7 |
| `agent-view` | AI Agent Chat (Model Copilot) | `views/agent/` | 4.7 |
| `resources-view` | Báo cáo & Bằng chứng kiểm thử | `views/resources/` | 4.8 |
| `docs-view` | Tài liệu hướng dẫn sử dụng | `views/docs/` | 4.8 |
| `compare-view` | So sánh kịch bản & kết quả | `views/compare/` | 4.8 |
| `settings-view` | Cấu hình hệ thống & AI models | `views/settings/` | 4.8 |

**Thành phần Shared Shell:**
- Thanh điều hướng trên cùng (`.view-tab`, status indicators).
- Bộ quản lý Theme (Dark / Light mode switcher).
- Hệ thống Toast Notification và Modal Backdrop dùng chung.
- Khởi tạo Prism Code Editor Controller dùng chung.

---

## 2. Danh Mục Các Action Toàn Cục Gắn Với `window` Cần Bảo Tồn (Window Actions)

Phát hiện từ quá trình quét động: Các bảng dữ liệu (Data tables, POM actions, BDD steps) sinh HTML từ template string có chứa các lệnh gọi trực tiếp đến `window`:

| Tên Hàm Toàn Cục | Dòng trong `app.js` | Mục Đích Sử Dụng | Slice Sở Hữu Mục Tiêu |
|---|---|---|---|
| `cloneDataRow(idx)` | 8701 | Nhân bản dòng dữ liệu trong Test Data Studio | `data/` |
| `removeDataRow(idx)` | 8711 | Xóa dòng dữ liệu trong Test Data Studio | `data/` |
| `removeCreateDraftRow(rIdx)` | 9074 | Xóa dòng draft đang tạo | `data/` |
| `removeCreateDraftKey(k)` | 9082 | Xóa thuộc tính key trong modal tạo dataset | `data/` |
| `openPageCodeModal(path, name)` | 10106 | Mở popup xem code Page Object | `pages/` |
| `jumpToDataFile(fileName)` | 10263 | Chuyển nhanh từ BDD sang file Test Data tương ứng | `data/` |
| `openInsertPomActionModal(...)` | 10338 | Mở popup chèn thao tác Page Object vào BDD | `bdd/` |
| `openCreateBddScriptModal()` | 12991 | Mở popup tạo mới kịch bản BDD | `bdd/` |
| `initBlankStarterSteps()` | 13067 | Tạo nhanh các bước BDD mẫu | `bdd/` |
| `runBuilderScenarioDirectly()` | 13801 | Chạy ngay kịch bản BDD đang soạn thảo | `bdd/` |
| `addBuilderStepFromAction(id)` | 13839 | Thêm bước hành động vào kịch bản BDD | `bdd/` |

> ⚠️ **Quy tắc TECH-03:** Các hàm trên bắt buộc phải được đăng ký qua `windowBridge.js` ngay khi Feature Slice được nạp để ngăn chặn 100% lỗi `ReferenceError`.

---

## 3. Danh Mục 40+ REST API & Routes Trong `dashboard/server.js`

Quét được 78 vị trí khai báo endpoints, phân loại thành 9 nhóm routes chính:

### Nhóm 1: Test Runner & Execution (`routes/runnerRoutes.js`)
- `POST /api/run` — Kích hoạt chạy test Playwright
- `POST /api/stop` — Hủy bỏ phiên chạy test
- `GET /api/test-results` — Lấy danh sách kết quả test
- `GET /api/events` — Server-Sent Events (SSE) stream log terminal thời gian thực

### Nhóm 2: BDD Studio (`routes/bdd/`)
- `GET /api/builder/scripts` — Lấy danh mục kịch bản BDD
- `POST /api/builder/create-script` — Tạo mới kịch bản
- `GET /api/builder/script` — Đọc chi tiết kịch bản
- `POST /api/builder/save` — Lưu kịch bản BDD
- `POST /api/builder/compile` — Biên dịch kịch bản thành file test Playwright
- `GET /api/builder/actions` — Lấy danh mục hành động khả dụng từ Page Objects
- `POST /api/builder/validate-spec` — Kiểm tra tính hợp lệ cú pháp kịch bản
- `POST /api/builder/insert-step` — Chèn bước tự động vào kịch bản

### Nhóm 3: Page Objects & Locators (`routes/pageRoutes.js`)
- `GET /api/object-repository/pages` — Quét và trả về cây danh mục Page Objects
- `GET /api/object-repository/page` — Lấy chi tiết locators của một Page
- `POST /api/object-repository/create-page` — Tạo mới Page Object
- `POST /api/object-repository/update-locator` — Cập nhật locator
- `DELETE /api/object-repository/page` — Xóa Page Object

### Nhóm 4: Test Data Studio (`routes/dataRoutes.js`)
- `GET /api/data/datasets` — Lấy danh sách tệp dữ liệu test
- `POST /api/data/create` — Tạo mới dataset
- `DELETE /api/data/delete` — Xóa dataset
- `POST /api/data/csv-import` — Import dữ liệu từ CSV
- `GET /api/data/csv-export` — Export dữ liệu ra CSV

### Nhóm 5: Fixtures Studio (`routes/fixtureRoutes.js`)
- `GET /api/fixtures` — Lấy danh mục custom fixtures
- `POST /api/fixtures/validate` — Static syntax validation cho fixture
- `POST /api/fixtures` — Lưu fixture mới
- `DELETE /api/fixtures/delete` — Xóa fixture

### Nhóm 6: Test Suites & Batch Runs (`routes/systemRoutes.js` & `routes/runnerRoutes.js`)
- `GET /api/config` — Nạp danh sách test suites từ `settings.suites`
- `PUT /api/settings` — Lưu/xóa/cập nhật cấu hình test suites trong `dashboardConfig.json`
- `POST /api/run` — Thực thi test suite (với `suiteId`, `suiteLabel`, `specs`, `projects`)
- `POST /api/remote-run` — Điều phối chạy suite từ xa qua GitHub Actions/Discord

### Nhóm 7: Codegen Recorder (`routes/recorderRoutes.js`)
- `POST /api/recorder/start` — Khởi động phiên Playwright Codegen
- `POST /api/recorder/stop` — Dừng phiên ghi
- `GET /api/recorder/status` — Kiểm tra trạng thái phiên ghi
- `POST /api/recorder/convert` — Chuyển đổi mã ghi được thành BDD script
- `POST /api/recorder/reset` — Reset bộ đệm ghi

### Nhóm 8: Git Sync (`routes/gitRoutes.js`)
- `GET /api/git/status` — Lấy git status
- `POST /api/git/pull` — Kéo mã mới từ remote
- `POST /api/git/commit-push` — Commit và push thay đổi
- `GET /api/git/diff` — Xem diff
- `POST /api/git/quality-check` — Chạy audit và check framework trước commit

### Nhóm 9: AI Agent & System Config (`routes/agentRoutes.js` & `routes/systemRoutes.js`)
- `POST /api/agent/*` — API chat với AI Model, SSE streaming
- `GET /api/config` — Lấy cấu hình Dashboard
- `GET /api/health` — Health check endpoint
- `GET /api/system/version` — Lấy phiên bản hệ thống
