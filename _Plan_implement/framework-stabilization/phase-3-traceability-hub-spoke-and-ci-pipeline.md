# Phase 3 — Chuẩn Hóa Truy Vết Hub-Spoke & Kích Hoạt CI/CD Pipeline

> **Tác giả Nghiệp vụ:** @ba · **Tác giả Kỹ thuật:** @tl · **Research:** Không áp dụng  
> **Trạng thái:** `COMPLETED` · **Cấp độ:** `L3`  
> **Nằm trong:** [Plan 20 Overview](plan-20-overview.md)

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:**
  - Nâng cấp [scripts/lib/qaTrace.js](file:///d:/_Automation-Project/scripts/lib/qaTrace.js) hỗ trợ cơ chế nhận diện Hub Mode:
    - Bỏ qua các thư mục ẩn bắt đầu bằng dấu chấm (`.tmp*`, `.gate*`).
    - Bỏ qua thư mục test hạ tầng nội bộ `tests/dashboard/**` khi đánh giá truy vết nghiệp vụ người dùng cuối.
    - Đưa lệnh kiểm tra chất lượng `npm run qa:check` về trạng thái **0 finding major** trên Hub Engine.
  - Tái cấu trúc pipeline CI/CD tại [.github/workflows/playwright.yml](file:///d:/_Automation-Project/.github/workflows/playwright.yml):
    - Kích hoạt cài đặt Playwright Chromium và chạy kiểm thử tự động `npm run suite:smoke` trên mọi sự kiện `push` và `pull_request`.
    - Chuẩn hóa thông báo Discord: gắn `await` cho lời gọi `fetch()`, cập nhật footer đúng danh tính Hub `@hadinhkms/qa-automation-engine`.
  - Dọn dẹp vệ sinh repository: Gỡ bỏ 120 file `_backup_vieclam24h/` khỏi Git tracking và bổ sung vào `.gitignore`.
- **Out-of-Scope:**
  - Không sửa đổi mã nguồn các dự án vệ tinh (chỉ sửa Hub).

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-20-05`: Công cụ kiểm tra truy vết nghiệp vụ (`qa:check`) phải hiểu được vai trò của dự án: Tại Hub, nó chỉ kiểm tra các test mẫu (`tests/e2e/`), không đòi hỏi tài liệu nghiệp vụ của vệ tinh.
- `REQ-20-06`: Toàn bộ Pull Request gửi vào nhánh `main` phải tự động chạy kiểm thử giao diện E2E khói (Smoke Test) trước khi cho phép merge.
- `BR-20-05`: Hub repository chỉ chứa mã nguồn framework dùng chung; tuyệt đối không commit bản sao lưu dữ liệu của các dự án vệ tinh cụ thể lên kho mã nguồn.

### A3. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-20-09`: Lệnh `npm run qa:check` (chế độ `--strict`) trên Hub kết thúc với mã thoát `0` và báo cáo **0 finding major**.
- `AC-20-10`: GitHub Actions workflow kích hoạt cài browser Chromium và chạy test smoke thành công trên cả nhánh PR và push main.
- `AC-20-11`: Thư mục `_backup_vieclam24h/` không còn xuất hiện trong danh sách `git ls-files`.

### A4. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx)
- `UAT-20-03`:
  - **Mục tiêu:** Xác minh cổng kiểm soát chất lượng CI ngăn chặn hoàn toàn code hỏng test được merge vào nhánh chính.
  - **Persona:** Senior DevOps / Tech Lead.
  - **Thao tác:** Mở một Pull Request thử nghiệm trên GitHub.
  - **Kỳ vọng:** GitHub Actions tự động kích hoạt workflow `Playwright Checks`, tải Chromium và chạy `suite:smoke`, hiển thị kết quả trực quan trên giao diện PR và gửi thông báo Discord đúng thông tin.

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-20-09`: Trong `scripts/lib/qaTrace.js`:
  - Bổ sung hàm `isHubRepo(root)` kiểm tra `package.json` xem `name === '@hadinhkms/qa-automation-engine'`.
  - Trong hàm `listFiles(root, relativeDir, filter)`:
    - Bỏ qua các entry `isDirectory()` có tên bắt đầu bằng `.` (trừ thư mục gốc).
    - Nếu là Hub repo và thư mục con là `tests/dashboard`, bỏ qua không duyệt vào `parseSpecs`.
- `TECH-20-10`: Trong `.github/workflows/playwright.yml`:
  - Cập nhật điều kiện cài Chromium:
    ```yaml
    - name: Install Playwright browsers
      run: npx playwright install --with-deps chromium
    ```
  - Bước chạy suite:
    ```yaml
    - name: Run Playwright Tests
      env:
        NODE_ENV: qc
      run: |
        if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
          npm run suite:${{ github.event.inputs.suite }}
        else
          npm run suite:smoke
        fi
    ```
  - Bọc script Discord trong `(async () => { await fetch(...) })()`.
- `TECH-20-11`: Chạy lệnh `git rm -r --cached _backup_vieclam24h/` và bổ sung `/_backup_vieclam24h/` vào `.gitignore`.

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)

| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `scripts/lib/qaTrace.js` | Core Script | Sửa | 600 | 590 |
| `.github/workflows/playwright.yml` | CI Workflow | Sửa | 130 | 125 |
| `.gitignore` | Git Config | Sửa | 155 | 150 |

### B3. Checklist Thực Thi & Bằng Chứng Nghiệm Thu
1. [x] Cập nhật `scripts/lib/qaTrace.js` hỗ trợ chế độ Hub và lọc thư mục ẩn `.`.
2. [x] Chạy `npm run qa:check` -> Bằng chứng exit code 0, 0 finding major.
3. [x] Cập nhật `.github/workflows/playwright.yml` chạy `suite:smoke` và sửa Discord notification (async/await, footer `@hadinhkms/qa-automation-engine`).
4. [x] Thực thi `git rm -r --cached _backup_vieclam24h/` và cập nhật `.gitignore`.
5. [x] Chạy kiểm thử toàn diện Gate 4 cuối cùng (`npm run test:e2e` [11/11 passed], `npm run test:dashboard:api` [164/164 passed], `npm run suite:smoke` [9/9 passed]).
