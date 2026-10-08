# Kế Hoạch 22: Xử Lý Rủi Ro Hệ Thống, Khôi Phục CI/CD & Chuẩn Hóa Hub-to-Spoke — Plan Overview

> **Plan ID:** `PLAN-22-RISK-REMEDIATION-2026-10-03` · **Cấp độ:** `L3` · **Baseline Commit:** `c9db466`  
> **Trạng thái:** `COMPLETED` · **Nguồn gốc:** [22_FRAMEWORK_RISK_REMEDIATION_PLAN.md](22_FRAMEWORK_RISK_REMEDIATION_PLAN.md)

---

## 1. Bối Cảnh & Mục Tiêu
- **Bối cảnh:** Qua đợt audit toàn diện hệ sinh thái Hub `@hadinhkms/qa-automation-engine`, phát hiện CI Unit Test Runner bị sập 7 test do rò rỉ slot AI Gateway và quét nhầm file backup; vệ tinh CarThings bị tụt hậu 41 file; vệ tinh `_SieuVietGroup` (Vieclam24h, trước đây là `_SV_Automation`) có nguy cơ mất code `run-suite.js`; audit registry bị lệch pha; và engine thiếu bộ mẫu traceability.
- **Mục tiêu:**
  - Khôi phục 100% Green toàn bộ bộ test `node --test` (764/764 tests: 585 unit + 179 dashboard contract).
  - Đồng bộ an toàn 100% Hub-to-Spoke không thất thoát mã nguồn.
  - Xây dựng Showcase Traceability `REQ-001` cho SauceDemo E2E test.
  - Dọn dẹp rác cấu hình, loại bỏ warning placeholder và bảo đảm Gate 4 xanh.

## 2. WBS & Đồ Thị Phụ Thuộc (Dependency Graph)

| Phase | Tên Giai Đoạn | File Chi Tiết | Phụ Thuộc | Chủ Trì | Trạng Thái |
|---|---|---|---|---|:---:|
| 1 | CI Unit Test Recovery & Gateway Mock | [phase-1-ci-unit-test-recovery.md](phase-1-ci-unit-test-recovery.md) | Không | @ba / @tl | `COMPLETED` |
| 2 | Hub-to-Spoke Sync & Audit Alignment | [phase-2-hub-spoke-and-audit-sync.md](phase-2-hub-spoke-and-audit-sync.md) | Phase 1 | @ba / @tl | `COMPLETED` |
| 3 | Traceability Showcase & Hygiene | [phase-3-traceability-showcase-and-hygiene.md](phase-3-traceability-showcase-and-hygiene.md) | Phase 2 | @ba / @tl | `COMPLETED` |

```text
Phase 1 (Unit Test Recovery & Mock) ──► Phase 2 (Hub-Spoke Sync & Audit) ──► Phase 3 (Showcase & Hygiene)
```

## 3. Điều Kiện Mang Theo & Quy Tắc Bất Biến (Rules & Constraints)
| Mã | Loại | Mô Tả Quy Tắc |
|---|---|---|
| **C-1** | Quy tắc Bất Biến | Tuyệt đối không thêm chú thích `// master-process-disable-size-check:` cho bất kỳ file mới hoặc file sửa đổi nào. |
| **C-2** | Bảo Vệ Vệ Tinh | Trước khi chạy `sync:satellites`, bắt buộc phải vượt qua `npm run presync:drift:strict` với 0 file nguy cơ mất nội dung riêng. |
| **C-3** | Tính Khách Quan Audit | Người sửa không tự ý đổi trạng thái sang `CLOSED` trong [FINDINGS_REGISTRY.md](file:///d:/_Automation-Project/audit/FINDINGS_REGISTRY.md) nếu chưa có bằng chứng kiểm định. |

## 4. Bảng Kiểm Tra Tiến Độ Toàn Diện (Checklist)
- [x] **Phase 1: CI Unit Test Recovery & AI Gateway Mock Isolation**
  - [x] Cập nhật npm script `test:unit` và `.github/workflows/playwright.yml`.
  - [x] Bổ sung `resetLimitsForTesting()` vào `core/ai/gateway/limits.js`.
  - [x] Cập nhật `createAgentService` và test suite `agentService.test.js` để cô lập mock 100%.
  - [x] Chạy `npm run test:unit`: Xác nhận 585/585 unit tests PASS (0 fail) + `tests/dashboard-api/` 179/179 PASS.
- [x] **Phase 2: Hub-to-Spoke Satellite Sync & Audit Registry Alignment**
  - [x] Phân giải an toàn `scripts/run-suite.js` giữa Hub và các vệ tinh (`_SieuVietGroup`).
  - [x] Vượt qua `npm run presync:drift:strict` với 0 nguy cơ mất mát.
  - [x] Chạy `npm run sync:satellites` cập nhật thành công cho `Vieclam24h` và `Automation_Carthings`.
  - [x] Cập nhật `audit/FINDINGS_REGISTRY.md` phân định rõ findings của Hub và vệ tinh.
- [x] **Phase 3: Traceability Showcase Suite, Config & Repo Hygiene**
  - [x] Tạo `requirements/REQ-001-authentication.md` và `test-cases/REQ-001-authentication.md`.
  - [x] Gắn tag `@REQ-001` vào `tests/e2e/desktop/saucedemo_login.spec.js`.
  - [x] Cập nhật `.env.example`, tạo `dashboardConfig.json` root và thêm backup vào `.gitignore`.
  - [x] Xác nhận nghiệm thu toàn diện Gate 4 (`check:framework`, `qa:trace`, `qa:check`, `suite:desktop`, `suite:mobile`, `suite:api`).
