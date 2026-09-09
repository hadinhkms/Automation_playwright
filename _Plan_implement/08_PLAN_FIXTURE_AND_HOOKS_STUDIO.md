# PLAN 08 — Fixtures, Preconditions & Lifecycle Hooks Studio

- Phiên bản: 2.0 — điều chỉnh sau review ngày 2026-09-09.
- Trạng thái: PLAN ĐÃ ĐIỀU CHỈNH; implementation hiện có chưa được nghiệm thu theo bản này.
- Mục tiêu: tạo, kiểm tra và sử dụng fixture nghiệp vụ từ Dashboard, bảo toàn engine/vệ tinh và có bằng chứng cleanup thực tế.
- Chất lượng mục tiêu: 10/10 theo checklist ở mục 10; không đồng nghĩa đã đạt trước khi kiểm thử.
- Tham chiếu: Plan 07, báo cáo review Plan 07, Master Process Hub, Dashboard canonical prompt/lessons và AI_PROMPTS/TEST_AUTOMATION_LESSONS.

## 1. Phạm vi và prerequisite

### In scope

- Registry fixture thuộc consumer, loader/composition API, cleanup test-scope có lifecycle rõ ràng.
- Studio 3 khung, metadata Inspector, wizard Setup/Teardown API và custom source editor.
- CRUD có validation/conflict/backup, draft isolation, BDD resource/cleanup mapping.
- Migration đường dẫn legacy, Git Sync policy, copy-core và npm consumer integration.
- Mock API độc lập kiểm tra trạng thái tài nguyên sau khi Playwright worker kết thúc.

### Out of scope

- Sandbox chạy JavaScript không tin cậy, arbitrary database reset, worker-scoped cleanup, background janitor tự xóa dữ liệu môi trường thật.
- Hot reload custom module trong một test run, tự sửa tất cả spec, tự publish/push/sync vệ tinh.
- Excel import UI mới; template data chỉ hỗ trợ dữ liệu JSON và secret references đã định nghĩa. Excel là mở rộng sau.

### Điều kiện bắt đầu

- Kiểm chứng lại baseline Plan 07: Page Manager render, fixture GET, root/platform và path containment. Không suy ra Plan 07 hoàn tất từ việc file đã tồn tại.
- Phần engine/mock có thể làm độc lập; nghiệm thu Studio phụ thuộc các luồng Inspector/editor liên quan hoạt động.
- Giữ nguyên thay đổi người dùng đang có. Lưu diff baseline trước implementation; không reset workspace.

## 2. Baseline review — không phải kết quả nghiệm thu

| Phát hiện ngày 2026-09-09 | Hệ quả |
|---|---|
| Loader custom mặc định `__dirname` | Package consumer có thể nạp fixture engine thay vì dự án |
| Sync core chỉ exclude dashboardConfig.json | Custom fixture cùng đường dẫn có thể bị upstream ghi đè |
| `...customFixtures` nằm cuối base.extend | Export trùng có thể override core nếu chỉ validate tên qua UI |
| cleanupQueueFixture bỏ qua errors từ runAll | Cleanup thất bại chỉ warning, test có thể vẫn xanh |
| Plan v1 mô tả 2 panels | Xung đột canonical 3-frame Studio |
| Unit `customFixtures.test.js` 3/3 PASS | Chưa chứng minh HTTP cleanup sau runner FAIL/TIMEOUT |
| ephemeralUser mẫu chỉ đổi object trong RAM | Không phải bằng chứng user trên API đã được xóa |

## 3. Ownership, root và migration

### 3.1. Cấu trúc đích

```text
core/fixtures/                   Engine-owned: loader, base/mobile fixtures, cleanup helpers
fixtures/custom/                 Consumer-owned: <name>.fixture.js
.dashboard-drafts/fixtures/       Draft, không nằm trong runtime scan path
.dashboard-backups/fixtures/      Backup local trước update/delete
```

- Loader chỉ chọn file `.fixture.js`; không tự nạp mọi `.js` hay backup/temp.
- Giữ engine loader ở core; không chép sample fixture nghiệp vụ vào vùng consumer khi sync engine.
- Root chung: explicit absolute project root → QA_PROJECT_ROOT → consumer CWD. Root explicit/env sai phải báo lỗi, không fallback sang engine.
- Resolve/realpath toàn bộ target và parent; dùng path.relative kiểm tra boundary, chặn traversal và junction/symlink vượt custom root. Không dùng startsWith(root) đơn thuần.

### 3.2. Composition trước discovery của Playwright

- Custom fixtures phải đăng ký vào test.extend trước khi spec được collect. Không dùng Proxy pages để thay việc đăng ký fixture trực tiếp trong destructured arguments.
- Cung cấp helper public dự kiến `defineProjectTest({ rootDir, platform })`, trả `{ test, expect }`; giữ export baseTest/mobileWebTest hiện có tương thích.
- Default root dùng khi import tương thích cũ được xác định tại composition. Consumer cần nhiều root trong một process phải gọi helper tường minh cho từng root.
- Không dùng test.use để mong thay registry đã collect; test.use chỉ override fixture option đã đăng ký.
- Cùng helper/resolver phục vụ desktop/mobile; không dùng registry singleton toàn cục cho nhiều consumer. Giữ nguyên authentication và failure hook ngoài phạm vi thay đổi.
- Chỉnh sửa fixture có hiệu lực ở run mới, hiển thị điều này trong Studio; không xóa require.cache toàn cục trong worker đang chạy.

### 3.3. Legacy và Git Sync

1. Inventory `core/fixtures/custom/*.fixture.js` đang có; giữ `index.js` như compatibility adapter tới loader mới nếu cần.
2. Trong thời gian migration, resolver có thể đọc canonical và legacy consumer paths. Nếu trùng exported name thì báo conflict; không chọn bản theo thứ tự filesystem.
3. Migration là thao tác riêng có preview manifest/hash: sao lưu, copy sang canonical, kiểm tra parity rồi mới đề xuất bỏ file legacy. Không tự chuyển/xóa dữ liệu người dùng khi startup.
4. Script sync phải exclude legacy `core/fixtures/custom/` để không ghi đè nghiệp vụ; engine loader mới nằm ngoài thư mục exclude. Migration không làm mất dependency loader trên satellite.
5. Dashboard Git Sync cho phép `fixtures/custom/**`, vẫn áp dụng blacklist secrets/runtime. Kiểm tra publish pipeline thực tế; `.gitignore` không được chặn fixture/spec/data/mock cần chạy.
6. Không thay package.json/lockfile của vệ tinh hàng loạt. Khi consumer dùng mock, commit mock/helper/spec cùng nhau.

## 4. Registry contract và validation

### 4.1. Contract phiên bản đầu

- Một file canonical tương ứng một exported fixture cùng tên; tên lowerCamelCase theo `^[a-z][A-Za-z0-9]*$`.
- Schema metadata: `name`, `description`, `kind`, `scope`, `dependencies`, `sourcePath`, `origin`, `readiness`, `diagnostics`, `permissions`, `revision`.
- v1 custom scope chỉ `test`; auto mặc định false. Worker scope/auto custom từ raw source bị báo unsupported, không âm thầm chuyển scope.
- Hỗ trợ function fixture hoặc tuple có options trong subset đã công bố. Metadata phải phản ánh source thật; không hard-code ready/scope/dependencies.
- `origin`: core, custom hoặc legacy. Core/package source read-only trong Studio.

### 4.2. Guard tại cả API và runtime

- Một registry reserved names dùng chung gồm built-ins theo phiên bản Playwright được hỗ trợ, toàn bộ core fixtures/options và reserved object keys.
- Tối thiểu gồm page/context/browser/request/test/expect/pages/basePage/cleanupQueue/workerUserData/authenticatedUser/featureName/pageObjectsRoot/pageObjectsPlatform/isMobile/viewport/browserName và các keys prototype.
- Validate exported keys thực tế, không chỉ filename/payload name. Chặn duplicate giữa files, core/custom và canonical/legacy trước extend; không spread ghi đè ngầm.
- Validate export shape, dependency tồn tại, dependency cycle và scope compatibility. Lỗi phải nêu file/key/dependency và hướng sửa.
- Cùng contract cho file tạo từ wizard, sửa source, git pull và file viết thủ công.

### 4.3. Phân tích tĩnh và lỗi module

- Dashboard scanner/validator không require/eval custom module. Dùng static parser có nested brace/string/comment awareness; `new Function` chỉ là syntax check bổ sung, không phải sandbox hoặc kiểm chứng semantic.
- Chốt parser strategy ở technical spike: tái sử dụng parser hiện có nếu đủ coverage; nếu cần dependency mới phải ghi lý do, kích thước và compatibility.
- Raw custom code là mã tin cậy của dự án, có quyền tương đương test script. Không quảng cáo loader có thể cô lập infinite loop, process.exit hay side effect tùy ý.
- Metadata invalid được hiển thị blocked và giữ diagnostics. Runtime gặp registry invalid phải fail discovery rõ ràng; không warning rồi bỏ qua làm mất precondition.
- Draft không tham gia collection. Runtime module import chỉ xảy ra trong runner; fixture setup vẫn on-demand theo dependency của Playwright.
- Advanced raw source chỉ được chấp nhận khi nằm trong subset có thể validate; source ngoài subset vẫn xem/copy được nhưng không gắn nhãn ready.

## 5. Cleanup lifecycle và kết quả quan sát được

### 5.1. Hai loại cleanup có ownership riêng

- Template Setup/Teardown API: fixture sở hữu resource và phụ thuộc trực tiếp vào request/client của nó; teardown trong try/finally quanh setup/use, trước khi dependency client bị dispose.
- cleanupQueue: dùng cho compensation của nhiều resource trong một test. API cleanup qua queue sử dụng client do queue sở hữu hoặc dependency explicit sống lâu hơn queue; không bắt closure của request/page/context độc lập mà không bảo đảm thứ tự teardown.
- Queue API đích: `register(taskFn, { label, resourceId, timeoutMs })`; task nhận context có client/signal được queue quản lý. Giữ adapter cho call syntax cũ nhưng không giả định closure cũ có lifecycle an toàn.
- Không chạy cùng một DELETE qua cả fixture finally và queue. Mỗi resource có một cleanup owner; unregister/disarm khi ownership chuyển giao hoặc resource đã xóa trong test.

### 5.2. Đăng ký và thứ tự

- Đăng ký compensation ngay sau khi tạo resource thành công và lấy được ID, trước assertion/action tiếp theo có thể fail.
- Setup tạo nhiều resource phải đăng ký từng cái ngay; nếu setup thất bại giữa chừng thì cleanup các resource đã biết.
- Thực thi LIFO, một lỗi không ngăn task còn lại. register sai input phải throw, không bỏ qua.
- runAll chống re-entry/double execution; snapshot hoặc trạng thái draining rõ ràng, không cho task tự thêm vô hạn trong lúc cleanup.
- Resource identity gắn run/test/retry/worker hoặc idempotency key, không dựa vào Date.now đơn lẻ cho isolation.

### 5.3. Timeout và retry

- Giá trị mặc định đề xuất: mỗi task 10s, tổng queue 30s, tối đa 1 retry trong cùng budget cho lỗi transient đã định; cấu hình được nhưng có giới hạn.
- Cấp teardown fixture timeout riêng đủ cho cleanup và ghi evidence. Timeout test không được sử dụng hết budget dọn dẹp.
- Request phải có timeout/cancellation thực tế; Promise.race chỉ dừng chờ, không được xem là đã hủy side effect.
- Chỉ retry DELETE idempotent có ownership ID xác thực; 404 có thể coi đã sạch theo contract. 401/403/validation failure không retry vô điều kiện.
- Process kill, crash, mất máy hoặc mất mạng kéo dài nằm ngoài bảo đảm finally. Ghi orphan record có redaction nếu còn cơ hội; reconciler/janitor tương lai là scope riêng, không tự gọi xóa hàng loạt.
- API đã tạo resource nhưng response bị mất cần correlation/idempotency key để truy tìm; nếu API không hỗ trợ, báo residual risk, không tuyên bố cleanup chắc chắn.

### 5.4. Chính sách kết quả

- runAll trả summary có task status/duration/retries/errors; attach structured report đã che token/payload nhạy cảm.
- Test đang pass nhưng mandatory cleanup fail: đánh dấu teardown failure/test failed.
- Test đã fail: giữ nguyên lỗi nghiệp vụ ban đầu, đính kèm cleanup errors rõ ràng; không thay thế bằng warning rời rạc.
- Optional cleanup chỉ có khi người dùng chọn rõ, report phân biệt warning. Không mặc định nuốt lỗi.
- Kiểm tra response.ok/status thực tế; HTTP 500 không được log “đã xóa thành công” chỉ vì request promise resolve.

## 6. API, persistence và template

### 6.1. Endpoint contract

| Endpoint | Hành vi |
|---|---|
| GET /api/fixtures | Catalog core/custom/legacy, readiness và diagnostics; không execute source |
| GET /api/fixtures/:name | Source/metadata/revision của custom; core dùng resource identity rõ, không trùng platform |
| POST /api/fixtures/validate | Static validation, preview source/diagnostics, không ghi canonical |
| POST /api/fixtures | Create-only; duplicate trả 409 |
| PUT /api/fixtures/:name | Update với expectedRevision; stale revision trả 409 |
| DELETE /api/fixtures/:name | Custom-only, expectedRevision, dependency/usage checks và backup |

- Giữ adapter cho endpoint POST-update/delete đã có trong giai đoạn chuyển đổi; adapter dùng cùng validation/permission service, không có đường ghi riêng bỏ guard.
- Missing 404, forbidden 403, invalid payload 400/422 theo convention hiện tại, size limit 413. Error sanitized, không raw stack/secret.
- Tách draft CRUD qua draftManager; canonical chỉ ghi sau validate thành công.
- Atomic temp-write/rename, backup và revision check phải nằm trong một mutation transaction/lock theo file; create phải chống race overwrite.
- Kiểm tra expectedRevision cả update/delete; giữ nội dung editor khi conflict. Từ chối xóa fixture có static dependency/test usage; dynamic usage không xác định phải hiển thị giới hạn và yêu cầu đánh giá tác động trước xóa.
- Core immutability áp dụng mọi đường ghi Dashboard: /api/fixtures, /api/code, /api/resource. Plan 08 thu hẹp quyền sửa fixture core so với source editor trước đây; chỉ thay core bằng quy trình phát triển engine, không nút UI bypass.

### 6.2. Wizard Setup/Teardown API

- Setup: method, relative endpoint, JSON body, expected status, response ID path, credential reference.
- Teardown: DELETE endpoint có placeholder ID, accepted status (ví dụ 204/404), timeout và retry policy.
- Cho URL tương đối theo môi trường được cấu hình. Không lưu token/header bí mật trực tiếp trong source; resolve env/secret reference lúc runtime và redact report.
- Template ID dùng interpolation có giới hạn, không eval `${...}` tùy ý; encode ID khi đưa vào path. JSON/string generation dùng escaping đúng, kể cả quote, newline và comment terminator.
- Không chạy “thử API” hoặc DELETE từ Dashboard backend trong v1; validation là tĩnh, execution qua runner/mock rõ ràng.
- Precondition data template dùng JSON/config và validate schema; raw custom script đi qua cùng editor và validator.

## 7. Studio 3 khung và BDD integration

### 7.1. Layout

- Khung 1 (290px): search/filter, core/custom/legacy groups, counts, collapsed rail.
- Khung 2 (minmax 360px): metadata, dependency/usage Inspector, wizard fields và validation.
- Khung 3 (minmax 380px): shared code editor/preview, usage snippet, readiness, Save/Revert/Copy actions.
- Reuse canonical workspace/tokens/header/panels và breakpoint hiện có; không tạo layout 2-panel riêng.
- Advanced source edit có dirty/loading/error/read-only, Ctrl/Cmd+S, Tab, scroll sync, unsaved-change protection; không tạo editor riêng cho fixture.

| Control | Điều kiện / hành vi |
|---|---|
| Save/Create | Disable khi invalid/loading; inline diagnostics; giữ draft nếu lỗi mạng |
| Select resource | Bảo vệ dirty state, bỏ response stale khi chọn nhanh |
| Delete | Chỉ custom hợp lệ, xác nhận tên và revision; hiển thị dependency blockers |
| Core source | Xem/copy read-only, không Save/Delete |
| Registry lỗi | Error/blocked có retry và vị trí lỗi, không fake empty success |
| Chỉnh fixture giữa run | Thông báo áp dụng ở run tiếp theo, không mutate worker hiện tại |

### 7.2. BDD

- Thêm schema liên kết resource-producing step với compensation; cleanup không phải một hành động xóa độc lập ở cuối flow.
- Compiler đặt register ngay sau create/ID extraction; variable/resource scope phải tồn tại khi cleanup chạy. Nếu không suy luận chắc chắn thì block compile và yêu cầu chọn fixture/resource.
- Inject đúng custom fixture/cleanupQueue/client dependency vào spec và dùng composition import đã đăng ký registry.
- Round-trip parser giữ setup-resource-cleanup mapping; static/dynamic expressions ngoài subset báo unsupported, không làm mất cleanup khi save lại.
- Không tạo hai cleanup owner cho cùng resource. Existing generated/manual specs giữ hành vi khi không dùng tính năng mới.

## 8. File mapping và trình tự triển khai

| Phase | Thay đổi dự kiến | Exit criteria |
|---|---|---|
| A — Spike/contracts | Inventory Plan 07, lifecycle probe, parser/root/registry schema, endpoint consumers | Chốt dependency graph, supported syntax và migration manifest |
| B — Engine | core/fixtures loader mới ngoài custom/, cleanupRegistry.js, baseTest/mobileWebTest composition, index.js khi cần public export | Root/override/cleanup tests đạt, không global registry collision |
| C — Ownership | fixtures/custom/, migration helper, scripts/sync-satellites.js, core/system/gitSyncService.js, docs | Sync không overwrite custom; QA push fixture vẫn được; package consumer smoke đạt |
| D — Backend | Fixture repository service (tách khỏi objectRepository nếu phù hợp), server routes, draftManager | Static scan/CRUD/permissions/atomicity/revision tests đạt |
| E — Studio/BDD | index.html/app.js/styles.css shared primitives, compiler/parser/schema | Workflow ba khung và round-trip contract đạt |
| F — QA/docs | Mock server, runner integration, UI verification, usage/migration docs, learning | Gate 4 và checklist mục 10 có evidence |

Không yêu cầu thêm dependency/framework chỉ vì plan có wizard. Không rollout/publish/sync remote tự động sau khi chạy test.

## 9. Ma trận kiểm thử nghiệm thu

Mock API chạy loopback port động, có create/delete/query audit và khả năng mô phỏng timeout/500/404. Observer nằm ngoài vòng đời fixture/worker được test để kiểm tra tài nguyên sau teardown; không assert deleted trước teardown xảy ra.

| ID | Ca bắt buộc | Expected result |
|---|---|---|
| V01 | Engine repo, copy-core, npm tarball consumer, CWD khác, root sai | Chỉ load consumer đã chọn; root sai fail rõ |
| V02 | Canonical/legacy duplicate, reserved export qua rawCode và git file | Không override core; diagnostic trước test |
| V03 | Syntax/export/dependency/cycle/scope lỗi, module side effects | Static server không execute source; unsupported/invalid blocked |
| V04 | Test PASS + API create/delete | Observer thấy resource đã xóa và audit đúng owner |
| V05 | Assertion FAIL và test TIMEOUT sau create | Cleanup được thử trong teardown budget; lỗi test gốc còn trong report |
| V06 | Setup fail sau resource thứ nhất | Resource đã tạo được cleanup; resource chưa tạo không bị xóa nhầm |
| V07 | DELETE 500, 401, 404, network hang; nhiều tasks | Policy status/retry đúng, bounded thời gian, tiếp tục tasks còn lại, report trung thực |
| V08 | LIFO, double runAll/register invalid/re-entry | Thứ tự và exactly-once attempt trong registry đúng; không lặp vô hạn |
| V09 | Request/client disposal order | API client còn dùng được khi cleanup thực hiện |
| V10 | Retry, parallel workers, mobile, API-only test | Resource ID/isolation đúng; API-only không bắt buộc browser |
| V11 | Worker kill và response lost sau create | Không fake guaranteed cleanup; residual/orphan outcome ghi rõ |
| V12 | Traversal, junction, quote/newline/template injection, secret logs | Không vượt path root, generated code không bị chèn lệnh, token không lộ |
| V13 | Draft invalid + Playwright collection/framework checker | Draft không làm hỏng runner/canonical scan |
| V14 | Create race, stale save/delete, disk failure, backup restore | Không mất bản mới/ghi nửa file; UI giữ dirty data |
| V15 | Core mutation qua mọi route; custom dependency delete | Backend guard thống nhất; không sửa file bị bảo vệ |
| V16 | BDD create/compensation, early fail, parse-save round trip | Registration đúng vị trí, không mất/nhân đôi cleanup |
| V17 | Sync dry-run và Git publish policy | Fixture consumer/hash không đổi; script/page/data/fixtures vẫn được push |
| V18 | 1920x1080 → 1440x900 → 1280x800 → 390x844, Light/Dark | Không clipping/overlap/overflow; keyboard/focus/editor states đạt |

### Lệnh baseline có sẵn

```powershell
node --test core/fixtures/customFixtures.test.js
node --test core/fixtures/pagesFactory.test.js core/generator/objectRepository.test.js core/generator/visualBuilderCompiler.test.js core/system/gitSyncService.test.js
npm run check:framework
node --check dashboard/public/app.js
node --check dashboard/server.js
npx playwright test tests/e2e/desktop/sample_cleanup_fixture.spec.js --project="Desktop Smoke Tests"
```

- Sample cleanup hiện có là smoke, không thay V04–V11. Thêm suite runner integration mới, ghi tên/lệnh chính xác sau khi tạo.
- Ca runner cố ý FAIL/TIMEOUT chạy trong harness riêng: harness kiểm tra expected exit/result và audit cleanup; không để suite smoke mặc định đỏ hoặc đánh dấu test.fail rồi bỏ qua teardown outcome.
- Unit test không thay real Playwright lifecycle; npm pack dry-run không thay cài tarball vào consumer sạch.
- Trước khi sửa spec, đọc AI_PROMPTS/TEST_AUTOMATION_LESSONS: POM, BDD, Precondition, Given assertion/evidence, không hard wait.
- Chạy mọi process test có timeout hữu hạn và cleanup process/temp thuộc task; không restart/kill Dashboard người dùng.

## 10. Quality gates, evidence và rollback

- Gate 1: scope, lifecycle, ownership, migration và unsupported cases chốt rõ.
- Gate 2: API schema, permission/button matrix, BDD mapping và V01–V18 đủ handoff.
- Gate 3: unit/integration/static/framework checks đạt; không override core hay mất custom fixture.
- Gate 4: Senior QA xác minh browser/API/runner thực tế; P0/P1 chưa xử lý thì chưa nghiệm thu.
- Gate 0.5: cập nhật LEARN-006 bằng evidence implementation; chỉ nâng lesson khi root cause/pattern/regression đã xác minh.

Checklist mục tiêu 10/10 — tất cả phải đạt, không dùng điểm trung bình để bỏ qua lỗi nghiêm trọng:

- [ ] Consumer root/composition đúng trên package và copy-core.
- [ ] Sync/Git/migration bảo toàn fixture nghiệp vụ.
- [ ] Registry không override core, validate semantic/export/dependency đúng.
- [ ] Cleanup ownership, LIFO và dependency lifetime đúng.
- [ ] Timeout/retry/failure outcomes có bằng chứng, không fake success.
- [ ] Template/API/secret/path validation đúng.
- [ ] Draft/atomic save/conflict/delete/backup đúng.
- [ ] BDD registration và round-trip không mất cleanup.
- [ ] Studio ba khung, shared editor, responsive/themes/accessibility đạt.
- [ ] Mock integration, usage docs, rollback và learning hoàn tất.

Evidence ghi revision/working-tree snapshot, OS/browser/runtime, lệnh, thời điểm, PASS/FAIL/NOT RUN, artifact và hạn chế. Kết quả review ở mục 2 giữ riêng. Không có test hoặc không chạy được phải NOT RUN, không ghi PASS.

Rollout opt-in qua custom fixture mới; không tự chuyển toàn bộ test. Trước migration lưu manifest/hash/backup, không tự xóa legacy. Rollback theo commit/hunk thuộc task, phục hồi registry và frontend/API contract cùng nhau; giữ nguyên custom/data/draft của người dùng. Nếu fixture mới lỗi, phục hồi phiên bản trước của fixture và chạy lại validation, không bỏ qua precondition để làm suite xanh. Việc publish hoặc đồng bộ vệ tinh thật ngoài phạm vi cập nhật plan này.

Tham chiếu lifecycle: https://playwright.dev/docs/test-fixtures#execution-order và https://playwright.dev/docs/test-timeouts — kiểm tra tương thích với phiên bản cài thực tế khi triển khai.
