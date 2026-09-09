# Plan 07 — Review implementation ngày 2026-09-09

**Kết luận: REQUEST CHANGES — chưa đạt Gate 4.**

Review trên working tree hiện tại, không phải commit release. Không sửa implementation của người dùng;
chỉ bổ sung mock và smoke tests. Các thay đổi staged về gitignore/untracking từ tác vụ trước giữ nguyên.

## 1. Findings theo mức ảnh hưởng

| ID | Mức | Vị trí | Bằng chứng / tác động | Hướng sửa |
|---|---|---|---|---|
| F01 | P1 | `dashboard/public/app.js:1946` | `renderPageManagerFiles` xóa khai báo `isFixture` nhưng template vẫn đọc biến này. Chạy hàm với một SamplePage trả `ReferenceError: isFixture is not defined`; browser không render được card. | Loại bỏ biểu thức fixture đã lỗi thời hoặc giữ phân loại hợp lệ nhất quán. Thêm regression render với ít nhất 1 business page và BasePage. |
| F02 | P1 | `core/fixtures/pagesFactory.js:195` | Dùng `realFilePath.startsWith(realRootDir)` cho phép junction `project/pages/mobile-web` trỏ sang sibling `project-escape`; mock OutsidePage ngoài root được load thành công. | Kiểm tra containment bằng `path.relative` với boundary đầy đủ, theo canonical pages root; chặn junction/symlink vượt phạm vi trước require. |
| F03 | P1 | `core/fixtures/baseTest.js:33` | Fixture không nhận public `isMobile`. Project `Handset`, `use.isMobile=true`, spec ngoài folder mobile: runtime chọn desktop. Playwright diagnostic fail: expected mobile-web, received desktop. | Áp dụng precedence plan: explicit option, public device option, legacy hints, default. Validate enum platform. |
| F04 | P2 | `core/generator/objectRepository.js:158` | Regex extend kết thúc sớm tại `})` trong function body; regex fixture chỉ nhận dạng `name: async`, bỏ tuple options/auto hook. baseTest chỉ trả workerUserData/featureName/basePage/pages; mobile cũng thiếu authenticatedUser và failureTrackerHook. | Parse cấu trúc object với nested braces/string/comment awareness; hỗ trợ tuple và inheritance, assertion đúng tập keys thay vì chỉ methodCount >= 1. |
| F05 | P2 | `core/generator/objectRepository.js:235` | Fixture readiness hard-code tất cả true. Fixture mock `const test = ; invalid syntax` vẫn ready=true. | Kiểm tra syntax/export thực tế, lỗi phân tích phải báo blocked/error; không giả định metadata ready. |
| F06 | P2 | `core/generator/visualBuilderCompiler.js:378` | Parser spec `sample_pages_fixture.spec.js` trả pages=[] và pageCount=0 dù dùng pages.sample.open(). | Bổ sung recognition container/alias theo resolver shared; giữ manual parsing; không giả “không dùng page” với expression chưa hỗ trợ. |
| F07 | P2 | `core/fixtures/pagesFactory.js:77` | Finder chỉ quét trực tiếp; `pages/desktop/account/NestedPage.js` không tìm thấy trong khi repository scanner đệ quy. | Shared metadata index, nested discovery và collision checks như plan. |
| F08 | P2 | `core/fixtures/pagesFactory.js:184` | Cache theo className đầu vào; `sample` và `SAMPLEPage` được finder chấp nhận cùng file nhưng tạo hai instance. | Cache theo canonical real file path; hoặc reject alias ngoài contract trước resolve. |
| F09 | P2 | `core/fixtures/pagesFactory.js:203` | WrongPage.js export `{ Unrelated: class Unrelated {} }` vẫn instantiate Unrelated do fallback vào export đầu tiên. | Chỉ chấp nhận direct/named canonical/default constructor; mismatch phải báo lỗi. |
| F10 | P2 | `core/fixtures/pagesFactory.js:24` | Explicit relative root được chấp nhận; QA_PROJECT_ROOT không tồn tại âm thầm fallback CWD. | Validate absolute existing directory; configured root sai phải fail rõ thay vì load project khác. |

F02 là boundary của loader local, không phải bằng chứng một remote endpoint cho phép thực thi mã tùy ý.
F04/F06 có phần giới hạn parser đã tồn tại; Plan 07 yêu cầu giải quyết nhưng implementation hiện chưa đáp ứng.

## 2. Những phần đã xác minh đạt

- Repository catalog loại fixture, vẫn có BasePage/resourceKind/permissions.
- GET fixture allowlisted trên server mới trả HTTP 200 và resourceKind=fixture.
- Canonical aliases sample/samplePage/SamplePage chia sẻ instance trong smoke.
- Container riêng không chia sẻ instance trong unit tests hiện có.
- Truyền featureName và manual SamplePage/SampleMobilePage tương thích trên trang mock local.
- Desktop Chromium, Mobile Chromium và Mobile WebKit chạy trang mock thành công.
- Unit tests hiện có kiểm tra ambiguity hai thư mục mobile và cấm mutation locator/delete BasePage.

## 3. Kiểm thử đã chạy

Môi trường: Windows, Node/Playwright đã cài trong workspace. Browser chạy headless.

| Lệnh / phương pháp | Kết quả |
|---|---|
| `node --test core/fixtures/pagesFactory.test.js core/generator/objectRepository.test.js core/generator/visualBuilderCompiler.test.js` | 27 PASS |
| `npx playwright test sample_container_mock.spec.js --project="Desktop Smoke Tests" --project="Mobile Chrome Smoke Tests" --project="Mobile Safari Smoke Tests"` | 3 PASS, 8.5s |
| `npm run check:framework` sau thêm mock specs | PASS — 6 specs, 3 page objects |
| `node --check` cho mockSampleTest.js, app.js, pagesFactory.js, objectRepository.js | PASS |
| `git diff --check` | PASS; Git chỉ cảnh báo chuyển LF/CRLF |
| `npx playwright test --config=.tmp/plan7-device/playwright.config.cjs` | 1 FAIL có chủ đích để kiểm chứng F03, không thuộc suite sản phẩm |
| Mock filesystem isolated, fixture malformed, canonical cache/export, script parser | Tái hiện F02, F04–F10; `.tmp/plan7-review-results.json` |
| Execute renderPageManagerFiles bằng Node VM với dữ liệu SamplePage | FAIL ReferenceError, xác nhận F01 |
| Fresh Dashboard process + GET fixture + Chromium UI | API PASS; UI chặn do card không render; lần đầu navigation load cũng bị timeout tài nguyên ngoài |

Diagnostic files `.tmp/plan7-review.cjs`, `.tmp/plan7-device/` là artifact local bị ignore,
không đưa vào test suite mặc định. Mock filesystem dùng thư mục OS temp riêng, junction được
unlink trước cleanup; server tạm đã dừng và state Dashboard cũ được khôi phục.

## 4. Mock bổ sung để chạy lại

- `data/mock/sample.html`: nội dung HTML local, heading xác định, không gọi mạng ngoài.
- `core/fixtures/mockSampleTest.js`: wrapper opt-in cho base/mobile fixture, HTTP worker server loopback port động, teardown hữu hạn bằng đóng connections.
- `tests/e2e/desktop/sample_container_mock.spec.js`: container aliases, exact heading, manual page parity, featureName.
- `tests/e2e/mobile-web/sample_container_mock.spec.js`: mobile fixture tương tự, chạy được Chromium/WebKit.
- `data/mock/README.md`: lệnh chạy và giới hạn; commit mock/helper/spec cùng nhau nếu dùng trên vệ tinh.

Không thay URL/data của sample demo cũ; không thêm dữ liệu vào authentication thật.

## 5. Chưa nghiệm thu / cần kiểm tra sau sửa

- Responsive 1920/1440/1280/390 và Light/Dark, keyboard, editor dirty/save/revert: BLOCKED bởi F01; không có bằng chứng visual pass.
- Package tarball và consumer cài npm sạch: NOT RUN; custom mock root không thay cho package integration.
- API add locator/action từ form, conflict/hash và package readonly: chưa có xác minh end-to-end. server.js chưa có diff tương ứng contract mutation trong plan.
- Runtime auth/retry/failure hook đầy đủ: chưa chạy nghiệp vụ auth; smoke mobile chỉ kiểm tra success lifecycle.
- E2E sample cũ trên website ngoài chưa chạy lại; manual compatibility được kiểm tra trên mock cùng Page Objects.

Ưu tiên sửa F01–F03 trước, sau đó parser/readiness và resolver contracts.
Không dùng 27 unit tests + 3 smoke pass để đánh dấu toàn bộ T01–T18 hay checklist 10/10 đã đạt.
