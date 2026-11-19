# Native iOS Testing — Appium + XCUITest trên máy Mac từ xa

Appium cho iOS chỉ chạy được trên macOS (cần Xcode). Dashboard và test chạy trên máy Windows của bạn, còn **Appium chạy trên một máy Mac trong cùng mạng**; `wdio.ios.conf.js` gửi lệnh tới Mac qua HTTP, không tự khởi động Appium.

```text
Windows: Dashboard / npm run test:ios ──HTTP──► Mac: Appium 2 + XCUITest ──► Simulator hoặc iPhone
```

Spec và Screen **dùng chung với Android** (xem [ANDROID_NATIVE_TESTING.md](ANDROID_NATIVE_TESTING.md) §5–6): spec trong `tests/native/shared/` chạy trên cả hai, `tests/native/ios/` chỉ dành cho những gì riêng iOS.

## 1. Checklist cài máy Mac (làm một lần)

| # | Việc | Lệnh / cách kiểm tra |
|:---:|---|---|
| 1 | macOS 14+ và **Xcode** bản mới (App Store), mở Xcode một lần để cài thêm thành phần | `xcodebuild -version` |
| 2 | Chọn Xcode cho dòng lệnh | `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` rồi `xcode-select -p` |
| 3 | Có ít nhất một simulator (Xcode → Settings → Platforms → iOS) | `xcrun simctl list devices available` |
| 4 | **Node.js 20+** | `node -v` |
| 5 | **Appium 2** | `npm install -g appium` rồi `appium -v` |
| 6 | **Driver XCUITest** | `appium driver install xcuitest` rồi `appium driver list --installed` |
| 7 | Kiểm tra môi trường | `appium driver doctor xcuitest` (sửa hết mục bắt buộc) |
| 8 | Chạy Appium **mở cho mạng LAN** | `appium --address 0.0.0.0 --port 4723` (giữ cửa sổ này mở) |
| 9 | Mở cổng: System Settings → Network → Firewall → cho phép `node` nhận kết nối | Từ Windows: `curl http://<ip-mac>:4723/status` trả JSON có `"ready":true` |
| 10 | Lấy IP của Mac | `ipconfig getifaddr en0` |

Chỉ khi chạy trên **iPhone thật** (simulator không cần):

| # | Việc | Ghi chú |
|:---:|---|---|
| 11 | Cắm iPhone, bật **Developer Mode** (Settings → Privacy & Security), tin cậy máy Mac | `xcrun xctrace list devices` thấy máy và UDID |
| 12 | Có **Team ID** Apple Developer (10 ký tự) | developer.apple.com → Membership |
| 13 | Ký WebDriverAgent bằng Team ID, đặt **bundle id WDA** riêng, ví dụ `com.tencongty.WebDriverAgentRunner` | Lần đầu Appium build WDA mất vài phút; nếu lỗi ký, mở `~/.appium/node_modules/appium-xcuitest-driver/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj` và chọn Team |
| 14 | Trên iPhone: Settings → General → VPN & Device Management → tin cậy chứng chỉ developer | Chỉ cần lần đầu |

Dashboard **không** cần và **không** lưu mật khẩu Apple ID; chỉ dùng Team ID + bundle id WDA.

## 2. Cấu hình trên Dashboard

Cấu hình hệ thống → **Mobile / iOS**:

1. **Địa chỉ Mac**: `http://<ip-mac>` (chỉ nhận `http(s)://tên-máy-hoặc-IP[:cổng]`, không đường dẫn), **Cổng** `4723`.
2. **Kiểm tra kết nối**: Dashboard gọi `GET /status` trên Mac (tối đa 5 giây) và báo phiên bản Appium, driver XCUITest có hay chưa, thời gian phản hồi.
3. **Thiết bị iOS**: thêm simulator (tên + phiên bản đúng như `xcrun simctl list devices available`, ví dụ `iPhone 15` / `17.5`) hoặc iPhone thật (bỏ chọn Simulator, nhập UDID).
4. **App mặc định** (tuỳ chọn), **Team ID** và **bundle id WDA** (chỉ iPhone thật).
5. **Lưu cấu hình iOS** → ghi vào `.env` (các khoá `IOS_*`, xem `.env.example` mục 7). Chỉ các dòng `IOS_*` bị sửa; dòng khác giữ nguyên.

## 3. Chạy test

### Trên Dashboard

Tiện ích → **Mobile App** → nút **iOS**:

- Khung 1: Mac host đang dùng, thiết bị đã khai báo, 4 mục kiểm tra (Mac host, Appium, XCUITest, thiết bị). Nút **Chạy test** bị khoá cho tới khi Mac phản hồi, và ghi rõ lý do.
- Khung 2: chọn **Hồ sơ app** hoặc nguồn app:
  - **Bundle id đã cài** — app có sẵn trên thiết bị (ví dụ `com.apple.Preferences` trên simulator, dùng cho smoke đầu tiên);
  - **Đường dẫn trên Mac** — `/Users/qa/Builds/MyApp.app` (simulator) hoặc `.ipa` (iPhone thật);
  - **URL tải về** — Appium trên Mac tự tải.
- **Tải build lên** nhận `.ipa` / `.app.zip`, nhưng chỉ để **lưu trữ** trong `apps/` của máy Windows: Appium trên Mac không đọc được file này. Hãy chép file sang Mac (AirDrop, thư mục chia sẻ, `scp`) rồi dùng "Đường dẫn trên Mac", hoặc đưa lên một URL.
- Kết quả, ảnh (`evidence/native/ios/<runId>/`), JUnit (`test-results/native/ios/junit-<runId>.xml`, test ID `native.ios.<describe>.<it>`) và lịch sử ở **Báo cáo → App native** dùng chung với Android.
- Đổi cấu hình khi đang chạy không ảnh hưởng lượt đang chạy.

### Từ dòng lệnh

```powershell
npm run test:ios
```

```powershell
npm run test:ios:smoke
```

Dùng các khoá trong `.env`: `IOS_APPIUM_HOST`, `IOS_APPIUM_PORT`, `IOS_DEVICES` (lấy thiết bị đầu tiên, hoặc đặt `IOS_DEVICE_NAME` + `IOS_PLATFORM_VERSION` + `IOS_UDID` + `IOS_SIMULATOR=false`), `IOS_APP` hoặc `IOS_BUNDLE_ID`, `IOS_XCODE_ORG_ID`, `IOS_WDA_BUNDLE_ID`.

## 4. Smoke đầu tiên khi có máy Mac (UAT-301)

1. Làm xong checklist §1 bước 1–10, Appium đang chạy.
2. Dashboard → Cấu hình → Mobile / iOS: nhập `http://<ip-mac>`, bấm **Kiểm tra kết nối** → "Kết nối được", Appium 2.x, Driver XCUITest: có. Khai báo simulator. **Lưu**.
3. Mobile App → iOS → Hồ sơ app **Settings (iOS, có sẵn trên simulator)** → tag `@smoke` → **Chạy test**. Lần đầu chờ vài phút để Mac build WebDriverAgent.
4. Mong đợi: `TC-101..103` Đạt, có ảnh `TC-101_app_launch_foreground_*.png`, lượt chạy hiện ở Báo cáo → App native.
5. Ghi kết quả vào `_Plan_implement/mobile-app-studio/phase-3-ios-remote-mac.md` §I (AC-305, UAT-301).

## 5. Lỗi thường gặp

| Dashboard báo | Nguyên nhân và cách sửa |
|---|---|
| "từ chối kết nối" | Appium chưa chạy, sai cổng, hoặc chạy với `--address 127.0.0.1`. Chạy lại `appium --address 0.0.0.0 --port 4723`. |
| "không phản hồi trong 5 giây" | Mac tắt/ngủ, khác mạng, tường lửa chặn cổng. |
| "Không tìm thấy máy" | Tên máy không phân giải được trên Windows; dùng IP. |
| "trả HTTP 404 cho /status" | Appium 1 hoặc đang chạy với `--base-path /wd/hub`. Dùng Appium 2 không base path. |
| "chưa có driver XCUITest" | `appium driver install xcuitest`, khởi động lại Appium. |
| Lượt chạy lỗi "Failed to create a session" | Tên/phiên bản simulator không khớp `xcrun simctl list`; app path không tồn tại trên Mac; iPhone thật chưa ký WDA (§1 bước 11–14). Xem log Appium trên Mac. |

## 6. Giới hạn

- Không đẩy file từ Windows sang Mac (SSH), không dò thiết bị tự động trên Mac, không dùng device farm (BrowserStack…).
- Một lượt chạy một thiết bị; khoá chạy dùng chung với Android và Playwright.
