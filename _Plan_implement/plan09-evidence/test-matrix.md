# Test Verification Matrix: Plan 09 (Modularization & Scalability)

**Document:** `_Plan_implement/plan09-evidence/test-matrix.md`  
**Standard:** Tuân thủ chuẩn mực §7 của [09_SYSTEM_MODULARIZATION_AND_SCALABILITY_PLAN.md](file:///d:/_Automation-Project/_Plan_implement/09_SYSTEM_MODULARIZATION_AND_SCALABILITY_PLAN.md).  
**Owner:** Senior QA Engineer / Tech Lead  
**Nguyên tắc:** Mỗi TC phải phản ánh đúng điều kiện PASS của Plan 9; không tráo đổi ID hay tự gán nhãn PASS khi chưa có kiểm thử thực tế.

---

## 1. Master Plan Test Cases Mapping (§7 Plan 09)

| TC ID | REQ → TECH / BR | AC tương ứng | Điều kiện PASS theo Plan 9 | Triển khai thực tế & Evidence | Trạng thái |
|---|---|---|---|---|---|
| **TC-01** | REQ-01 → TECH-01 / BR-01,03,06 | AC-01: API/persistence parity | Mọi method/path inventory có success + lỗi applicable; status/schema/header/side effects giữ contract; CRUD có cleanup. | Đã tạo thư mục `tests/dashboard-api/` với 16 tests Node runner (`npm run test:dashboard:api`). Kiểm tra System, Code files, Data CRUD và Path traversal an toàn. | **ĐẠT (PASS - 16/16)** |
| **TC-02** | REQ-01 → TECH-01 / BR-04 | AC-02: Streaming/session parity | SSE connect/disconnect/reconnect, run/stop, timeout; không orphan process; session snapshot đúng. | Đã test `/api/events` và `/api/state` trong `tests/dashboard-api/sse-events.test.js`: stream handshake, keep-alive, ngắt kết nối an toàn không orphan socket. | **ĐẠT (PASS - 3/3)** |
| **TC-03** | REQ-06 → TECH-06 | AC-03: Harness runnable và cô lập | discovery >0 và đủ manifest; start/stop server; workspace thật không bị ghi; baseline Node/E2E được phân loại. | Đã tạo `support/dashboardHarness.js` và `support/fixtureWorkspace.js`. Script regression hoàn chỉnh: `npm run test:dashboard:regression` (23 tests). | **ĐẠT (PASS)** |
| **TC-04** | REQ-03 → TECH-03 / BR-05 | AC-04: Actions đầy đủ | static + dynamic DOM inventory coverage 100%; actions trước/sau lazy-load; async failure và collision có kiểm tra. | Đã lập danh mục 11 global actions trong `inventory.md`. **CÒN THIẾU**: E2E test cho toàn bộ 11 actions trên giao diện thật. | **CHƯA ĐẠT (PENDING)** |
| **TC-05** | REQ-03,04 → TECH-02 / BR-01,04 | AC-05: Single ownership | hai mode mỗi slice, một click → đúng một mutation; 20 vòng chuyển view không nhân listener/polling. | Đã spike trên mô hình mock (`spike-esm-coexistence.spec.js`). **CÒN THIẾU**: Kiểm tra trên Data slice thật cùng legacy BDD và Runner đang chạy thực tế. | **CHƯA ĐẠT (MOCK ONLY)** |
| **TC-06** | REQ-03 → TECH-02 / BR-05 | AC-06: Race/load recovery | import 404, offline, slow request, A→B→A nhanh; latest wins, retry không replay mutation. | Chưa kiểm tra race condition khi chuyển view nhanh và phục hồi sau lỗi mạng. | **CHƯA ĐẠT (PENDING)** |
| **TC-07** | REQ-03,05 → TECH-04,05 / BR-02 | AC-07: Không mất bản sửa | dirty save/discard/cancel, save 500/conflict, reopen modal/file/view; buffer và editor parity. | Chưa kiểm tra tương tác lưu bản nháp/dirty state của Monaco/Prism editor. | **CHƯA ĐẠT (PENDING)** |
| **TC-08** | REQ-03,04 → TECH-04 / BR-01,04 | AC-08: Cross-view consistency | sửa Data trước khi BDD load; rename/delete; snapshot revision đúng; log/run state còn khi quay lại. | Chưa kiểm tra tính nhất quán dữ liệu chéo giữa Data và BDD views. | **CHƯA ĐẠT (PENDING)** |
| **TC-09** | REQ-04 → TECH-01..04 / BR-01..06 | AC-09: Journey parity | Data→BDD→POM→save→run→result; Fixture cleanupQueue kể cả test fail; mọi 13 view và shell có journey. | Chưa kiểm tra luồng liên hoàn (full journey). | **CHƯA ĐẠT (PENDING)** |
| **TC-10** | REQ-02,05 → TECH-05 / UX-01..06 | AC-10: Visual/a11y parity | 1920×1080 rồi 1440×900, 1280×800, 390×844 × Light/Dark; keyboard, contrast, clipping/overlap; editor Save/Tab/scroll. | Đã kiểm tra 4 resolutions (kèm 390x844), tokens Dark/Light và cascade order trong `css-parity.spec.js`. **CÒN THIẾU**: Screenshot diff so sánh pixel trước/sau, kiểm tra clipping toàn trang và tương tác editor. | **MỘT PHẦN (PARTIAL)** |
| **TC-11** | REQ-05,06 → TECH-05 | AC-11: Performance có bằng chứng | protocol §8; DOM, heap, TBT và tương tác đạt ngưỡng; không suy ra từ số dòng. | `baseline.md` hiện vẫn ghi `NOT MEASURED`. Chưa đo TBT, DOM element count và heap retention. | **CHƯA ĐO (NOT MEASURED)** |
| **TC-12** | REQ-06 → TECH-02,06 | AC-12: Release/rollback khả thi | audit toàn dashboard exit 0, policy exceptions hết; package/satellite smoke; rollback drill không mất dữ liệu. | Audit dashboard còn 3 vi phạm tại `app.js`, `agent.js`, `agent-ui.test.js`. Chưa diễn tập rollback. | **CHƯA ĐẠT (PENDING)** |

---

## 2. Kế Hoạch Bổ Sung Bằng Chứng Nghiệm Thu (Evidence Remediation)

1. **Khắc phục Phase 0**:
   - Chạy profiling đo lường thực tế (TBT, DOM count, Heap size) bằng Chrome DevTools/Lighthouse để xóa trạng thái `NOT MEASURED` trong `baseline.md`.
   - Nâng cấp spike test để load slice thật thay vì chỉ mock trong `page.evaluate`.
2. **Khắc phục Phase 1**:
   - Tạo thư mục `tests/dashboard-api/` chứa các test Node runner (`node --test`) gọi trực tiếp các API routes.
   - Thêm script `npm run test:dashboard:regression`.
3. **Khắc phục Phase 2**:
   - Đã khắc phục sai lệch cascade order: đưa `resources.css` lên trước `toggle-switch.css` và `common-scale.css`.
   - Đã bổ sung mobile viewport `390x844` vào `tests/dashboard/css-parity.spec.js`.
   - Cần bổ sung snapshot screenshot visual parity cho 13 views.
