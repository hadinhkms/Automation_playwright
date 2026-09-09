# Cold Archive: 2026-09

> [!NOTE]
> Processed candidates (Promoted/Rejected) archived during 2026-09.



<!-- Archived at 2026-09-10 03:00:33 -->
### [LEARN-001] Cơ chế Whitelist Asset & Rào Chắn Bảo Mật Khi Đồng Bộ Git Trong QA Automation
- **Nguồn trích xuất:** FEATURE-GIT-SYNC-STUDIO
- **Role quan sát:** Senior QA / Technical Lead
- **Quan sát (Observation):** Khi cung cấp tính năng Commit/Push trực tiếp cho tester trên UI Dashboard, nguy cơ vô tình commit file `.env`, media nặng (`playwright-report`, `test-results`, `evidence`), hoặc code dở dang vi phạm framework (`waitForTimeout`) là rất cao nếu chỉ dùng `git add .`.
- **Bằng chứng (Evidence):** `core/system/gitSyncService.js`, `scripts/git-sync.js`, `dashboard/public/app.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Technical Lead
- **Trạng thái:** PROMOTED
- **Nguyên tắc rút ra:**
  1. Luôn dùng Whitelist cụ thể cho các tệp test (`tests/**`, `pages/**`, `data/**`, `suites`, `docs/**`) và Blacklist bảo mật cho secrets/artifacts.
  2. Bắt buộc kích hoạt Framework Quality Gate (`npm run check:framework`) trước khi cho phép commit/push.
  3. Khi thực hiện Git Pull từ UI, cung cấp cơ chế auto-stash an toàn để tránh làm mất code dở dang của tester khi có xung đột.

### [LEARN-002] Chuẩn Hóa Căn Hàng Đều Cho Multi-Column Form Inputs & Viewport Spacing Trong Dashboard
- **Nguồn trích xuất:** UI/UX-SUITE-FORM-ALIGNMENT
- **Role quan sát:** Senior UI/UX Designer & Frontend Maintainer
- **Quan sát (Observation):** Trong grid form nhiều cột có chứa các input/select, độ dài văn bản của label các cột không đều nhau (cột 1 dòng, cột 2 dòng do wrapping) dẫn đến các control input (`<select>`, `<input>`) bị lệch cao độ ngang theo bậc thang gây mất thẩm mỹ trầm trọng.
- **Bằng chứng (Evidence):** `dashboard/public/styles.css` (.suite-field-item > label, .suite-fields-grid), `dashboard/public/index.html` (#suite-platform-row1)
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Senior UI/UX Designer / Frontend Lead
- **Trạng thái:** PROMOTED
- **Nguyên tắc rút ra:**
  1. Luôn quy định `min-height` cố định kèm `display: flex; align-items: flex-end;` cho thẻ `<label>` trong grid items để đáy nhãn luôn cùng nằm trên một tọa độ Y, đảm bảo 100% control bên dưới xuất phát từ cùng một đường thẳng ngang.
  2. Đồng nhất chiều cao tuyệt đối (`height: 40px; box-sizing: border-box;`) giữa `<select>` và `<input>` để triệt tiêu chênh lệch render mặc định của trình duyệt.
  3. Phân bổ tỉ lệ cột grid linh hoạt với cột số lượng (Workers) nhỏ gọn (96px - 100px) căn giữa rõ ràng, tránh text helper bị rớt dòng đơn lẻ.

### [LEARN-003] Thiết Kế Segmented Control Duy Nhất Cho Artifacts Explorer Thay Thế Nút Trùng Lặp (Duplicate Buttons Anti-Pattern)
- **Nguồn trích xuất:** UI/UX-REPORTS-EVIDENCE-REDESIGN
- **Role quan sát:** Senior UI/UX Designer & Product Owner
- **Quan sát (Observation):** Việc đồng thời bố trí khối nút danh mục dạng thẻ lớn (Results Orientation) ở đầu và hàng nút lọc (Resource Filter Pills) ngay dưới thanh tìm kiếm gây hiện tượng trùng lặp chức năng trực quan (duplicate mode switcher), làm người dùng bối rối và lãng phí không gian dọc quý giá của thanh điều hướng (sidebar).
- **Bằng chứng (Evidence):** `dashboard/public/index.html` (#resources-view, #resource-nav), `dashboard/public/styles.css` (.resource-segmented-control, .resource-seg-btn, .resource-platform-pills), `dashboard/public/app.js` (switchResourceCategory, renderResourceList)
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Senior UI/UX Designer / QA Lead
- **Trạng thái:** PROMOTED
- **Nguyên tắc rút ra:**
  1. Loại bỏ triệt để việc xếp chồng 2 hàng nút chuyển đổi cùng một danh mục (Reports vs Evidence). Hợp nhất thành một Segmented Control duy nhất theo phong cách Linear/SaaS với badge số lượng trực tiếp và mô tả phụ gọn gàng.
  2. Ghim cố định (pinned) Header, Segmented Control, Hộp tìm kiếm và Thanh công cụ thư mục ở trên cùng của sidebar (`display: flex; flex-direction: column; height: 100%`), chỉ cho phép cây thư mục (`.resource-list-scroll`) cuộn dọc để người dùng không bao giờ bị trôi mất ô tìm kiếm hay bộ lọc.
  3. Cung cấp nút tiện ích "Mở tất cả / Thu gọn" (`#resource-toggle-tree-btn`) và tự động mở thư mục ngày gần nhất để tối ưu hóa thao tác kiểm tra artifact hàng ngày của tester.
  4. Bổ sung bộ lọc nền tảng nhanh (`Tất cả`, `Desktop`, `Mobile`) khi xem Evidence để lọc tức thì trong hàng trăm ảnh chụp màn hình mà không cần lùng sục từng cấp folder.

### [LEARN-004] Page Studio catalog separation must preserve fixture consumers
- Date: 2026-09-09.
- Source: Review plan 07.
- Role: Code Reviewer / Senior QA.
- Observation: Removing fixtures from both scanner and path validation breaks the existing BDD Inspector capability lookup.
- Evidence: dashboard/public/app.js:9762 still requests core/fixtures via object-repository/page; parsePageObject rejects that path; node --test core/generator/objectRepository.test.js reports 6 passed, 1 failed.
- Proposed classification: FAILURE PATTERN.
- Scope: PROJECT.
- Owner: Technical Lead / QA Lead.
- **Trạng thái:** PROMOTED
- Preventive proposal: Separate UI catalog filtering from shared inspection contracts; migrate consumers and regression tests together. Align Studio page destinations with runtime resolution: Studio creates mobile-web pages while the current container selects mobile whenever that directory exists.

### [LEARN-005] Plan 07 follow-up: contract assertions beyond smoke coverage
- Date: 2026-09-09.
- Source: 07_IMPLEMENTATION_REVIEW_2026-09-09.md.
- Role: Reviewer / Senior QA.
- **Trạng thái:** PROMOTED
- Scope: PROJECT.
- Evidence: Existing 27 tests and 3 new local browser smoke tests pass, but targeted checks reproduce an undefined isFixture in Page Manager, a sibling-prefix junction escape in pagesFactory, and desktop selection for a public isMobile=true project named Handset.
- Observation: Fixture GET compatibility from LEARN-004 is restored. Capability parsing still omits authenticatedUser/options/failureTrackerHook; malformed fixture source is marked ready. Container script metadata still reports zero pages.
- Preventive proposal: Assert complete capability keys and invalid-source readiness, canonical path boundaries/cache identity, custom device platform selection, and execute nonempty UI render paths. Test labels alone do not prove the Plan 07 T01-T18 contracts.
- Related files: core/fixtures/pagesFactory.js, core/fixtures/baseTest.js, core/generator/objectRepository.js, core/generator/visualBuilderCompiler.js, dashboard/public/app.js.

### [LEARN-006] Plan 08 needs consumer-owned fixtures and observable cleanup contracts
- Date: 2026-09-09.
- Source: Review 08_PLAN_FIXTURE_AND_HOOKS_STUDIO.md.
- Role: Reviewer / Senior QA.
- **Trạng thái:** PROMOTED
- Scope: PROJECT.
- Evidence: scripts/sync-satellites.js copies core recursively and excludes only core/config/dashboardConfig.json; custom fixture loader defaults to package __dirname; cleanupQueueFixture ignores runAll error results. A mock delete failure logs a warning but the fixture resolves successfully. customFixtures.test.js passes 3/3 without verifying teardown through an HTTP API after a real runner failure/timeout.
- Preventive proposal: Store consumer fixtures outside engine-owned sync paths (or explicitly preserve custom files), resolve consumer root consistently, validate exported keys at runtime, specify dependency-safe teardown ownership, bounded cleanup and observable error outcomes. Keep the canonical three-frame Studio layout. Register compensation immediately after resource creation, not at an unreachable final BDD step.
- Related files: core/fixtures/custom/index.js, core/fixtures/cleanupRegistry.js, scripts/sync-satellites.js, ai/dashboard/DASHBOARD_AI_PROMPT.md.

### [LEARN-007] Consolidated Architecture & Resolution Pattern for Plan 07 & Plan 08
- **Date:** 2026-09-09.
- **Source:** MASTER_PLAN_07_08_CONSOLIDATED & Gate 4 Senior QA Verification.
- **Role:** Principal QA Engineer / Framework Architect.
- **Quan sát (Observation):** Khi tích hợp song song Fixture Container (Plan 07) và Fixtures & Hooks Studio (Plan 08), sự phân định trách nhiệm lỏng lẻo giữa Page Manager và Fixtures Studio dẫn tới lỗi hiển thị (`isFixture` ReferenceError), nguy cơ ghi đè fixtures người dùng qua `sync-satellites`, cơ chế cleanup không an toàn (timeout treo, nuốt lỗi teardown), và xung đột ghi đè đồng thời trên UI.
- **Bằng chứng (Evidence):**
  - F01: `isFixture` ReferenceError trong `renderPageManagerFiles`.
  - F02/F07: `sync-satellites.js` ghi đè toàn bộ `core/fixtures` mà không loại trừ `custom/`.
  - F03: Bỏ qua public Playwright `isMobile` project flag trong `baseTest.js`.
  - F04: LIFO cleanup thiếu timeout cục bộ và nuốt lỗi khi test thành công nhưng cleanup thất bại.
  - F08: Thiếu cơ chế Optimistic Concurrency Control (ETag/SHA-256 revision) và auto-backup khi tester chỉnh sửa fixture trên Web UI.
- **Đề xuất phân loại:** APPROVED STANDARD.
- **Phạm vi đề xuất:** PROJECT & ALL SATELLITE REPOSITORIES.
- **Đề xuất Owner duyệt:** Principal QA / Technical Lead.
- **Trạng thái:** PROMOTED
- **Nguyên tắc rút ra:**
  1. **Tách bạch Catalog Tuyệt Đối:** Page Manager chỉ quản lý Page Objects nghiệp vụ và BasePage (Foundation); Fixtures Studio quản lý toàn bộ vòng đời, preconditions và custom fixtures.
  2. **Bảo tồn Fixtures Consumer:** Khuyến nghị lưu fixtures dự án con tại `fixtures/custom/` và cấu hình `scripts/sync-satellites.js` luôn loại trừ `core/fixtures/custom` khi đồng bộ code lõi.
  3. **Ưu tiên Platform 4 Cấp:** Khi khởi tạo `pages` fixture: `pageObjectsPlatform` (override) -> `isMobile` (Playwright option) -> Nhận diện tên project/file -> `desktop` (fallback mặc định).
  4. **Hợp đồng Cleanup An toàn & Đo lường được:** Cleanup Registry bắt buộc thực thi LIFO, bọc từng tác vụ trong timeout độc lập (`timeoutMs` + `timer.unref()`), trả về danh sách `errors` chuẩn cho assert, và ném `TeardownFailureError` nếu test pass nhưng teardown thất bại.
  5. **Bảo vệ Concurrency & Backup:** Mọi thao tác cập nhật/xóa fixture qua REST API/UI phải kiểm tra SHA-256 `expectedRevision` (409 Conflict) và tự động tạo bản sao lưu trong `.dashboard-backups/fixtures/`.

### [LEARN-005] Chuẩn Hóa Kiến Trúc Card Sidebar & Giới Hạn Phạm Vi Selector (Scoped DOM Queries) Tránh Xung Đột Trạng Thái
- **Nguồn trích xuất:** UI/UX-CARD-SYNC-BUGFIX
- **Role quan sát:** Senior Frontend Maintainer / QA Lead
- **Quan sát (Observation):** 
  1. Khi nhiều view cùng sử dụng lớp CSS chung dạng card (`.script-card-item`), việc gọi `document.querySelectorAll('.script-card-item')` toàn cục trong hàm chọn file của một tab sẽ vô tình xóa sạch trạng thái `.active` và `.is-selected` của các tab khác, gây mất viền sáng và trạng thái lựa chọn.
  2. Các pill filter phân loại không bao quát (ví dụ chỉ có precondition/teardown mà bỏ quên infrastructure/options) khiến các thẻ cốt lõi bị lọc mất, tạo cảm giác bấm vào đâu mất items ở đó.
- **Bằng chứng (Evidence):** `dashboard/public/app.js` (selectProjectScript, selectFixture, Wizard deselect), `dashboard/public/styles.css` (.dashboard-list-card, .script-card-item), `dashboard/public/index.html` (#fixtures-filter-pills)
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Senior Frontend Maintainer / Technical Lead
- **Trạng thái:** PROMOTED
- **Nguyên tắc rút ra:**
  1. **Đồng bộ hóa 100% Card Design System:** Mọi thẻ danh sách trong sidebar (`builder-view`, `page-manager-view`, `data-view`, `suites-view`, `fixtures-view`) bắt buộc sử dụng chuẩn lớp `.dashboard-list-card.script-card-item` kèm các lớp đặc thù. Nhờ đó, trạng thái active được thừa hưởng đồng nhất: viền `var(--accent)`, viền glow `box-shadow`, nền tint 10%, và vạch gradient đa sắc 3.5px ở mép trái (`::before`).
  2. **Luôn Giới Hạn Scope Khi Query Selector:** Tuyệt đối không dùng `document.querySelectorAll('.script-card-item')` mà phải luôn kèm container ID (ví dụ `#script-files-list .script-card-item`, `#fixtures-list-container .fixture-card-item`).
  3. **Bộ Lọc Sidebar Cần Bao Quát & Hỗ Trợ Toggle Hoàn Tác:** Luôn cung cấp pill `Tất cả` và các nhóm lớn (Cốt lõi, Tùy biến hoặc Desktop, Mobile). Khi người dùng bấm lại vào pill đang active, tự động hoàn tác về `Tất cả` thay vì giữ trạng thái lọc chết.

### [LEARN-006] Triệt Tiêu Xung Đột Sự Kiện Giữa Các Bộ Lọc Dùng Chung Lớp CSS (Pill Listener Namespace Isolation)
- **Nguồn trích xuất:** UI/UX-FIXTURES-FILTER-COLLISION
- **Role quan sát:** Senior Frontend Maintainer / QA Architect
- **Quan sát (Observation):** Khi tái sử dụng lớp CSS tiện ích `.pm-filter-pill` cho bộ lọc của nhiều phân hệ khác nhau (Page Manager, Fixtures Studio), việc gắn sự kiện qua `document.querySelectorAll('.pm-filter-pill')` toàn cục đã kích hoạt listener của Page Manager mỗi khi người dùng click vào nút lọc của Fixtures. Hệ quả: listener Page Manager gán `active` trước, khiến listener Fixtures hiểu nhầm là click lặp lại để bỏ chọn và tự động hoàn tác về `all`; đồng thời xóa sạch class `active` của Page Manager, gây ra hiện tượng "có tab có bộ lọc mặc định, có tab mất trắng".
- **Bằng chứng (Evidence):** `dashboard/public/app.js` (dòng 6856, dòng 14736), `dashboard/public/index.html` (#fixtures-filter-pills)
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Frontend Lead / Principal QA
- **Trạng thái:** PROMOTED
- **Nguyên tắc rút ra:**
  1. **Namespace Bắt Buộc Cho Bộ Lọc Từng Phân Hệ:** Nút lọc của mỗi tab phải có lớp định danh riêng (ví dụ: Page Manager dùng `#pm-sidebar .pm-filter-pill`, Fixtures dùng `#fixtures-filter-pills .fx-filter-pill`, BDD dùng `.script-filter-btn`, Data dùng `.data-filter-btn`).
  2. **Chặn Nổi Bọt Sự Kiện (Event Bubble):** Luôn dùng `e.stopPropagation()` trong handler của nút lọc để ngăn chặn sự kiện lan ra các handler dùng chung ngoài ý muốn.

### [LEARN-007] Cơ Chế Quản Lý Vòng Đời Tiến Trình Codegen & Tự Động Phục Hồi Khỏi Session Zombie
- **Nguồn trích xuất:** BUG-RECORDER-CODEGEN-LAUNCH-RELIABILITY
- **Role quan sát:** Principal QA Engineer / Backend Node.js Architect
- **Quan sát (Observation):** Trong các công cụ QA Studio tích hợp Playwright Codegen, người dùng thường gặp hiện tượng "lúc mở được trình duyệt ghi, lúc lại không". Nguyên nhân cốt lõi gồm:
  1. *Zombie Session*: Khi người dùng đóng trình duyệt bằng nút "X" trên Windows hoặc crash, tiến trình CLI của Playwright không gửi tín hiệu exit hoặc biến quản lý session ở backend vẫn giữ trạng thái cũ. Backend từ chối các yêu cầu sau bằng HTTP 409 Conflict.
  2. *Khóa chết UI*: Frontend khi nhận lỗi 409 vô hiệu hóa nút "Dừng ghi", khiến người dùng không thể dừng phiên cũ và cũng không thể bắt đầu phiên mới.
  3. *Tắc nghẽn Pipe Buffer*: Gọi `spawn` với `stdio: ['ignore', 'pipe', 'pipe']` nhưng không lắng nghe sự kiện `data` trên `stdout` và `stderr` làm đầy buffer pipe của HĐH, khiến tiến trình con Playwright bị đóng băng (hang).
- **Bằng chứng (Evidence):** `dashboard/server.js` (dòng 1572, dòng 1616), `dashboard/public/app.js` (dòng 7464 - 7489)
- **Đề xuất phân loại:** APPROVED STANDARD / KNOWN PITFALL
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Technical Lead / Principal QA
- **Trạng thái:** PROMOTED
- **Nguyên tắc rút ra:**
  1. **Tree Kill trên Windows:** Luôn sử dụng `taskkill /pid ${pid} /T /F` để tiêu diệt sạch sẽ toàn bộ cây tiến trình (bao gồm cả Node CLI và các tiến trình Chromium/Browser con).
  2. **Tự động phục hồi (Auto-Recovery) thay vì từ chối 409:** Khi người dùng bấm "Bắt đầu ghi", nếu phát hiện session cũ (còn sống hoặc zombie), backend phải tự động dọn dẹp session cũ và khởi chạy session mới mượt mà, không bao giờ bắt chẹt người dùng bằng lỗi xung đột.
  3. **Chủ động tiêu thụ Stream & Grace Period Check:** Luôn gắn listener đọc stream cho cả `stdout` và `stderr` để chống nghẽn pipe buffer; đồng thời chờ một khoảng trễ bảo hiểm (500ms) trước khi trả về HTTP 200 nhằm bắt trọn các lỗi crash sớm (thiếu browser binary, sai tham số device, port conflict) và trả về thông báo lỗi cụ thể cho người dùng.
  4. **Polling nền & Đồng bộ Focus:** Tích hợp polling nhẹ (2.5s) và sự kiện `window.focus` để UI luôn đồng bộ trạng thái thực tế nếu người dùng đóng trình duyệt từ bên ngoài HĐH.

### [LEARN-008] Ngăn Chặn Khóa Chết Modal Khi Được Mở Từ Phân Hệ Khác (Cross-Module Modal Event Encapsulation & HTML Tag Balance)
- **Nguồn trích xuất:** BUG-POM-BDD-LINKER-MODAL-UNRESPONSIVE
- **Role quan sát:** Senior Frontend Maintainer / Principal QA
- **Quan sát (Observation):** Modal dùng chung (ví dụ `#modal-insert-pom-action`) có thể được kích hoạt từ nhiều phân hệ độc lập (từ Page Manager khi bấm nút "Dùng trong BDD" trên từng method, hoặc từ BDD Builder khi bấm "Chèn bước từ POM"). Nếu logic đăng ký event listeners (chuyển tab method/locator, nút Hủy, nút Đóng "X", nút Chèn BDD, các input/select live preview) bị gói bên trong hàm khởi tạo riêng của một phân hệ (`initVisualBuilderControls` - chỉ kích hoạt khi người dùng vào tab BDD Builder), thì khi mở modal từ Page Manager, toàn bộ listener chưa hề được đăng ký. Trình duyệt render modal bình thường nhưng người dùng click vào bất kỳ đâu trên popup đều không phản hồi ("bị đơ hoàn toàn"). Ngoài ra, cấu trúc HTML bị thiếu thẻ đóng `</div>` của `.app-modal-box` trước `</dialog>` làm sai lệch cây DOM.
- **Bằng chứng (Evidence):** `dashboard/public/index.html` (dòng 4402 - 4409), `dashboard/public/app.js` (dòng 10146, 12744 - 12782)
- **Đề xuất phân loại:** APPROVED STANDARD / KNOWN PITFALL
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Frontend Lead / Principal QA
- **Trạng thái:** PROMOTED
- **Nguyên tắc rút ra:**
  1. **Tự Đóng Gói Event Listeners (Self-Contained & Idempotent Modal Controls):** Mọi modal dialog dùng chung giữa các tab/phân hệ bắt buộc phải có hàm khởi tạo listeners riêng (ví dụ `initPomModalControls()`) đi kèm cờ bảo vệ `isPomModalControlsInitialized`. Hàm này phải được gọi ngay tại đầu hàm mở modal (`openInsertPomActionModal`) và khi khởi động ứng dụng, đảm bảo 100% listeners sẵn sàng bất kể modal được mở từ đâu.
  2. **Trạng Thái Khởi Đầu Chuẩn Xác Khi Mở:** Mỗi khi mở modal, luôn chủ động reset tab về trạng thái mặc định (`method`), làm sạch các trường tiêu đề tự sinh để code preview render chuẩn xác cho phần tử/hành động vừa chọn.
  3. **Hỗ Trợ Đầy Đủ Thoát Nhanh (Escape Routes):** Dialog phải luôn gắn listener click vào backdrop (`e.target === modal`) để đóng ngoài nút Đóng "X" và "Hủy".
  4. **Toàn Vẹn Cấu Trúc HTML `<dialog>`:** Kiểm tra nghiêm ngặt tính cân bằng cặp thẻ `<div>...</div>` bên trong `<dialog>` để tránh việc trình duyệt tự động đóng tag gây lỗi cấu trúc lồng nhau ngoài ý muốn.

### [LEARN-009] Kiến Trúc Accordion / Collapsible Sections Trong Màn Hình Biên Tập Script Đa Khối
- **Nguồn trích xuất:** UI/UX-BDD-SCRIPT-EDIT-ACCORDION
- **Role quan sát:** Senior BA & Lead Product Designer
- **Quan sát (Observation):** Khi nâng cấp màn hình chỉnh sửa kịch bản test từ dạng đơn giản lên dạng toàn diện 5 khối (Thông tin, Bước BDD, Tiền điều kiện, Page Objects, File Data), nếu hiển thị tất cả các khối ở trạng thái mở phẳng (flat expanded):
  1. Chiều cao form quá dài, tạo gánh nặng nhận thức (cognitive overload), người dùng phải cuộn trang liên tục để tìm mục cần sửa.
  2. Bố trí các nút thao tác nhanh (+ Given, + When, Chọn hết/Bỏ chọn) chèn ép lên cùng hàng tiêu đề accordion header sẽ gây tràn viền (overflow/clipping), đè chữ tiêu đề khi độ rộng cột hẹp (< 450px).
- **Bằng chứng (Evidence):** `dashboard/public/index.html` (#script-edit-view, .script-accordion-item), `dashboard/public/styles.css` (.script-accordion-*), `dashboard/public/app.js` (initScriptEditAccordions, updateEditAccordionSummaries)
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Senior Product Designer / Frontend Lead
- **Trạng thái:** PROMOTED
- **Nguyên tắc rút ra:**
  1. **Đồng Bộ 1:1 Thứ Tự Xem vs Sửa:** Luôn giữ thứ tự các khối giữa chế độ Xem (Inspect) và Sửa (Edit) đồng nhất tuyệt đối (01 Info $\rightarrow$ 02 Steps $\rightarrow$ 03 Preconditions $\rightarrow$ 04 Page Objects $\rightarrow$ 05 Data Files) để duy trì mental model của người dùng.
  2. **Tiêu Chuẩn Tối Giản Cho Accordion Header:** Header của accordion chỉ nên chứa: Icon Chevron + Tag danh mục + Tiêu đề khối (bên trái) và Chip tóm tắt dữ liệu hiện thời (bên phải). Không đặt các cụm nút bấm thao tác hàng loạt trên header ở các cột có độ rộng co giãn để triệt tiêu nguy cơ đè chữ.
  3. **Thanh Công Cụ Nằm Trong Body (Body-Anchored Toolbars):** Đặt cụm nút thao tác (như `+ Given/When/Then`, `Chọn hết/Bỏ chọn`) nằm ở hàng đầu tiên bên trong `.script-accordion-body` của khối đó. Khi mở rộng, người dùng có không gian thao tác rộng rãi, khi thu gọn thì giao diện sạch sẽ tối đa.
  4. **Quy Tắc Mở Mặc Định Theo Tần Suất (80/20 Default State):** Mặc định khi vào chỉnh sửa, chỉ mở sẵn các khối có tần suất sửa 80% (Khối 01 Tên kịch bản & Khối 02 Các bước BDD); các khối cấu hình phụ (03, 04, 05) mặc định thu gọn kèm summary chip để người dùng nắm trọn thông tin mà không bị rối mắt.
  5. **Hỗ Trợ Nút Tiện Ích Toàn Cục:** Luôn cung cấp bộ đôi nút "Mở rộng tất cả" / "Thu gọn tất cả" ở đầu danh sách để người dùng có toàn quyền kiểm soát không gian làm việc.

### [LEARN-010] Phòng Chống Co Ép & Cắt Xén Phần Tử (Flex-Shrink Clipping Pitfall) Trong Khung Cuộn Accordion
- **Nguồn trích xuất:** BUG-BDD-ACCORDION-EXPAND-ALL-SQUEEZE
- **Role quan sát:** Senior Frontend Engineer / Senior QA
- **Quan sát (Observation):** Khi các khối Accordion (`.script-accordion-item`) được đặt bên trong container có `display: flex; flex-direction: column; overflow-y: auto;`, giá trị mặc định của CSS Flexbox cho các phần tử con là `flex-shrink: 1`. Khi người dùng bấm "Mở tất cả" (Expand All), tổng chiều cao thực tế của các khối vượt quá chiều cao container. Vì `.script-accordion-item` có `overflow: hidden`, thay vì kích hoạt thanh cuộn dọc mượt mà cho toàn container, Flexbox tự động co ép (shrink) chiều cao của từng khối accordion (ví dụ: khối Info từ 228px bị ép xuống 111px; khối POM từ 248px bị ép xuống 121px). Hậu quả là các box nhỏ bên trong (input feature, tags, danh sách steps, thẻ Page Object) bị đè mất và cắt xén một nửa (clipping defect).
- **Bằng chứng (Evidence):** `dashboard/public/styles.css` (.script-accordion-item, .script-middle-scroll-wrap), `dashboard/public/index.html` (#script-edit-view)
- **Đề xuất phân loại:** APPROVED STANDARD / KNOWN PITFALL
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Frontend Lead / Senior QA
- **Trạng thái:** PROMOTED
- **Nguyên tắc rút ra:**
  1. **Bắt buộc `flex-shrink: 0` trên Accordion Cards:** Mọi phần tử khối collapsible hoặc card accordion nằm trong flex scroll container BẮT BUỘC phải khai báo `flex-shrink: 0;` và `min-height: fit-content;` để bảo toàn kích thước thực tế theo nội dung bên trong khi mở rộng.
  2. **Khai báo `min-height: 0` cho Flex Scroll Wrappers:** Container cha có `overflow-y: auto` và `flex: 1` phải có `min-height: 0` để đảm bảo cơ chế scrollbar của Flexbox hoạt động nhất quán trên mọi engine trình duyệt.
  3. **Không Khóa Cứng Chiều Cao Lồng Nhau (Nested Fixed Height):** Tránh lồng các thuộc tính `max-height` hạn chế quá ngắn (như inline `max-height: 200px`) lên các lưới con nhiều hàng (`.dependency-grid`), để lưới có thể giãn nở tự nhiên theo số lượng item và cuộn nhẹ nhàng theo container chính.

### [LEARN-011] Cơ Chế Soạn Thảo Nháp Đầu Tiên (Draft-First Pattern) Cho Hành Động Chèn Modal Trong BDD Editor
- **Nguồn trích xuất:** UX-BDD-LINKER-PREMATURE-DISK-SAVE
- **Role quan sát:** Senior BA & Lead Product Designer / Senior QA
- **Quan sát (Observation):** Khi người dùng đang ở chế độ Chỉnh sửa kịch bản (`#script-edit-view`) và bấm nút `+ Thêm từ Page` (`#btn-edit-add-step-pom`) để mở modal chèn method/locator:
  1. Thay vì chỉ thêm bước vào danh sách nháp (`editableSteps`), hệ thống cũ lại gọi ngay API `/api/builder/insert-step` ghi đè trực tiếp lên file `.spec.js` trên đĩa cứng HĐH khi người dùng bấm "Chèn vào kịch bản" trong modal.
  2. Việc ghi đè file trên đĩa kích hoạt tải lại danh sách script và chuyển kịch bản về trạng thái xem từ đĩa (Inspect Mode), làm xóa sạch các nội dung nháp chưa lưu (tiêu đề, tên tính năng, tags, các bước thêm mới trước đó) mà người dùng vừa gõ trên form.
- **Bằng chứng (Evidence):** `dashboard/public/app.js` (submitPomActionToBdd, generatePomStepCodeAndTitle)
- **Đề xuất phân loại:** APPROVED STANDARD / KNOWN PITFALL
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Senior Product Designer / Frontend Lead
- **Trạng thái:** PROMOTED
- **Nguyên tắc rút ra:**
  1. **Tuân Thủ Tuyệt Đối Chu Trình Soạn Thảo Nháp (Drafting Lifecycle):** Trong giao diện biên tập trực quan (Visual Editor), nút "Thêm" từ modal chỉ có nhiệm vụ chèn dữ liệu vào state nháp của bộ nhớ UI (`editableSteps`), tự động đánh dấu trạng thái "Chưa lưu" (`isDirty`), cập nhật live preview và giữ người dùng ở lại màn hình chỉnh sửa.
  2. **Chỉ Lưu Đĩa Khi Người Dùng Xác Nhận Rõ Ràng (Explicit User Consent):** Nghiêm cấm mọi hành vi tự ý gọi API ghi đè file trên đĩa cứng trước khi người dùng chủ động bấm nút "Lưu kịch bản" (`#btn-save-edit-script` hoặc Ctrl+S).
  3. **Tự Động Đồng Bộ Dependencies:** Khi thêm bước từ Page Object mới vào bản nháp, hệ thống phải tự động thêm tệp Page Object đó vào danh sách liên kết (`editSelectedPoms`) để khi người dùng bấm "Lưu kịch bản", các tham số fixture và import được tự động biên dịch đầy đủ mà không bắt tester phải tick thủ công.

### [LEARN-012] Đồng Bộ Đa Phân Hệ & Hủy Bộ Nhớ Đệm Tự Động (Cross-Module Invalidation) Cho Danh Mục Dataset
- **Nguồn trích xuất:** BUG-CROSS-MODULE-DATASET-SYNC-BLINDSPOT
- **Role quan sát:** Senior Fullstack Engineer / Senior QA
- **Quan sát (Observation):** Khi người dùng tạo một tệp dữ liệu test mới (`test.json`) tại phân hệ Test Data Studio (`data-view`), tệp đã được ghi thành công vào thư mục `data/` trên đĩa và cập nhật danh sách của `data-view`. Tuy nhiên khi chuyển sang phân hệ Kịch bản BDD (`builder-view`), dropdown chọn dataset ở Khối 05 và Wizard không hề hiển thị tệp mới tạo. Nguyên nhân do biến mảng `wizardAvailableDatasets` được nạp 1 lần duy nhất lúc khởi động và bị kiểm tra điều kiện `if (!wizardAvailableDatasets || wizardAvailableDatasets.length === 0)` chặn lại, không bao giờ fetch lại từ API `/api/data/datasets`.
- **Bằng chứng (Evidence):** `dashboard/public/app.js` (loadEditDatasets, loadDataFilesList, submitCreateDataset, initVisualBuilder)
- **Đề xuất phân loại:** APPROVED STANDARD / KNOWN PITFALL
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Frontend Lead / Fullstack Lead
- **Trạng thái:** PROMOTED
- **Nguyên tắc rút ra:**
  1. **Hủy Cache Ngay Khi Có Mutation:** Bất cứ khi nào có hành động tạo mới (`submitCreateDataset`), sửa đổi hoặc xóa (`data-delete-file-btn`) tệp dữ liệu, hệ thống BẮT BUỘC phải đồng bộ ngay lập tức các biến cache dùng chung giữa các phân hệ (`datasetsCache`, `wizardAvailableDatasets`).
  2. **Luôn Fetch Dữ Liệu Tươi (Fresh Data) Khi Mở Chế Độ Soạn Thảo:** Hàm `loadEditDatasets()` khi được gọi trong chế độ chỉnh sửa kịch bản phải luôn nạp danh sách tệp mới nhất từ `/api/data/datasets` thay vì tin tưởng vào mảng cache cũ trong bộ nhớ.
  3. **Lắng Nghe Sự Kiện Mở Rộng Khối (Accordion Expansion Trigger):** Khi người dùng mở rộng Khối 05 (Quản lý dữ liệu test), hệ thống chủ động gọi `loadEditDatasets(true)` để người dùng vừa tạo tệp ở tab khác quay lại là thấy ngay lập tức tệp vừa tạo.
