# PLAN 09: SYSTEM MODULARIZATION & SCALABILITY

> **Phiên bản:** 4.0 — cập nhật 2026-09-10 sau review v3.
> **Phân loại triển khai:** L4 — refactor kiến trúc, giữ tương thích hành vi và dữ liệu.
> **Mục tiêu chất lượng:** 10/10 theo rubric §10; điểm chỉ được xác nhận bằng evidence và review độc lập.
> **Trạng thái:** Kế hoạch đã cập nhật; Phase 0 chưa thực hiện. Gate 1: TECHNICAL SPIKE REQUIRED. Gate 2–4: PENDING.
> **Phạm vi lần cập nhật này:** Tài liệu kế hoạch; chưa hiện thực hóa refactor Dashboard.

## 1. Mục tiêu, phạm vi và nguồn chuẩn

Chia Dashboard Vanilla HTML/CSS/JS thành module có trách nhiệm rõ, giảm phạm vi ảnh hưởng khi sửa một tính năng, giữ nguyên API, dữ liệu, editor và luồng chạy test. Không suy ra hiệu năng hoặc độ an toàn chỉ từ số dòng/file.

Nguồn chuẩn: [Core Guide](D:/_Master_Process/00_CORE_PROCESS_GUIDE.md), [Delivery Process](D:/_Master_Process/SOFTWARE_DELIVERY_PROCESS_MASTER.md), [Modular Guide](D:/_Master_Process/02_MODULAR_ARCHITECTURE_AND_EXTENSIBILITY_GUIDE.md), [Quality Policy](D:/_Master_Process/config/quality-policy.json), [Token Policy](D:/_Master_Process/01_TOKEN_OPTIMIZATION_AND_KNOWLEDGE_SCALING.md), [Intelligence Layer](D:/_Master_Process/project_intelligence_layer_10_of_10.md), [Dashboard Prompt](../ai/dashboard/DASHBOARD_AI_PROMPT.md), [Dashboard Lessons](../ai/dashboard/AI_LESSONS.md). Core Guide hiện hành và policy được ưu tiên khi tài liệu cũ khác nhau.

| ID | Trong phạm vi | Điều kiện bảo toàn |
|---|---|---|
| REQ-01 | Backend dispatcher, routes và services liên quan | Giữ method/path/status/body/header, path safety, draft isolation, subprocess và SSE |
| REQ-02 | CSS tokens, primitives, components, views | Giữ cascade, responsive, theme, trạng thái và shared editor |
| REQ-03 | Frontend ESM, registry, bridge, state/service boundaries | Mỗi tài nguyên có một owner; không chạy song song legacy và module cho cùng action |
| REQ-04 | Chuyển đổi toàn bộ view và shared shell | Inventory đầy đủ, không bỏ màn hình nhỏ hoặc entry point ngoài tab |
| REQ-05 | Shell HTML và DOM theo nhu cầu | Chỉ thực hiện sau khi lifecycle/state migration đạt; bảo toàn draft và focus |
| REQ-06 | Kiểm thử, profiling, staged rollout và rollback | Có baseline, lệnh chạy, artifact, owner và tiêu chí dừng |

Ngoài phạm vi: đổi UI framework, đổi schema lưu trữ/API công khai, thêm tính năng nghiệp vụ, thay authentication, tối ưu hệ thống bên ngoài. Nếu phát hiện cần thay đổi các hợp đồng này, mở ADR và cập nhật scope trước khi làm.

### 1.1. Baseline đã kiểm chứng và dữ liệu còn phải đo

Kết quả `powershell -NoProfile -File D:/_Master_Process/master.ps1 audit dashboard` trong phiên review 2026-09-10: **exit 1, scanned=8, violations=4**. Số dòng dưới đây theo chính audit, không phải ước lượng v3.

| File | Dòng / giới hạn | Hướng xử lý |
|---|---|---|
| `dashboard/server.js` | 2617 / 250 | Dispatcher + route groups + services |
| `dashboard/public/app.js` | 15738 / 250 | Legacy adapter → feature slices + shell |
| `dashboard/public/agent.js` | 303 / 250 | Đưa vào inventory và chuyển về slice Agent |
| `dashboard/agent-ui.test.js` | 330 / 250 | Tách theo nhóm hành vi, giữ nguyên assertion có giá trị |

CSS/HTML không nằm trong extensions của policy hiện tại: audit PASS không chứng minh CSS/DOM đạt chất lượng. TBT, DOM count, heap và ảnh visual hiện **NOT MEASURED**; các con số ước lượng và kết luận rò rỉ bộ nhớ của v3 không được dùng làm baseline. Phase 0 ghi HEAD SHA, hash file dirty, phiên bản công cụ và môi trường để tái lập kết quả.

### 1.2. Inventory view ban đầu

13 giá trị `data-view` khác nhau đã tìm thấy trong `index.html`; Phase 0 còn phải đối chiếu router, modal, deep link và entry point động.

| DOM view | Slice mục tiêu | Đợt chuyển đổi |
|---|---|---|
| `data-view` | data | 4.1 |
| `suites-view` | suites | 4.2 |
| `fixtures-view` | fixtures | 4.3 |
| `page-manager-view` | pages | 4.4 |
| `builder-view` | bdd | 4.5 |
| `runner-view` | runner | 4.6 |
| `recorder-view` | recorder | 4.7 |
| `git-view` | git | 4.7 |
| `agent-view` | agent | 4.7 |
| `resources-view` | resources | 4.8 |
| `docs-view` | docs | 4.8 |
| `compare-view` | compare | 4.8 |
| `settings-view` | settings | 4.8 |

Shared shell có owner riêng: navigation, branding/theme, quota/status, notification, shared modal, editor/language registry. Không gom các chức năng này vào một slice nghiệp vụ chỉ để hết code trong app.js.

## 2. Hợp đồng kiến trúc và tương thích

### 2.1. TECH-01 — Backend và dependency boundaries

- Backend giữ CommonJS hiện tại; ESM chỉ áp dụng frontend. Không đổi `package.json` sang `type: module` toàn repo.
- `server.js` tạo server, shared service instances, static serving và dispatch. Routes nhận dependencies; không tự tạo bản sao runner/recorder/agent session managers.
- Route registry phải bao phủ inventory method + path + precedence, gồm wildcard/static, fallback 404/405 và streaming. Không gộp mọi response thành JSON hoặc HTTP 200.
- Giữ validation, giới hạn request body, status lỗi, resolve path trong project root, bảo vệ draft và AI client config theo baseline. Chặn path traversal trước mọi ghi/xóa; subprocess Windows giữ `windowsHide: true`.
- UI gọi service/API client; feature khác chỉ dùng public API hoặc events, không import state/DOM internals. Shared core không import feature implementation. Kiểm tra import cycle và boundary trong CI.
- Client API phân biệt JSON/text/stream, timeout, HTTP error và abort; lỗi được chuẩn hóa, UI sở hữu cách hiển thị. Không tự retry thao tác ghi nếu chưa có contract idempotency.

### 2.2. TECH-02 — Strangler migration và một owner cho mỗi action

Registry là nguồn duy nhất cho view ID, loader, legacy adapter và trạng thái migration. Tất cả slice bắt đầu `legacy`; các cờ ví dụ không được mặc định bật trước test.

Lifecycle bắt buộc: `prepare → mount → activate → deactivate → dispose`. `prepare/mount` không lặp khi nhiều click cùng chờ một import; `activate/deactivate` hỗ trợ quay lại view; `dispose` hủy tài nguyên vĩnh viễn.

1. Bootstrap thiết lập registry/bridge và service chung trước khi enable navigation/actions. Giữ loading rõ ràng; startup error có retry và không hiển thị màn hình rỗng.
2. Với slice legacy, adapter là owner đăng ký listener/timer/DOM. Với slice migrated, legacy registration và startup side effects của slice đó bị vô hiệu trước khi module được mount. Chỉ đổi router là chưa đủ.
3. Router dùng navigation generation để bỏ kết quả import/request cũ. A → B → A nhanh chỉ activate navigation cuối, không để B mount đè A.
4. Trước rời view, kiểm tra dirty state. Chỉ commit đổi view sau khi user chọn lưu/bỏ thay đổi hoặc hủy chuyển. Save thất bại giữ nguyên bản sửa và view.
5. Mỗi registration có disposer; deactivate ngừng request/polling chỉ thuộc view. Không dừng phiên chạy test hoặc session ứng dụng khi đóng view.
6. Import/prepare thất bại trước side effects có thể trả về legacy sau cleanup. Sau khi mutation đã gửi, không tự chạy lại bằng legacy: đối soát trạng thái server, hiển thị lỗi và cho retry có kiểm soát.
7. Rollback mặc định áp dụng ở lần tải app tiếp theo bằng release artifact/cấu hình tương thích. Hot rollback chỉ được bật nếu spike chứng minh bàn giao state và dispose an toàn.

### 2.3. TECH-03 — Window bridge và inventory handler

- Quét `index.html`, mọi JS/template sinh HTML và các trạng thái DOM sau render. Regex chỉ là nguồn gợi ý; handler inventory đối chiếu runtime mới là gate đầy đủ.
- Inventory gồm action name, nguồn gọi, owner, sync/async, tham số, phụ thuộc `this/event`, readiness và callers xuyên view. Bao gồm property handlers và `addEventListener`, không chỉ `onclick`.
- Bridge dùng allowlist; từ chối overwrite tên của owner khác; registration trả disposer và chỉ gỡ đúng registration của mình. Public action names tồn tại trước khi control được enable.
- Action async có thể chờ loader; control chỉ gửi một mutation. Action đồng bộ phụ thuộc return value phải được nạp trước khi enable, không chuyển mù quáng thành async.
- Forward đúng arguments/context; xử lý cả synchronous throw và Promise rejection. Lỗi đến error channel thống nhất, người dùng nhận feedback; không nuốt lỗi thành thành công.
- Bridge là lớp tương thích tạm thời. Cuối migration chuyển inline events thuộc ứng dụng sang delegated/bound actions, gỡ export không còn caller; giữ compatibility export có caller được ghi rõ trong inventory.

### 2.4. TECH-04 — State, events và phiên chạy độc lập view

| State/tài nguyên | Owner | Contract |
|---|---|---|
| Active view, theme, framework status | Shell store | Chỉ shell cập nhật; view đọc snapshot/subscribe |
| Form, selection, dirty buffer | Slice store/editor controller | Giữ qua deactivate; dispose chỉ sau quyết định lưu/bỏ |
| Dataset/catalog | Domain service | Snapshot + revision/invalidation; một nguồn đọc/ghi |
| Run ID, kết quả, live logs, recorder/agent session | Session services | Tồn tại ngoài view; view chỉ subscribe/unsubscribe |
| View fetch, timer, DOM listener | View lifecycle | Abort/clear/dispose; response cũ không ghi đè state mới |

Event envelope: `{ type, version: 1, entityId, revision, source }`; danh mục `STUDIO_EVENTS` công bố producer, consumer và payload cụ thể trong Phase 0. Không gửi secrets hoặc mutable state object qua event.

Subscriber đăng ký rồi đọc snapshot kèm revision; bỏ event cũ/trùng và refresh khi revision mới. Slice lazy-load không phụ thuộc việc đã nghe được mọi event trước khi mount. Legacy adapter đọc/ghi qua cùng domain service; không duy trì hai cache tự sửa độc lập. Không phát event vòng lặp khi nhận cập nhật từ adapter.

SSE/EventSource do session service quản lý: rời tab chỉ unsubscribe UI; `EventSource.close()` khi service dispose, không dùng AbortController thay cho close. Reconnect theo contract server hiện có; nếu không có replay/cursor, đọc snapshot authoritative và hiển thị khoảng log thiếu thay vì tự tuyên bố đầy đủ. Không thay backend protocol trong refactor chỉ để bổ sung replay.

### 2.5. TECH-05 — CSS, editor và DOM

- Tách CSS theo thứ tự rule hiện hữu trước; ghi source-order map cho selector trùng, media queries, theme overrides, keyframes và URL tương đối. Đổi thứ tự cascade là thay đổi hành vi cần visual evidence.
- Chọn entry stylesheet với danh sách `<link>` có thứ tự; không thêm chuỗi `styles.css → main.css → @import` và gọi đó là bundle tối ưu. Nếu giữ facade cũ, phải test compatibility riêng và bảo đảm trang chính không tải CSS hai lần.
- Tái sử dụng tokens, layout 3 cột, modal primitives và một editor/language registry. Không thêm framework/bundler chỉ để tách file.
- Phase 4 giữ DOM tĩnh để giảm số biến thay đổi đồng thời. Phase 5 mới chuyển markup của view sang template được mount theo nhu cầu; không chỉ ẩn bằng CSS rồi tuyên bố giảm DOM.
- Mount template xong mới bind editor/actions. Giữ ID duy nhất, labels, focus restore, draft/selection, Ctrl/Cmd+S, Tab, undo/redo, scroll sync, save/revert/copy và Prism fallback khi grammar thiếu.
- Template là asset cùng release, không chứa dữ liệu người dùng chưa escape. Đảm bảo đường dẫn asset, MIME, 404 và cache version tương thích.

## 3. Cấu trúc mục tiêu và budget

```text
dashboard/
  server.js
  routes/                 # registry, routeUtils, nhóm handlers theo inventory
  services/               # orchestration mới nếu chưa có service tương ứng trong core/
  public/
    index.html            # Phase 4: DOM cũ; Phase 5: shell + view mặc định
    app.js                # bootstrap facade trong thời gian tương thích
    styles.css            # compatibility entry nếu còn consumer
    styles/               # tokens, base, components/, views/
    templates/            # Phase 5: markup theo view
    js/
      main.js
      core/               # registry, router, bridge, events, API, lifecycle
      services/           # catalog và run/recorder/agent session clients
      components/editor/  # controller, language registry, keybindings theo trách nhiệm
      legacy/             # adapters chuyển tiếp; có owner và điều kiện xóa
      views/<slice>/      # index, state, controller, rendering, service facade khi cần
```

Không bắt mọi slice tạo đủ các file rỗng; phân tách theo trách nhiệm thật. Tái sử dụng `core/` services hiện hữu trước khi tạo bản mới. Inventory là nguồn scope; cây trên không phải danh sách toàn bộ endpoint/file cần tạo.

Budget theo policy: component/hook/utils ≤150, service/API/client ≤200, module khác ≤250 dòng. Mục tiêu thiết kế entry/dispatcher ≤180 dòng, không phải ngưỡng mới của auditor. CSS/HTML dùng review riêng theo trách nhiệm, không đổi extension để lách audit.

**TECH-06 — Chuyển tiếp policy:** Auditor/hook hiện chưa hỗ trợ miễn trừ từng file. Không gọi audit đang fail là PASS, không dùng `--no-verify` hoặc nới global limit để vượt gate. Phase 0 phải chốt một cơ chế staged migration được owner review: policy/tooling hỗ trợ baseline có path, hash, owner, hạn xử lý và kiểm tra không tăng nợ; hoặc chuỗi extraction hợp policy trước khi merge. Nếu cần sửa Master Hub, mở thay đổi riêng có regression evidence trước commit bị ảnh hưởng. Scoped checks trong quá trình làm chỉ là evidence cục bộ, không thay Gate 3. Gate cuối yêu cầu audit toàn Dashboard exit 0 và xóa toàn bộ ngoại lệ chuyển tiếp.

## 4. Lộ trình triển khai và đầu ra từng phase

L4 dùng tuần tự vai trò A1 → A2 → A3 → B → C → D → E theo prompts hiện hành trong Master Hub. Reviewer/QA làm ở phiên độc lập, không dùng lời giải thích Dev làm bằng chứng. Giới hạn ≤400 dòng thay đổi logic mỗi PR; pure move phải kèm mapping và diff phát hiện thay đổi hành vi, không trộn cleanup vào extraction.

| Phase / owner | Công việc bắt buộc | Điều kiện ra phase |
|---|---|---|
| **0 — Tech Lead + QA** | Inventory routes/views/actions/state/imports; baseline audit/test/visual/profile; harness cô lập; ADR TECH-01..06; spike Data slice + legacy BDD + active Runner; chốt policy chuyển tiếp | TC-01..04 baseline runnable; spike TC-05..08 đạt; ADR và cơ chế policy được review; Gate 1/2 có kết quả rõ |
| **1 — Backend Dev** | Tách một route group mỗi PR, ưu tiên read-only rồi CRUD; giữ shared session service, static/SSE và subprocess behavior | Contract + fault/security tests của nhóm đạt trước/sau; toàn route inventory có owner; không tăng nợ; không yêu cầu app.js đã hết vi phạm |
| **2 — UI Dev + Designer** | Tách CSS theo source order; giữ primitives/editor; kiểm tra assets và theme | TC-10 đạt trên baseline ổn định; không phát sinh CSS request failure/duplicate load |
| **3 — Frontend Dev** | Dựng registry/router, legacy adapters, bridge, domain/session services và shared editor; tất cả view vẫn legacy trước cutover | TC-04..08 đạt; startup side effects có ownership; lỗi load/retry không làm mất draft |
| **4 — Frontend Dev + QA** | Chuyển slice theo đợt §1.2; mỗi slice kiểm thử cả legacy/migrated và các consumer liên quan; tách agent.js/test budget | Mỗi slice có mapping hành vi + rollback drill; TC-05..09 đạt; hết code nghiệp vụ trong app.js; không còn view bị bỏ sót |
| **5 — UI Dev + QA** | Tách HTML templates và lazy DOM; gỡ inline handlers dư; giữ state ngoài DOM | TC-07,10,11 đạt; DOM/hiệu năng theo §8; keyboard/editor parity đạt |
| **6 — Reviewer + QA + Release Owner** | Full regression, audit, doctor, profiling, packaged satellite smoke và staged rollout | Gate 3/4 đạt; rollback rehearsal đạt; rubric §10 đủ evidence |

Phase 0 spike có timebox tối đa 2 ngày công; hết timebox phải ghi kết luận khả thi hoặc câu hỏi còn mở và re-plan, không tự mở rộng. Spike disposable mặc định; chỉ đưa code sang production sau review như thay đổi thông thường. Ước lượng các phase sau dựa trên inventory và kết quả spike, không cam kết một phiên cho hàng nghìn dòng.

### 4.1. Deliverables và handoff

Tạo trong Phase 0 tại `_Plan_implement/plan09-evidence/`: `inventory.md`, `contracts.md`, `adr.md`, `baseline.md`, `test-matrix.md`, `rollout.md`. Mỗi artifact có owner, commit/hash, lệnh, expected/actual, timestamp, trạng thái PASS/FAIL/NOT RUN và link report. Các đường dẫn này là đầu ra dự kiến, chưa có nghĩa artifact đã tồn tại.

Gate 2 chỉ đóng khi mỗi action trong inventory có required/optional fields, validation baseline, các trạng thái, error location, confirmation và AC/TC. Không nhân bản mô tả business rule mới; liên kết source/test hiện hữu và ghi rõ phần còn thiếu.

## 5. Ma trận hành vi và validation bảo toàn

| BR/UX/VAL | Luồng | Loading / disabled / lỗi | Expected result |
|---|---|---|---|
| BR-01 / UX-01 / VAL-01 | Tạo/sửa Data, Suite, Fixture, Page, BDD | Giữ required/optional và giới hạn hiện tại; inline validation; mutation pending chặn submit trùng | Invalid không gửi request; valid gửi đúng một lần; lỗi server giữ nội dung |
| BR-02 / UX-02 / VAL-02 | Lưu editor và chuyển file/view | Dirty guard với lưu/bỏ/hủy; lỗi lưu ở view/toast đã chuẩn hóa | Hủy giữ view; lưu fail không mất buffer; bàn phím cùng semantics nút |
| BR-03 / UX-03 / VAL-03 | Xóa/ghi đè | Confirmation chứa đúng entity; disable khi pending; không retry tự động | Cancel không mutation; success refresh snapshot; conflict không giả thành success |
| BR-04 / UX-04 / VAL-04 | Run/stop, recorder, agent | Giữ điều kiện enable; status từ session service; timeout/reconnect rõ | Chuyển view không tạo/dừng phiên ngoài ý muốn; không nhân đôi execution |
| BR-05 / UX-05 / VAL-05 | Tab, lazy load, retry | Loading/focus rõ; lỗi load có retry; latest navigation wins | Không mount view cũ đè view mới; không mất dirty state |
| BR-06 / UX-06 / VAL-06 | Path, malformed JSON, AI settings | Giữ security validation, draft isolation và client-scoped settings | Không ghi ngoài root, không lộ secrets, không ghi đè cấu hình user khác |

Nếu baseline chứa defect, ghi issue riêng và expected behavior được review; không đóng băng lỗi làm chuẩn, cũng không âm thầm sửa nghiệp vụ trong pure extraction.

## 6. Test harness và lệnh thực thi

**Các file/lệnh mới dưới đây là deliverable cần tạo ở Phase 0, hiện NOT RUN.** Đọc `ai/shared/AI_PROMPTS.md` và `ai/shared/TEST_AUTOMATION_LESSONS.md` trước khi viết Playwright tests.

- Config riêng `playwright.dashboard.config.js`: CommonJS, `testDir: './tests/dashboard'`, `testMatch: '**/*.spec.js'`, project `Dashboard Chromium`, không dùng grep/testMatch của E2E nghiệp vụ. Output riêng, retries=0 ở baseline; retry chẩn đoán không xóa first failure.
- `tests/dashboard/support/` quản lý server riêng, port khả dụng, timeout readiness và shutdown. Dùng `QA_PROJECT_ROOT` trỏ fixture workspace tạm được tạo đầy đủ; khởi chạy đúng entry ở repo, không dùng dashboard đang chạy của người dùng. Teardown chỉ xóa root tạm đã xác minh và process do harness tạo.
- Fixture workspace chứa data/page/spec/suite/draft mẫu hợp lệ và malformed variants. Git, AI, recorder dùng fake adapters hoặc local fixture repo; không push, gọi model trả phí hoặc sửa dữ liệu thật. Ít nhất một happy run dùng Playwright thực với trang fixture local.
- API contract tests ở `tests/dashboard-api/`, dùng Node test runner; routes hiện hữu được test trước extraction. SSE test có deadline, đóng stream và kiểm tra reconnect/cleanup riêng.
- Inventory test Node hiện hữu trong core/dashboard trước khi định nghĩa script `test:dashboard:regression`; include generator/fixture/session/Agent contracts liên quan. `npm test` không được coi là tự chạy toàn bộ Node unit tests.

```powershell
# Lệnh hiện có: chạy và lưu actual output, không mặc định PASS
powershell -NoProfile -File D:/_Master_Process/master.ps1 audit dashboard
powershell -NoProfile -File D:/_Master_Process/master.ps1 doctor .
npm run check:framework
npm test

# Lệnh dự kiến sau khi harness và scripts được tạo ở Phase 0
npx playwright test --config=playwright.dashboard.config.js --project="Dashboard Chromium" --list
npx playwright test --config=playwright.dashboard.config.js --project="Dashboard Chromium"
node --test tests/dashboard-api/*.test.js
npm run test:dashboard:regression
```

Gate discovery: `--list` có đủ TC theo manifest và số test >0; không dùng `--pass-with-no-tests`. Kiểm tra glob của Node runner trên Windows/Node đang dùng; nếu không hỗ trợ, script regression enumerate file và truyền argument list, không shell-interpolate tên file. Baseline `npm test` phụ thuộc môi trường ngoài phải phân loại riêng; NOT RUN/FAIL không đổi thành PASS.

## 7. Traceability và QA acceptance

Mỗi TC dưới đây được mở thành case/data/expected cụ thể trong `test-matrix.md`; các ID là yêu cầu tối thiểu, không thay inventory từng action.

| REQ → TECH / BR | AC | TC và điều kiện PASS |
|---|---|---|
| REQ-01 → TECH-01 / BR-01,03,06 | AC-01: API/persistence parity | TC-01: Mọi method/path inventory có success + lỗi applicable; status/schema/header/side effects giữ contract; CRUD có cleanup |
| REQ-01 → TECH-01 / BR-04 | AC-02: Streaming/session parity | TC-02: SSE connect/disconnect/reconnect, run/stop, timeout; không orphan process; session snapshot đúng |
| REQ-06 → TECH-06 | AC-03: Harness runnable và cô lập | TC-03: discovery >0 và đủ manifest; start/stop server; workspace thật không bị ghi; baseline Node/E2E được phân loại |
| REQ-03 → TECH-03 / BR-05 | AC-04: Actions đầy đủ | TC-04: static + dynamic DOM inventory coverage 100%; actions trước/sau lazy-load; async failure và collision có kiểm tra |
| REQ-03,04 → TECH-02 / BR-01,04 | AC-05: Single ownership | TC-05: hai mode mỗi slice, một click → đúng một mutation; 20 vòng chuyển view không nhân listener/polling |
| REQ-03 → TECH-02 / BR-05 | AC-06: Race/load recovery | TC-06: import 404, offline, slow request, A→B→A nhanh; latest wins, retry không replay mutation |
| REQ-03,05 → TECH-04,05 / BR-02 | AC-07: Không mất bản sửa | TC-07: dirty save/discard/cancel, save 500/conflict, reopen modal/file/view; buffer và editor parity |
| REQ-03,04 → TECH-04 / BR-01,04 | AC-08: Cross-view consistency | TC-08: sửa Data trước khi BDD load; rename/delete; snapshot revision đúng; log/run state còn khi quay lại |
| REQ-04 → TECH-01..04 / BR-01..06 | AC-09: Journey parity | TC-09: Data→BDD→POM→save→run→result; Fixture cleanupQueue kể cả test fail; mọi 13 view và shell có journey |
| REQ-02,05 → TECH-05 / UX-01..06 | AC-10: Visual/a11y parity | TC-10: 1920×1080 rồi 1440×900,1280×800,390×844 × Light/Dark; keyboard, contrast, clipping/overlap; editor Save/Tab/scroll |
| REQ-05,06 → TECH-05 | AC-11: Performance có bằng chứng | TC-11: protocol §8; DOM, heap, TBT và tương tác đạt ngưỡng; không suy ra từ số dòng |
| REQ-06 → TECH-02,06 | AC-12: Release/rollback khả thi | TC-12: audit toàn dashboard exit 0, policy exceptions hết; package/satellite smoke; rollback drill không mất dữ liệu |

Fault/security cases gồm input rỗng, sát biên min/max, unicode/tên dài, malformed JSON, traversal, permission denied, 404/409/500 khi applicable, double click, slow/offline và retry. Không tự đổi status code backend chỉ để khớp mã ví dụ.

Console gate: zero unexpected `pageerror`, unhandled rejection, console error và warning mới. Warning baseline cần owner, lý do và disposition; không chặn mù quáng warning bên thứ ba hoặc tắt console để test xanh. Quét rendered UI loại debug/raw stack, undefined/null, TODO và code comment lộ ra.

## 8. Protocol đo lường và ngưỡng nghiệm thu

Ngưỡng dưới đây là mục tiêu thiết kế, chưa phải kết quả đo. Phase 0 khóa fixture, máy, OS/browser phiên bản, viewport, CPU throttling và cách đo; chỉ thay target qua ADR có lý do/evidence trước cutover.

| Chỉ số | Cách đo | Ngưỡng |
|---|---|---|
| TBT initial load | Chromium/Lighthouse cùng phiên bản, CPU 4× slowdown, 1920×1080; 5 cold runs, so median trước/sau | Median mới ≤ baseline + max(20ms, 10% baseline); ghi mức cải thiện thực, không cam kết % khi chưa đo |
| Tab ready | performance marks từ navigation đến view ready; 5 lượt cold và 5 lượt warm riêng, cùng fixtures/network profile | Median mỗi nhóm ≤ baseline + max(50ms, 10% baseline); không đánh đổi lazy-load thành tab chậm không báo |
| DOM | Đếm ở app-ready của shell + tab mặc định, không chỉ DOMContentLoaded; báo thêm element count sau mỗi view | Mục tiêu <1500 elements; nếu không khả thi mà vẫn giữ hành vi, giải quyết bằng spike/ADR trước Phase 5, không tự bỏ gate |
| Heap/tài nguyên | Warm tất cả view, full GC bằng cùng DevTools protocol; snapshot sau 20 và 40 vòng cùng hành động | Không tăng listener/timer/session count sau warmup; retained heap tăng ≤max(5MB,10% snapshot 20 vòng); điều tra retaining path nếu vượt |
| CSS/network | HAR cùng cold/warm fixture; request failures, duplicate entry, transferred bytes và thời gian load | 0 asset failure/duplicate stylesheet; không tăng transferred CSS bytes >5% baseline |
| Visual | Cố định font/data/time/animations; mask duy nhất vùng động có lý do; 8 tổ hợp viewport/theme | 0 sai khác bố cục/interaction chưa giải thích; pixel diff tolerance chốt từ baseline lặp, không nới sau refactor để che lỗi |
| Token/context | Đo task sửa BDD đại diện, ghi các file thực sự đọc và token estimate theo cùng công thức | Báo before/after; chỉ số quan sát, không release gate hay cam kết tiết kiệm từ một file |

## 9. Rollout, rollback và quality gates

- Release Owner ghi artifact/version, config flags, compatible backend/frontend và cách phục hồi trong `rollout.md`; không thay file live rời rạc tạo mixed-version app. Giữ assets phiên bản trước trong cửa sổ rollout cho tab đang mở.
- Triển khai pilot trên workspace thử nghiệm/satellite kiểm soát trước, chạy journey và ít nhất một phiên test thực; quan sát đủ một chu kỳ run hoàn tất trước mở rộng. Kiểm tra package phân phối chứa JS/CSS/template mới và hoạt động khi project root khác package root.
- Trigger dừng: mất/corrupt dữ liệu, duplicate run/write, P0/P1, contract mismatch, startup failure, gate performance vượt ngưỡng hoặc regression chưa giải thích. Owner dừng mở rộng, lưu evidence, không tự retry mutation.
- Rollback frontend: giữ/sao lưu dirty buffer theo contract, chặn mutation mới, quay artifact/config cũ và reload có kiểm soát. Backend cần restart: drain hoặc kết thúc phiên đang chạy theo quyết định có ghi nhận; giữ persistent data và đối soát run ID. Không gọi restart này là zero downtime.
- Mục tiêu vận hành là giữ Dashboard dùng được qua từng bước; không cam kết Zero-Downtime khi chưa có hạ tầng/versioning và rehearsal chứng minh.
- Không xóa legacy implementation của slice trước khi rollback drill đạt. Khi bỏ legacy cuối cùng, rollback chuyển sang previous artifact; registry giữ metadata hữu ích nhưng xóa cờ/adapters chết.

| Gate | Owner | Điều kiện |
|---|---|---|
| 1 | BA + Tech Lead | Inventory/scope/BR rõ; SPIKE-01 chứng minh coexistence Data–BDD–Runner và policy chuyển tiếp khả thi |
| 2 | BA + Designer + Tech Lead | ADR, action matrix, AC/TC, baseline, scripts và rollback handoff đầy đủ; không còn quyết định critical để Dev tự đoán |
| 3 | Reviewer độc lập | Diff/contract/security/concurrency review, boundary checks, tests, budget và policy hợp lệ; evidence gắn commit |
| 4 | QA độc lập + Release Owner | 100% AC pass; zero P0/P1; P2/P3 có owner, impact, workaround và quyết định chấp nhận; rollback đạt |

`doctor .` là kiểm tra toàn project: Phase 0 ghi baseline và owner xử lý lỗi ngoài Dashboard. Trước release cần exit 0 hoặc disposition ngoài scope được Release Owner ghi rõ; không tuyên bố HEALTHY khi exit khác 0. Audit dashboard exit 0 vẫn là điều kiện bắt buộc của Plan 09.

## 10. Rubric mục tiêu 10/10 và tiến độ

Mỗi tiêu chí được 1 điểm khi có artifact đáp ứng đầy đủ và reviewer xác nhận; thiếu evidence được 0, không tự lấy trung bình để bỏ qua blocker. Điểm kế hoạch chỉ đánh giá độ đầy đủ handoff; **10/10 delivery cần kết quả thực nghiệm**, không thể suy ra từ tài liệu này.

| Điểm | Tiêu chí | Evidence yêu cầu |
|---|---|---|
| 1 | Scope/inventory đầy đủ | 13 views + shell + toàn route/action map |
| 1 | Backward compatibility | Contract matrix + TC-01/02 |
| 1 | Module boundaries và policy | ADR + import checks + audit |
| 1 | Migration ownership/race | Spike + TC-05/06 |
| 1 | State/editor/data integrity | TC-07/08 và dirty-state matrix |
| 1 | UI/CSS/accessibility | TC-10 và 8 tổ hợp visual |
| 1 | Harness/regression/security | Discovery + TC-03/04/09 + fault evidence |
| 1 | Performance có thể tái lập | Baseline/profile + TC-11 |
| 1 | Rollout/rollback/package | Rehearsal + TC-12 |
| 1 | Review độc lập và traceability | Gate 1–4 records, AC→TC→commit, disposition defects |

- [ ] Phase 0: inventory, baseline, harness, spike, ADR, policy transition. (Trạng thái: Đã làm một phần — Đang mở Gate 1/2: Cần đo baseline hiệu năng thực và spike tương tác thật Data/BDD/Runner).
- [x] Phase 1: backend routes/services extraction và contract parity. (Trạng thái: Hoàn tất nghiệm thu — Đã tách 18 file backend đạt budget, 16 API contract tests tại `tests/dashboard-api/` PASS 16/16, script `test:dashboard:regression` tự động).
- [ ] Phase 2: CSS extraction và visual parity. (Trạng thái: Đã làm một phần — Đã tách 17 files, đã sửa lỗi cascade order `resources.css`, test responsive 4 viewports gồm `390x844` PASS; Cần bổ sung visual screenshot pixel diff cho toàn bộ 13 views).
- [x] Phase 3: registry/bridge/state/session/editor foundations. (Trạng thái: Hoàn tất nghiệm thu — Đã triển khai 8 modules ESM tại `dashboard/public/js/` đạt 100% budget dòng, tích hợp `main.js`, TC-04..08 PASS trong `tests/dashboard/foundation-parity.spec.js`, 28/28 tests regression PASS).
- [ ] Phase 4: đủ 13 slice + shell; agent.js và test budget; rollback từng slice.
- [ ] Phase 5: DOM templates, accessibility, performance và bridge cleanup.
- [ ] Phase 6: full verification, package/satellite, rollout và rollback.
- [ ] Gate 0.5: cập nhật candidate có evidence; không tự promote thành project standard.

**Bước triển khai đầu tiên:** Phase 0. Kết quả review tài liệu không thay thế spike, code review, kiểm thử chạy thực tế hoặc quyết định release.
