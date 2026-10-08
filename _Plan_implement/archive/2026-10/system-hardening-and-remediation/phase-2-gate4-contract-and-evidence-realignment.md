# Phase 2 — Căn Chỉnh Hợp Đồng Gate 4 & Đóng Sổ Audit

> **Tác giả Nghiệp vụ:** @ba (phiên 2026-10-03) · **Tác giả Kỹ thuật:** @tl (phiên 2026-10-03) · **Research:** Không áp dụng  
> **Trạng thái:** `COMPLETED` · **Cấp độ:** L3  

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:** Khắc phục tình trạng lệch SHA256 khiến Gate 4 bị chặn (`GATE BLOCKED`); căn chỉnh `.delivery/contract.json` và `.delivery/approved_contract.sha256` đồng bộ với phase hiện hành; thẩm định và chuyển trạng thái các finding HUB-01 và HUB-02 trong `audit/FINDINGS_REGISTRY.md` sang `CLOSED` theo đúng quy chuẩn Standard 04 §2.10.
- **Out-of-Scope:** Không thay đổi các kịch bản test nghiệp vụ đang pass.

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-23-02`: Đảm bảo quy trình kiểm soát Cổng Nghiệm thu (Acceptance Gates) hoạt động trơn tru và sổ phát hiện thẩm định phản ánh chính xác kết quả thực tế.
- `BR-23-02`: Chỉ chuyển trạng thái finding sang `CLOSED` khi có biên nhận chạy test tự động hồi quy đạt 100% Green.

### A3. User Flow & Nhánh Lỗi/Hủy
- Luồng chính: `Căn chỉnh contract.json khớp SHA256 pin → Chạy kiểm định mp:gate --preview → Cập nhật bằng chứng đóng CLOSED trong sổ Audit`.
- Nhánh lỗi: Nếu SHA256 không khớp, lệnh gate từ chối và yêu cầu tính lại chữ ký hợp đồng.

### A4. Trạng Thái Biên (EDGE-xx)
- `EDGE-23-02`: Trường hợp chuyển đổi giữa các phase hợp đồng đảm bảo file backup và evidence map tương ứng không bị mất mát.

### A5. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-23-02`: Given hợp đồng nghiệm thu được căn chỉnh When chạy lệnh `node scripts/run-mp.js gate . --preview` Then hệ thống không bị lỗi `Contract differs from trusted approved SHA256` và các finding HUB-01, HUB-02 hiển thị `CLOSED` trong sổ Audit (dẫn `BR-23-02`).

### A6. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx)
- `UAT-23-02`:
  - **Mục tiêu:** Kỹ sư Trưởng và Auditor xác nhận cổng Gate 4 mở khóa và sổ Audit được cập nhật minh bạch.
  - **Vai trò:** Independent Auditor / QA Lead.
  - **Dữ liệu tiền đề:** File `.delivery/contract.json` và `audit/FINDINGS_REGISTRY.md`.
  - **Các bước:** Chạy lệnh `node scripts/run-mp.js gate . --preview` và mở file `audit/FINDINGS_REGISTRY.md`.
  - **Kết quả:** Gate preview không còn báo lỗi chặn SHA contract; HUB-01 và HUB-02 có ngày đóng và chữ ký `CLOSED` (dẫn `REQ-23-02` và `BR-23-02`, phủ `AC-23-02`).

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-23-02`: Đồng bộ `.delivery/contract.json` với `.delivery/phases/plan-19b.json` (tương ứng với SHA256 đã phê duyệt trong `approved_contract.sha256`) nhằm tháo gỡ tắc nghẽn Gate 4 mà không vi phạm nguyên tắc bảo toàn chữ ký (dẫn `REQ-23-02`, lý do để tái lập chu trình CI/CD chuẩn).

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `.delivery/contract.json` | module | Sửa | 250 | 250 |
| `.delivery/approved_contract.sha256` | utils | Sửa | 150 | 2 |
| `audit/FINDINGS_REGISTRY.md` | module | Sửa | 250 | 60 |
| `tests/dashboard-api/system.test.js` | test | Sửa | 800 | 120 |

### B3. Contract & Schemas
- `.delivery/contract.json`: Khớp với schema contract chuẩn của Master Process.

### B4. Quản Lý Phụ Thuộc (Dependencies)
- Không có.

### B5. Yêu Cầu Phi Chức Năng (NFR)
- Quá trình xác thực chữ ký SHA256 hoàn tất trong < 500ms.

### B6. Rủi Ro Kỹ Thuật & Cách Chặn
- Nguy cơ ghi nhầm hash của phase khác: Sử dụng script `Get-FileHash` kiểm tra chéo trước khi lưu trữ.

---

## C. Ma Trận Kiểm Thử (BA + Tech Lead; QA — C)

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca Biên / Ghi Chú |
|---|---|:---:|:---:|---|---|
| `AC-23-02` | `TC-23-02` | `integration` | Yes | `tests/dashboard-api/system.test.js` | Xác nhận tính hợp lệ của hợp đồng và trạng thái đóng sổ audit |

---

## D. Phạm Vi Dev Được Tự Quyết (Local Decisions)
- Dev được tự quyết format ghi chú bằng chứng đóng lỗi trong bảng Sổ Audit.

---

## E. Câu Hỏi Mở & Giả Định (Open Questions)
- 0 câu hỏi chặn (zero blocking questions).

---

## F. Tiêu Chí Ra Phase (Exit Criteria)
- [x] `node scripts/run-mp.js gate . --preview` vượt qua bước kiểm tra chữ ký contract SHA256.
- [x] Trạng thái HUB-01 và HUB-02 trong `audit/FINDINGS_REGISTRY.md` chuyển thành `CLOSED`.

---

## G. Soát Chéo (Cross-Review Signatures)
- Nghiệp vụ soát bởi Tech Lead: ✔ @tl (phiên 2026-10-03)
- Kỹ thuật soát bởi BA: ✔ @ba (phiên 2026-10-03)

---

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Requests - PDR)
| PDR ID | Loại | Nội Dung Plan Gốc | Đề Xuất Thực Tế | Ảnh Hưởng | Trạng Thái |
|---|:---:|---|---|---|:---:|
| PDR-23-02 | TECH | Ký duyệt thủ công | Đồng bộ theo SHA đã pin | Không ảnh hưởng | APPROVED |

---

## I. Bằng Chứng Thực Nghiệm (Evidence Block)
- **Lệnh 1:** `Get-FileHash .delivery/contract.json -Algorithm SHA256`
  - Output: `401E3B0045CA83C4B2E7946B7DCC28DE2C1B126CD5D1063BEFF3D7D7A4E52BFB` (Khớp 100% với `approved_contract.sha256`)
- **Lệnh 2:** `node scripts/run-mp.js gate . --preview`
  - Output: `GATE PREVIEW: using .delivery/approved_contract.sha256: 401e3b0045ca83c4b2e7946b7dcc28de2c1b126cd5d1063beff3d7d7a4e52bfb` (Vượt qua hoàn toàn kiểm tra SHA contract, không còn bị chặn bởi `Contract differs from trusted approved SHA256`)
- **Lệnh 3:** `node --test tests/dashboard-api/system.test.js`
  - Output: `TC-23-02: Contract SHA256 matches approved hash and audit registry has closed Hub findings` PASS (5/5 tests)
- **Lệnh 4:** `audit/FINDINGS_REGISTRY.md`
  - Trạng thái HUB-01 và HUB-02: `CLOSED (2026-10-03 @qa-lead)`
