# Regression Hotspots & Flaky Tests

> [!WARNING]
> Các khu vực trong mã nguồn thường xuyên xảy ra lỗi hồi quy (regression) hoặc có test không ổn định (flaky).

## 1. Điểm Nóng Hồi Quy (Regression Hotspots)
- **Module Form Dynamic:** Thường xuyên lỗi khi validate conditional fields.
- **Module Tích Hợp Master Process & Dashboard APIs:** Dễ sót Mutex ở direct mutation endpoints; dễ sót khởi tạo hook/lock trên vệ tinh phụ; nhầm exit code 1 của công cụ chẩn đoán thành HTTP 400 Bad Request; thiếu test click thực tế cho toàn bộ API của tính năng mới.

## 2. Kiểm Thử Không Ổn Định (Flaky Test Log)
| Test Name | File | Nguyên nhân nghi ngờ | Cách khắc phục tạm thời / Triệt để |
|---|---|---|---|
| Example Flaky Test | `tests/e2e/order.spec.ts` | Chờ animation hoặc API chậm | Dùng `waitForResponse` thay vì `waitForTimeout` |
