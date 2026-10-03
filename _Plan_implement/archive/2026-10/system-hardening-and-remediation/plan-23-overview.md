# Kế Hoạch 23: Khắc Phục Lỗ Hổng Hệ Thống, Đồng Bộ Hub Anti-Drift & Chuẩn Hóa Plan — Plan Overview

> **Plan ID:** `PLAN-23-SYSTEM-HARDENING-DRIFT-GATE-REMEDIATION-2026-10-03` · **Baseline:** `20caf254` · **Cấp độ:** L3  
> **Trạng thái:** `COMPLETED` · **Research:** Không áp dụng (L1/L2)  
> **Nguồn gốc:** Đợt audit toàn diện hệ sinh thái `_Automation-Project` và Master Process Hub ngày 2026-10-03.

---

## 1. Bối Cảnh & Mục Tiêu Kinh Doanh
- **Bối cảnh:** Qua đợt audit toàn diện hệ thống, dù bộ test (585 unit tests + 179 dashboard contract tests + 10 E2E tests) đạt 100% Green, dự án vẫn bị hổng ("lủng") tại 7 điểm:
  1. `.ai/process-lock.json` bị lệch commit SHA (`2863a7cb` vs Hub `20caf254`), lệnh `mp:drift` báo lỗi Exit Code 1.
  2. `.delivery/approved_contract.sha256` ghim mã của `plan-19b.json` nhưng `contract.json` vẫn nằm ở `plan-18`, làm nghẽn `mp:gate`.
  3. Thư mục rác tạm thời `tests/dashboard/.tmp-workspace-*` bị bỏ lại sau khi test.
  4. Sổ `FINDINGS_REGISTRY.md` chưa đóng chu trình nghiệm thu cho HUB-01/HUB-02 (`CLAIMED_FIXED` thay vì `CLOSED`).
  5. Master Probe P5 bị false positive do regex PowerShell `-match` không phân biệt hoa thường bắt nhầm `test.fixme`.
  6. Git history chứa 3 media blobs lớn (~35.2 MB).
  7. Các file plan cũ (Plan 20, 21, 22) chưa được lưu trữ (archive) và cấu trúc chưa chuẩn hóa theo Master Process P1–P6.
- **Mục tiêu:**
  - Đưa `mp:drift` về trạng thái `IN_SYNC` 100% (exit code 0).
  - Căn chỉnh hợp đồng nghiệm thu Gate 4 và đóng sổ audit chính thức.
  - Vệ sinh sạch sẽ workspace và tinh chỉnh probes không còn false positive.
  - Lưu trữ Plan 20, 21, 22 vào `archive/2026-10/` và chuẩn hóa Dashboard Điều Phối.

---

## 2. WBS & Dependency Graph

| Phase | Tên Giai Đoạn | File Chi Tiết | Phụ Thuộc | Chủ Trì | Trạng Thái |
|---|---|---|---|:---:|:---:|
| 1 | Đồng Bộ Hub Anti-Drift & Cập Nhật Tri Thức | [phase-1-drift-sync-and-knowledge.md](phase-1-drift-sync-and-knowledge.md) | — | @ba / @tl | `COMPLETED` |
| 2 | Căn Chỉnh Hợp Đồng Gate 4 & Đóng Sổ Audit | [phase-2-gate4-contract-and-evidence-realignment.md](phase-2-gate4-contract-and-evidence-realignment.md) | Phase 1 | @ba / @tl | `COMPLETED` |
| 3 | Vệ Sinh Mã Nguồn, Chống Rác Workspace & Sửa Probes | [phase-3-hygiene-and-probe-fixes.md](phase-3-hygiene-and-probe-fixes.md) | Phase 2 | @ba / @tl | `COMPLETED` |
| 4 | Lưu Trữ Kế Hoạch Cũ & Chuẩn Hóa Dashboard Plan | [phase-4-plan-archive-and-standardization.md](phase-4-plan-archive-and-standardization.md) | Phase 3 | @ba / @tl | `COMPLETED` |

```text
Phase 1 (Drift Sync) ──► Phase 2 (Gate 4 & Audit) ──► Phase 3 (Hygiene & Probes) ──► Phase 4 (Plan Archive)
```

---

## 3. Research Impact
> Research: Không áp dụng (L1/L2). Kế hoạch xử lý rủi ro và ổn định hệ thống nội bộ.

---

## 4. Điều Kiện Mang Theo
| Mục | Loại | Xử lý trong plan |
|---|---|---|
| U-1 | P1 | Bảo tồn tuyệt đối tính toàn vẹn của mã nguồn dự án khi chạy `mp:sync` (không ghi đè file có chỉnh sửa riêng). |
| U-2 | P2 | Tất cả các phase con phải tuân thủ nghiêm ngặt chuẩn cấu trúc §A–§I và vượt qua `master plan-check`. |

---

## 5. Danh Mục Điểm Chưa Rõ Từ Plan Gốc
| ID | Điểm chưa rõ | Vị trí trong plan gốc | Người xác nhận | Trạng thái |
|---|---|---|---|:---:|
| GAP-1 | 3 video blob lớn trong lịch sử git có cần rewrite history ngay không | Lủng số 6 | Tech Lead | `RESOLVED` (giữ nguyên, đưa vào quy chế team theo GIT_HYGIENE_GUIDE) |

---

## 6. Checklist Trạng Thái Nghiệm Thu Toàn Diện
- [x] **Phase 1: Đồng Bộ Hub Anti-Drift & Cập Nhật Tri Thức**
  - [x] Cập nhật `.ai/process-lock.json` khớp với Hub SHA `20caf254`.
  - [x] Tạo `.ai/knowledge/domain/research-sources.md` và dọn dẹp các bản `.hub-new`.
  - [x] Bổ sung `TC-23-01` vào `tests/dashboard-api/master-process.test.js` kiểm định `drift_status === 'IN_SYNC'`.
  - [x] Xác nhận `npm run mp:drift` đạt trạng thái `IN_SYNC` 100% (exit code 0).
- [x] **Phase 2: Căn Chỉnh Hợp Đồng Gate 4 & Đóng Sổ Audit**
  - [x] Cập nhật `.delivery/contract.json` khớp `approved_contract.sha256` (`plan-19b.json`).
  - [x] Đóng chu trình nghiệm thu cho `HUB-01` và `HUB-02` trong `audit/FINDINGS_REGISTRY.md` (`CLOSED`).
  - [x] Bổ sung `TC-23-02` vào `tests/dashboard-api/system.test.js` xác nhận contract hash và audit registry.
  - [x] Xác nhận `node scripts/run-mp.js gate . --preview` thông qua rào cản contract lock.
- [x] **Phase 3: Vệ Sinh Mã Nguồn, Chống Rác Workspace & Sửa Probes**
  - [x] Xóa thư mục rác `tests/dashboard/.tmp-workspace-1790975873387`.
  - [x] Nâng cấp `fixtureWorkspace.js` với `cleanupStaleWorkspaces()` và `maxRetries: 5, retryDelay: 100`.
  - [x] Sửa regex Probe P5 trong `.master_process/scripts/audit-probes.ps1` (`-cmatch` comment pattern).
  - [x] Xác nhận `node scripts/run-mp.js probes P5 .` đạt PASS (0 false positive).
- [x] **Phase 4: Lưu Trữ Kế Hoạch Cũ & Chuẩn Hóa Dashboard Plan**
  - [x] Di chuyển Plan 20, Plan 21, Plan 22 vào `_Plan_implement/archive/2026-10/`.
  - [x] Chuẩn hóa và cập nhật bảng điều phối `_Plan_implement/README.md` theo chuẩn phân vùng Master Process.
  - [x] Bổ sung `TC-23-04` vào `tests/dashboard-api/qa-spec-studio.test.js` xác thực cấu trúc và 100% link.
  - [x] Xác nhận `python .master_process/master.py plan-check` đạt PASS cho toàn bộ 4 phase.


