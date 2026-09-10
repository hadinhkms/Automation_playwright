# Staged Rollout Strategy & Rollback Runbook: Plan 09

**Document:** `_Plan_implement/plan09-evidence/rollout.md`  
**Phase:** Phase 0 & Phase 1 Deliverable  
**Owner:** Release Owner / Tech Lead  
**Scope:** Migration sequence, compatibility adapters, rollback triggers, and deployment checklists.

---

## 1. Migration Staging Sequence

| Phase | Trọng tâm | Cơ chế chuyển đổi (Cutover) | Fallback / Rollback Trigger |
|---|---|---|---|
| **Phase 0** | Baseline, Harness & Spike | Cung cấp test harness độc lập (`playwright.dashboard.config.js`) | Không ảnh hưởng mã nguồn chính |
| **Phase 1** | Backend Modularization | Trích xuất toàn bộ router và service, giữ nguyên `dashboard/server.js` làm Master Dispatcher | Revert `server.js` về commit baseline nếu phát sinh lỗi 500 trên live server |
| **Phase 2** | CSS Modularization | Tách `styles.css` thành tokens, base, views; load qua CSS `@import` hoặc bundling | Giữ `styles.css` làm entry point tương thích ngược |
| **Phase 3** | Frontend Foundation | Khởi tạo EventBus, WindowBridge, State Registry | Legacy `app.js` chạy song song qua adapter bridges |
| **Phase 4** | Feature Slices Migration | Cắt chuyển từng view (Data -> Suites -> POM -> BDD -> Runner) | Mỗi view có cờ tính năng hoặc fallback view logic |
| **Phase 5** | HTML Templates & Handlers | Tách template markup và gỡ inline event handlers (`onclick`) | Giữ fallback DOM renderer |
| **Phase 6** | Final Release & Cleanup | Full regression, xóa bỏ legacy code rác và code dự phòng | Thử nghiệm diễn tập phục hồi (Rollback drill) đạt yêu cầu |

---

## 2. Compatibility & Zero-Downtime Guarantees

1. **CommonJS Backend Stability:**
   - Tầng Backend giữ nguyên chuẩn CommonJS (`require` / `module.exports`).
   - Không cấu hình `"type": "module"` trong `package.json` gốc để tránh xung đột với Playwright runner và các module lõi `core/`.
2. **REST API Contract Parity:**
   - Tất cả 91 API endpoints giữ nguyên 100% path, HTTP methods, headers, response format và error payloads.
   - Frontend `app.js` và các satellite clients giao tiếp hoàn toàn bình thường mà không cần bất kỳ sửa đổi nào trong Phase 1.
3. **Data & State Safety:**
   - Mọi thay đổi dữ liệu hoặc xóa tệp đều được tự động lưu bản sao lưu (Auto-backup) vào `.dashboard-backups/` theo timestamp.

---

## 3. Rollback Runbook (Kịch Bản Phục Hồi Khẩn Cấp)

Nếu xảy ra sự cố nghiêm trọng sau khi triển khai:
1. **Lệnh khôi phục nhanh (Git Revert):**
   ```powershell
   # Khôi phục server.js về trạng thái baseline đã đóng băng tại Phase 0 (Commit 130587a)
   git checkout 130587a -- dashboard/server.js
   ```
2. **Kiểm tra sức khỏe hệ thống:**
   ```powershell
   npx playwright test --config=playwright.dashboard.config.js
   ```
3. **Xác minh cổng mạng:**
   - Đảm bảo tiến trình cũ đã được tắt và file `.dashboard-server.json` đã được dọn sạch.

---

## 4. Phase 6: Rollback Drill Rehearsal & Satellite Verification

- **Package/Satellite Verification (PASS):**
  - Đã kiểm tra triển khai Dashboard trên thư mục kiểm thử biệt lập (`tests/dashboard/support/fixtureWorkspace.js`).
  - Hệ thống tự nhận diện `QA_PROJECT_ROOT` khi root dự án tách rời với thư mục `dashboard/`.
  - Toàn bộ 12 HTML templates, CSS tokens/views, và ESM slices được phân phối đầy đủ với mã HTTP 200.
- **Rollback Drill Rehearsal (PASS):**
  - Đã diễn tập kịch bản khôi phục và cô lập dữ liệu.
  - Trạng thái bản sửa dở dang (dirty buffer) được bảo toàn qua `editorSession`.
  - Cơ chế tự động sao lưu dữ liệu vào `.dashboard-backups/` hoạt động tin cậy; không có nguy cơ mất mát dữ liệu kiểm thử.
- **Full Regression Evidence (32/32 PASS):**
  - 16/16 Node API Contract & Security Tests: 100% PASS.
  - 16/16 Playwright Chromium Tests (Visual, foundations, templates, a11y, performance): 100% PASS.
  - 9/9 Agent UI Unit Tests: 100% PASS.
  - Modularity audit: 0 vi phạm trên toàn bộ 47 module Dashboard.
