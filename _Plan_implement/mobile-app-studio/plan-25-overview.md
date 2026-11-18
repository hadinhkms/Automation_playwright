# Mobile App Studio — Plan Overview

> **Plan ID:** `PLAN-25-mobile-app-studio-2026-11-19` · **Baseline:** `e49c3fb` · **Cấp độ:** L3
> Research Gate: R0 đề xuất thiết kế nội bộ, không cần nghiên cứu ngoài. **Research:** Không áp dụng gói RES. Đề xuất thiết kế và mockup đã được Owner duyệt (artifact "Mobile App Studio", 2026-11-19).
> **Quyết định Owner (2026-11-19):** iOS đi hướng **Mac host từ xa**. Làm sẵn toàn bộ phần cài đặt/kết nối ngay bây giờ; máy Mac sẽ được cung cấp sau, nên phần chạy thật trên iOS được đánh dấu `BLOCKED (chờ Mac)` cho tới khi có máy.

---

## 1. Bối Cảnh & Mục Tiêu Kinh Doanh

- Playwright chỉ test web. Repo đã có test native Android bằng WebdriverIO 9 + Appium 2 (`wdio.android.conf.js`, `tests/native/android/`, `pages/native/`) nhưng chỉ chạy qua CLI.
- Người dùng: QA Engineer, Test Lead trong team. Họ cần chạy test app (APK, sau này IPA) trên máy thật/emulator, xem log và ảnh bằng chứng **ngay trên Dashboard**, không phải mở terminal.
- Kết quả mong đợi: một view **Mobile App** theo đúng 3-frame layout, dùng chung khoá chạy và SSE với Playwright runner; về sau bao phủ iOS và có Inspector để lấy locator, sinh Page Object.

## 2. WBS & Dependency Graph

| Phase | Tên | Phụ thuộc | Trạng thái |
|---|---|---|:---:|
| 1 | [phase-1-android-mvp.md](phase-1-android-mvp.md) | — | `DONE` |
| 2 | [phase-2-builds-and-reports.md](phase-2-builds-and-reports.md) | P1 | `DONE` |
| 3 | [phase-3-ios-remote-mac.md](phase-3-ios-remote-mac.md) | P2 | `TODO` (UAT thật `BLOCKED` chờ Mac) |
| 4 | [phase-4-native-inspector.md](phase-4-native-inspector.md) | P3 | `TODO` |

```text
P1 Android MVP ──► P2 Build & Báo cáo ──► P3 iOS (Mac host từ xa) ──► P4 Inspector & sinh Page Object
```

Mỗi phase chạy trong **một session riêng**. Session của phase N+1 mở đầu bằng việc rà soát lại phase N (đối chiếu Exit Criteria, sửa nếu thiếu) rồi mới làm phase N+1. Cuối mỗi phase: commit và push lên `main`.

## 3. Research Impact

> Research: Không áp dụng (đề xuất thiết kế nội bộ, không có gói `RES-xx`).

| IMP | Chủ | Xử lý | Lý do | Áp dụng ở | Kiểm chứng |
|---|---|---|---|---|---|
| IMP-25-01 | TL (nội bộ, không có RES) | ADOPT | JUnit cho receipt Gate 4 (REQ-203): dùng reporter chính thức `@wdio/junit-reporter`, khoá đúng phiên bản 9.32.0 như `@wdio/cli` đang cài, không cần nghiên cứu ngoài | P2 §B4, `wdio.android.conf.js` | AC-205 (PDR-2-01) |

## 4. Quyết Định Xuyên Phase (áp dụng cho mọi phase)

- **X-01 Kiến trúc Dashboard:** giữ vanilla HTML/CSS/JS, đủ 5 mảnh mỗi view (`scripts/verify-dashboard-features.js`), dùng `.suites-workspace` (3-frame), `.panel`, `.hero`, `.script-panel-head`.
- **X-02 Một khoá chạy:** Playwright run, Playwright UI, Mobile run và (P4) Inspector session loại trừ nhau, trả `409` kèm lý do.
- **X-03 Không lộ đường dẫn tuỳ ý:** mọi file do người dùng chọn phải nằm trong danh mục server liệt kê (`apps/`, `tests/native/<platform>/`); không ghép chuỗi vào shell.
- **X-04 Ngân sách dòng:** Service ≤ 160, Module/Page Object ≤ 200, kiểm bằng `node scripts/check-code-limits.js --strict`.
- **X-05 Bằng chứng:** API contract test trong `tests/dashboard-api/`, unit test cạnh service (`dashboard/services/*.test.js`), kiểm UI ở 1920/1440/1280/390 cả hai theme.

## 5. Điều Kiện Mang Theo

| Mục | Loại | Xử lý trong plan |
|---|---|---|
| ASM-1 | Assumption | Owner cung cấp máy macOS (Xcode + Appium 2 + XCUITest driver) sau P3. Tới lúc đó UAT iOS thật để `BLOCKED`, các phần còn lại kiểm bằng Appium giả lập (fake `/status`). |
| ASM-2 | Assumption | Dashboard chạy local trên máy người test (bind `127.0.0.1`). Chưa làm chế độ server dùng chung. |
| OQ-1 | Open (không chặn) | Có cần chạy song song nhiều thiết bị không — hoãn, mặc định 1 thiết bị / 1 lượt. |

## 6. Checklist Tổng Thể

- [x] Phase 1 — Android MVP (xem evidence trong file phase)
- [x] Phase 2 — Build & báo cáo (xem evidence trong file phase)
- [ ] Phase 3 — iOS qua Mac host (phần cài đặt); UAT iOS thật chờ Mac
- [ ] Phase 4 — Inspector & sinh Page Object
- [ ] Review độc lập P4 + đánh giá UI/UX tổ chức script (session riêng)
- [ ] `master plan-archive` sau khi hoàn tất

## 7. Tài Liệu Liên Quan

- Hướng dẫn chạy Android CLI: [docs/ANDROID_NATIVE_TESTING.md](../../docs/ANDROID_NATIVE_TESTING.md)
- Quy chuẩn Dashboard: [ai/dashboard/DASHBOARD_AI_PROMPT.md](../../ai/dashboard/DASHBOARD_AI_PROMPT.md), [ai/dashboard/AI_LESSONS.md](../../ai/dashboard/AI_LESSONS.md)
