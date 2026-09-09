# PLAN 09: SYSTEM MODULARIZATION & ARCHITECTURAL SCALABILITY (v1.0)
## Kế Hoạch Chuẩn Hóa Kiến Trúc & Phân Tách Mô-đun Hệ Thống Dashboard Studio

> **Cấp độ kiến trúc:** L4 — Major Architectural Refactoring & Scalability  
> **Mục tiêu cốt lõi:** Chuyển đổi toàn diện các file nguyên khối (Monolith: `app.js` 15.730 dòng, `styles.css` 19.450 dòng, `server.js` 2.720 dòng) thành kiến trúc mô-đun hóa chuẩn (Modular Architecture), tăng 400% tốc độ tải trang, giảm 85% chi phí Token Quota cho AI, đảm bảo Zero-Downtime và không gây bất kỳ lỗi hồi quy nào.  
> **Tiêu chuẩn tuân thủ:** Master Process Hub (`SOFTWARE_DELIVERY_PROCESS_MASTER.md`, `01_TOKEN_OPTIMIZATION_AND_KNOWLEDGE_SCALING.md`, `DASHBOARD_AI_PROMPT.md`).

---

## 1. Hiện Trạng & Đánh Giá Điểm Nghẽn Kỹ Thuật (Architectural Debt)

| Tệp nguồn | Dung lượng | Số dòng | Vấn đề kỹ thuật (Pain Points) | Rủi ro khi mở rộng tính năng mới |
|---|---|---|---|---|
| `dashboard/server.js` | 116 KB | 2.720 dòng | Toàn bộ 40+ REST API của 10 phân hệ (Runner, BDD, POM, Fixtures, Data, Git, Recorder, AI) nằm chung trong một file `http.createServer` khổng lồ. | Sửa 1 API dễ ảnh hưởng nhầm route khác; khó viết unit test cho từng handler. |
| `dashboard/public/styles.css` | 430 KB | 19.450 dòng | Toàn bộ tokens, base primitives, layout 3 cột và component của mọi studio nhồi chung một file. | Trình duyệt parse CSS chậm; nguy cơ xung đột class selector toàn cục rất cao. |
| `dashboard/public/app.js` | 676 KB | 15.730 dòng | Biến toàn cục chồng chéo (`currentSelectedScript`, `datasetsCache`, `editableSteps`...); 10 view nhồi chung 1 luồng runtime. | Main thread trình duyệt bị nghẽn (TBT); AI tốn 40.000 tokens mỗi lần đọc diff; dễ va chạm namespace. |
| `dashboard/public/index.html` | 317 KB | 4.705 dòng | 10 views và hàng chục modals nằm chung trong 1 tệp HTML duy nhất. | DOM tree quá nặng khi render ban đầu; khó bảo trì độc lập từng màn hình. |

---

## 2. Thiết Kế Kiến Trúc Mục Tiêu (Target Modular Architecture)

Áp dụng mô hình **Vanilla ES6 Modules (ESM) & Component-Driven Styling** — Giữ nguyên 100% bản sắc kỹ thuật Vanilla của dự án, không cài thêm thư viện/framework cồng kềnh (No React, No Webpack, No Babel runtime).

```text
dashboard/
├── server.js                        # Entry point: HTTP Server & Route Dispatcher (~180 dòng)
├── routes/                          # [PHASE 1] Backend Modular API Handlers
│   ├── runnerRoutes.js              # /api/run-specs, /api/stop-run, /api/test-results
│   ├── bddRoutes.js                 # /api/builder/* (scripts, actions, steps, save, compile)
│   ├── pageRoutes.js                # /api/object-repository/* (scan, get, save, delete)
│   ├── dataRoutes.js                # /api/data/* (datasets, create, delete, csv import/export)
│   ├── fixtureRoutes.js             # /api/fixtures/* (list, detail, save, delete, scenarios)
│   ├── suiteRoutes.js               # /api/suites/* (list, detail, save, delete, run)
│   ├── recorderRoutes.js            # /api/recorder/* (start codegen, stop, status)
│   ├── gitRoutes.js                 # /api/git/* (status, commit, push, pull, check)
│   ├── agentRoutes.js               # /api/agent/* (models, chat, stop)
│   └── systemRoutes.js              # /api/system/* (health, backups, file explorer)
│
└── public/
    ├── index.html                   # Shell container tải layout khung & import main.js (~600 dòng)
    │
    ├── styles/                      # [PHASE 2] CSS Modular Architecture
    │   ├── main.css                 # Master bundle nạp các module qua @import
    │   ├── tokens.css               # Design tokens (màu sắc, spacing, typography, theme)
    │   ├── base.css                 # Reset, layout 3 cột, hero headers, subnav primitives
    │   ├── components/              # Shared UI components
    │   │   ├── editor.css           # Code editor surface & line numbers
    │   │   ├── modals.css           # Modal dialogs, backdrop, animations
    │   │   ├── buttons.css          # Primary, secondary, ghost, icon buttons
    │   │   ├── cards.css            # Sidebar list cards, active glow, badges
    │   │   └── accordion.css        # Accordion blocks, chevron, summary chips
    │   └── views/                   # Studio-specific styles
    │       ├── runner.css           # Trình chạy test, terminal logs, stat cards
    │       ├── bdd.css              # BDD Studio, visual step builder, edit accordion
    │       ├── pages.css            # Page Manager, locator trees, method list
    │       ├── data.css             # Test Data Studio, archetypes, JSON preview
    │       ├── fixtures.css         # Fixtures Studio, capabilities, hooks
    │       ├── suites.css           # Test Suites Studio
    │       └── recorder.css         # Playwright Codegen recorder panel
    │
    └── js/                          # [PHASE 3] Frontend ES6 Modules (type="module")
        ├── main.js                  # App bootstrap, tab router & lazy loader (~150 dòng)
        ├── core/                    # Dịch vụ nền tảng dùng chung
        │   ├── state.js             # Quản lý state tập trung, dirty flags, events
        │   ├── api.js               # HTTP client request, toast/notifications
        │   ├── editor.js            # Shared Code Editor Controller (Prism, sync, format)
        │   └── utils.js             # EscapeHTML, debounce, formatters, copyToClipboard
        └── views/                   # Logic chuyên biệt từng màn hình (Lazy Loaded)
            ├── runnerView.js        # Controller tab Chạy Test
            ├── bddView.js           # Controller tab Kịch bản BDD (Inspect, Edit, Wizard)
            ├── pageManagerView.js   # Controller tab Quản lý Page Objects
            ├── dataView.js          # Controller tab Dữ liệu Test (Inspect, Create, CSV)
            ├── fixturesView.js      # Controller tab Fixtures Studio
            ├── suitesView.js        # Controller tab Test Suites
            ├── recorderView.js      # Controller tab Ghi thao tác Codegen
            ├── resourcesView.js     # Controller tab Báo cáo & Evidence
            ├── gitView.js           # Controller tab Đồng bộ Git
            └── agentView.js         # Controller tab AI Agent
```

---

## 3. Kế Hoạch Triển Khai Chi Tiết (Phased Execution Roadmap)

> ⚠️ **Quy Tắc Sống Còn:** Mỗi giai đoạn phải được kiểm thử độc lập. Hệ thống luôn ở trạng thái **chạy tốt (Always-Green)** sau mỗi bước, không được phép làm gián đoạn dashboard.

### 📍 Giai đoạn 1: Bóc tách Backend Router (`dashboard/server.js`)
*Thời gian ước tính: 1 phiên làm việc | Mức độ rủi ro: Thấp | Không ảnh hưởng UI*

- **Bước 1.1:** Tạo thư mục `dashboard/routes/` và chuẩn hóa helper xử lý request (`dashboard/routes/routeUtils.js`).
- **Bước 1.2:** Tách lần lượt 9 nhóm route độc lập:
  1. `dataRoutes.js` (Dataset CRUD & CSV)
  2. `pageRoutes.js` (Object Repository & Page Scanner)
  3. `fixtureRoutes.js` (Custom Fixtures & Lifecycle Hooks)
  4. `bddRoutes.js` (BDD Script CRUD & Generator)
  5. `suiteRoutes.js` (Test Suites CRUD & Execution)
  6. `recorderRoutes.js` (Codegen Session Manager)
  7. `runnerRoutes.js` (Test Execution & Live Logs)
  8. `gitRoutes.js` (Git Sync & Check Framework)
  9. `agentRoutes.js` & `systemRoutes.js`
- **Bước 1.3:** Tinh giản `dashboard/server.js`: Chỉ giữ lại HTTP server, static file serving, và dispatch request vào các router tương ứng.
- **Tiêu chí nghiệm thu Giai đoạn 1:**
  - `npm run check:framework` $\rightarrow$ 0 lỗi.
  - Chạy script kiểm thử tự động toàn bộ 40+ endpoints qua `node test-api.js` $\rightarrow$ Đạt 100% HTTP 200/OK.

---

### 📍 Giai đoạn 2: Bóc tách Hệ thống CSS (`dashboard/public/styles.css`)
*Thời gian ước tính: 1 phiên làm việc | Mức độ rủi ro: Trung bình | Giảm tải DOM Parser*

- **Bước 2.1:** Tạo thư mục `dashboard/public/styles/` và bóc tách các tệp nền tảng:
  - `tokens.css`: Gom toàn bộ CSS Variables (`:root`, dark/light theme, typography, shadow).
  - `base.css`: Reset CSS, typography gốc, layout 3 cột (`.suites-workspace`), header `.hero`.
- **Bước 2.2:** Bóc tách các thành phần dùng chung (`components/`):
  - `editor.css`: Bàn phím code editor, Prism highlighter, số dòng.
  - `modals.css`: Hộp thoại modal dialogs, backdrop, animation phóng to/thu nhỏ.
  - `buttons.css` & `cards.css`: Nút bấm, danh sách card sidebar, vạch gradient active.
  - `accordion.css`: Khung xếp gập 5 khối của BDD Studio.
- **Bước 2.3:** Bóc tách CSS riêng biệt cho từng Studio vào `views/` (`runner.css`, `bdd.css`, `data.css`, `pages.css`, `fixtures.css`...).
- **Bước 2.4:** Tạo tệp `dashboard/public/styles/main.css` gom các module lại qua `@import`. File `dashboard/public/styles.css` chỉ cần 1 dòng `@import './styles/main.css';` để tương thích ngược 100%.
- **Tiêu chí nghiệm thu Giai đoạn 2:**
  - Chụp ảnh Playwright so sánh trực quan (Pixel-by-pixel Visual Comparison) tại 1920x1080, 1440x900 và 1280px.
  - Kiểm tra chế độ Dark Mode và Light Mode $\rightarrow$ Đồng nhất 100%, không bị vỡ bố cục hay mất viền viền sáng.

---

### 📍 Giai đoạn 3: Trích xuất Dịch Vụ Lõi Frontend (`core/`)
*Thời gian ước tính: 1 phiên làm việc | Mức độ rủi ro: Trung bình | Chuẩn bị cho View Modules*

- **Bước 3.1:** Xây dựng `dashboard/public/js/core/state.js`:
  - Quản lý state tập trung: `currentSelectedScript`, `currentDataFile`, `currentInspectedPage`, `currentSelectedFixture`.
  - Cung cấp event bus nhẹ nhàng (`onStateChange`, `notifySubscribers`) để đồng bộ trạng thái giữa các view mà không gây va chạm biến toàn cục.
- **Bước 3.2:** Xây dựng `dashboard/public/js/core/api.js`:
  - Hàm `request(endpoint, options)` bọc `fetch`, tự động xử lý JSON, báo lỗi mạng và hiển thị toast notification.
- **Bước 3.3:** Xây dựng `dashboard/public/js/core/editor.js`:
  - Đóng gói toàn bộ controller Code Editor dùng chung (Prism syntax, đồng bộ cuộn, Undo/Redo, Dirty indicator, Format code) thành module tái sử dụng duy nhất.
- **Tiêu chí nghiệm thu Giai đoạn 3:**
  - Các màn hình vẫn hoạt động bình thường, mã nguồn dùng chung không bị lặp lại.

---

### 📍 Giai đoạn 4: Bóc tách Frontend Views theo Mô-đun (Cuốn Chiếu Từng Phân Hệ)
*Thời gian ước tính: 2 phiên làm việc | Mức độ rủi ro: Cao | Zero-Downtime Migration*

Tiến hành di dời logic từ `app.js` sang `public/js/views/` theo thứ tự độc lập từ dễ đến phức tạp:
1. **Phân hệ 1: Dữ liệu Test (`dataView.js`)**: Di chuyển logic JSON datasets, Archetypes, CSV import/export.
2. **Phân hệ 2: Test Suites (`suitesView.js`)**: Di chuyển logic bộ kịch bản, chạy test suite, tags filter.
3. **Phân hệ 3: Fixtures Studio (`fixturesView.js`)**: Di chuyển logic custom fixtures, hook registry, lifecycle.
4. **Phân hệ 4: Quản lý Page (`pageManagerView.js`)**: Di chuyển logic scan pages, locator tree, method inspector.
5. **Phân hệ 5: Kịch bản BDD (`bddView.js`)**: Di chuyển BDD Inspector, Accordion Edit 5 khối, Step Compiler, POM Linker.
6. **Phân hệ 6: Chạy Test (`runnerView.js`)**: Di chuyển logic kích hoạt test Playwright, streaming logs, terminal console.
- **Tạo Entry Point `public/js/main.js`**:
  - Lắng nghe sự kiện click thanh điều hướng trên cùng (`.view-tab`).
  - **Lazy Loading:** Chỉ nạp và khởi tạo view khi người dùng lần đầu tiên bấm vào tab đó, giúp tốc độ tải trang ban đầu cực kỳ nhanh (< 200ms).
- **Tiêu chí nghiệm thu Giai đoạn 4:**
  - `app.js` gốc được thay thế hoàn toàn bởi `main.js` gọn nhẹ (~150 dòng).
  - Mọi thao tác: Chạy test, Soạn thảo BDD, Thêm bước từ POM, Tạo dữ liệu mới, Chỉnh sửa Fixtures đều chạy trơn tru 100%.

---

### 📍 Giai đoạn 5: Senior QA Verification Gate (Gate 4 Toàn Diện)
*Thời gian ước tính: 1 phiên làm việc | Tiêu chuẩn: 10/10 Production*

- **Kiểm thử tự động:**
  - Chạy toàn bộ test suites hiện có của framework: `npm test`.
  - Chạy kiểm tra quy chuẩn kiến trúc: `npm run check:framework`.
- **Kiểm thử giao diện & luồng nghiệp vụ trên Playwright:**
  - Viết kịch bản E2E kiểm tra toàn bộ luồng xuyên suốt (End-to-End Journey):
    1. Tạo 1 file Data mới $\rightarrow$ Kiểm tra tự động nhận diện bên BDD Studio.
    2. Chỉnh sửa kịch bản BDD qua Accordion $\rightarrow$ Thêm bước từ Page Object $\rightarrow$ Bấm Format code $\rightarrow$ Lưu file.
    3. Chọn kịch bản và bấm "Chạy test này" $\rightarrow$ Kiểm tra console logs và hiển thị kết quả.
    4. Kiểm tra trên 4 độ phân giải: 1920x1080, 1440x900, 1280x800 và Mobile Viewport.
    5. Kiểm tra cả 2 chế độ màu Light / Dark Mode.

---

## 4. Quản Trị Rủi Ro (Risk Mitigation Matrix)

| Rủi ro tiềm ẩn | Mức độ | Biện pháp kiểm soát & Phòng ngừa |
|---|---|---|
| Mất tính tương thích ngược với các file HTML cũ | Cao | File `styles.css` và `app.js` ở thư mục gốc được giữ làm proxy nạp module mới, đảm bảo mọi tham chiếu cũ không bị lỗi 404. |
| Mất kết nối biến toàn cục (Global Scope Breakdown) | Cao | Đặt các biến chia sẻ quan trọng lên `window` hoặc dùng `state.js` tập trung trong giai đoạn chuyển tiếp. |
| Xung đột sự kiện (Event Listener Duplication) | Trung bình | Áp dụng cờ bảo vệ `isInitialized` (idempotent pattern) cho mọi hàm khởi tạo module theo bài học `[PITFALL-004]`. |
| Lỗi đường dẫn import file tĩnh trên server | Thấp | Kiểm tra cấu hình static serving của `server.js` cho thư mục `public/js/` và `public/styles/`. |

---

## 5. Kết Quả Dự Kiến Sau Khi Hoàn Tất Plan

1. **Hiệu năng (Performance):** Tốc độ nạp trang ban đầu tăng **~300% - 400%** nhờ cơ chế Lazy Load theo tab.
2. **Khả năng mở rộng (Extensibility):** Khi cần thêm 1 Studio mới (ví dụ API Testing Studio hay Performance Studio), lập trình viên chỉ cần tạo 1 file `routes/apiStudioRoutes.js`, 1 file `styles/views/apiStudio.css` và 1 file `js/views/apiStudioView.js` mà không phải đụng chạm đến bất kỳ dòng code nào của các studio khác.
3. **Tiết kiệm Quota Token cho AI:** Khi bạn yêu cầu sửa BDD Studio, AI chỉ cần nạp duy nhất file `bddView.js` (~500 dòng / ~3.000 tokens) thay vì phải nạp cả file `app.js` (15.730 dòng / ~45.000 tokens), tiết kiệm **hơn 90% chi phí token**!
4. **Bảo trì & Debug:** Truy vết lỗi tức thì theo đúng thư mục tính năng, loại bỏ hoàn toàn tình trạng "sửa chỗ này hỏng chỗ kia".

---

> 🎯 **Trạng thái Kế hoạch:** ĐÃ LẬP KẾ HOẠCH — CHỜ REVIEW VÀ DUYỆT TỪ USER.  
> **Chưa có bất kỳ dòng code nào bị thay đổi.** Hãy đọc và chỉnh sửa thoải mái trong file này. Khi bạn đã sẵn sàng, chúng ta sẽ bắt đầu từ Phase 1!
