# Kế Hoạch 19: BDD Specification & Smart Test Data Studio (Plan Tổng)

> **Mã kế hoạch:** `PLAN-19`  
> **Phiên bản:** `v2.0` — 2026-09-28. Bản v1 (DRAFT, cùng ngày) nằm trong git history, commit `db3d741`.  
> **Trạng thái:** `ĐÃ TÁCH thành PLAN-19a và PLAN-19b — file này chỉ còn là mục lục và quyết định chung`  
> **Tham chiếu:** [AGENTS.md](../AGENTS.md), [DASHBOARD_AI_PROMPT.md](../ai/dashboard/DASHBOARD_AI_PROMPT.md), [AI_LESSONS.md](../ai/dashboard/AI_LESSONS.md), [03_ACCEPTANCE_GATES.md](../.master_process/03_ACCEPTANCE_GATES.md), [gate-scenarios.json](../.master_process/config/gate-scenarios.json), [PLAN-17](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md) (BA-2, QA-7 là 2 hạng mục còn bỏ ngỏ), [PLAN-18](18_QA_STATIC_FINDINGS_BATCH_PROCESSING_PLAN.md) (mẫu contract/evidence).

---

## 1. Vì Sao Tách

Bản v1 gộp 2 luồng giá trị không phụ thuộc nhau:

- **QA-7 (dữ liệu test VN + payload biên):** thuật toán thuần, không dùng AI, nằm ở view `#/data`. Rủi ro thấp.
- **BA-2 (BDD Given-When-Then) + BVA/EP:** cần AI cho BDD, nằm ở modal phân tích REQ của view `#/qa`. Rủi ro cao hơn.

Nếu gộp, Gate 4 phải chờ phần AI xong mới đóng được phần dữ liệu. Khi tách, mỗi plan có contract, bộ TC và gate riêng.

## 2. Danh Sách Plan Con

| Plan | Phạm vi | AI | Ước lượng | Thứ tự |
| --- | --- | --- | --- | --- |
| [PLAN-19a](19a_VN_TEST_DATA_GENERATOR_PLAN.md) | Bộ sinh CCCD / MST / SĐT / họ tên / persona theo seed; thư viện payload biên; placeholder `{{vn_*}}`; export `commonUtils`; modal sinh dữ liệu ở `#/data` | Không (0 token) | ~4 ngày | Làm trước |
| [PLAN-19b](19b_BVA_MATRIX_AND_BDD_FORMATTER_PLAN.md) · [Overview](plan-19b-overview.md) | Ma trận biên theo luật (0 token, corpus 44 câu); chuẩn hoá AC sang Given-When-Then qua AI gateway, giữ nguyên mã AC, chỉ sao chép Markdown | Chỉ phần BDD | ~4.5 ngày | Làm sau 19a |

Hai plan không dùng code của nhau. Làm tuần tự để mỗi lần trên `main` chỉ có một phase chờ gate (verifier yêu cầu HEAD sạch).

## 3. Thay Đổi So Với v1

| # | v1 | Vấn đề (đã đối chiếu với code / quy định) | v1.1 (19a / 19b) |
| --- | --- | --- | --- |
| 1 | Bảng Gate 4 dùng mã ASYNC/OWN/UI với nghĩa riêng; chỉ có 10/16 mã | Lệch nghĩa so với `gate-scenarios.json` (vd. OWN-01 là định danh đăng ký, không phải 20 vòng mount). `contract.py` bắt buộc đủ mọi scenario của nhóm đã `applies` | Mỗi plan ánh xạ đủ 16 mã theo đúng nghĩa trong config, kèm level tối thiểu |
| 2 | "CCCD 12 số modulo", test "CCCD qua checksum" | CCCD không có chữ số kiểm tra | 19a: kiểm cấu trúc (63 mã tỉnh, số thế kỷ/giới tính, năm sinh) bằng oracle độc lập |
| 3 | `mstType: enterprise \| personal` | MST 13 số là đơn vị phụ thuộc, không phải cá nhân; cá nhân dùng CCCD làm MST (TT 86/2024) | 19a D2: chỉ sinh 10 số và 13 số; thuật toán checksum đã đối chiếu với 2 MST công khai |
| 4 | Email `testmail.vn` | Có thể là tên miền thật | `@example.com` (RFC 2606, trùng quy ước hiện có) |
| 5 | Không có contract; evidence ghi `plan-19-evidence.json`; commit ở bước cuối | Quy trình PLAN-18: contract `.delivery/phases/<plan>.json` được BA duyệt hash; evidence build vào `.gate-artifacts/`; phải commit trước receipts | Phase 0 soạn `plan-19a.json` / `plan-19b.json` + evidence map; Phase 4 commit trước rồi mới ghi receipts |
| 6 | `npm test`; `tests/core-utils/` | `npm test` là `playwright test` của app vệ tinh; `tests/core-utils/` không nằm trong runner nào | Lệnh thật: `node --test …`, `npm run test:dashboard:api`, `npx playwright test -c playwright.dashboard.config.js`; test đặt cạnh file nguồn |
| 7 | Endpoint AI dưới `/api/qa/requirement/*` | Không qua chặn cross-site (chỉ áp cho `/api/ai/*`) | 19b: `POST /api/ai/format-bdd` trong `aiFastWinsRoutes.js` |
| 8 | Ghi BDD vào REQ và backup riêng | Trùng `PUT /api/qa/document` đã có backup + 409 | 19b D2: chỉ sao chép; 19a: lưu qua `create-dataset` có sẵn. Không có đường ghi file mới |
| 9 | `GIVEN/WHEN/THEN` viết hoa | Không phải Gherkin; lệch `bddDraft.js` và scaffold | `**Given/When/Then/And**` + nội dung tiếng Việt |
| 10 | BVA dùng heuristic + AI; "chính xác 100%" không đo được; 5 điểm ở mục tiêu nhưng contract trả 7 điểm | Không kiểm chứng được; tự mâu thuẫn | 19b: 100% luật, corpus 33 + 10 câu do BA duyệt, 7 điểm thống nhất, câu không nhận diện được thì liệt kê, không đoán |
| 11 | `generateSyntheticData.js` (AI sinh dữ liệu theo schema) | Không có goal/AC/TC; LLM có thể tái tạo PII thật | Bỏ khỏi phạm vi |
| 12 | Danh mục file chỉ có file mới | Bỏ sót `server.js`, `tasks/index.js`, `reqAnalyzerHelper.js` (993 dòng), `dataSlice.js`, `dataManager.js` | Mỗi plan liệt kê cả file sửa, kèm ngân sách dòng |
| 13 | Fallback AI "an toàn" chung chung | PLAN-17 dòng 78: BA-2 không được trả kết quả giả | 19b D5 + TC-11, TC-12 |
| 14 | Chèn thẳng dữ liệu tĩnh vào JSON | Chạy lại luồng đăng ký sẽ trùng CCCD/SĐT | 19a: gọi hàm trong spec (`generateVnCccd()`…) hoặc placeholder `{{vn_*}}` qua `resolveDynamicValues` |
| 15 | Token CSS `--panel-bg`, `--border` | Không tồn tại | Dùng `--surface`, `--line`, `--accent`, `--muted`, `--text` |

## 4. Quyết Định Chung

- Mỗi plan con có contract riêng và phủ đủ 16 gate scenario. Không gộp bằng chứng của 2 plan.
- Mọi hash contract do BA duyệt. Review Gate 3/4 do actor/session khác phiên implementation thực hiện.
- 19a và 19b đều không thêm exemption size-check cho file mới.

## 5. Tiến Độ

- [ ] PLAN-19a — Phase 0 (chốt D1–D6, contract)
- [ ] PLAN-19a — Phase 1 (lõi sinh dữ liệu + unit tests)
- [ ] PLAN-19a — Phase 2 (API + integration tests)
- [ ] PLAN-19a — Phase 3 (giao diện + E2E tests)
- [ ] PLAN-19a — Phase 4 / Gate 4 PASS
- [ ] PLAN-19b — Phase 0 (chốt D1–D7, duyệt corpus, contract)
- [ ] PLAN-19b — Phase 1 (ma trận biên, 0 token)
- [ ] PLAN-19b — Phase 2 (BDD qua gateway)
- [ ] PLAN-19b — Phase 3 (giao diện + E2E tests)
- [ ] PLAN-19b — Phase 4 / Gate 4 PASS
