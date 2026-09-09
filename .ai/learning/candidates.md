# Learning Candidates (Pending Gate 0.5 Review)

> [!NOTE]
> Đây là nơi chứa các bài học, quan sát, quy tắc mới được AI và các Role trích xuất sau khi hoàn thành Feature, Bug fix, Review hoặc QA.
> Các candidate ở đây CHƯA PHẢI LÀ STANDARD cho đến khi được Knowledge Curator duyệt qua Gate 0.5.

<!-- Mẫu ứng viên học hỏi:
### [LEARN-001] Tiêu đề quan sát / bài học
- **Nguồn trích xuất:** [FEATURE-X / BUG-Y / CODE-REVIEW]
- **Role quan sát:** [Developer / QA / Tech Lead / BA]
- **Quan sát (Observation):** Mô tả cụ thể hiện tượng hoặc vấn đề
- **Bằng chứng (Evidence):** Link file hoặc mã lỗi thực tế
- **Đề xuất phân loại:** [CURRENT PRACTICE / APPROVED STANDARD / KNOWN PITFALL]
- **Phạm vi đề xuất:** [FEATURE-LOCAL / MODULE / PROJECT]
- **Đề xuất Owner duyệt:** [Technical Lead / Principal QA / BA]
- **Trạng thái:** [PENDING / APPROVED / REJECTED]
### [LEARN-001] Cơ chế Whitelist Asset & Rào Chắn Bảo Mật Khi Đồng Bộ Git Trong QA Automation
- **Nguồn trích xuất:** FEATURE-GIT-SYNC-STUDIO
- **Role quan sát:** Senior QA / Technical Lead
- **Quan sát (Observation):** Khi cung cấp tính năng Commit/Push trực tiếp cho tester trên UI Dashboard, nguy cơ vô tình commit file `.env`, media nặng (`playwright-report`, `test-results`, `evidence`), hoặc code dở dang vi phạm framework (`waitForTimeout`) là rất cao nếu chỉ dùng `git add .`.
- **Bằng chứng (Evidence):** `core/system/gitSyncService.js`, `scripts/git-sync.js`, `dashboard/public/app.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Technical Lead
- **Trạng thái:** PENDING
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
- **Trạng thái:** PENDING
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
- **Trạng thái:** PENDING
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
- Status: PENDING.
- Preventive proposal: Separate UI catalog filtering from shared inspection contracts; migrate consumers and regression tests together. Align Studio page destinations with runtime resolution: Studio creates mobile-web pages while the current container selects mobile whenever that directory exists.

### [LEARN-005] Plan 07 follow-up: contract assertions beyond smoke coverage
- Date: 2026-09-09.
- Source: 07_IMPLEMENTATION_REVIEW_2026-09-09.md.
- Role: Reviewer / Senior QA.
- Status: PENDING.
- Scope: PROJECT.
- Evidence: Existing 27 tests and 3 new local browser smoke tests pass, but targeted checks reproduce an undefined isFixture in Page Manager, a sibling-prefix junction escape in pagesFactory, and desktop selection for a public isMobile=true project named Handset.
- Observation: Fixture GET compatibility from LEARN-004 is restored. Capability parsing still omits authenticatedUser/options/failureTrackerHook; malformed fixture source is marked ready. Container script metadata still reports zero pages.
- Preventive proposal: Assert complete capability keys and invalid-source readiness, canonical path boundaries/cache identity, custom device platform selection, and execute nonempty UI render paths. Test labels alone do not prove the Plan 07 T01-T18 contracts.
- Related files: core/fixtures/pagesFactory.js, core/fixtures/baseTest.js, core/generator/objectRepository.js, core/generator/visualBuilderCompiler.js, dashboard/public/app.js.

### [LEARN-006] Plan 08 needs consumer-owned fixtures and observable cleanup contracts
- Date: 2026-09-09.
- Source: Review 08_PLAN_FIXTURE_AND_HOOKS_STUDIO.md.
- Role: Reviewer / Senior QA.
- Status: PENDING.
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
- **Trạng thái:** PENDING.
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
- **Trạng thái:** PENDING
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
- **Trạng thái:** PENDING
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
- **Trạng thái:** PENDING
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
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. **Tự Đóng Gói Event Listeners (Self-Contained & Idempotent Modal Controls):** Mọi modal dialog dùng chung giữa các tab/phân hệ bắt buộc phải có hàm khởi tạo listeners riêng (ví dụ `initPomModalControls()`) đi kèm cờ bảo vệ `isPomModalControlsInitialized`. Hàm này phải được gọi ngay tại đầu hàm mở modal (`openInsertPomActionModal`) và khi khởi động ứng dụng, đảm bảo 100% listeners sẵn sàng bất kể modal được mở từ đâu.
  2. **Trạng Thái Khởi Đầu Chuẩn Xác Khi Mở:** Mỗi khi mở modal, luôn chủ động reset tab về trạng thái mặc định (`method`), làm sạch các trường tiêu đề tự sinh để code preview render chuẩn xác cho phần tử/hành động vừa chọn.
  3. **Hỗ Trợ Đầy Đủ Thoát Nhanh (Escape Routes):** Dialog phải luôn gắn listener click vào backdrop (`e.target === modal`) để đóng ngoài nút Đóng "X" và "Hủy".
  4. **Toàn Vẹn Cấu Trúc HTML `<dialog>`:** Kiểm tra nghiêm ngặt tính cân bằng cặp thẻ `<div>...</div>` bên trong `<dialog>` để tránh việc trình duyệt tự động đóng tag gây lỗi cấu trúc lồng nhau ngoài ý muốn.



