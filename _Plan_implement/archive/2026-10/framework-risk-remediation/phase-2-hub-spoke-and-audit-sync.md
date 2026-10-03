# Kế Hoạch 22 — Phase 2: Đồng Bộ Vệ Tinh (Hub-to-Spoke) & Chuẩn Hóa Sổ Thẩm Định

> **Plan ID:** `PLAN-22-PHASE-2` · **Cấp độ:** `L3` · **Trạng thái:** `COMPLETED`  
> **Chủ trì:** `@ba` (Đặc tả) / `@tl` (Kỹ thuật) · **Phụ thuộc:** Phase 1 (Đã hoàn thành)

---

## 1. Mục Tiêu Phase
1. Giải quyết triệt để nguy cơ thất thoát mã nguồn riêng của vệ tinh `_SieuVietGroup` (Vieclam24h, trước đây là `_SV_Automation`) đối với file [scripts/run-suite.js](file:///d:/_Automation-Project/scripts/run-suite.js).
2. Đồng bộ hóa 41 file cho vệ tinh `Automation_Carthings` qua cơ chế `npm run sync:satellites`.
3. Chuẩn hóa Sổ Thẩm Định [FINDINGS_REGISTRY.md](file:///d:/_Automation-Project/audit/FINDINGS_REGISTRY.md): tách biệt rõ findings cũ của vệ tinh Vieclam24h vào khu vực lưu trữ, thiết lập registry sạch cho Hub Engine.

---

## 2. Bảng Ngân Sách Dòng Mã & File Tác Động (File Budget)

| Thao Tác | Đường Dẫn File | Dòng Hiện Tại | Dòng Sau Sửa | Thay Đổi Net | Ghi Chú |
|---|---|:---:|:---:|:---:|---|
| Modify / Add | [scripts/lib/sync-manifest.js](file:///d:/_Automation-Project/scripts/lib/sync-manifest.js) | 294 | 300 | +6 | Bổ sung exclude hoặc tiếp nhận run-suite.js |
| Modify | [audit/FINDINGS_REGISTRY.md](file:///d:/_Automation-Project/audit/FINDINGS_REGISTRY.md) | 26 | 45 | +19 | Lưu trữ AUTO-01..03 & tạo bảng Hub Engine |
| Modify | [scripts/sync-satellites.js](file:///d:/_Automation-Project/scripts/sync-satellites.js) | - | - | 0 | Chạy sync an toàn qua CLI |

*Tổng số dòng sửa đổi dự kiến: < 30 dòng.*

---

## 3. Tiêu Chí Nghiệm Thu (Acceptance Criteria & Test Cases)

| Mã AC | Mô Tả Tiêu Chí | Kịch Bản Kiểm Thử (TC) | Kết Quả Mong Đợi |
|---|---|---|---|
| **AC-22-05** | An toàn tuyệt đối trước khi sync | `TC-P2-01`: Chạy `npm run presync:drift:strict` | 0 file báo nguy cơ mất mã nguồn riêng (SAT-ONLY với nội dung mới). |
| **AC-22-06** | Đồng bộ vệ tinh thành công | `TC-P2-02`: Chạy `npm run sync:satellites` | 41 file của `Automation_Carthings` được cập nhật thành công, 0 lỗi đĩa. |
| **AC-22-07** | Chuẩn hóa Sổ Thẩm Định | `TC-P2-03`: Kiểm tra `audit/FINDINGS_REGISTRY.md` | Bảng Hub chỉ theo dõi các module đang có trong Hub; các lỗi của Vieclam24h được đưa vào mục Lưu trữ vệ tinh. |

---

## 4. Chi Tiết Thực Thi Kỹ Thuật

### 4.1. Xử lý `scripts/run-suite.js` của vệ tinh
File này là tiện ích chọn môi trường linh hoạt `[qc, stg, prod]` khi chạy test.
- Đánh giá: Nếu script này hữu ích cho mọi dự án vệ tinh, tích hợp chính thức lên Hub tại `scripts/run-suite.js` và đưa vào manifest sync.
- Nếu mang tính cục bộ của Vieclam24h: Di chuyển vào `core/local/scripts/run-suite.js` tại thư mục vệ tinh `d:\_SieuVietGroup` (trước đây là `d:\_SV_Automation`) theo đúng quy ước `core/local/README.md`.

### 4.2. Thực thi đồng bộ Vệ tinh CarThings
```powershell
# Kiểm tra nghiêm ngặt trước khi sync
npm run presync:drift:strict

# Chạy sync chính thức
npm run sync:satellites
```

### 4.3. Cập nhật `audit/FINDINGS_REGISTRY.md`
Chia thành 2 bảng rõ rệt:
1. **Phần 1: Findings Hub Engine**: Theo dõi nợ kỹ thuật thực tế của Hub (như tái cấu trúc [objectRepository.js](file:///d:/_Automation-Project/core/generator/objectRepository.js), cảnh báo placeholder URL).
2. **Phần 2: Kho Lưu Trữ Vệ Tinh (Satellite Legacy Archive)**: Chuyển các findings `AUTO-01`, `AUTO-02`, `AUTO-03` với trạng thái `ARCHIVED_TO_SATELLITE`.

---

## 5. Lệnh Kiểm Chứng Cổng Nghiệm Thu
```powershell
# 1. Kiểm tra không còn rủi ro trôi lệch
npm run presync:drift

# 2. Kiểm tra tính toàn vẹn của sync contract
node --test scripts/lib/sync-manifest.test.js
```
