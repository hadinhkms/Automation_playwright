# Native Android Testing (APK) — Appium + WebdriverIO

Playwright chỉ test web. Test **app native Android (.apk)** dùng **WebdriverIO 9 + Appium 2 (UiAutomator2)**, chạy tách biệt khỏi các project Playwright.

## 1. Yêu cầu máy

| Thành phần | Kiểm tra |
|---|---|
| Android SDK + `adb` | `adb version`, biến `ANDROID_HOME` |
| JDK 11+ | `java -version`, biến `JAVA_HOME` |
| Appium 2 (global) | `appium -v` (cài: `npm i -g appium`) |
| Driver UiAutomator2 | `appium driver list --installed` (cài: `appium driver install uiautomator2`) |
| Dependencies repo | `npm install` |

Kiểm tra tổng thể: `npm run android:doctor`.

## 2. Kết nối máy thật

1. Settings → About phone → chạm 7 lần **Build number** để mở Developer options.
2. Developer options → bật **USB debugging** (Xiaomi: thêm **USB debugging (Security settings)** và **Install via USB**).
3. Cắm cáp USB có truyền dữ liệu → trên điện thoại chọn **Always allow** → **Allow**.
4. `npm run android:devices` phải hiện `<serial>  device`. `unauthorized` = chưa bấm Allow.
5. **OPPO / Realme (ColorOS)**: Developer options → bật **Disable permission monitoring** và **Install via USB** (có thể phải đăng nhập tài khoản OPPO). Lần chạy đầu, Appium cài các app phụ `io.appium.settings` và `io.appium.uiautomator2.server`: mở khóa màn hình và bấm **Install / Cài đặt** khi điện thoại hỏi. Nếu không bấm, test sẽ treo rồi báo `adbExec ... timed out`.
6. Nên bật **Stay awake**, tắt khóa màn hình, tắt 3 mục animation scale.

Không dây (Android 11+): Developer options → Wireless debugging → `adb pair <ip>:<port>` rồi `adb connect <ip>:<port>`.

## 3. Cấu hình `.env`

```env
ANDROID_APP_PATH=apps/my-app.apk   # đặt APK trong apps/ (đã gitignore)
ANDROID_UDID=                      # serial từ adb devices; bỏ trống nếu chỉ 1 máy
```

App đã cài sẵn: bỏ `ANDROID_APP_PATH`, đặt `ANDROID_APP_PACKAGE` (+ `ANDROID_APP_ACTIVITY`).
Lấy package/activity của app đang mở: `adb shell dumpsys window | findstr mCurrentFocus`.

## 4. Chạy test

```powershell
npm run test:android          # toàn bộ tests/native/android/**/*.native.js
npm run test:android:smoke    # chỉ test gắn @smoke
```

Test tự khởi động Appium ở `127.0.0.1:4723`. Muốn tự chạy `appium` ở terminal khác thì đặt `APPIUM_EXTERNAL=true`.

- Ảnh bằng chứng / ảnh lỗi: `evidence/native/android/`
- Log Appium: `test-results/appium/`
- JUnit (một file mỗi lượt chạy): `test-results/native/android/junit-<runId>.xml`. Test ID ổn định dạng `classname.name`, ví dụ `native.android.@android_@smoke_App_launch.TC-AND-001 - ...`. Muốn ghi ra một đường dẫn cố định (receipt Gate 4) thì đặt `MOBILE_JUNIT_FILE=test-results/gate/android.xml`.

### Chạy trên Dashboard

Tiện ích → **Mobile App**: chọn thiết bị, app (file APK trong `apps/` hoặc app đã cài), file test, tag rồi bấm **Chạy test**.

- **Tải build lên**: kéo thả hoặc chọn file `.apk` (tối đa 300 MB). Tên file được làm sạch còn `[A-Za-z0-9._-]`. Trùng tên thì Dashboard hỏi trước khi ghi đè. Không ghi đè hay xoá được build đang được lượt chạy dùng.
- Có Android build-tools (`aapt2`) thì Dashboard hiện package và version của APK.
- **Báo cáo → Mobile**: 30 lượt chạy gần nhất (lưu ở `test-results/mobile-runs/index.json`, còn sau khi khởi động lại), kết quả từng test, ảnh bằng chứng, tải file JUnit.
- **Test Suites → nền tảng "Android native"**: suite giữ danh sách file test và một tag. Bấm **Chạy** sẽ mở Mobile App và chạy đúng các file đó với thiết bị/app đang chọn.

## 5. Cấu trúc

| File | Vai trò |
|---|---|
| `wdio.android.conf.js` | Config WDIO (runner, Appium service, hook chụp ảnh khi fail) |
| `core/native/androidCapabilities.js` | Đọc `.env` → capabilities UiAutomator2 |
| `pages/native/NativeBasePage.js` | Base Page Object: `byId`, `byText`, `byAccessibilityId`, `tap`, `type`, `capture` |
| `pages/native/android/*.js` | Page Object từng màn hình (kế thừa `NativeBasePage`) |
| `tests/native/android/*.native.js` | Test Mocha (`describe`/`it`), đặt TC-ID trong tên test |

## 6. Viết test mới

- Tìm locator bằng **Appium Inspector** (kết nối `127.0.0.1:4723`, cùng capabilities) hoặc `adb shell uiautomator dump`.
- Ưu tiên: `resource-id` → `content-desc` (accessibility id) → text. Tránh XPath tuyệt đối.
- Không dùng `driver.pause()` để chờ; dùng `waitForDisplayed` / `driver.waitUntil`.
- Tạo Page Object cho mỗi màn hình trong `pages/native/android/`, spec chỉ gọi method của Page Object.

## 7. Giới hạn

- iOS native (`.ipa`) cần macOS + Xcode — chưa hỗ trợ trên Windows.
- Test native **không** chạy qua `npx playwright test`. Suite Android native không xuất hiện ở tab Chạy test và không gộp được vào Suite Cha (cả hai chạy Playwright).
