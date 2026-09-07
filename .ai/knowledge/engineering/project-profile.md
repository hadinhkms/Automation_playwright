# Project Technical Profile — @hadinhkms/qa-automation-engine

> [!NOTE]
> Thông tin kỹ thuật nền tảng của dự án Playwright Automation Studio Core Engine & Dashboard.

## 1. Công Nghệ Cốt Lõi (Tech Stack)
- **Ngôn ngữ:** JavaScript (Node.js ESM & CommonJS)
- **Testing Framework:** `@playwright/test` (^1.40.0)
- **Dashboard Backend:** Node.js HTTP Server (`dashboard/server.js`)
- **Dashboard Frontend:** Vanilla HTML5, CSS3, JavaScript (Không dùng framework nặng)
- **Kiến trúc Test:** Page Object Model (POM) + BDD Gherkin (`test.step('Given/When/Then')`)
- **Quản lý biến môi trường:** `dotenv` (`core/config/env.js`)

## 2. Lệnh Cơ Bản (Core Commands)
- **Cài đặt thư viện:** `npm install`
- **Chạy toàn bộ test:** `npm test` hoặc `npx playwright test`
- **Chạy test theo suite:**
  - Smoke test: `npm run suite:smoke`
  - Regression test: `npm run suite:regression`
  - Desktop suite: `npm run suite:desktop`
  - Mobile suite: `npm run suite:mobile`
- **Chạy test có UI / Headed:** `npm run test:ui` / `npm run test:headed`
- **Chạy Dashboard:**
  - Khởi động: `npm run dashboard` (hoặc `npm run dashboard:start`)
  - Dừng: `npm run dashboard:stop`
- **Kiểm tra tiêu chuẩn Framework:** `npm run check:framework` (`node scripts/check-framework-structure.js`)
- **Xem báo cáo Playwright:** `npm run report`

## 3. Cấu Trúc Thư Mục Chính (Folder Layout)
```text
/
├── .ai/                  # Project Intelligence Layer (Bộ nhớ tự học của dự án)
│   ├── knowledge/        # Tri thức bất biến đã duyệt (Domain, Engineering, QA, Release)
│   └── learning/         # Vùng ghi nhận bài học & đề xuất mới (candidates.md)
├── .master_process/      # Junction trỏ về D:\_Master_Process (Quy trình chuẩn toàn diện)
├── ai/                   # AI Prompt Guidelines & Lessons chuyên sâu
│   ├── shared/           # Quy chuẩn test automation (AI_PROMPTS.md, TEST_AUTOMATION_LESSONS.md)
│   └── dashboard/        # Quy chuẩn phát triển Dashboard (DASHBOARD_AI_PROMPT.md, AI_LESSONS.md)
├── core/                 # Thư viện dùng chung của framework
│   ├── config/           # Cấu hình môi trường & timeout
│   ├── fixtures/         # Playwright test fixtures & hooks
│   └── utils/            # UiActions, evidence, assertion helpers
├── data/                 # Test data theo nghiệp vụ
├── dashboard/            # Mã nguồn web studio quản lý test
├── pages/                # Page Object Models (BasePage, desktop/, mobile/)
├── scripts/              # Scripts tiện ích kiểm tra kiến trúc & quản trị
├── tests/                # Test specs
│   └── e2e/              # E2E test specs (desktop/, mobile/)
└── playwright.config.js  # Cấu hình Playwright tổng thể
```
