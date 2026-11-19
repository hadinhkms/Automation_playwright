# Đánh giá UI/UX — Tổ chức script automation app native trên Dashboard

> **Plan:** `PLAN-25-mobile-app-studio` · **Ngày:** 2026-11-19 · **Baseline:** `525c0e0` (P1 xong, P2 đang làm)
> **Vai:** end user, một QA Engineer viết và chạy test app hằng ngày. Có tham chiếu skill `qa-ui-review` (bản cục bộ `.agents/skills/`).
> **Phạm vi:** cách sắp xếp test, Page Object, tag, liên kết TC ↔ script ↔ kết quả cho Android (nay) và iOS (P3), và các thay đổi UI Dashboard đi kèm. Báo cáo chỉ đọc code, không sửa file nào khác.

---

## 1. Cách đánh giá

| Việc đã làm | Bằng chứng |
|---|---|
| Đọc cấu trúc native | `tests/native/android/app-launch.native.js`, `pages/native/{NativeBasePage.js, android/AppLaunchPage.js}`, `core/native/androidCapabilities.js`, `wdio.android.conf.js`, `docs/ANDROID_NATIVE_TESTING.md` |
| So với cách tổ chức web | `tests/e2e/{desktop,mobile-web}/`, `pages/{desktop,mobile}/`, `core/fixtures/`, `requirements/REQ-001…`, `test-cases/REQ-001…` |
| Đọc code các view | Mobile App (`views/mobile/*`, `templates/mobile.html`, `services/mobileSpecService.js`); Quản lý Page, Kịch bản BDD, Test Suites, Báo cáo, Chạy test, QA (phần lớn logic ở `dashboard/public/app.js`) |
| Đọc plan | `plan-25-overview.md`, `phase-1..4-*.md` |
| Thao tác thật | `DASHBOARD_PORT=4198 node dashboard/server.js`, viewport 1440×900 và 390×844. Mobile App: chọn "App đã cài", nhập `com.coloros.calculator` / `com.android.calculator2.Calculator`, chọn `@smoke`, bấm Chạy trên máy thật CPH2481 (Android 15). Kết quả **3/3 Đạt, khoảng 35 giây**, có 1 ảnh bằng chứng. Ở 390px không bị cuộn ngang. Console chỉ có 404 do chính người đánh giá gọi thử API sai đường dẫn. Mở thêm Quản lý Page và Test Suites để xem file native hiện ra thế nào. |

---

## 2. Hiện trạng

### 2.1 Cấu trúc file

```text
tests/native/android/app-launch.native.js   ← Mocha; tag ghi ở describe: '@android @smoke App launch'
                                               test ID dạng TC-AND-001..003
pages/native/NativeBasePage.js              ← byId / byAccessibilityId / byText / tap / type / capture
pages/native/android/AppLaunchPage.js       ← locator viết thẳng trong method, không có field this.x
core/native/androidCapabilities.js          ← đọc .env → capabilities
wdio.android.conf.js                        ← specs: tests/native/android/**/*.native.js
evidence/native/android/<screen>_<step>_<timestamp>.png  ← một thư mục phẳng, mọi lượt chạy dồn chung
```

Bên web, mỗi thứ có chỗ riêng:
- spec ở `tests/e2e/<platform>/` và gắn `@REQ-001 @smoke @desktop`;
- test ID dạng `TC-001 - AC-001: …`;
- `test-cases/REQ-001-*.md` có cột "File Kịch Bản";
- màn QA đếm số TC đã automation bằng regex `TC-\d{3}`.

### 2.2 Dashboard nhìn thấy script native thế nào

| View | Thấy gì |
|---|---|
| **Mobile App** | Danh sách file `*.native.js` (tên file, số test, tag gom từ mọi tiêu đề), lọc theo **một** tag, chạy và dừng. Kết quả hiện tiêu đề test kèm Đạt/Lỗi. Ảnh bằng chứng hiện thành lưới thumbnail không có nhãn, kèm log thô. Không mở được file test. |
| **Quản lý Page** | `AppLaunchPage` và `NativeBasePage` hiện dưới nhãn **Desktop** và báo **0 Locators**. Lý do: bộ đoán nền tảng coi mọi thứ không thuộc `mobile/` là desktop, còn parser chỉ đọc `this.x = …`. "Tạo Page Object mới" chỉ cho `desktop` và `mobile-web`. |
| **Test Suites** | Nền tảng chỉ có `Desktop Web` và `Mobile Web`. Chữ "Mobile" ở đây nghĩa là mobile **web**. |
| **Kịch bản BDD** | Chỉ quét `tests/e2e/*`, `tests/api`, `tests/setup`, nên không thấy spec native. |
| **Báo cáo** | Chỉ có Playwright HTML và cây `evidence/`. Bộ lọc "mobile" ở đây cũng là mobile web. |
| **QA** | Regex `TC-\d{3}` không khớp `TC-AND-001`, nên test native không được tính là đã automation. |

---

## 3. Các điểm đau, xếp theo mức độ

| # | Mức | Điểm đau | Ảnh hưởng tới end user | Bằng chứng |
|---|:---:|---|---|---|
| D1 | **Cao** | Quản lý Page xếp Page Object native vào **Desktop** và báo **0 locator** | Người dùng tìm Page Object Android ở tab Desktop. Không xem, không sửa được locator như bên web. Họ sẽ nghĩ file bị lỗi. | Thấy trực tiếp ở `#/page-manager-view`; xem `pageRepository` (đoán nền tảng theo đường dẫn) |
| D2 | **Cao** | Chữ "Mobile" mang 3 nghĩa: `pages/mobile/` là mobile web, suite "Mobile" là mobile web, còn view "Mobile App" là native | Dễ đặt nhầm file và chọn nhầm suite. Khi P2 thêm nền tảng `android-native` vào Test Suites, sự nhầm lẫn còn tăng. | `pages/mobile/SampleMobilePage.js`; nút "MOBILE WEB" ở Test Suites; menu "Mobile App (Android / iOS)" |
| D3 | **Cao** | **P3 sẽ nhân đôi spec**: plan tạo `tests/native/ios/app-launch.native.js` và `pages/native/ios/AppLaunchPage.js` cạnh bản Android | Mỗi luồng nghiệp vụ phải viết và bảo trì 2 lần. Hai bản sẽ lệch nhau. Báo cáo cũng không so được "cùng TC, 2 nền tảng". | phase-3 §A1 mục 3, §B2 |
| D4 | **Cao** | Không có truy vết TC ↔ script ↔ kết quả cho native | Lead không trả lời được "TC nào của app đã automation, lần chạy gần nhất ra sao". Test ID `TC-AND-xxx` lệch chuẩn `TC-\d{3}`. Chưa có REQ hay test case nào cho app. | QA analyzer; `test-cases/` chỉ có REQ-001 web |
| D5 | **Trung bình** | Tag đặt ở `describe` và chỉ lọc được **một** tag | `@smoke` ở describe kéo theo cả 3 test, nên không tách được smoke với regression trong cùng file. Không kết hợp được `@smoke` với `@REQ-xxx`. | `app-launch.native.js:5`; `renderTags` chọn 1 |
| D6 | **Trung bình** | Chỉ chọn được ở mức **file**, không chạy được một test, không có "Chạy lại test lỗi" | Sửa một locator xong phải chạy lại cả file. Mỗi lượt có thêm khoảng 20 giây khởi động Appium. | `renderSpecs` chỉ có checkbox file. Danh sách tiêu đề test đã có trong catalog (`tests[]`) nhưng không được hiển thị. |
| D7 | **Trung bình** | Kết quả lỗi thiếu ngữ cảnh | Một dòng Lỗi chỉ có tiêu đề. Thông báo lỗi nằm lẫn trong log thô. Ảnh không có nhãn TC. Không có liên kết "file:dòng" hay "Page Object liên quan". | `renderResults`, `renderEvidence` |
| D8 | **Trung bình** | Bằng chứng dồn vào một thư mục phẳng theo timestamp | Sau vài chục lượt không biết ảnh nào thuộc lượt nào hay TC nào. Kế hoạch lịch sử chạy của P2 cần thư mục theo lượt. | Thư mục `evidence/native/android/` đang có các file `app_launch_foreground_<ts>.png` của nhiều lượt |
| D9 | **Trung bình** | Phải nhập lại thông tin app | Khi `apps/` trống, chế độ mặc định vẫn là "File APK" (đã chọn sẵn nhưng không dùng được). Package và activity phải gõ tay ở lần đầu; chỉ được nhớ trong `localStorage` của một trình duyệt. Chưa có "hồ sơ app" dùng chung cho team. | Thao tác thật: phải bấm thêm 1 lần và gõ 2 ô |
| D10 | **Thấp** | Nút Chạy bị đẩy xuống khi dòng lệnh xem trước xuống dòng | Khi chọn thêm tag, câu lệnh dài ra và nút Chạy dịch xuống khoảng 9px. Người đánh giá đã bấm trượt một lần. | `.mobile-command` có chiều cao thay đổi |
| D11 | **Thấp** | Chưa có quy ước cho dữ liệu test native | Không rõ đặt dữ liệu ở `data/` hay trong spec. | Không có `data/native/` |
| D12 | **Rủi ro kỹ thuật** (ngoài UX) | Khoá chạy X-02 chỉ có hiệu lực trong một tiến trình server | Hai Dashboard chạy ở hai cổng (4198 và 4199) có thể cùng khởi động Appium ở cổng 4723 trên cùng một điện thoại. | `mobileRunnerService` giữ trạng thái trong bộ nhớ |

---

## 4. Đề xuất cấu trúc thư mục và quy ước

### 4.1 Nguyên tắc
1. **Một luồng nghiệp vụ có một spec.** Spec viết một lần, chạy trên cả Android và iOS. Chỉ tách theo nền tảng khi hành vi thật sự khác nhau.
2. **Nền tảng khác nhau ở locator, không ở logic.** Mỗi màn hình có một class Screen. Locator của cả hai nền tảng đặt cạnh nhau trong cùng file đó, nên Dashboard và Inspector đọc và ghi được, và thấy ngay chỗ nào còn thiếu iOS.
3. **Dùng chung chuẩn ID với web.** TC theo dạng `TC-\d{3}`, REQ theo dạng `REQ-xxx`. Nền tảng biểu diễn bằng tag hoặc thư mục, không ghi vào ID.
4. **Đặt tên theo native, không theo "mobile".** "mobile" dành cho mobile web. Native dùng `native`, `android`, `ios`.

### 4.2 Cây thư mục mẫu

```text
tests/native/
├── shared/                                ← spec chạy trên cả 2 nền tảng (mặc định viết ở đây)
│   ├── app-launch/
│   │   └── app-launch.native.js
│   └── calculator/                        ← một thư mục cho một khu vực nghiệp vụ (= module trong REQ)
│       ├── basic-arithmetic.native.js
│       └── history.native.js
├── android/                               ← chỉ những gì chỉ Android có (nút Back cứng, intent, quyền runtime)
│   └── system/back-button.native.js
└── ios/                                   ← chỉ những gì chỉ iOS có (P3)
    └── system/swipe-back.native.js

pages/native/
├── NativeBasePage.js                      ← thêm el(name): chọn locator theo driver.isAndroid / isIOS
├── screens/                               ← một class cho mỗi màn hình, dùng chung cho 2 nền tảng
│   ├── AppLaunchScreen.js
│   └── CalculatorScreen.js
└── components/                            ← phần lặp lại giữa nhiều màn (toolbar, dialog, keyboard)
    └── PermissionDialog.js

core/native/
├── capabilities/{android.js, ios.js}      ← tách từ androidCapabilities.js (P3 thêm ios.js)
└── app-profiles.json                      ← hồ sơ app dùng chung: tên, package/activity, bundleId, đường dẫn build

data/native/<khu-vực>/*.json               ← dữ liệu test, như data/*.json bên web
requirements/REQ-1xx-<app>-<khu-vực>.md    ← dải số riêng cho app native (gợi ý REQ-1xx)
test-cases/REQ-1xx-<app>-<khu-vực>.md      ← bảng thêm cột "Nền tảng" (android | ios | both)

evidence/native/<platform>/<runId>/<TC-xxx>_<step>.png       ← mỗi lượt chạy một thư mục (P2)
test-results/native/<platform>/junit-<runId>.xml              ← đã có trong P2
```

Config: `wdio.android.conf.js` lấy spec từ `['tests/native/shared/**/*.native.js', 'tests/native/android/**/*.native.js']`. `wdio.ios.conf.js` lấy `shared` cộng `ios` tương tự.

### 4.3 Mẫu Screen dùng chung

```js
// pages/native/screens/CalculatorScreen.js
class CalculatorScreen extends NativeBasePage {
  static locators = {
    digit7: { android: 'id:com.coloros.calculator:id/digit_7', ios: '~7' },
    plus:   { android: '~plus',                                ios: '~+' },
    equals: { android: 'id:com.coloros.calculator:id/eq',       ios: '~=' },
    result: { android: 'id:com.coloros.calculator:id/result',   ios: null }, // null = chưa có, Dashboard cảnh báo
  };
  async add(a, b) { /* gọi this.tap(this.el('digit7')) … — logic viết một lần */ }
}
```

- Tiền tố locator là `id:`, `~` (accessibility id), `text:`, `uia:` (UiSelector), `pred:`/`chain:` (iOS) và `xpath:`. `NativeBasePage.el()` dịch các tiền tố này sang `byId`, `byAccessibilityId`… nên vẫn đúng BR-402 của P4.
- Dashboard đọc được `static locators` bằng parser đơn giản, giống cách đang đọc `this.x = …` bên web. Nhờ vậy Page Manager hiện được bảng 2 cột Android/iOS, và Inspector P4 chỉ cần ghi đúng ô của nền tảng đang mở.

### 4.4 Quy ước đặt tên

| Thành phần | Quy ước | Ví dụ |
|---|---|---|
| File spec | `<luồng>.native.js`, kebab-case, đặt trong thư mục khu vực | `tests/native/shared/calculator/basic-arithmetic.native.js` |
| Tiêu đề `describe` | `<Khu vực> - <Luồng> @native @<khu-vực> @REQ-1xx` | `'Calculator - Basic arithmetic @native @calculator @REQ-101'` |
| Tiêu đề `it` | `TC-1xx - <mô tả ngắn> @<mức>` (mức tag đặt ở **it**, không đặt ở describe) | `'TC-101 - Cộng hai số dương @smoke'` |
| Screen class | `<Tên>Screen` (khác `*Page` bên web, để phân biệt ngay khi tìm) | `CalculatorScreen.js` |
| Component | `<Tên>` + hậu tố loại | `PermissionDialog.js`, `BottomTabBar.js` |
| Ảnh bằng chứng | `capture('<bước>')` → `<runId>/<TC>_<bước>.png` (TC lấy từ tiêu đề `it`) | `r20261119-1824/TC-101_result.png` |
| Dữ liệu | `data/native/<khu-vực>/<luồng>.json` | `data/native/calculator/basic-arithmetic.json` |

### 4.5 Bộ tag

| Nhóm | Tag | Ghi ở đâu |
|---|---|---|
| Mức chạy | `@smoke`, `@regression`, `@sanity` | `it` |
| Truy vết | `@REQ-1xx` (TC-ID đã nằm trong tiêu đề) | `describe` |
| Khu vực | `@calculator`, `@login`… | `describe` |
| Nền tảng | **Không cần ghi tay**. Dashboard tự suy ra từ thư mục (`shared` = cả 2). Chỉ ghi `@android-only` / `@ios-only` khi một test trong file `shared` chỉ chạy được trên một bên. | `it` |
| Trạng thái | `@wip` (bị bỏ qua khi chạy suite), `@flaky` | `it` |

Lưu ý `@android` / `@ios` hiện có: vì thư mục đã cho biết nền tảng, nên bỏ hai tag này, tránh việc lọc theo `@android` lại ra cả test ở thư mục `shared`.

---

## 5. Số bước thao tác: hiện tại so với đề xuất

| Việc hay làm | Hiện tại (đếm khi thao tác thật) | Sau đề xuất |
|---|---|---|
| **Chạy smoke** | Tiện ích → Mobile App (2) + chọn "App đã cài" (1) + gõ package và activity (2) + chọn `@smoke` (1) + Chạy (1) = **7** | Mobile App (2) + preset "Smoke" có hồ sơ app đã nhớ (1) + Chạy (1) = **4** |
| **Xem vì sao lỗi** | Tìm dòng Lỗi → cuộn log thô tìm stack → đoán ảnh nào của TC nào = **không xác định**, phụ thuộc độ dài log | Bấm dòng Lỗi (1) để mở chi tiết: thông báo lỗi, ảnh của TC đó, `file:dòng`, Screen liên quan = **1** |
| **Sửa locator** | Rời view → Quản lý Page → tìm file (đang nằm ở tab Desktop, báo 0 locator) → "Chỉnh sửa mã" → tìm dòng trong textarea → sửa → lưu → quay lại Mobile App → chạy lại **cả file** = **≥ 9**, không có trợ giúp locator | Ở dòng Lỗi bấm "Sửa locator" (1) → mở Page Manager tab Native, đúng Screen, đúng ô (1) → sửa hoặc lấy từ Inspector (1) → lưu → "Chạy lại test lỗi" (1) = **4** |
| **Viết test mới** | Không làm được trên Dashboard. Phải tạo Screen và spec bằng IDE, rồi làm mới view. | P4: Inspector → "Thêm vào Screen" → **"Tạo spec từ mẫu"** (spec có sẵn describe/it theo quy ước 4.4, TC-ID gợi ý từ `test-cases/`) → mở bằng editor `/api/code` |

---

## 6. Đề xuất thay đổi UI Dashboard và phase nên làm

### 6.1 Đưa vào P2 (đang làm: rẻ nếu làm cùng lúc, đắt nếu làm sau)
| ID | Thay đổi | Giải quyết |
|---|---|---|
| U-01 | Lịch sử và JUnit dùng `runId`. Ảnh lưu vào `evidence/native/<platform>/<runId>/`. Tên ảnh lấy TC-ID từ tiêu đề `it` (truyền qua `beforeTest` của WDIO). JUnit đặt `classname` = đường dẫn spec, `name` = tiêu đề `it`. | D7, D8, giúp REQ-202/203 ổn định |
| U-02 | Danh sách test ở khung 2 hiện dạng cây **file → test**: checkbox cho từng `it`, chạy bằng `--mochaOpts.grep` khớp chính xác tiêu đề. Catalog đã có `tests[]`. | D6 |
| U-03 | Nút **"Chạy lại test lỗi"** ở khung 3 và trên mỗi lượt trong lịch sử | D6 |
| U-04 | Dòng kết quả mở ra được: thông báo lỗi (lấy từ JUnit `<failure>`), ảnh của chính TC đó, đường dẫn spec, "Mở file" (xem read-only qua `/api/code`, giống trình xem spec ở Test Suites) | D7 |
| U-05 | Test Suites đổi nhãn nền tảng thành **Desktop web / Mobile web / Android app / iOS app** (giá trị `android-native` theo plan). Báo cáo đặt tên nhóm là **"App native"**, không dùng chữ "Mobile". | D2 |
| U-06 | Khi `apps/` trống thì tự chọn "App đã cài". Lấy sẵn package và activity từ `catalog.defaults`, hoặc lần dùng gần nhất. | D9 |
| U-07 | Cho khối xem lệnh một chiều cao cố định (`min-height` 3 dòng hoặc cuộn ngang) để nút Chạy không dịch chuyển | D10 |
| U-08 | Lọc tag cho chọn **nhiều** tag (AND), có chip hiển thị. Giữ phần xem trước lệnh `--mochaOpts.grep` như hiện tại. | D5 |

### 6.2 Đưa vào **đầu P3**, trước khi tạo file iOS
| ID | Thay đổi | Giải quyết |
|---|---|---|
| S-01 | **Chuyển cấu trúc sang mục 4.2.** Đổi `tests/native/android/app-launch.native.js` thành `tests/native/shared/app-launch/`, `AppLaunchPage` thành `screens/AppLaunchScreen` có `static locators`. Thêm `NativeBasePage.el()`. Sửa mục 3 của phase-3 §A1/§B2: **không** tạo `tests/native/ios/app-launch.native.js` hay `pages/native/ios/AppLaunchPage.js`. | D3 |
| S-02 | `mobileSpecService.PLATFORMS` nhận nhiều `specDirs` cho mỗi nền tảng (`shared` + riêng). Catalog trả `scope: shared/android/ios` cho từng spec. Khung 2 hiện badge **A**, **iOS**, **A+iOS**. | D3 |
| S-03 | Đổi test ID `TC-AND-00x` sang `TC-1xx`. Tạo `requirements/REQ-101-app-launch.md` và `test-cases/REQ-101-app-launch.md` có cột "Nền tảng", làm mẫu truy vết cho app. | D4 |
| S-04 | Tag mức chạy chuyển từ `describe` xuống `it`; bỏ `@android`. Cập nhật `docs/ANDROID_NATIVE_TESTING.md` §5–6 theo quy ước 4.4/4.5 (P3 tạo `IOS_NATIVE_TESTING.md` cùng quy ước). | D5 |
| S-05 | **Hồ sơ app** `core/native/app-profiles.json`: tên hiển thị, Android package/activity/APK, iOS bundleId/đường dẫn trên Mac. Khung 2 chọn hồ sơ thay vì gõ tay; một hồ sơ dùng được cho cả 2 nền tảng. | D9, chuẩn bị cho iOS |

### 6.3 Đưa vào P4 (Inspector và sinh Page Object)
| ID | Thay đổi | Giải quyết |
|---|---|---|
| I-01 | Page Manager thêm bộ lọc **"App native"**. Bộ đoán nền tảng nhận `pages/native/**`. Parser đọc `static locators` và hiện bảng Android \| iOS; ô trống được tô cảnh báo "Thiếu locator iOS". Có thể làm sớm phần đoán nền tảng (sửa 1 dòng) ngay trong P2. | D1 |
| I-02 | Inspector ghi vào **ô của nền tảng đang mở** trong `static locators` của Screen có sẵn, hoặc tạo Screen mới theo mẫu 4.3. Không sinh class riêng cho từng nền tảng. | D3, BR-402 |
| I-03 | Nút **"Sửa locator"** ở dòng kết quả lỗi: mở Inspector hoặc Page Manager đúng Screen và đúng khoá locator. Khoá locator lấy từ stack trace (`el('equals')`). | D7, rút gọn flow sửa locator |
| I-04 | **"Tạo spec từ mẫu"**: chọn REQ và TC trong `test-cases/` → sinh `describe`/`it` theo quy ước, dùng Screen vừa tạo → mở editor. | Viết test mới trên Dashboard |
| I-05 | "Tạo Page Object mới" ở Page Manager cho phép đích `native` (ghi vào `pages/native/screens/`) | D1 |

### 6.4 Backlog (ngoài PLAN-25)
- **QA view:** cột "Kết quả gần nhất" theo từng TC, lấy từ JUnit native và Playwright, và tách theo nền tảng (TC-101: Android Đạt, iOS chưa chạy). Đây là phần còn thiếu của D4.
- **Khoá chạy giữa nhiều tiến trình (D12):** dùng lock file `test-results/.mobile-run.lock` có PID, hoặc kiểm cổng 4723 trước khi spawn. Nên làm trước khi team dùng chung một máy có nhiều Dashboard.
- Recorder native và BDD cho spec native: để sau P4 (phase-4 đã ghi Out-of-Scope).

---

## 7. Tóm tắt khuyến nghị

1. **Việc gấp nhất là S-01 ở đầu P3.** Nếu P3 làm đúng như plan hiện tại (thư mục iOS riêng, spec riêng), mọi luồng nghiệp vụ sẽ bị nhân đôi và về sau rất tốn công gộp lại.
2. Trong P2, làm U-01 (thư mục bằng chứng và JUnit theo `runId`, TC-ID trong tên ảnh) và U-05 (đổi tên "Mobile"). Đây là quyết định về dữ liệu và đặt tên, đổi muộn sẽ làm hỏng lịch sử đã lưu.
3. Bước giảm thao tác nhiều nhất cho end user là U-02, U-03, U-04 (chọn từng test, chạy lại test lỗi, xem chi tiết lỗi) và I-03 (sửa locator ngay từ dòng lỗi).
