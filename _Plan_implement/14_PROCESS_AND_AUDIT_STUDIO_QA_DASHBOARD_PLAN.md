# Kế Hoạch Hiện Thực Hóa: Tích Hợp "Process & Audit Studio" Vào QA Dashboard

> **Mã kế hoạch:** `PLAN-14`  
> **Trạng thái:** `COMPLETED (Đã Hoàn Tất & Đồng Bộ Nghiệm Thu)`  
> **Tài liệu tham chiếu:** [04_PROJECT_AUDIT_STANDARD.md](file:///D:/_Master_Process/04_PROJECT_AUDIT_STANDARD.md), [13_GATE_EVIDENCE_AND_CIRCUIT_BREAKER_PLAN.md](file:///d:/_Automation-Project/_Plan_implement/13_GATE_EVIDENCE_AND_CIRCUIT_BREAKER_PLAN.md)  
> **Môi trường mục tiêu:** Dashboard Core (`d:\_Automation-Project\dashboard`) và Vieclam24h Dashboard tại `D:\_SV_Automation`.

---

## 1. Bối Cảnh & Mục Tiêu

### 1.1. Bối Cảnh
Hiện tại:
- Dự án vệ tinh `D:\_SieuVietGroup` đang chạy Dashboard Node.js tại cổng 4180 (`http://127.0.0.1:4180/`).
- Kỹ sư QA/Dev chủ yếu làm việc tại phân hệ **QA Docs & Automation** (`#/qa`) để tra cứu Requirement, Test Case, Traceability, và Candidate Automation.
- Khi cần thực hiện các tác vụ quản trị chất lượng phần mềm (Health Check bằng `doctor`, Quét Modularity & Secret bằng `audit`, Dọn dẹp & Lưu trữ tri thức bằng `optimize`, hoặc Kiểm định 6 Probes bằng `audit-probes.ps1`), người dùng vẫn phải mở PowerShell/Terminal gõ lệnh thủ công.
- Người dùng muốn tích hợp một phân hệ trực quan **"Process & Audit Studio"** ngay trong giao diện QA (`#/qa`) để 1-click kích hoạt kiểm định và theo dõi sức khỏe dự án theo thời gian thực.

### 1.2. Mục Tiêu Cốt Lõi
1. **Backend API Master Process Đầy Đủ**:
   - Mở rộng `GET /api/mp/status` để trích xuất toàn diện: trạng thái `.quality-policy.json`, `.ai/process-lock.json`, `audit/FREEZE.json`, và số dòng tri thức tồn đọng trong `candidates.md`.
   - Bổ sung endpoint thống nhất `POST /api/mp/run` nhận `{ action: 'doctor' | 'audit' | 'optimize' | 'probes' }`, điều phối gọi Python CLI hoặc PowerShell runner của Hub an toàn, không block server.
2. **Giao Diện Trực Quan "Process & Audit Studio" Tại View QA (`#/qa`)**:
   - **4 Thẻ Trạng Thái (Status Badges)**:
     - Policy Status: `CUSTOM (Code 100k lines / Knowledge 150 lines)`
     - Modularity Health: `201 Scanned / 0 Violations (PASS)`
     - Learning Status: `143 lines (Needs Curation)`
     - Freeze Status: `NORMAL (Unfrozen)` hoặc `FROZEN`
   - **4 Nút Thao Tác 1-Click (Action Buttons)**:
     - 🩺 `[Run Health Check]` (`doctor`)
     - 🛡️ `[Run Security & Audit]` (`audit`)
     - ⚡ `[Optimize & Archive Learning]` (`optimize`)
     - 🔍 `[Run 6 Audit Probes]` (`probes`)
   - **Khung Console Log Thời Gian Thực**:
     - Terminal tối màu (Dark terminal box), tự động cuộn (Auto-scroll), phân biệt màu sắc an toàn (Xanh = PASS, Đỏ = FAIL/VIOLATION, Vàng = WARN).
3. **Tuyệt Đối Tuân Thủ Tiêu Chuẩn Kiến Trúc**:
   - **Zero `innerHTML`**: 100% sử dụng DOM APIs (`document.createElement`, `textContent`) khi hiển thị dữ liệu server/terminal output để phòng chống XSS.
   - **Decoupled Controller**: Tạo module riêng `processStudioHelper.js` thay vì nhồi nhét làm phình file `qaSlice.js` (hiện đã gần 2000 dòng).
   - **Zero-Drift Sync**: Phân phối đồng bộ sang `D:\_SieuVietGroup` qua `sync-satellites.js --force` mà không làm gián đoạn server port 4180.

---

## 2. Đánh Giá Toàn Diện Các Điểm "Thủng" / Lỗ Hổng Kỹ Thuật (Critical Gap Audit)

Trước khi bắt tay vào hiện thực hóa, kế hoạch đã tiến hành "vạch lá tìm sâu" và phát hiện **8 lỗ hổng tiềm ẩn** trong Prompt 4 nếu chỉ làm theo mô tả sơ bộ ban đầu:

| STT | Điểm Thủng / Lỗ Hổng Tiềm Ẩn | Mức Độ | Hậu Quả Nếu Không Xử Lý | Giải Pháp Trong Kế Hoạch Này |
|:---:|---|:---:|---|---|
| **01** | **Xung đột cấu trúc Backend (`dashboard/server.js` vs Modular Routes)** | **P0** | Đề bài yêu cầu viết vào `dashboard/server.js`, nhưng kiến trúc dự án đã phân rã toàn bộ routing sang `dashboard/routes/`. Viết vào `server.js` sẽ phá vỡ quy chuẩn kiến trúc và phình file. | Triển khai đúng chuẩn trong [dashboard/routes/masterProcessRoutes.js](file:///d:/_Automation-Project/dashboard/routes/masterProcessRoutes.js) và [dashboard/services/masterProcessService.js](file:///d:/_Automation-Project/dashboard/services/masterProcessService.js). |
| **02** | **Lệch chuẩn tham số action `probes` trong `POST /api/mp/run`** | **P0** | Lệnh `probes` không phải sub-command trong `master.py` mà chạy qua script PowerShell `audit-probes.ps1`. Nếu gọi `python master.py probes` sẽ văng lỗi `invalid choice: 'probes'`. | `masterProcessService.js` map chính xác: `doctor`, `audit`, `optimize` $\to$ `master.py`; `probes` $\to$ `audit-probes.ps1`. |
| **03** | **Nguy cơ Timeout & Freezing Subprocess khi chạy 6 Probes** | **P1** | `audit-probes.ps1` quét toàn bộ Git log và files (P1-P6) mất từ 5-15 giây. Nếu client không có loading state hoặc server xử lý blocking, giao diện sẽ bị đơ/timeout. | Dùng Promise spawn bất đồng bộ, streaming stdout/stderr, vô hiệu hóa nút bấm và hiển thị spinner trong lúc chạy. |
| **04** | **Thiếu xử lý Fallback khi file `.quality-policy.json` chưa tồn tại** | **P1** | Ở Hub (`_Automation-Project`), file này chưa có. Nếu backend chỉ `fs.readFileSync` mà không kiểm tra, server sẽ ném `ENOENT` và crash endpoint `GET /api/mp/status`. | Xây dựng fallback thông minh: nếu có file thì đọc `CUSTOM`, nếu không có thì trả về ngưỡng chuẩn `DEFAULT` của Master Process Standard 01. |
| **05** | **Rủi ro đếm dòng `candidates.md` và ngưỡng chặn của `doctor`** | **P1** | `candidates.md` ở `_SieuVietGroup` hiện có 151 dòng (vượt ngưỡng 50 dòng). Khi bấm `[Run Health Check]`, `doctor` sẽ báo FAIL exit code 1. Người dùng tưởng lỗi hệ thống. | Hiển thị badge trực quan: Xanh nếu $\le 50$ dòng, Đỏ `CRITICAL (>50 lines - Needs Curation)` nếu vượt ngưỡng; giải thích rõ vì sao `doctor` fail và hướng dẫn bấm `[Optimize]`. |
| **06** | **Nguy cơ XSS khi phân màu Terminal Output** | **P1** | Đề bài yêu cầu phân biệt màu (Xanh = PASS, Đỏ = FAIL). Nếu dùng `innerHTML` để parse ANSI escape codes, kẻ tấn công hoặc log chứa mã HTML/script có thể gây lỗi bảo mật nghiêm trọng. | Xây dựng parser thuần DOM: tách từng dòng/đoạn text, dùng `document.createElement('span')`, gán `textContent` an toàn và gắn class màu CSS (`.log-pass`, `.log-fail`, `.log-warn`). |
| **07** | **Làm phình file `qaSlice.js` (hiện đã 1986 dòng)** | **P2** | Quy chuẩn dự án giới hạn kích thước module. Nếu nhồi toàn bộ logic Master Process Studio vào `qaSlice.js`, file sẽ vượt 2100 dòng. | Tạo file mới [dashboard/public/js/views/qa/processStudioHelper.js](file:///d:/_Automation-Project/dashboard/public/js/views/qa/processStudioHelper.js) đóng gói toàn bộ logic UI, chỉ gọi nạp trong `qaSlice.js` bằng 3 dòng code. |
| **08** | **Đồng bộ hóa sang vệ tinh làm vỡ Dashboard Port 4180** | **P1** | Khi đồng bộ sang `D:\_SieuVietGroup`, nếu có lỗi cú pháp JS hoặc template, Dashboard đang chạy tại port 4180 sẽ bị trắng trang. | Kiểm tra cú pháp bằng `check:framework`, đồng bộ qua `sync-satellites.js --force`, và kiểm chứng trực tiếp bằng Browser Subagent trên port 4180. |

---

## 3. Kiến Trúc Giải Pháp Kỹ Thuật

```mermaid
graph TD
    subgraph FrontendQAView [View QA: http://127.0.0.1:4180/#/qa]
        QA_HTML[dashboard/public/templates/qa.html]
        QA_SUBNAV[Thanh Subnav: Docs | Candidates | Findings | Decisions | Studio]
        STUDIO_CARD[Section: Master Process Studio]
        BADGES[4 Badges: Policy, Modularity, Learning, Freeze]
        ACTIONS[4 Action Buttons: Doctor, Audit, Optimize, Probes]
        TERMINAL[Console Log Terminal Box DOM Safe]
        QA_HELPER[dashboard/public/js/views/qa/processStudioHelper.js]
    end

    subgraph BackendEngine [Dashboard Backend API]
        MP_ROUTES[dashboard/routes/masterProcessRoutes.js]
        MP_SERVICE[dashboard/services/masterProcessService.js]
        ROUTER[dashboard/routes.js]
    end

    subgraph MasterProcessCore [Master Process Hub: D:/_Master_Process]
        MASTER_PY[master.py CLI: doctor, audit, optimize]
        AUDIT_PROBES[scripts/audit-probes.ps1: Probes P1-P6]
        POLICY_FILE[.quality-policy.json]
        CANDIDATES_FILE[.ai/learning/candidates.md]
        FREEZE_FILE[audit/FREEZE.json]
    end

    STUDIO_CARD --> QA_HELPER
    ACTIONS -->|click| QA_HELPER
    QA_HELPER -->|GET /api/mp/status| MP_ROUTES
    QA_HELPER -->|POST /api/mp/run| MP_ROUTES
    MP_ROUTES --> MP_SERVICE
    MP_SERVICE -->|doctor / audit / optimize| MASTER_PY
    MP_SERVICE -->|probes| AUDIT_PROBES
    MP_SERVICE -->|read status| POLICY_FILE
    MP_SERVICE -->|read status| CANDIDATES_FILE
    MP_SERVICE -->|read status| FREEZE_FILE
    MP_SERVICE -->|return JSON| QA_HELPER
    QA_HELPER -->|DOM textContent & Color Spans| TERMINAL
```

---

## 4. Kế Hoạch Hiện Thực Hóa Chi Tiết (4 Phases)

### Phase 1: Nâng Cấp Backend API Master Process
**Mục tiêu:** Cung cấp đầy đủ dữ liệu trạng thái và điều phối 4 actions an toàn.

1. **Cập nhật `dashboard/services/masterProcessService.js`**:
   - Thêm hàm `getProjectQualityStatus(projectRoot)`:
     - **Đọc `.quality-policy.json`**: Trích xuất `limits` (module, service, utils) và `knowledge` (maxLines, candidateLines). Trả về nhãn tóm tắt, ví dụ: `"CUSTOM (Code 100k lines / Knowledge 150 lines)"`. Nếu file không tồn tại, trả về `"DEFAULT (Standard 01 Policy)"`.
     - **Đọc `.ai/learning/candidates.md`**: Đếm tổng số dòng, kiểm tra nếu $> 50$ dòng thì đánh dấu `status: "NEEDS_CURATION"` (cảnh báo đỏ), ngược lại `status: "NORMAL"`.
     - **Đọc `audit/FREEZE.json` (hoặc `.ai/audit/FREEZE.json`)**: Lấy trạng thái Circuit Breaker (`active`, `reason`, `blocking_findings`).
     - **Lấy kết quả Modularity gần nhất**: Số file đã quét, violations, exemptions.
   - Thêm hàm `runMasterAction(projectRoot, action)`:
     - Kiểm tra whitelist: `['doctor', 'audit', 'optimize', 'probes']`.
     - `doctor`: Gọi `runMaster(masterRoot, ['doctor', projectRoot], projectRoot)`.
     - `audit`: Gọi `runMaster(masterRoot, ['audit', projectRoot], projectRoot)`.
     - `optimize`: Gọi `runMaster(masterRoot, ['optimize', projectRoot], projectRoot)`.
     - `probes`: Gọi `runProbes(projectRoot, { probeId: 'ALL' })`.
     - Trả về object: `{ ok, exitCode, stdout, stderr, action }`.
2. **Cập nhật `dashboard/routes/masterProcessRoutes.js`**:
   - Endpoint `GET /api/mp/status`: Trả về dữ liệu kết hợp từ `getProjectStatus()` và `getProjectQualityStatus()`.
   - Endpoint `POST /api/mp/run`: Nhận body `{ action }`, gọi `runMasterAction()`, trả về HTTP 200 kèm kết quả chi tiết.

---

### Phase 2: Thiết Kế Giao Diện UI "Master Process Studio" Trong QA View
**Mục tiêu:** Tích hợp trực quan phân hệ Studio vào template `dashboard/public/templates/qa.html`.

1. **Thêm Tab Điều Hướng trong `qa-subnav`**:
   ```html
   <button type="button" class="view-subtab script-subtab" data-qa-tab="process-studio" role="tab" aria-selected="false">
     <i class="ph-bold ph-shield-check"></i> Process &amp; Audit Studio
   </button>
   ```
2. **Thêm Panel Nội Dung `#qa-panel-process-studio`**:
   - **Hàng 4 Thẻ Trạng Thái (Status Badges Row)**:
     - 📜 **Policy Status**: Badge hiển thị định mức (`#qa-mp-policy-badge`).
     - 🛡️ **Modularity Health**: Badge hiển thị số violations (`#qa-mp-modularity-badge`).
     - 🧠 **Learning Status**: Badge hiển thị số dòng candidates kèm cảnh báo (`#qa-mp-learning-badge`).
     - ❄️ **Freeze Status**: Badge hiển thị trạng thái Circuit Breaker (`#qa-mp-freeze-badge`).
   - **Hàng 4 Nút Hành Động (Action Buttons Row)**:
     - 🩺 `<button id="qa-mp-btn-doctor" class="btn-primary-sm">` Run Health Check
     - 🛡️ `<button id="qa-mp-btn-audit" class="btn-secondary-sm">` Run Security & Audit
     - ⚡ `<button id="qa-mp-btn-optimize" class="btn-secondary-sm">` Optimize & Archive Learning
     - 🔍 `<button id="qa-mp-btn-probes" class="btn-secondary-sm">` Run 6 Audit Probes
   - **Hộp Điều Khiển & Khung Console Log (Terminal)**:
     - Header có tiêu đề, trạng thái thực thi (Idle / Running spinner), và nút "Xoá log".
     - Thẻ `<div id="qa-mp-terminal" class="qa-mp-terminal">` phong cách terminal đen tuyền, font monospace, tự động cuộn khi có log mới.

---

### Phase 3: Xây Dựng Controller Tách Rời `processStudioHelper.js`
**Mục tiêu:** Xử lý toàn bộ logic tương tác người dùng, gọi API và render an toàn 100% DOM.

1. **Tạo mới `dashboard/public/js/views/qa/processStudioHelper.js`**:
   - `class ProcessStudioHelper`:
     - `bindEvents(root, disposers)`: Bắt sự kiện click 4 nút hành động, nút xoá log, và sự kiện chuyển tab.
     - `loadStatus(root)`: Gọi `GET /api/mp/status`, cập nhật các badge trạng thái bằng `textContent` và gán class màu sắc.
     - `executeAction(action, root)`:
       - Vô hiệu hóa các nút bấm, hiện icon spinner.
       - Ghi log: `[THỰC THI] Đang chạy lệnh: <action>... Vui lòng đợi.`
       - Gọi `POST /api/mp/run` với `{ action }`.
       - Render kết quả trả về vào terminal.
       - Bật lại các nút bấm và tự động cập nhật lại status badges.
     - `appendLog(root, text, type)`:
       - Parser DOM an toàn: Duyệt qua từng dòng text, tạo phần tử `<p class="log-line ${type}">`, gán `textContent = line`.
       - Tự động nhận diện từ khóa để tô màu:
         - Dòng chứa `PASS`, `OK`, `IN_SYNC`, `scanned`, `violations=0` $\to$ màu xanh (`.log-pass`).
         - Dòng chứa `FAIL`, `VIOLATION`, `DRIFT`, `CRITICAL`, `ERROR` $\to$ màu đỏ (`.log-fail`).
         - Dòng chứa `WARNING`, `SKIP`, `WARN` $\to$ màu vàng (`.log-warn`).
2. **Tích hợp vào `dashboard/public/js/views/qa/qaSlice.js`**:
   - Thêm tab `'process-studio'` vào mảng điều hướng `switchTab()`.
   - Khởi tạo `this.processStudioHelper = new ProcessStudioHelper(this);` và gọi `bindEvents()` trong 4 dòng code.

---

### Phase 4: Phân Phối Đồng Bộ Vệ Tinh & Kiểm Định Nghiệm Thu E2E
**Mục tiêu:** Đưa tính năng lên Dashboard đang chạy tại `http://127.0.0.1:4180/` và nghiệm thu thực tế.

1. **Đồng bộ hóa qua `scripts/sync-satellites.js --force`**:
   - Đẩy toàn bộ thay đổi từ Hub sang `D:\_SieuVietGroup`.
2. **Kiểm tra trực tiếp trên trình duyệt sống (`http://127.0.0.1:4180/#/qa`)**:
   - Mở view QA, bấm sang tab **Process & Audit Studio**.
   - Kiểm tra 4 thẻ trạng thái hiển thị chuẩn xác số liệu thực tế của `_SieuVietGroup`.
   - Bấm nút `[Run Security & Audit]`: Xác nhận terminal hiện kết quả Modularity Audit xanh, không văng lỗi.
   - Bấm nút `[Run 6 Audit Probes]`: Xác nhận chạy qua 6 probes mà không làm crash server Node.js.
   - Bấm nút `[Run Health Check]`: Xác nhận `doctor` chạy và thông báo rõ ràng về ngưỡng candidate.

---

## 5. Tiêu Chí Nghiệm Thu Bắt Buộc (Acceptance Criteria)

- [x] Endpoint `GET /api/mp/status` trả về đầy đủ: `policy`, `process_lock`, `freeze`, `candidates_lines`, `modularity`.
- [x] Endpoint `POST /api/mp/run` xử lý chuẩn xác cả 4 actions: `doctor`, `audit`, `optimize`, `probes`.
- [x] Giao diện Card "Process & Audit Studio" hiển thị đầy đủ thông số và 4 action buttons tại `#/qa`.
- [x] Bấm nút `[Run Security & Audit]`: Console hiển thị `MODULARITY: scanned=... violations=0...` với chữ màu xanh.
- [x] Bấm nút `[Run 6 Audit Probes]`: Console hiển thị kết quả quét 6 probes không gây crash server Node.js.
- [x] Không có bất kỳ lỗi console bất thường nào trên Browser DevTools.
- [x] 100% tuân thủ quy tắc DOM an toàn: không dùng `innerHTML` trên dữ liệu log/server.
- [x] Kiểm định Modularity Audit trên mã nguồn mới đạt 0 violations (`service <= 200`, `helper <= 250`).
- [x] Đã đồng bộ sang vệ tinh Vieclam24h (`D:\_SV_Automation`) thành công thông qua cơ chế phân giải đường dẫn động đa máy tính (Zero-Hardcoded Paths).
