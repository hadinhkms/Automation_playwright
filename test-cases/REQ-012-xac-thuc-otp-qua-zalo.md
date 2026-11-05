# Test case — REQ-012 Xác thực OTP qua Zalo (mặc định) và SMS

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-150 | AC-050 | Zalo mặc định → OTP Zalo → verify → form tạo tài khoản trên desktop | P0 | Có | tests/e2e/desktop/register_by_phone_zalo_otp-bdd.spec.js |
| TC-151 | AC-050 | Zalo mặc định → OTP Zalo → verify → form tạo tài khoản trên mobile web | P0 | Có | tests/e2e/mobile-web/register_by_phone_zalo_otp-bdd.mobile.spec.js |
| TC-152 | AC-051 | Đăng ký SĐT qua OTP SMS (Phương thức khác / Tiếp tục khi tắt Zalo) trên desktop | P0 | Có | tests/e2e/desktop/register_by_phone_zalo_otp-bdd.spec.js |
| TC-153 | AC-051 | Đăng ký SĐT qua OTP SMS (Phương thức khác / Tiếp tục khi tắt Zalo) trên mobile web | P0 | Có | tests/e2e/mobile-web/register_by_phone_zalo_otp-bdd.mobile.spec.js |

## Chi tiết

### TC-150 và TC-151 — Zalo OTP mặc định

- **Precondition**: chưa đăng nhập; build bật Zalo OTP (nếu tắt → test tự skip với lý do kill switch).
- **Dữ liệu**: SĐT di động ngẫu nhiên; BE Zalo mock (`mockZaloOtpBackend`): request OTP trả
  `1|120|<request_id>|<expiredAt>`, verify trả `{code:200, data:{phone, token, list:[]}}`.
- **Các bước**: mở popup từ header → kiểm CTA Zalo mặc định → nhập SĐT → "Nhận OTP qua Zalo" → nhập 4 số OTP.
- **Expected result đang kiểm**:
  - "Nhận OTP qua Zalo" hiển thị + enabled; "Phương thức khác" `aria-expanded=false`; nút SMS ẩn — Có assertion.
  - Đúng 1 request OTP với `phone`, `channel=zalo`, `platform=web` (desktop) / `mobile` (mobile web) — Có assertion.
  - Màn OTP hiển thị "Zalo … <SĐT>" và "Mã OTP hết hiệu lực trong" — Có assertion.
  - Verify gọi đúng 1 lần với `{phone, code, request_id}` khớp request_id BE trả — Có assertion.
  - Form "Tạo tài khoản mới" với SĐT điền sẵn — Có assertion.
- **Giới hạn**: không bấm Hoàn tất vì token là mock; hoàn tất đăng ký thật do TC-152/110 phủ.

### TC-152 và TC-153 — OTP qua SMS, đăng ký end-to-end

- **Precondition**: chưa đăng nhập; BE thật.
- **Dữ liệu**: SĐT + email ngẫu nhiên; OTP cố định 1111.
- **Các bước**: mở popup → nhập SĐT → `requestSmsOtp()` ("Phương thức khác" → "Nhận OTP qua SMS", hoặc "Tiếp tục"
  khi Zalo tắt; nhánh thực tế ghi vào annotation "SMS entry") → nhập 1111 → điền họ tên, email → Hoàn tất → Đồng ý Consent.
- **Expected result đang kiểm**: màn OTP, form "Tạo tài khoản mới", nút Hoàn tất, nội dung trang chủ tải sau Consent — Có assertion.

## Lần chạy xác nhận (2026-11-05)

| Môi trường (chạy regression trên QC) | Desktop (TC-150, TC-152) | Mobile Chrome (TC-151, TC-153) |
|---|---|---|
| QC (Zalo OTP đã bật) | PASS / PASS (nhánh SMS qua "Phương thức khác") | PASS / PASS |
