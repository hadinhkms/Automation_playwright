# Regression Hotspots & Flaky Tests

> [!WARNING]
> Các khu vực trong mã nguồn thường xuyên xảy ra lỗi hồi quy (regression) hoặc có test không ổn định (flaky).

## 1. Điểm Nóng Hồi Quy (Regression Hotspots)
- **Module Form Dynamic:** Thường xuyên lỗi khi validate conditional fields.
- **Module Phân Quyền (Permissions):** Dễ sót quyền khi thêm endpoint hoặc menu mới.

## 2. Kiểm Thử Không Ổn Định (Flaky Test Log)
| Test Name | File | Nguyên nhân nghi ngờ | Cách khắc phục tạm thời / Triệt để |
|---|---|---|---|
| Example Flaky Test | `tests/e2e/order.spec.ts` | Chờ animation hoặc API chậm | Dùng `waitForResponse` thay vì `waitForTimeout` |
