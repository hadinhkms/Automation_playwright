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
npm run test:android          # tests/native/shared/** + tests/native/android/**
npm run test:android:smoke    # chỉ test gắn @smoke
```

Test tự khởi động Appium ở `127.0.0.1:4723`. Muốn tự chạy `appium` ở terminal khác thì đặt `APPIUM_EXTERNAL=true`.

- Ảnh bằng chứng / ảnh lỗi: `evidence/native/android/<runId>/<TC>_<màn hình>_<bước>.png` (mỗi lượt một thư mục; chạy CLI thì `runId` dạng `cli-xxxx`)
- Log Appium: `test-results/appium/`
- JUnit (một file mỗi lượt chạy): `test-results/native/android/junit-<runId>.xml`. Test ID ổn định dạng `classname.name`, ví dụ `native.android.App_launch_-_Smoke_@native_@app-launch_@REQ-101.TC-101 - App opens in the foreground @smoke`. Muốn ghi ra một đường dẫn cố định (receipt Gate 4) thì đặt `MOBILE_JUNIT_FILE=test-results/gate/android.xml`.

### Chạy trên Dashboard

Tiện ích → **Mobile App**: chọn thiết bị, app (hồ sơ app, file APK trong `apps/` hoặc app đã cài), file test, tag rồi bấm **Chạy test**. Badge cạnh mỗi file: `A+iOS` (dùng chung), `A` (chỉ Android), `iOS` (chỉ iOS).

- **Tải build lên**: kéo thả hoặc chọn file `.apk` (tối đa 300 MB). Tên file được làm sạch còn `[A-Za-z0-9._-]`. Trùng tên thì Dashboard hỏi trước khi ghi đè. Không ghi đè hay xoá được build đang được lượt chạy dùng.
- Có Android build-tools (`aapt2`) thì Dashboard hiện package và version của APK.
- **Hồ sơ app** (`core/native/app-profiles.json`): tên app, package/activity Android, bundle id/đường dẫn iOS; chọn một hồ sơ để điền sẵn form. Khi `apps/` chưa có APK, Dashboard tự chọn "App đã cài trên máy".
- **Báo cáo → App native**: 30 lượt chạy gần nhất (lưu ở `test-results/mobile-runs/index.json`, còn sau khi khởi động lại), kết quả từng test, ảnh bằng chứng, tải file JUnit.
- **Test Suites → nền tảng "Android native"**: suite giữ danh sách file test và một tag. Bấm **Chạy** sẽ mở Mobile App và chạy đúng các file đó với thiết bị/app đang chọn.

## 5. Cấu trúc (dùng chung Android và iOS)

Một luồng nghiệp vụ có **một** spec; nền tảng khác nhau ở locator, không ở logic.

| File | Vai trò |
|---|---|
| `wdio.android.conf.js` | Config WDIO Android (runner, Appium service) |
| `wdio.ios.conf.js` | Config WDIO iOS, nối Appium trên Mac — xem [IOS_NATIVE_TESTING.md](IOS_NATIVE_TESTING.md) |
| `core/native/wdioShared.js` | Phần config chung: thư mục spec, JUnit một file mỗi lượt, ảnh khi lỗi |
| `core/native/androidCapabilities.js`, `iosCapabilities.js` | Đọc `.env` → capabilities UiAutomator2 / XCUITest |
| `core/native/locators.js` | Dịch locator có tiền tố (`id:`, `~`, `text:`, `uia:`, `pred:`, `chain:`, `xpath:`) theo nền tảng |
| `core/native/app-profiles.json` | Hồ sơ app dùng chung cho team |
| `pages/native/NativeBasePage.js` | Base: `el(name)`, `byId`, `byText`, `tap`, `type`, `currentAppId`, `capture` |
| `pages/native/screens/*Screen.js` | Một class cho mỗi màn hình, `static locators = { ten: { android, ios } }` |
| `tests/native/shared/<khu-vực>/*.native.js` | Spec chạy trên **cả hai** nền tảng (mặc định viết ở đây) |
| `tests/native/android/`, `tests/native/ios/` | Chỉ những gì riêng một nền tảng (nút Back cứng, quyền runtime…) |
| `requirements/REQ-1xx-*.md`, `test-cases/REQ-1xx-*.md` | Yêu cầu và TC của app native (dải số `1xx`), cột "Nền tảng" |

## 6. Viết test mới

- Tìm locator bằng **Inspector trên Dashboard** (Mobile App → chế độ **Inspector**, dùng thiết bị và app đang chọn ở chế độ Chạy test):
  1. **Bắt đầu** → ảnh màn hình + cây phần tử (Dashboard tự bật Appium cổng 4723 nếu chưa chạy và tắt khi đóng phiên).
  2. Bấm lên ảnh hoặc một dòng trong cây → bảng thuộc tính + gợi ý locator theo thứ tự `id:` → `~` → `uia:` → `text:` → `xpath:`, mỗi gợi ý có **số phần tử khớp** (1 = tốt). XPath luôn ở cuối; khi chỉ còn XPath, Dashboard cảnh báo.
  3. **Chạm** / **Nhập** / **Back** / **Làm mới** để đi tới màn khác. Chỉ thao tác chỉ đọc trên app thật.
  4. **Thêm vào Screen** (tên camelCase + loại hàm: chạm, nhập chữ, đọc chữ, kiểm tra hiển thị) → **Ghi vào** Screen mới hoặc Screen có sẵn (chỉ ghi ô của nền tảng đang mở, ô kia giữ nguyên) → **Xem trước** (sửa được trong editor) → **Lưu nháp** (`.dashboard-drafts/pages/native/screens/`) hoặc **Tạo** (`pages/native/screens/`).
  - Phiên tự đóng khi rời view, tải lại trang, sau 10 phút không thao tác, hoặc khi tắt Dashboard. Khi Inspector mở, không chạy được test (và ngược lại).
  - Ngoài Dashboard: **Appium Inspector** (kết nối `127.0.0.1:4723`) hoặc `adb shell uiautomator dump`.
- Ưu tiên: `resource-id` → `content-desc` (accessibility id) → text. Tránh XPath tuyệt đối.
- Không dùng `driver.pause()` để chờ; dùng `waitForDisplayed` / `driver.waitUntil`.
- Thêm locator vào `static locators` của Screen, cả hai cột Android và iOS; chưa biết iOS thì để `null` (chạy iOS sẽ báo rõ "has no ios locator yet"). Spec chỉ gọi method của Screen, gọi phần tử bằng `this.el('ten')`.
- Quy ước tên: `describe('<Khu vực> - <Luồng> @native @<khu-vực> @REQ-1xx')`, `it('TC-1xx - <mô tả> @smoke')`. Tag mức chạy (`@smoke`, `@regression`) đặt ở `it`, không ở `describe`. Không cần `@android`/`@ios`: thư mục đã cho biết nền tảng. Test trong `shared/` chỉ chạy được một bên thì gắn `@android-only` / `@ios-only`.
- Ví dụ: [tests/native/shared/app-launch/app-launch.native.js](../tests/native/shared/app-launch/app-launch.native.js) + [pages/native/screens/AppLaunchScreen.js](../pages/native/screens/AppLaunchScreen.js), truy vết ở [test-cases/REQ-101-app-launch.md](../test-cases/REQ-101-app-launch.md).
- Ví dụ Screen lấy bằng Inspector: [pages/native/screens/JobListScreen.js](../pages/native/screens/JobListScreen.js) + [tests/native/shared/job-list/job-list.native.js](../tests/native/shared/job-list/job-list.native.js) (app Vieclam24h.QA, chỉ đọc; app khác thì spec tự bỏ qua).
- App đã cài (`ANDROID_APP_PACKAGE`): Dashboard và config luôn đưa app lên trước (`forceAppLaunch`), kể cả khi app đang chạy nền; dữ liệu app được giữ.

## 7. Giới hạn

- iOS native cần Appium + Xcode trên máy Mac; Dashboard trên Windows chỉ điều khiển từ xa — xem [IOS_NATIVE_TESTING.md](IOS_NATIVE_TESTING.md).
- Test native **không** chạy qua `npx playwright test`. Suite Android native không xuất hiện ở tab Chạy test và không gộp được vào Suite Cha (cả hai chạy Playwright).
