# Kế Hoạch Khắc Phục Toàn Diện Các Thiếu Sót Trong Plan 12 (Master Process Dashboard Integration)

## 1. Bối Cảnh & Mục Tiêu

Dựa trên kết quả rà soát thực tế đối chiếu với tiêu chí nghiệm thu của **Plan 12**, hệ thống hiện tại đã kết nối thành công các luồng cơ bản (Backend Service, Routes, Settings UI, QA Process Studio). Tuy nhiên, còn tồn tại **8 điểm thiếu sót (Findings)** ảnh hưởng trực tiếp đến tính an toàn, bảo mật và trải nghiệm người dùng:

1. **[P0/P1] Thiếu Whitelist Path Validation:** `masterProcessService.js` chưa có `validateProjectPath()`. API chưa trả mã 400/403 cho target ngoài danh sách cho phép (nguy cơ path traversal / command injection).
2. **[P1] Subprocess thiếu Timeout 60s & WindowsHide:** `spawn()` thiếu timeout chống treo vô hạn, thiếu cơ chế kill process khi hết hạn và thiếu `windowsHide: true`.
3. **[P1] Thiếu Execution Lock / Mutex:** Khi một tác vụ nặng đang chạy (audit/sync/doctor), người dùng có thể bấm nút gửi thêm nhiều request song song làm nghẽn tiến trình Node.js.
4. **[P1] Sync UI thiếu cơ chế "2 nấc an toàn":** Thiếu checkbox xác nhận `--update-templates`, thiếu nút xem trước `--dry-run` trước khi ghi đè thật.
5. **[P1] Trạng thái Git Hook hiển thị thiếu chính xác:** UI chỉ kiểm tra `installed && managedV2` mà bỏ qua `pointsToHub`, dẫn đến hook sai Hub vẫn hiện màu xanh.
6. **[P1] Đồng bộ vệ tinh chưa phân phối `package.json` scripts:** Chưa có cơ chế phân phối các script `mp:*` vào `package.json` của vệ tinh mà không làm hỏng metadata riêng của vệ tinh.
7. **[P2] Test Coverage chưa bao phủ rào chắn an toàn:** Thiếu unit test cho whitelist, timeout, mutex 409, và dry-run.
8. **[P2] UI chưa hiển thị chi tiết violations/exemptions:** Bổ sung bảng/danh sách vi phạm trực quan từ kết quả audit.

**Mục tiêu:** Khắc phục triệt để 100% các findings trên, bảo đảm tuân thủ mọi quy chuẩn modularity (service $\le 200$ dòng, utils $\le 150$ dòng, helper $\le 250$ dòng), bảo mật tuyệt đối và nghiệm thu E2E trên cả giao diện Web và CLI.

---

## 2. Thiết Kế Chi Tiết & Giải Pháp Kỹ Thuật

### 2.1. Backend: Tách `masterProcessUtils.js` để bảo đảm Modularity

Để không làm phình to `masterProcessService.js` (hiện tại 197 dòng, trần $\le 200$), chúng ta trích xuất module trợ năng `dashboard/services/masterProcessUtils.js` (role `utils`, trần $\le 150$ dòng):

#### A. Whitelist Path Validation
```javascript
const ALLOWED_PROJECT_ROOTS = [
  'D:\\_Automation-Project',
  'D:/_Automation-Project',
  'D:\\_Master_Process',
  'D:/_Master_Process',
  'D:\\_SieuVietGroup',
  'D:/_SieuVietGroup',
  'D:\\_CarThings\\Automation_Carthings',
  'D:/_CarThings/Automation_Carthings',
];

function validateProjectPath(targetPath, fallbackRoot) {
  const resolved = path.resolve(targetPath || fallbackRoot || process.cwd());
  const normalized = resolved.replace(/\\/g, '/').toLowerCase();
  
  const isAllowed = ALLOWED_PROJECT_ROOTS.some((allowed) => {
    const normAllowed = path.resolve(allowed).replace(/\\/g, '/').toLowerCase();
    return normalized === normAllowed || normalized.startsWith(normAllowed + '/');
  });

  if (!isAllowed) {
    const err = new Error(`Target path '${targetPath}' is outside allowed project whitelist.`);
    err.statusCode = 403;
    throw err;
  }
  return resolved;
}
```

#### B. Subprocess Runner có Timeout 60s, Graceful Kill & `windowsHide: true`
```javascript
function runCommand(cmd, args, cwd, options = {}) {
  const timeout = options.timeout || 60000;
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch (_) {}
      }, 2000);
    }, timeout);

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({
          code: 124,
          stdout: stdout.trim(),
          stderr: (stderr + '\n[TIMEOUT] Tiến trình bị hủy sau 60 giây vì vượt quá thời gian cho phép.').trim(),
          ok: false,
          timedOut: true
        });
      } else {
        resolve({ code: code || 0, stdout: stdout.trim(), stderr: stderr.trim(), ok: code === 0 });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout: '', stderr: err.message, ok: false });
    });
  });
}
```

#### C. In-Memory Execution Mutex
- Biến trạng thái: `let currentRunningAction = null;`
- Khi có request `runMasterAction(projectRoot, action, payload)`:
  - Nếu `currentRunningAction` đang khác null: Trả về `{ ok: false, code: 409, error: `Tiến trình '${currentRunningAction}' đang chạy. Vui lòng chờ hoàn tất.` }`.
  - Trong khối `try { currentRunningAction = action; ... } finally { currentRunningAction = null; }`.

---

### 2.2. API Routes: Xử Lý Lỗi 403 & 409 Trong `masterProcessRoutes.js`

- Kiểm tra tham số `targetPath` / `projectRoot` từ query params hoặc body bằng `validateProjectPath`.
- Nếu bắt được lỗi `statusCode === 403`: Trả về HTTP `403 Forbidden` kèm JSON `{ ok: false, error: ... }`.
- Nếu kết quả từ service trả về `code === 409`: Trả về HTTP `409 Conflict`.
- Tiếp tục duy trì file `masterProcessRoutes.js` $\le 100$ dòng.

---

### 2.3. Frontend: Giao Diện Settings "Sync 2 Nấc" & Execution Loading State

#### A. Cập Nhật Template `settings.html`
1. **Thêm Checkbox & Nút Dry-run vào Card 1 (Anti-Drift & Process Lock):**
   - Checkbox `#mp-sync-confirm-checkbox`: `[ ] Cho phép ghi đè templates có sao lưu (.bak) (--update-templates)`
   - Nút `#mp-btn-sync-dryrun`: `[ 🔍 Xem trước Đồng bộ (--dry-run) ]` (Class `ghost`)
   - Nút `#mp-btn-sync`: Mặc định bị `disabled` hoặc ở chế độ nhắc nhở. Khi checkbox được tích, nút chuyển sang màu cam cảnh báo `[ ⚠️ Xác nhận Đồng bộ & Ghi đè ]`.
2. **Thêm Spinner & Trạng Thái Thực Thi Toàn Cục `#mp-spinner`:**
   - Hộp loading hiển thị icon xoay kèm chữ "Đang thực thi tác vụ Master Process...".

#### B. Nâng Cấp Controller `masterProcessHelper.js`
1. **Quản lý Mutex & Loading State (`setRunningState`):**
   - Thêm cờ `this.isRunning`.
   - Khi chạy tác vụ: hiển thị `#mp-spinner`, disable toàn bộ các nút trong subtab Master Process (`#mp-btn-init`, `#mp-btn-sync`, `#mp-btn-sync-dryrun`, `#mp-btn-drift`, `#mp-btn-hook`, `#mp-btn-audit`, `#mp-btn-audit-staged`, `#mp-btn-doctor`, `#mp-btn-probes`, `#mp-refresh-button`), đổi con trỏ chuột sang `not-allowed`.
   - Kết thúc tác vụ: khôi phục trạng thái nút bấm và ẩn spinner trong khối `finally`.
2. **Xử lý Luồng Đồng Bộ 2 Nấc:**
   - Bấm `#mp-btn-sync-dryrun`: Gọi `/api/mp/sync` với `{ dryRun: true, updateTemplates: false }`. In toàn bộ danh sách file preview ra terminal.
   - Khi thay đổi trạng thái checkbox: Nếu bật, kích hoạt nút `#mp-btn-sync` với nhãn `⚠️ Xác nhận Đồng bộ & Ghi đè`. Nếu tắt, vô hiệu hóa nút hoặc yêu cầu chạy dry-run trước.
3. **Hiển Thị Chính Xác Trạng Thái Git Hook:**
   - Kiểm tra đồng thời: `data.hook_status?.installed && data.hook_status?.managedV2 && data.hook_status?.pointsToHub`.
   - Nếu thiếu `pointsToHub`: Hiển thị cảnh báo màu vàng: `Cảnh báo: Chưa trỏ đúng Hub`.

---

### 2.4. Đồng Bộ Scripts `mp:*` Sang Vệ Tinh Trong `scripts/sync-satellites.js`

- Tạo hàm `syncPackageScripts(hubRoot, satelliteRoot)`:
  - Đọc `package.json` của Hub, trích xuất tất cả keys trong `scripts` có tiền tố `mp:`.
  - Đọc `package.json` của vệ tinh, so sánh và hợp nhất các scripts `mp:*`.
  - Ghi lại `package.json` của vệ tinh (bảo tồn nguyên vẹn tên dự án, dependencies riêng và định dạng thụt lề).
  - Tự động gọi hàm này trong chu trình sync của `sync-satellites.js`.

---

### 2.5. Kiểm Thử Đầy Đủ (Test Coverage) Trong `masterProcessService.test.js`

Bổ sung các test cases tự động:
1. `validateProjectPath`:
   - Kiểm tra đường dẫn hợp lệ (Hub, vệ tinh) $\rightarrow$ Thành công.
   - Kiểm tra đường dẫn bất hợp pháp (`C:\Windows`, path traversal `../../outside`) $\rightarrow$ Ném lỗi 403.
2. `timeout` & graceful termination:
   - Chạy lệnh với timeout nhỏ (vd. 200ms) $\rightarrow$ Subprocess bị kill đúng hạn và trả về `timedOut: true`.
3. `mutex lock`:
   - Gọi song song 2 actions $\rightarrow$ Lần gọi thứ hai nhận lỗi `code: 409`.
4. `sync dryRun`:
   - Xác nhận tham số `--dry-run` được truyền chính xác tới subprocess.

---

## 3. Đánh Giá Lỗ Hổng Kế Hoạch (Plan Gap Analysis & Blind Spot Check)

| STT | Nguy cơ tiềm ẩn | Biện pháp ngăn chặn trong kế hoạch |
| :---: | :--- | :--- |
| **G1** | **Vi phạm giới hạn dòng (Modularity Audit):** Cả service và helper đều đang gần chạm trần dòng code. | Trích xuất triệt để `masterProcessUtils.js` để giảm tải service từ 197 dòng xuống ~150 dòng. Helper được tái cấu trúc súc tích để luôn $\le 250$ dòng. |
| **G2** | **Xung đột process trên Windows khi bị kill:** `proc.kill('SIGTERM')` trên Windows đôi khi không dừng các tiến trình con (như python/powershell). | Sử dụng cơ chế timeout 2 tầng và bổ sung cờ `windowsHide: true`. Nếu sau 2s chưa thoát, ép buộc kill. |
| **G3** | **Làm hỏng file `package.json` của vệ tinh khi sync scripts:** Ghi đè toàn bộ `package.json` sẽ làm mất `dependencies` riêng của dự án con. | Chỉ đọc và gộp (merge) riêng nhánh `scripts['mp:*']`, tuyệt đối không ghi đè toàn bộ `package.json`. |
| **G4** | **Phá vỡ tính năng của QA View:** Các sửa đổi ở backend không được làm ảnh hưởng đến QA View Process Studio vừa tạo. | Cả 2 view Settings và QA đều dùng chung các endpoint `/api/mp/*` và chia sẻ mutex lock an toàn. |

---

## 4. Kế Hoạch Thực Hiện Theo Các Bước

1. **Bước 1:** Tạo `dashboard/services/masterProcessUtils.js` chứa `validateProjectPath`, `runCommand` (timeout 60s, windowsHide, kill handling).
2. **Bước 2:** Cập nhật `dashboard/services/masterProcessService.js` tích hợp `masterProcessUtils.js` và cơ chế Mutex Lock.
3. **Bước 3:** Cập nhật `dashboard/routes/masterProcessRoutes.js` xử lý HTTP 403 (Invalid Target) và 409 (Conflict).
4. **Bước 4:** Cập nhật `dashboard/public/templates/settings.html` bổ sung checkbox xác nhận `--update-templates`, nút xem trước `--dry-run` và `#mp-spinner`.
5. **Bước 5:** Cập nhật `dashboard/public/js/views/settings/masterProcessHelper.js` tích hợp loading state, mutex UI, luồng sync 2 nấc và badge Git Hook chính xác.
6. **Bước 6:** Cập nhật `scripts/sync-satellites.js` phân phối scripts `mp:*` vào `package.json` của vệ tinh.
7. **Bước 7:** Mở rộng `dashboard/services/masterProcessService.test.js` kiểm thử Whitelist, Timeout, Mutex và chạy kiểm thử tự động.
8. **Bước 8:** Chạy `sync-satellites.js --force` và kiểm tra toàn diện trên trình duyệt (Browser Subagent).
