# Kế Hoạch 22 — Phase 1: Khôi Phục CI/CD Unit Test Runner & Cô Lập AI Gateway Mock

> **Plan ID:** `PLAN-22-PHASE-1` · **Cấp độ:** `L3` · **Trạng thái:** `COMPLETED`  
> **Chủ trì:** `@ba` (Đặc tả) / `@tl` (Kỹ thuật) · **Phụ thuộc:** Không

---

## 1. Mục Tiêu Phase
Khôi phục 100% Green cho bộ kiểm thử Unit Test (`node --test`), xử lý triệt để 7 lỗi fail hiện tại:
1. Loại trừ thư mục backup `_backup_vieclam24h/` khỏi phạm vi chạy của test runner.
2. Xử lý triệt để race condition và nghẽn concurrency slot (`BUSY`) trong [agentService.test.js](file:///d:/_Automation-Project/core/ai/agentService.test.js) bằng cách hỗ trợ mock adapter sạch cho [callAi](file:///d:/_Automation-Project/core/ai/gateway/index.js) và hàm dọn slot `resetLimitsForTesting()` trong [limits.js](file:///d:/_Automation-Project/core/ai/gateway/limits.js).

---

## 2. Bảng Ngân Sách Dòng Mã & File Tác Động (File Budget)

| Thao Tác | Đường Dẫn File | Dòng Hiện Tại | Dòng Sau Sửa | Thay Đổi Net | Ghi Chú |
|---|---|:---:|:---:|:---:|---|
| Modify | [package.json](file:///d:/_Automation-Project/package.json) | 78 | 80 | +2 | Thêm script `test:unit` giới hạn thư mục chuẩn |
| Modify | [.github/workflows/playwright.yml](file:///d:/_Automation-Project/.github/workflows/playwright.yml) | 112 | 112 | 0 | Đổi `run: node --test` thành `run: npm run test:unit` |
| Modify | [core/ai/gateway/limits.js](file:///d:/_Automation-Project/core/ai/gateway/limits.js) | 78 | 86 | +8 | Export thêm `resetLimitsForTesting()` |
| Modify | [core/ai/agentService.js](file:///d:/_Automation-Project/core/ai/agentService.js) | 491 | 500 | +9 | Nhận `callAiImpl` hoặc `mockAdapter` cho test |
| Modify | [core/ai/agentService.test.js](file:///d:/_Automation-Project/core/ai/agentService.test.js) | 154 | 165 | +11 | Đồng bộ mock và gọi `resetLimitsForTesting()` |

*Tổng số dòng sửa đổi dự kiến: < 40 dòng (không vi phạm ngân sách).*

---

## 3. Tiêu Chí Nghiệm Thu (Acceptance Criteria & Test Cases)

| Mã AC | Mô Tả Tiêu Chí | Kịch Bản Kiểm Thử (TC) | Kết Quả Mong Đợi |
|---|---|---|---|
| **AC-22-01** | `test:unit` không quét thư mục backup | `TC-P1-01`: Chạy `npm run test:unit` | Bỏ qua hoàn toàn `_backup_vieclam24h/`, không báo lỗi thiếu module. |
| **AC-22-02** | `agentService.test.js` chạy offline | `TC-P1-02`: Chạy `node --test core/ai/agentService.test.js` | 7/7 test PASS trong < 500ms, không phát sinh bất kỳ request ra mạng ngoài. |
| **AC-22-03** | Kháng rò rỉ Concurrency Slot | `TC-P1-03`: Kiểm tra `activeCalls` sau mỗi test case | `activeCalls === 0`, không bao giờ bắn lỗi `BUSY` giả lập giữa các test. |
| **AC-22-04** | Toàn bộ Unit Suite 100% Green | `TC-P1-04`: Chạy toàn bộ unit test suite | 766/766 tests PASS, 0 fail, 0 timeout. |

---

## 4. Chi Tiết Thực Thi Kỹ Thuật

### 4.1. Cập nhật `package.json` & GitHub Actions
Khai báo rõ ràng các thư mục hợp lệ của Hub:
```json
"test:unit": "node --test \"core/**/*.test.js\" \"dashboard/**/*.test.js\" \"scripts/**/*.test.js\" \"tools/**/*.test.js\""
```

### 4.2. Bổ sung `resetLimitsForTesting()` trong `limits.js`
```javascript
function resetLimitsForTesting() {
  activeCalls = 0;
}
```

### 4.3. Đồng bộ hóa mock trong `agentService.js`
Trong [agentService.js](file:///d:/_Automation-Project/core/ai/agentService.js), cho phép truyền `callAiImpl` tùy chọn qua options khởi tạo `createAgentService({ root, env, callAiImpl })` (mặc định dùng `callAi` từ `./gateway/index`).
Trong [agentService.test.js](file:///d:/_Automation-Project/core/ai/agentService.test.js), cấu hình `callAiImpl` trả về kết quả giả lập tương ứng với các trường hợp: hoàn tất tin nhắn, phản hồi lỗi quota, gợi ý inline code.

---

## 5. Lệnh Kiểm Chứng Cổng Nghiệm Thu
```powershell
# 1. Chạy riêng lẻ bộ test agentService
node --test core/ai/agentService.test.js

# 2. Chạy toàn bộ Unit Tests của Hub Engine
npm run test:unit

# 3. Đảm bảo cấu trúc framework không bị ảnh hưởng
npm run check:framework
```
