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

## 3. Các Chỉ Số Đo Lường Được Đánh Dấu (Status: NOT MEASURED)

Tuân thủ Mục 1.1 của Plan 09 v4.0, các chỉ số sau đây được ghi nhận chính thức là **CHƯA ĐO** (NOT MEASURED) tại baseline và sẽ chỉ được đo lường thông qua protocol cố định tại Phase 0:
- **Total Blocking Time (TBT):** NOT MEASURED
- **Kích thước DOM elements tĩnh:** NOT MEASURED (Mục tiêu thiết kế: < 1.500 elements)
- **Memory Heap Retention:** NOT MEASURED
- **CSS Transferred Bytes:** NOT MEASURED
- **Visual Regression Baseline:** NOT MEASURED (Yêu cầu cố định 8 tổ hợp Viewport/Theme)
