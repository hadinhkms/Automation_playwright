# Plan 09 Baseline Evidence

> **Ghi nhận tại:** 2026-09-10  
> **Git HEAD SHA:** `130587a08512868a1e5cb00337b3d3d1df5dfe18`  
> **Môi trường:** Windows 10/11, Node.js, PowerShell 5.1 / 7

---

## 1. Trạng Thái Mã Nguồn & Hash Khóa File Monolith

Bảng mã băm SHA-256 dùng để đối chiếu xác nhận không làm biến đổi bất thường trong quá trình refactor:

| Tệp nguồn | Số dòng thực tế | SHA-256 Checksum |
|---|---|---|
| `dashboard/server.js` | 2.618 | `c5c7db7c8e1d1dd6d2fb90990c14fb12fd3a244b66a3f26bafc0ba451f785988` |
| `dashboard/public/app.js` | 15.739 | `71ef55680830e2946f01a9b49834b399e90b218d217dc1d435498da27c572641` |
| `dashboard/public/styles.css` | 19.463 | `fc9d77d715f0503cb67ef94fa3b1592ec7b8fc6634ae762b803b5229ca37c42c` |
| `dashboard/public/index.html` | 4.705 | `2c920e779835acb4ecb91002f85582ac912a8ae0bf383fd62f71866fb93f3db1` |
| `dashboard/public/agent.js` | 304 | `79817922ba08678b3c7d2f2ef3082faf6905d9f23c306e78f493d4c663740323` |
| `dashboard/agent-ui.test.js` | 331 | `b8ac6424fd225d19727b25a230a7b659b0d2473b307ba451854d7aaad1a7b21a` |

---

## 2. Kết Quả Quét Audit Trước Refactor

Lệnh thực thi:
```powershell
powershell -NoProfile -File "D:\_Master_Process\master.ps1" audit dashboard
```

Output thực tế:
```text
FAIL: agent-ui.test.js (330 lines; module limit 250)
FAIL: server.js (2617 lines; module limit 250)
FAIL: public/agent.js (303 lines; module limit 250)
FAIL: public/app.js (15738 lines; module limit 250)
MODULARITY: scanned=8 violations=4 staged=False
Exit code: 1
```

---

## 3. Các Chỉ Số Đo Lường Thực Tế (Empirical Baseline Metrics)

Thực hiện đo lường bằng lệnh: `node scripts/measure-dashboard-baseline.js`  
Chi tiết raw data lưu tại: `_Plan_implement/plan09-evidence/baseline-measurement.json`

| Chỉ số | Giá trị đo được | Phương pháp đo | Ngưỡng mục tiêu Plan 9 | Ghi chú kỹ thuật |
|---|---|---|---|---|
| **Kích thước DOM elements (App Ready)** | **3.471 elements** | `document.querySelectorAll('*').length` trên Chromium cô lập | < 1.500 elements (Phase 5) | Do monolith `index.html` hiện tại pre-render toàn bộ 13 views. Phase 5 sẽ dùng lazy DOM templates để đưa về ngưỡng < 1.500. |
| **Thời gian load ban đầu (Cold load)** | **1.823 ms** | `page.goto` tới `waitForSelector('.shell')` | Median baseline | Load toàn bộ CSS + fonts + scripts CDN. |
| **CSS Transferred Bytes** | **1.087.481 bytes** (24 requests) | Playwright network capture | ≤ 5% baseline | Bao gồm styles nội bộ (~210 KB) + Google Fonts & Prism CDN. |
| **Visual Regression Baseline** | **ĐÃ CHỤP ĐỦ 8 TỔ HỢP** | `page.screenshot` theo 4 viewports × 2 themes | 0 visual diff | Lưu tại `_Plan_implement/plan09-evidence/visual-baseline/`: <br>- `1920x1080-dark.png`, `1920x1080-light.png`<br>- `1440x900-dark.png`, `1440x900-light.png`<br>- `1280x800-dark.png`, `1280x800-light.png`<br>- `390x844-dark.png`, `390x844-light.png` |
| **Memory Heap Usage** | Đã cấu hình tracker | DevTools Performance Protocol | Retained heap tăng ≤ 10% | Sẽ đo thêm profile 20/40 vòng navigation ở TC-11. |
