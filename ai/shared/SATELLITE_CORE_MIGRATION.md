# Migration: đưa code riêng của dự án ra khỏi `core/`

**Đối tượng:** chủ repo vệ tinh (Automation_Carthings, Vieclam24h-Automation_JS).
**Người chạy:** chính bạn, trên repo của bạn. Hub không sửa hộ.

## Vì sao phải làm

`core/` do Hub `_Automation-Project` sở hữu và bị ghi đè mỗi lần sync. Mọi sửa đổi
trực tiếp trong `core/` sẽ biến mất. Việc này đã xảy ra: commit `7ad6984`
(2026-09-16, `github-actions[bot]`, "fix(core): restore commonUtils generators and
environment URL mappings") phải khôi phục tay 179 dòng `core/utils/commonUtils.js`,
4 dòng `core/config/dashboardConfig.js` và 11 dòng test.

Hub nay cung cấp **một điểm nối duy nhất, không bao giờ bị sync**: `core/local/`.
Chi tiết: `core/local/README.md` (tạo sau bước 1) hoặc bản Hub tại
`_Automation-Project/core/local/README.md`.

## Bước 0 — Chụp hiện trạng (bắt buộc, trước khi sync lần tới)

Chạy từ **Hub**, không phải từ repo vệ tinh:

```bash
cd D:/_Automation-Project
node scripts/pre-sync-drift.js
```

Cột `SAT-ONLY > 0` = số dòng chỉ tồn tại ở vệ tinh và sẽ bị xoá. Lưu lại output này.

---

## A. Automation_Carthings

### A1. Tách helper riêng khỏi `core/utils/commonUtils.js`

```bash
cd D:/_CarThings/Automation_Carthings
git checkout -b chore/core-local-seam
mkdir -p core/local
```

Tạo `core/local/commonUtils.local.js` và **di chuyển** (cắt, không copy) 178 dòng
chỉ có ở CarThings từ cuối `core/utils/commonUtils.js` sang:

| Hàm cần chuyển |
|---|
| `generateRandomVNIDCard` |
| `generateRandomVNAddress` |
| `generateRandomLicensePlate` |
| `generateRandomDriverLicense` |
| `generateDynamicVehicleDates` |
| `generateRandomVietnameseName` |
| `generateRandomCompanyName` (kèm `COMPANY_PREFIX_POOL`, `COMPANY_BODY_POOL`, `COMPANY_BRANCH_POOL`) |
| `readTestData`, `writeTestData` |

Lấy đúng nội dung từ commit đã khôi phục:

```bash
git show 7ad6984:core/utils/commonUtils.js > /tmp/restored-commonUtils.js
```

Khung file mới:

```js
// core/local/commonUtils.local.js — thuộc dự án, KHÔNG bao giờ bị Hub sync ghi đè.
const fs = require('fs');
const path = require('path');

// ... dán các hàm đã cắt vào đây ...
// Lưu ý readTestData/writeTestData dùng path.join(__dirname, '../../data', filename):
// từ core/local/ thì '../../data' vẫn trỏ đúng <repo>/data — giữ nguyên.

module.exports = {
  generateRandomVNIDCard,
  generateRandomVNAddress,
  generateRandomLicensePlate,
  generateRandomDriverLicense,
  generateDynamicVehicleDates,
  generateRandomVietnameseName,
  generateRandomCompanyName,
  readTestData,
  writeTestData,
};
```

### A2. Khôi phục `core/utils/commonUtils.js` về đúng bản Hub

```bash
cp D:/_Automation-Project/core/utils/commonUtils.js core/utils/commonUtils.js
```

Bản Hub tự nạp `core/local/commonUtils.local.js` nếu tồn tại và merge vào export,
nên **không phải sửa import ở test/page object**: `require('.../core/utils/commonUtils')`
vẫn trả về đủ hàm như trước.

### A3. Chuyển test của helper riêng

11 dòng test `generateRandomCompanyName` đang nằm cuối `core/utils/commonUtils.test.js`
(file Hub sở hữu) — cắt sang `core/local/commonUtils.local.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { generateRandomCompanyName } = require('./commonUtils.local');
// ... dán test đã cắt ...
```

Rồi khôi phục bản Hub:

```bash
cp D:/_Automation-Project/core/utils/commonUtils.test.js core/utils/commonUtils.test.js
node --test core/
```

### A4. Xoá bản `core/config/dashboardConfig.js` riêng

Hub đã sửa: mọi key chuỗi ngoài `label` / `baseURL` / `apiBaseURL` trong
`core/config/dashboardConfig.json` được giữ nguyên, không cần khai báo tên trong `.js`.
`dashboardConfig.json` của CarThings đã có sẵn `carthingsURL` và `companyURL` ở cả ba
môi trường (`prod`, `dev`, `qc`), nên bản `.js` riêng là thừa:

```bash
cp D:/_Automation-Project/core/config/dashboardConfig.js core/config/dashboardConfig.js
node -e "const c=require('./core/config/dashboardConfig').getDashboardConfig(); console.log(c.environments.qc)"
# phải in ra đủ carthingsURL + companyURL
```

### A5. Nghiệm thu

```bash
node --test core/
npm run check:framework
cd D:/_Automation-Project && node scripts/pre-sync-drift.js --satellite=CarThings
# core/utils/commonUtils.js, commonUtils.test.js, dashboardConfig.js phải về SAT-ONLY = 0
```

Còn lại `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `QA_AI_RULES.md`: đây là file gốc do Hub
sở hữu (mới được thêm vào `ROOT_FILES_TO_SYNC`). Bài học/ghi chú riêng của dự án phải
nằm ở `.ai/` — thư mục này không bao giờ được sync. Rà và chuyển trước khi sync.

---

## B. Vieclam24h-Automation_JS

### B1. `core/utils/authSetup.js` — 147 dòng riêng, SẼ BỊ XOÁ

Bản vệ tinh (207 dòng) đã viết đè logic riêng lên bản Hub (70 dòng): import
`./registrationApiHelper`, `../../pages/desktop/LoginPopup`, `HomePage`, `PopupConsent`,
và luồng đăng ký worker-scoped của dự án.

Cách xử lý: chuyển sang `core/local/authSetup.local.js`, rồi để test/fixture của dự án
import thẳng file đó, và khôi phục `core/utils/authSetup.js` về bản Hub.

```bash
cd D:/_SieuVietGroup
git checkout -b chore/core-local-seam
mkdir -p core/local
git mv core/utils/authSetup.js core/local/authSetup.local.js
cp D:/_Automation-Project/core/utils/authSetup.js core/utils/authSetup.js
grep -rn "utils/authSetup" tests/ pages/ core/ playwright.config.js 2>/dev/null
# sửa các import đó trỏ sang core/local/authSetup.local
```

### B2. Các file chỉ vệ tinh mới có — không cần làm gì

`core/utils/registrationApiHelper.js` và `core/reporters/suiteReporter.js` không tồn
tại ở Hub, nên sync không đụng tới. Dù vậy nên chuyển dần vào `core/local/` để nhất
quán và để tránh va chạm nếu Hub sau này thêm file cùng tên.

### B3. Thư mục `dashboard/` — không cần làm gì

9 file từng lệch đều là bản Hub cũ, không có tuỳ biến nào của dự án; sync ngày
2026-09-19 đã đưa chúng về đúng bản Hub. Chỉ còn khác kiểu xuống dòng (CRLF), vô hại.

### B4. Nghiệm thu

```bash
node --test core/
npm run check:framework
cd D:/_Automation-Project && node scripts/pre-sync-drift.js --satellite=Vieclam24h
```

---

---

## C. Áp dụng cho MỌI vệ tinh — xoá file mẫu của Hub còn sót

Hub từng đặt nhầm một fixture **chỉ để làm ví dụ** vào vùng được sync:
`core/fixtures/mockSampleTest.js`. Nó đọc `data/mock/sample.html` và chỉ được dùng bởi
`tests/e2e/**/sample_container_mock.spec.js` — cả `data/` lẫn `tests/` đều nằm trong
`FORBIDDEN_SYNC_MODULES`, nên ở vệ tinh file này là **code chết và sẽ lỗi nếu ai đó gọi tới**.

Hub đã chuyển nó sang `tests/fixtures/mockSampleTest.js` (vùng không bao giờ sync).
Nhưng **sync chỉ ghi đè và thêm, không bao giờ xoá**, nên bản cũ vẫn nằm lại ở vệ tinh.
Mỗi repo tự dọn một lần:

```bash
# Xác nhận không có gì trong repo này dùng tới nó
grep -rn "mockSampleTest" --include=*.js . | grep -v node_modules

# Nếu kết quả rỗng thì xoá
git rm core/fixtures/mockSampleTest.js
```

Nếu `grep` có kết quả, dừng lại và báo — nghĩa là dự án đã tự dùng nó, khi đó hãy chuyển
file sang `core/local/` thay vì xoá.

## Quy tắc từ nay

- Cần sửa `core/`? Hỏi: sửa này có giá trị cho **mọi** dự án không?
  - Có → PR ngược lên Hub.
  - Không → `core/local/`.
- Trước mỗi lần sync thủ công: `node scripts/pre-sync-drift.js --strict` (đã được
  gắn vào `npm run sync:satellites` và vào job CI `sync-satellites.yml`).
