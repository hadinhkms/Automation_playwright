# PLAN 07 — Chuẩn hóa Page Container, Fixture Inspector và Page Studio

- Phiên bản: 2.0 — cập nhật sau review ngày 2026-09-09.
- Trạng thái: PLAN ĐÃ ĐIỀU CHỈNH; implementation hiện có mới là một phần, chưa nghiệm thu.
- Mục tiêu chất lượng: 10/10 theo checklist đo được ở cuối tài liệu; không tự công nhận chất lượng trước khi thực thi QA.
- Phạm vi: core fixtures, object repository/API, Page Manager, BDD Inspector và kiểm thử tương thích engine/consumer.

## 1. Mục tiêu và giới hạn

1. Test có thể dùng `pages.sample` hoặc `pages.samplePage` mà không đăng ký từng Page Object trong fixture.
2. Page Manager chỉ quản lý page nghiệp vụ và nhóm nền tảng riêng; fixture vẫn được kiểm tra capability và đọc source qua các luồng Inspector hiện hữu.
3. Giữ canonical `pages/BasePage.js`, các import cũ và package entry point đang có. Không di chuyển file nền tảng.
4. Chạy được trong repository engine, dự án vệ tinh copy core và consumer cài engine bằng package.
5. Giữ manual construction (`new SamplePage(page, featureName)`), authentication, failure hook và fixture hiện hữu. Không tự chuyển hàng loạt spec sang container.

Ngoài phạm vi: chuyển framework UI, dependency mới, hot reload module trong worker, tự quản lý popup/context bổ sung, ESM loader mới, triển khai/publish package hoặc đồng bộ vệ tinh tự động. Page dùng constructor đặc thù tiếp tục dùng manual construction/custom fixture.

## 2. Baseline và rủi ro đã xác nhận

Kết quả dưới đây thuộc lượt review 2026-09-09, không phải kết quả nghiệm thu implementation mới:

| ID | Mức | Bằng chứng hiện tại | Yêu cầu khắc phục |
|---|---|---|---|
| R01 | P1 | `app.js` vẫn đọc fixture qua `/api/object-repository/page`; `normalizePagePath` chỉ nhận `pages/` | Tách contract đọc fixture khỏi contract ghi page; bảo toàn consumer |
| R02 | P1 | Studio tạo `pages/mobile-web/`; factory chọn `pages/mobile/` khi thư mục này tồn tại | Resolve theo từng file, thống nhất canonical và phát hiện trùng |
| R03 | P1 | Factory mặc định root theo `__dirname` của engine | Root phải thuộc consumer, được truyền rõ ràng |
| R04 | P2 | UI chỉ ẩn form locator/action với fixture, chưa áp dụng cho BasePage | Capability policy thống nhất frontend/backend |
| R05 | P2 | Mobile fixture chưa ép platform; factory chưa truyền featureName | Platform option và constructor contract rõ ràng |
| R06 | P2 | Repository test vẫn yêu cầu scanner chứa fixture | Tách test catalog và fixture inspection, không chỉ xóa assertion |
| R07 | P2 | Proxy discovery có thể khác scanner/parser của Studio | Kiểm tra mapping, nesting, alias, script metadata và readiness |

Đã chạy: `npm run check:framework` PASS (4 specs, 3 page objects); `node --test core/generator/objectRepository.test.js` 6 PASS, 1 FAIL; gọi `parsePageObject('core/fixtures/baseTest.js')` bị từ chối đường dẫn. Hai kết quả E2E ghi trong bản plan cũ chưa được xác minh lại, không dùng làm bằng chứng release.

## 3. Quyết định kiến trúc

### 3.1. Project root và public contract

Contract đích: `createPageContainer(page, { rootDir, platform, featureName })`.

- Giữ overload cũ `(page, isMobile, rootDir)` bằng adapter trong giai đoạn chuyển đổi để không làm hỏng call site đã có.
- Fixture option mới: `pageObjectsRoot` và `pageObjectsPlatform`, cấu hình bằng `test.use`/project `use`; không dùng tên trùng fixture built-in.
- Root ưu tiên: `pageObjectsRoot` tường minh → `QA_PROJECT_ROOT` → `process.cwd()` của consumer.
- Không fallback sang thư mục package engine khi root sai hoặc không có page. Root tường minh phải là absolute path; thông báo cấu hình sai sớm, không âm thầm tìm root khác.
- Khi CWD không phải project root, caller phải truyền root; ghi ví dụ cho monorepo/chạy từ thư mục khác trong tài liệu sử dụng.
- Chuẩn hóa absolute/real path; metadata root/cache không được dùng chung giữa hai consumer.
- Cùng một resolver dùng cho runtime và kiểm tra khả năng dùng container của repository. Chỉ đọc metadata/tên file trong scanner; không `require` Page Object để phân tích trên server.

### 3.2. Platform và quy tắc thư mục

- Giá trị cấu hình: `desktop`, `mobile-web`, `auto`; `mobile` chỉ là alias tương thích của `mobile-web`.
- `baseTest`: override tường minh → public option `isMobile` của Playwright → dấu hiệu mobile trong path spec/tên project để hỗ trợ legacy → desktop.
- Nếu các dấu hiệu không thống nhất, báo rõ platform được chọn và nguồn lựa chọn; explicit override có ưu tiên cao nhất.
- `mobileWebTest` mặc định và ràng buộc `mobile-web`, không phụ thuộc tên project/path spec. Cấu hình explicit desktop qua fixture này phải báo lỗi có hướng dẫn dùng `baseTest`.
- Không dùng API private của Playwright để đọc device/context options.

| Loại page | Nơi Studio tạo mới | Nơi resolver tìm |
|---|---|---|
| Desktop | `pages/desktop/` | desktop, sau đó shared `pages/` |
| Mobile Web | `pages/mobile-web/` | mobile-web và legacy mobile theo từng file, sau đó shared `pages/` |
| Shared | Không thêm flow tạo mới trong task này | File trực tiếp dưới `pages/`, trừ BasePage |
| Foundation | Giữ `pages/BasePage.js` | Không đưa vào business container; dùng fixture `basePage` |

- Không chuyển/xóa page trong `pages/mobile/` tự động.
- Nếu cùng logical name tồn tại ở mobile và mobile-web: báo ambiguity với hai đường dẫn, không chọn ngầm một bản.
- Page platform được ưu tiên hơn shared cùng tên; không fallback chéo desktop/mobile khi thiếu page.
- Hỗ trợ page trong thư mục con của platform bằng index đường dẫn không thực thi module. Hai page cùng logical name trong cùng platform phải báo ambiguity.
- Index chỉ chứa file `.js` hợp lệ; bỏ thư mục ẩn, draft, backup và test/helper không đáp ứng quy ước Page Object. Không thêm generated index vào git.
- Canonical filename PascalCase kết thúc `Page.js`; tên lowerCamelCase cũ được hỗ trợ có kiểm thử. Không dựa vào Windows để bỏ qua case; báo collision khi hai filename chỉ khác case.
- Alias: `sample`, `samplePage`, `SamplePage` cùng một identity; `jobDetail` và `job_detail` cùng map `JobDetailPage`. Tên acronym giữ theo class canonical, không hứa tự suy đoán mọi cách viết.

### 3.3. Lazy loading, lifecycle và lỗi

- Index metadata có thể tạo ở lần truy cập đầu; chỉ `require` và `new` class được yêu cầu. Không tạo tất cả page trước test.
- Cache instance theo canonical real path trong từng container/test. Hai alias cùng file phải trả cùng instance; khác test, retry, worker hoặc consumer không chia sẻ instance.
- Giữ cache module CommonJS bình thường; không xóa `require.cache` toàn cục. Chỉnh source giữa một run không được bảo đảm hot reload; khởi động run mới để nhận thay đổi.
- Constructor chuẩn `new PageClass(page, featureName)`; fixture truyền `featureName` đang có để giữ nhóm evidence. Constructor chỉ nhận page vẫn hoạt động.
- Export hỗ trợ: constructor trực tiếp, named export khớp class canonical, hoặc default constructor. Export sai/constructor throw phải trả lỗi phân loại, giữ nguyên `cause` và stack gốc trong log kỹ thuật.
- Không giả định constructor chỉ có page là đủ cho mọi page cũ; audit constructor trước khi đánh dấu container-ready.
- Container không đóng `page`/context do Playwright quản lý và không tự gọi cleanup method chưa được định nghĩa. Page cần resource teardown riêng dùng custom fixture.
- Thuộc tính runtime `then`, `toJSON`, `inspect`, symbol không được kích hoạt load/throw. `__proto__`, `prototype`, `constructor` là reserved; không ánh xạ sang file.
- `in` kiểm tra metadata không instantiate; enumeration không instantiate. Test quy ước JSON/log/Promise.resolve để tránh side effect từ Proxy.
- Tên truy cập có slash, backslash, dấu chấm traversal hoặc ký tự ngoài quy ước bị từ chối. Xác nhận real path cuối cùng thuộc page root; symlink/junction vượt root bị từ chối.
- Unknown page báo tên yêu cầu, platform, root và đường dẫn đã xét; không nuốt lỗi hoặc dùng page khác để làm test pass.

### 3.4. Tách Page catalog và Fixture inspection

Phương án triển khai tối thiểu: giữ URL đọc hiện hữu, dispatch theo loại resource ở backend.

- `scanAllPageObjects(root)` trả business pages + BasePage, không fixture.
- Thêm `parseFixture`/`inspectRepositoryResource` trong repository layer; route GET `/api/object-repository/page?file=...` dispatch tới parser đúng loại.
- Chỉ allowlist `core/fixtures/baseTest.js`, `core/fixtures/mobileWebTest.js` để inspect fixture. Không nới `normalizePagePath` cho mọi thao tác ghi.
- Fixture parser giữ capability metadata của `.extend`, đồng thời xử lý kế thừa mobile fixture từ base bằng static analysis có giới hạn. Không `require` fixture trên Dashboard để lấy metadata.
- Preserve các field consumer đang dùng (`methods`, `capabilities`, platform...) và thêm `resourceKind: page|foundation|fixture`, `permissions`; xác minh schema thực tế trước khi sửa.
- BDD Inspector tiếp tục dùng route tương thích. Nếu fixture không có ở consumer package: đọc canonical fixture engine qua mapping allowlist riêng; không fallback filesystem tùy ý.
- API trả lỗi an toàn/phân loại rõ cho missing resource hoặc parse failure; UI hiển thị trạng thái lỗi và retry, không biến lỗi thành danh sách capability rỗng thành công.
- Cập nhật fixture counts, page counts, sidebar state và documentation/lesson cũ nói scanner phải bao gồm fixture.
- Bảo toàn flow xem source fixture và code editor hiện có. Fixture trong package chỉ đọc; fixture local vẫn theo quyền sửa source hiện hữu.

### 3.5. BasePage và quyền ghi

| Resource / hành động | Xem/copy | Thêm/sửa locator hoặc action bằng form | Xóa | Sửa source |
|---|---|---|---|---|
| Business page local | Có | Có, validate trước khi ghi | Theo flow xác nhận hiện có | Có |
| BasePage local | Có | Không | Không | Qua editor framework hiện có, cảnh báo tác động dùng chung |
| Fixture local | Có | Không | Không qua Page Studio | Qua editor framework hiện có |
| Foundation/fixture từ engine package | Có | Không | Không | Chỉ đọc |

- Backend tính policy từ canonical path/resource kind, không tin `isBase`/permission từ request body.
- Page Manager hiển thị BasePage dưới nhóm riêng “Lớp nền tảng”, không tính vào business page count, không cho chọn như page nghiệp vụ trong BDD action picker.
- Dùng chung policy cho nút, keyboard shortcut, inline form, modal, delete, locator endpoint và handler lưu.
- Hiện form đang dùng PUT `/api/code` để ghi cả file: chuyển thao tác form sang mutation endpoint có kiểm tra business page; không chỉ thêm flag client vào `/api/code` rồi coi là đã bảo vệ.
- `/api/code` là editor source tổng quát, giữ quyền sửa foundation local có chủ đích và cảnh báo. Đây không phải ranh giới xác thực người dùng mới; không tuyên bố ngăn mọi sửa source qua API.
- Sửa source dùng validation, backup/khôi phục và phát hiện conflict theo cơ chế hiện có; nếu chưa có cơ chế thì bổ sung tối thiểu expected-content hash trước ghi, trả conflict thay vì ghi đè bản mới.

### 3.6. BDD/script metadata và trải nghiệm người viết test

- Inventory consumer của `repoPages`, `fixtureName`, `script.pages`, `methods`, platform filter và action picker trước khi đổi schema.
- Kiểm tra parser có nhận `pages.sample.open()` và alias/destructuring được hỗ trợ hay không. Bổ sung recognition cho cú pháp được tài liệu hóa, giữ parser manual `new SamplePage(...)` hiện có.
- Không tuyên bố script không dùng page chỉ vì parser chưa nhận container; hiển thị giới hạn phân tích khi gặp dynamic property/expression.
- Readiness tách `sourceReady` khỏi `containerReady`; page manual hợp lệ nhưng constructor đặc thù không bị đánh dấu toàn bộ page lỗi.
- Không tự thay đổi generated spec mặc định trong task này. Demo container có ví dụ rõ; generated spec cũ tiếp tục chạy và được regression test.

## 4. UI/UX và validation

Áp dụng skill dashboard-maintainer, canonical Dashboard prompt và lessons; giữ Vanilla HTML/CSS/JS, layout ba khung, tokens, panels và shared code editor.

- Gỡ pill Fixture khỏi Page Manager, không bỏ khả năng inspect fixture trong BDD.
- Reset filter fixture được lưu từ phiên cũ về All; tính lại count/search/empty state theo business pages và foundation riêng.
- BasePage có badge, mô tả phạm vi tác động ngắn gọn, action phù hợp ma trận quyền; không hiển thị label tự chấm “10/10”.
- Khi đổi file/view có dirty editor: giữ flow chống mất thay đổi; không reset editor chỉ để chuyển badge.
- Loading/empty/error/read-only phải phân biệt; lỗi fixture có retry, không hiện stack trace/undefined/null.

| Control / tình huống | Validation và trạng thái | Phản hồi |
|---|---|---|
| Chọn page/foundation | Loading khi fetch; bỏ response cũ nếu chọn nhanh | Inspector đúng resource cuối cùng |
| Tạo page mobile | Check class/path/collision trong cả hai mobile roots | Inline error; không tạo file khi không hợp lệ |
| Save business source | Dirty + syntax hợp lệ; khóa lúc lưu | Thành công hoặc conflict/error giữ nội dung đang sửa |
| Add locator/action | Chỉ business page, validate tên/expression, chống double submit | Inline error; backend từ chối foundation |
| Delete | Chỉ business page; xác nhận tên/path theo flow hiện có | Foundation luôn bị backend từ chối |
| Inspect fixture fail | Không giả lập empty success | Error + retry, source link nếu có |

## 5. Phạm vi file và thứ tự triển khai

Không reset/revert thay đổi đang có của người dùng. Trước khi sửa, lưu `git diff` baseline để tách code có sẵn khỏi phần task.

| Bước | File/module | Kết quả cần có |
|---|---|---|
| A — Contract | Audit factory, repository, server, BDD consumers, package entry point | Root/platform/path/permission/schema chốt theo mục 3; liệt kê call sites thực tế |
| B — Runtime | `core/fixtures/pagesFactory.js`, `baseTest.js`, `mobileWebTest.js`; resolver dùng chung nếu cần | Lazy container, root consumer, mobile compatibility, featureName, lỗi rõ ràng |
| C — Backend | `core/generator/objectRepository.js`, `dashboard/server.js` | Catalog tách fixture nhưng GET inspection tương thích; permission và mutation routes |
| D — UI/metadata | `dashboard/public/app.js`, `index.html`, `styles.css` nếu cần; parser/compiler thực tế tìm ở A | BasePage group, filter migration, fixture Inspector, container metadata |
| E — QA/docs | Factory/repository/API/parser/UI tests; E2E samples; usage docs; `.ai/learning/candidates.md` | Evidence thật, hướng dẫn consumer và checklist nghiệm thu |

- Package `files`/entry point chỉ sửa nếu public option/helper mới cần export; giữ tên export cũ. Kiểm tra nội dung tarball bằng pack dry-run trước integration test.
- B và C có thể làm theo commit nhỏ, nhưng chỉ nghiệm thu khi toàn bộ consumer ở D đã chuyển xong.
- Không xóa fixture parser/metadata như biện pháp “dọn code” khi còn consumer.

## 6. Ma trận kiểm thử bắt buộc

Test unit/integration dùng temporary project độc lập ngoài scan path thật; mock page tối thiểu khi không cần browser. Cleanup trong finally và xác nhận target nằm trong temp root. Browser smoke dùng trang local xác định để tránh phụ thuộc mạng ngoài.

| ID | Tầng / ca kiểm thử | Expected result |
|---|---|---|
| T01 | Alias sample/samplePage/SamplePage; jobDetail/job_detail | Cùng instance cho cùng file; không require trước truy cập |
| T02 | Hai container, test retry, parallel workers | Không chia sẻ instance/page/featureName |
| T03 | Desktop + shared; mobile-web only; mobile only; cả hai | Resolve đúng từng file, không bỏ qua mobile-web khi mobile tồn tại |
| T04 | Duplicate logical name, nested names, case-only collision | Ambiguity rõ ràng; cùng kết quả Windows/Linux |
| T05 | Consumer npm package, copy core, custom absolute root, CWD khác | Chỉ load page consumer; root sai không fallback engine |
| T06 | Custom project name, mobile fixture ngoài mobile folder, explicit platform | Theo đúng precedence; override không hợp lệ bị từ chối |
| T07 | Named/direct/default exports; invalid export; constructor throw | Success đúng contract hoặc lỗi có cause; không cache instance lỗi |
| T08 | featureName, manual constructor, auth và failure hook | Nhóm evidence đúng; fixture cũ/hook không đổi hành vi |
| T09 | then/symbol/toJSON/inspect, JSON/log/Promise.resolve, in/enumeration | Không vô tình instantiate/throw vì runtime introspection |
| T10 | Traversal, absolute property path, symlink/junction vượt root | Không load/ghi file ngoài phạm vi |
| T11 | Page catalog + fixture GET + mobile inherited capabilities | Catalog không fixture; Inspector fixture vẫn có metadata đúng |
| T12 | BasePage form/API delete/locator/action; package foundation | Bị từ chối; file trước/sau không đổi; local source editor đúng policy |
| T13 | BDD parser manual và pages.sample; dynamic access | Metadata đúng cú pháp hỗ trợ; không báo sai “không dùng page” |
| T14 | Create mobile page qua Studio rồi truy cập container | Page mới resolve được mà không sửa fixture |
| T15 | Stale filter, dirty switch, save conflict, double click, retry/error | Không mất dữ liệu, duplicate mutation hay giả empty success |
| T16 | E2E desktop cũ + container; mobile Chromium + WebKit | Luồng Given/When/Then có precondition, evidence và assertion cụ thể |
| T17 | UI 1920x1080 → 1440x900 → 1280px → 390px; Light/Dark | Không clipping/overlap/tràn ngang; keyboard/focus/contrast đạt |
| T18 | Package tarball sạch và consumer ngoài workspace | Không dựa vào page/dependency chỉ tồn tại trong repo engine |

Lệnh baseline và regression hiện có:

```powershell
npm run check:framework
node --test core/generator/objectRepository.test.js
node --check core/fixtures/pagesFactory.js
node --check core/fixtures/baseTest.js
node --check core/fixtures/mobileWebTest.js
node --check dashboard/server.js
node --check dashboard/public/app.js
npx playwright test tests/e2e/desktop/sample_pages_fixture.spec.js --project="Desktop Smoke Tests"
npx playwright test tests/e2e/desktop/sample_demo.spec.js --project="Desktop Smoke Tests"
npx playwright test tests/e2e/mobile-web/sample_mobile.spec.js --project="Mobile Chrome Smoke Tests"
npx playwright test tests/e2e/mobile-web/sample_mobile.spec.js --project="Mobile Safari Smoke Tests"
npm pack --dry-run
```

Test mới dự kiến: `core/fixtures/pagesFactory.test.js`, `core/fixtures/pagesFixture.integration.test.js`; test route/parser/UI bổ sung vào suite hiện hữu tìm được ở bước A. Ghi chính xác tên file/lệnh sau khi tạo, không báo PASS cho test chưa tồn tại. Mobile container cần ca mới riêng: chạy sample mobile manual hiện hữu không thay thế kiểm thử fixture mới.

Trước khi sửa Playwright spec, đọc `ai/shared/AI_PROMPTS.md` và `ai/shared/TEST_AUTOMATION_LESSONS.md`; tuân thủ POM, Precondition annotation, Given assertion/evidence, không hard wait. Thiếu browser/runtime phải ghi NOT RUN cùng lý do; không đổi skip thành PASS.

## 7. Quality gates và bằng chứng nghiệm thu

- Gate 1 — Requirement: xác nhận scope và các contract mục 3 đầy đủ; unresolved mapping của consumer phải được ghi rõ trước coding phần phụ thuộc.
- Gate 2 — Handoff: ma trận quyền, lỗi, root/platform, file mapping và T01–T18 có implementation target cụ thể.
- Gate 3 — Engineering: unit/integration/API/parser/package tests đạt; framework check đạt; không còn R01–R03; static check không thay executable test.
- Gate 4 — Senior QA: pass độc lập theo rủi ro, browser thật + console/server output + responsive/themes; không còn P0/P1. P2 chưa xử lý phải ghi impact và hướng xử lý, không tuyên bố đạt 10/10.
- Gate 0.5 — Knowledge: cập nhật candidate LEARN-004 bằng kết quả xác minh; hợp nhất lesson fixture cũ nếu root cause và regression check đã rõ, không thêm lesson suy đoán/trùng lặp.

Mỗi bằng chứng ghi: commit hoặc mô tả working-tree revision, môi trường/OS/browser, lệnh, thời điểm, PASS/FAIL/NOT RUN, số test, artifact path và hạn chế. Bảng review baseline ở mục 2 giữ riêng; không ghi đè thành kết quả implementation mới.

Checklist mục tiêu 10/10 (mỗi mục một tiêu chí; tất cả phải đạt, không lấy trung bình để bỏ qua lỗi nghiêm trọng):

- [ ] Root consumer và package/copy-core integration đúng.
- [ ] Desktop/mobile/shared/nested/collision resolution đúng.
- [ ] Lazy loading, alias, per-test lifecycle và Proxy protocol đúng.
- [ ] Manual specs, auth/failure hook và featureName tương thích.
- [ ] Fixture Inspector/API không hồi quy.
- [ ] BasePage/source/mutation permissions đúng cả UI và backend.
- [ ] BDD metadata, readiness và Studio-create-to-runtime nhất quán.
- [ ] Path containment, lỗi, conflict và dữ liệu đang sửa được bảo vệ.
- [ ] Toàn bộ regression liên quan và visual QA có bằng chứng đạt.
- [ ] Usage docs, package verification, rollback và learning hoàn tất.

## 8. Rollout và rollback

1. Triển khai trên branch hiện tại hoặc worktree riêng theo trạng thái repository; giữ baseline thay đổi người dùng. Không tự commit/publish/sync chỉ vì hoàn thành plan.
2. Container là opt-in qua fixture `pages`; giữ cách dùng manual và generated specs cũ để giảm phạm vi hồi quy.
3. Kiểm tra consumer fixture trong temp project trước; sau đó smoke một vệ tinh được chọn nếu có môi trường, không sửa hàng loạt vệ tinh.
4. Chỉ công bố nghiệm thu khi Gate 4 đạt. Triển khai/publish thật là công việc riêng ngoài plan này.
5. Nếu lỗi runtime: chuyển spec thử nghiệm về manual construction; revert đúng commit của task khi đã có commit, không reset toàn workspace. Nếu chưa commit, rollback từng hunk thuộc task dựa baseline.
6. Nếu lỗi Inspector: phục hồi contract đọc fixture tương thích cùng frontend consumer; không rollback nửa schema. Giữ nguyên file page nghiệp vụ và dữ liệu người dùng.
7. Không có migration phá hủy directory/file trong plan; page mobile legacy tiếp tục tồn tại. Source đã sửa phải có backup/conflict evidence để phục hồi chọn lọc.
