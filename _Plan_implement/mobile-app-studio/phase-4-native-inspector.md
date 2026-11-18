# Phase 4 — Native Inspector & sinh Page Object

> **Tác giả Nghiệp vụ / Kỹ thuật:** @claude (phiên 2026-11-19) · **Research:** Không áp dụng
> **Cấp độ:** L3 · **Phụ thuộc:** Phase 3 · **Trạng thái:** `TODO`

**Bước 0 bắt buộc của session:** rà soát lại Phase 3 theo §F của [phase-3-ios-remote-mac.md](phase-3-ios-remote-mac.md), sửa nếu thiếu, ghi kết quả vào §I của file này.

---

## A. Nghiệp Vụ

### A1. Mục Tiêu & Phạm Vi
- **In-Scope:**
  1. Mở **phiên Inspector** trên thiết bị đã chọn (Android; iOS khi có Mac), không cần Appium Inspector riêng.
  2. Hiện **ảnh màn hình** + **cây phần tử** (page source) cạnh nhau; bấm lên ảnh chọn phần tử tương ứng, bấm trên cây thì khoanh vùng trên ảnh.
  3. Bảng thuộc tính phần tử + **gợi ý locator** theo thứ tự ưu tiên: `resource-id` / accessibility id → `-android uiautomator` (hoặc iOS predicate/class chain) → text → XPath tương đối. Mỗi gợi ý có số phần tử khớp (1 = tốt).
  4. Thao tác điều hướng app: chạm, nhập chữ, Back, làm mới ảnh.
  5. Gom phần tử đã chọn thành **Page Object nháp** (`.dashboard-drafts/pages/native/<platform>/`), xem trước bằng editor dùng chung, rồi **Tạo** vào `pages/native/<platform>/` (theo `NativeBasePage`).
- **Out-of-Scope:** ghi lại thao tác thành spec (recorder native) — để backlog.
- **UI:** yes

### A2. Yêu Cầu & Quy Tắc
- `REQ-401` Inspector dùng chung khoá chạy (X-02): đang có lượt test thì không mở được, và ngược lại.
- `REQ-402` Phiên tự đóng sau 10 phút không thao tác hoặc khi rời view.
- `BR-401` Page Object nháp không được ghi vào `pages/` cho tới khi người dùng bấm Tạo; tên file/class làm sạch.
- `BR-402` Locator sinh ra phải dùng các hàm có sẵn của `NativeBasePage` (`byId`, `byAccessibilityId`, `byText`…).

### A3. User Flow
- Mobile App → khung 3 "Inspector" (hoặc nút "Mở Inspector") → chọn thiết bị + app → Bắt đầu → ảnh + cây hiện ra → chọn phần tử → "Thêm vào Page Object" → đặt tên → xem trước → Tạo.
- Lỗi: thiết bị rớt kết nối / Appium lỗi → phiên đóng, thông báo, không giữ khoá.

### A4. Trạng Thái Biên
- `EDGE-401` Page source rất lớn (> 2 MB) → vẫn render, cây thu gọn mặc định.
- `EDGE-402` Bấm vào vùng không có phần tử → không chọn gì, không lỗi.
- `EDGE-403` Mở 2 tab cùng Inspector → tab sau nhận `409`.
- `EDGE-404` Tên Page Object trùng file có sẵn → hỏi ghi đè trong UI, mặc định không ghi đè.

### A5. Tiêu Chí Nghiệm Thu
- `AC-401` Given máy Android thật When Bắt đầu Inspector Then ≤ 60 s có ảnh + cây phần tử.
- `AC-402` (BR-402) Given chọn một nút có `resource-id` Then gợi ý đầu tiên là `byId('<id>')` với số khớp = 1.
- `AC-403` (BR-401) Given đã thêm 3 phần tử When Tạo Page Object Then file mới trong `pages/native/android/` qua `npm run check:framework` và dùng được trong một spec chạy đạt.
- `AC-404` Given phiên Inspector đang mở When gọi `/api/mobile/run` hoặc `/api/run` Then `409`; khi đóng phiên thì chạy được.
- `AC-405` Given không thao tác 10 phút Then phiên tự đóng, session Appium bị xoá.

### A6. UAT
- `UAT-401` QA mở Inspector trên app thật, chọn ô nhập và nút đăng nhập, tạo `LoginPage`, viết spec ngắn dùng Page Object đó và chạy đạt từ Dashboard. Truy vết: REQ-401, AC-401..403.

---

## B. Kỹ Thuật

### B1. Quyết Định
- `TECH-401` Server nói chuyện trực tiếp với Appium qua WebDriver HTTP (`POST /session`, `GET /screenshot`, `GET /source`, `POST /elements`, `DELETE /session`) bằng `fetch`, không chạy WDIO, vì phiên tương tác cần giữ lâu và đóng chủ động (REQ-402).
- `TECH-402` Android: Appium tự khởi động như P1 (`appium` CLI, cổng 4723) nếu chưa chạy; iOS: dùng Mac host P3, để REQ-401 dùng chung khoá và hạ tầng đã có.
- `TECH-403` Parse XML page source ở trình duyệt bằng `DOMParser`; toạ độ từ `bounds` (Android) / `x,y,width,height` (iOS), vì để BR-402 gợi ý locator cần đủ thuộc tính gốc.
- `TECH-404` Sinh Page Object từ template chung + lưu nháp qua cơ chế `.dashboard-drafts/` sẵn có, để tuân thủ BR-401 (không ghi vào `pages/` khi chưa xác nhận).

### B2. Bản Đồ File (dự kiến)
| Path | Loại | Thao tác | Trần |
|---|---|:---:|:---:|
| `dashboard/services/mobileInspectorService.js` | Service | Tạo | 160 |
| `dashboard/services/nativePageObjectGenerator.js` | Service | Tạo | 160 |
| `dashboard/routes/mobileInspectorRoutes.js` | Route | Tạo | 160 |
| `dashboard/public/js/views/mobile/inspector*.js` | Module | Tạo | 200/file |
| `tests/dashboard-api/mobile-inspector.test.js` (fake Appium) | Test | Tạo | — |

### B3. Contract
| Method | Path | Mã |
|---|---|---|
| POST | `/api/mobile/inspector/start` | 201, 400, 409, 503 |
| GET | `/api/mobile/inspector/snapshot` | 200 (`screenshot` base64, `source` xml), 404 |
| POST | `/api/mobile/inspector/find` | 200 (`count`) |
| POST | `/api/mobile/inspector/action` (`tap`/`type`/`back`) | 200, 400 |
| POST | `/api/mobile/inspector/stop` | 200, 404 |
| POST | `/api/mobile/inspector/page-object` (nháp / tạo) | 200, 201, 400, 409 |

### B4. Dependencies
- Không có.

### B5. NFR
- Snapshot ≤ 3 s trên máy thật thông thường. Ảnh không lưu ra đĩa trừ khi người dùng bấm lưu.

### B6. Rủi Ro
- Session Appium mồ côi khi server tắt → `shutdown()` gọi `DELETE /session` và dừng Appium.
- XPath sinh tự động dễ gãy → luôn đặt XPath cuối danh sách, cảnh báo khi chỉ có XPath.

---

## C. Ma Trận Kiểm Thử
| AC | TC | Mức | File | Ca biên |
|---|---|:---:|---|---|
| AC-401 | TC-4.1 | e2e máy thật | thủ công qua UI | — |
| AC-402 | TC-4.2 | unit | `nativeLocatorSuggest.test.js` | không id, trùng id, text dài |
| AC-403 | TC-4.3 | integration + e2e | `nativePageObjectGenerator.test.js` + chạy spec | tên trùng, ký tự lạ |
| AC-404 | TC-4.4 | integration | `tests/dashboard-api/mobile-inspector.test.js` | 409 hai chiều |
| AC-405 | TC-4.5 | unit (đồng hồ giả) | `mobileInspectorService.test.js` | — |

## D. Phạm Vi Dev Tự Quyết
- Bố cục ảnh/cây (2 cột hay tab trên mobile), màu khoanh vùng, cách thu gọn cây.

## E. Câu Hỏi Mở
- 0 câu hỏi chặn.

## F. Tiêu Chí Ra Phase
- [ ] Bước 0: rà soát P3 ghi vào §I.
- [ ] AC-401..405 đạt (phần iOS `BLOCKED (chờ Mac)` nếu chưa có Mac); UAT-401 đạt trên Android thật.
- [ ] Đủ test + kiểm tra như X-05 của overview; UI 4 kích thước × 2 theme.
- [ ] Cập nhật overview, commit và push lên `main`.

## G. Soát Chéo
- Review độc lập P4 ở một session riêng sau khi xong.

## H. Nhật Ký Thay Đổi (PDR)
| PDR | Loại | Plan gốc | Thực tế | Ảnh hưởng | Trạng thái |
|---|:---:|---|---|---|:---:|

## I. Bằng Chứng
_(Điền khi thực thi)_
