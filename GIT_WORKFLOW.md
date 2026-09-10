# Git Workflow Guide - Dự Án Automation Testing

## 🚀 Quy Trình Commit & Push Hàng Ngày

### Bước 1: Kiểm tra trạng thái
```bash
git status
```

### Bước 2: Thêm file cần commit
```bash
# Thêm file cụ thể
git add tests/e2e/mytest.spec.js pages/MyPage.js

# Hoặc thêm tất cả thay đổi (kiểm tra git status trước)
git add .
```

### Bước 3: Commit với message có ý nghĩa
```bash
git commit -m "test(loginFlow): add email validation test"
```

**Format commit message:**
- `test(scope)`: Thêm/sửa test case
- `fix(scope)`: Fix bug
- `feat(scope)`: Tính năng mới
- `refactor(scope)`: Tái cấu trúc code
- `docs(scope)`: Cập nhật tài liệu

### Bước 4: Push lên remote
```bash
git push origin [tên-branch]

# Hoặc nếu branch đã setup upstream
git push
```

---

## 📋 Danh Sách Lệnh Hữu Ích

### Xem lịch sử commit
```bash
git log --oneline -10
```

### Xem thay đổi trước khi commit
```bash
git diff
```

### Xem thay đổi của file cụ thể
```bash
git diff tests/e2e/mytest.spec.js
```

### Unstage file (nếu thêm nhầm)
```bash
git reset HEAD tests/e2e/mytest.spec.js
```

### Undo commit cuối cùng (chưa push)
```bash
git reset --soft HEAD~1
```

### Xem branch hiện tại
```bash
git branch -v
```

### Tạo branch mới và chuyển sang
```bash
git checkout -b feature/my-feature
```

### Xem remote origin
```bash
git remote -v
```

---

## ⚡ 1. Sử Dụng Trực Tiếp Trên Dashboard: Git Sync Studio (Khuyên dùng)

Hệ thống đã tích hợp sẵn **Git Sync Studio** trên Web Dashboard tại `http://127.0.0.1:4174`:
- **Truy cập:** Bấm vào nút Git trên **Thanh điều hướng (Topbar)** hoặc vào menu **Tiện ích -> Đồng bộ Git (Sync Code)**.
- **Tính năng nổi bật:**
  - 🔄 **Kéo mã mới về máy (Git Pull):** 1-Click kéo code từ remote, hỗ trợ tự động Stash bảo vệ code dở dang và tự động chạy `npm install` nếu có package mới.
  - 🛡️ **Khiên bảo vệ mã nguồn (Security Guard):** Tự động phân loại tài nguyên hợp lệ (tests, pages, data, suites) và chặn triệt để `.env`, `playwright-report/`, `test-results/`, `evidence/`, `.dashboard-drafts/`, file log và prompt cá nhân.
  - 🔍 **Xem trước Diff trực quan (Visual Diff Inspector):** Bấm "Xem Diff" của bất kỳ file nào để xem trực tiếp các dòng thêm mới / thay đổi trước khi commit.
  - 🚦 **Tự động kích hoạt Framework Quality Gate:** Kiểm tra quy chuẩn cấu trúc test script (`npm run check:framework`) trước khi cho phép commit/push.
  - 📦 **Trình soạn Commit Message chuẩn:** Hỗ trợ định dạng Conventional Commits (`test(...)`, `feat(...)`, `fix(...)`, `data(...)`).

---

## ⚡ 2. Bộ Lệnh Dòng Lệnh Nhanh & An Toàn (Safe CLI Commands)

Trong terminal, bạn có thể sử dụng các lệnh tiện ích được tích hợp sẵn:

```bash
# Kiểm tra trạng thái Git, tệp hợp lệ và tệp bị chặn bảo mật
npm run git:status

# Kéo mã mới nhất từ remote về máy an toàn (tự động stash nếu dirty)
npm run git:pull

# Kiểm tra chất lượng cấu trúc mã nguồn trước khi push
npm run git:check

# Đóng gói và đẩy các tệp hợp lệ lên máy chủ
npm run git:push -- "test(login): thêm kịch bản kiểm tra đăng nhập"
```

---

## ✅ Danh Mục Thông Tin Được Phép & Bị Chặn (Asset Whitelist & Shield)

- 🟢 **Được phép đồng bộ (Permitted Whitelist):**
  - `tests/**`: Kịch bản kiểm thử e2e, api, spec BDD.
  - `pages/**`: Page Object Models.
  - `data/**`: Dữ liệu test JSON, CSV fixtures.
  - `dashboardConfig.json`, `qa-engine.config.json`: Cấu hình test suites và môi trường.
  - `docs/**`: Tài liệu hướng dẫn.
- 🔴 **Tuyệt đối chặn bảo mật (Strictly Blocked):**
  - `.env`, `.env.*`, credential, tokens, mật khẩu.
  - `playwright-report/**`, `test-results/**`, `evidence/**` (Ảnh/Video/Trace).
  - `.dashboard-drafts/**`, `.dashboard-backups/**`, `tmp/**`.
  - `ai/personal/**`, `node_modules/**`, log và file OS.

---

## 🔄 Cách Làm Việc Với Branch

### Pull request workflow:
```bash
# 1. Tạo branch feature
git checkout -b feature/new-test

# 2. Commit thay đổi
git add .
git commit -m "test(jobApply): add form validation test"

# 3. Push branch
git push origin feature/new-test

# 4. Tạo Pull Request trên GitHub

# 5. Merge & delete branch
git checkout main
git pull
git branch -d feature/new-test
git push origin --delete feature/new-test
```

---

## 🛠️ Setup Optional: Pre-commit Hook

Tạo file `.git/hooks/pre-commit`:

```bash
#!/bin/bash
echo "Running framework check before commit..."
npm run check:framework
if [ $? -ne 0 ]; then
  echo "❌ Framework check failed. Commit cancelled."
  exit 1
fi
echo "✅ Framework check passed. Proceeding with commit..."
```

Sau đó:
```bash
chmod +x .git/hooks/pre-commit
```

Nếu dùng Windows PowerShell, tạo `.git/hooks/pre-commit.ps1` hoặc dùng Husky (xem phần dưới).

---

## 📦 Setup Optional: Husky (Pre-commit Hook ngon lành)

```bash
# 1. Cài Husky
npm install husky --save-dev
npx husky install

# 2. Thêm hook
npx husky add .husky/pre-commit "npm run check:framework"
npx husky add .husky/pre-commit "npm run test:lint" (nếu có)

# 3. Commit
git add .
git commit -m "chore: setup husky pre-commit hooks"
```

---

## 🚫 Tránh Những Lỗi Phổ Biến

❌ **Không nên làm:**
```bash
# Commit toàn bộ mà không check
git add .
git commit -m "update"
git push

# Commit file tạm hoặc log
git add test-results/
git add debug.log
```

✅ **Nên làm:**
```bash
# Check trước
git status

# Commit cụ thể
git add pages/MyPage.js tests/e2e/mytest.spec.js
git commit -m "test(mytest): add new scenario"

# Review trước push
git log --oneline -1
git push
```

---

## 📞 Troubleshooting

### Lỗi: "branch not setup for tracking remote"
```bash
git push --set-upstream origin feature/my-feature
```

### Lỗi: "rejected because the tip of your current branch is behind"
```bash
git pull origin [branch-name]
git push
```

### Muốn xem diff chi tiết trước commit
```bash
git add .
git diff --cached
```

---

## 🛰️ 3. Quy Tắc Đồng Bộ Vệ Tinh (Hub-to-Spoke Satellite Sync)

Hệ thống hoạt động theo mô hình **Hub-to-Spoke**:
- **Nhánh chính (Hub - `Automation_playwright`):** Đóng vai trò là trung tâm phát triển framework engine (`core/`, `dashboard/`, `bin/`, `scripts/`, `ai/`, `tools/`).
- **Các dự án vệ tinh (Satellites - `Vieclam24h`, `CarThings`):** Nhận mã nguồn engine mới nhất từ Hub khi chạy lệnh `npm run sync:satellites` hoặc qua GitHub Actions CI.

### 🛡️ Nguyên Tắc Phân Tách Chủ Quyền Dữ Liệu (Data Sovereignty):
1. **Dữ liệu kiểm thử (`data/`) KHÔNG BAO GIỜ đồng bộ từ nhánh chính sang vệ tinh**: Mỗi dự án vệ tinh có bộ dữ liệu nghiệp vụ thực tế độc lập (ví dụ tài khoản ứng viên, tin tuyển dụng của Vieclam24h; xe, showroom của CarThings). Đồng bộ dữ liệu mẫu từ nhánh chính sẽ làm hỏng hoặc ghi đè dữ liệu của vệ tinh.
2. **Kịch bản test (`tests/`) và Page Objects (`pages/`) KHÔNG đồng bộ từ Hub**: Vệ tinh tự do phát triển Page Object và kịch bản test đặc thù mà không bị nhánh chính can thiệp hay ghi đè.
3. **Cấu hình riêng (`dashboardConfig.json`) & Custom Fixtures (`core/fixtures/custom`)**: Được bảo vệ tự động bằng cơ chế Exclude để giữ nguyên cấu hình local của từng vệ tinh.


