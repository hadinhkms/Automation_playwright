---
id: REQ-012
title: Xác thực OTP qua Zalo (mặc định) và SMS khi đăng nhập/đăng ký bằng số điện thoại
status: Confirmed
version: 1.0
risk: high
owner: QA
test_cases: test-cases/REQ-012-xac-thuc-otp-qua-zalo.md
---

# REQ-012 — Xác thực OTP qua Zalo (mặc định) và SMS

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-012 |
| Phiên bản | 1.0 |
| Vai trò | Khách vãng lai (chưa đăng nhập) |
| Nền tảng | Desktop web, Mobile web |
| Nguồn | Jira JS-8873 (FE), JS-8857 (BE); Figma `76BkywsGo7UnAJkOzUQEPu` page "Zalo OTP"; báo cáo QA `evidence/JS-8873/REPORT_JS-8873_JS-8857_2026-11-02.md` |
| Trạng thái tổng thể | Confirmed — kiểm thủ công 2026-11-02 → 2026-11-05; regression chạy trên QC (QC đã bật Zalo OTP) |

## Bối cảnh nghiệp vụ

Khi nhập số điện thoại ở popup "Đăng nhập hoặc Đăng ký", OTP mặc định được gửi qua Zalo (CTA chính
"Nhận OTP qua Zalo"). SMS là phương thức phụ, nằm trong mục "Phương thức khác" (thu gọn mặc định).
Tính năng được bật/tắt bằng biến build `NEXT_PUBLIC_ZALO_OTP_ENABLED` (kill switch): khi tắt, popup
quay về nút "Tiếp tục" gửi OTP qua SMS như trước.

Contract BE mà FE dùng:
- Request OTP: `GET /<nonce>?phone=..&platform=web|mobile&m=s[&channel=zalo]` (same-origin, header `X-Nonce`).
  Thành công `1|seconds|request_id|expiredAt`; lỗi `0|CODE|message|reason|duration|seconds|expiredAt`.
- Verify Zalo: `POST /fe/api/v1/guest/auth/zalo/verify-otp-and-list-accounts` body `{phone, code, request_id}`.
- Verify SMS: `POST /fe/api/v1/guest/auth/list-account-by-phone`.

## Acceptance criteria

### AC-050 — Zalo là kênh OTP mặc định và xác thực thành công

**Given** tôi là khách vãng lai đã mở popup "Đăng nhập hoặc Đăng ký" và build đang bật Zalo OTP
**Then** nút "Nhận OTP qua Zalo" là CTA chính, "Phương thức khác" đang thu gọn và nút SMS bị ẩn
**When** tôi nhập số điện thoại hợp lệ và bấm "Nhận OTP qua Zalo"
**Then** màn "Xác thực OTP" hiển thị "Zalo số <SĐT>" và đồng hồ "Mã OTP hết hiệu lực trong"
**When** tôi nhập đủ 4 số OTP
**Then** FE gọi verify Zalo với đúng `phone`, `code`, `request_id` BE trả về
**And** với SĐT chưa có tài khoản, form "Tạo tài khoản mới" xuất hiện với SĐT điền sẵn

- Trạng thái: Confirmed (Flow 02/04 checklist JS-8873, happy case Zalo thật tới SĐT QA 2026-11-04).
- Ràng buộc automation: số ngẫu nhiên không có Zalo và QC không có mã Zalo cố định → automation mock
  request OTP + verify kênh Zalo theo contract trên (`core/utils/zaloOtpMock.js`); mọi API khác là BE thật.
- Khi build tắt Zalo (kill switch), test case tự skip; luồng SMS do AC-051 phủ.

### AC-051 — Đăng ký bằng SĐT với OTP qua SMS (phương thức phụ / kill switch)

**Given** tôi là khách vãng lai đã mở popup "Đăng nhập hoặc Đăng ký"
**When** tôi nhập số điện thoại mới và yêu cầu OTP qua SMS — mở "Phương thức khác" → "Nhận OTP qua SMS"
khi Zalo OTP bật, hoặc bấm "Tiếp tục" khi Zalo OTP tắt
**Then** màn nhập OTP xuất hiện
**When** tôi nhập OTP cố định của môi trường test (1111)
**Then** form "Tạo tài khoản mới" xuất hiện
**And** khi tôi điền họ tên, email và bấm Hoàn tất rồi Đồng ý Consent thì nội dung trang chủ được tải

- Trạng thái: Confirmed — BE thật; mã 1111 chỉ áp dụng kênh SMS trên môi trường test (REQ-001 Open question 4).
- Nguồn: Flow 05/13/24 checklist JS-8873.

## Ngoài phạm vi automation regression

Các nhánh lỗi (#1–#8: không có Zalo, ZBS hết số dư, lỗi kỹ thuật, hết hạn, nhập sai, quá 5 lần/ngày, OTP còn
hiệu lực), Lead Form SMS và kiểm tra API đã kiểm thủ công / JMeter — xem báo cáo QA ở mục Nguồn.

## Open questions

1. Khi QC bật Zalo OTP, các luồng cũ dùng nút "Tiếp tục" cho SĐT (TC-003/004/033/039/040, `ChopChatbotPage`,
   `JobApplyNoCVPage`) cần chuyển sang `LoginPopup.requestSmsOtp()` — chưa chốt phạm vi sửa.
