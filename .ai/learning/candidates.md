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

