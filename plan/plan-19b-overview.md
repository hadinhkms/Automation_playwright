# Kế Hoạch 19b: Ma Trận Giá Trị Biên (BVA/EP) & Chuẩn Hoá AC Given-When-Then (BA-2) — Plan Overview

> **Plan ID:** `PLAN-19B-SPEC-STUDIO-2026-10-01` · **Baseline:** `a20461e` · **Cấp độ:** `L3`  
> **Trạng thái:** `DRAFT — CHỜ SOÁT CHÉO` · **Research:** Không áp dụng (L3-Standard)  
> **Nguồn gốc:** `_plan_implement/19b_BVA_MATRIX_AND_BDD_FORMATTER_PLAN.md` — giữ nguyên bản gốc, không xoá.

---

## 1. Bối Cảnh & Mục Tiêu Kinh Doanh
- **Bài toán gốc:** Sau khi tách từ PLAN-19 v1 và hoàn tất PLAN-19a (Bộ sinh dữ liệu VN), hệ thống cần giải quyết 2 bài toán QA/BA trọng tâm:
  1. **BVA/EP (0 token):** Tự động phát hiện các ràng buộc số lượng/độ dài từ tài liệu đặc tả tiếng Việt/Anh và sinh 7 điểm biên kiểm thử hoàn toàn bằng thuật toán xác định.
  2. **BDD Given-When-Then (BA-2):** Chuẩn hoá các tiêu chí nghiệm thu (AC) sang kịch bản Gherkin chuẩn qua AI Gateway, giữ nguyên 100% mã định danh AC và tuyệt đối không trả dữ liệu giả khi AI lỗi.
- **Người dùng hưởng lợi:** QA Engineers, Business Analysts và Developers làm việc trực tiếp tại View `#/qa` trong modal Phân tích Yêu cầu.

## 2. WBS & Dependency Graph
| Phase | Tên Giai Đoạn | Phụ Thuộc | Chủ (BA / TL) | Trạng Thái |
|---|---|---|---|:---:|
| 1 | [phase-1-bva-boundary-matrix-core.md](phase-1-bva-boundary-matrix-core.md) | PLAN-19a đã xong | @ba / @tl | `DRAFT` |
| 2 | [phase-2-bdd-gateway-and-rules.md](phase-2-bdd-gateway-and-rules.md) | Phase 1 | @ba / @tl | `DRAFT` |
| 3 | [phase-3-spec-studio-ui-and-e2e.md](phase-3-spec-studio-ui-and-e2e.md) | Phase 2 | @ba / @tl | `DRAFT` |

```text
Phase 1 (Lõi BVA 0 Token) ──► Phase 2 (BDD Rules & AI Gateway) ──► Phase 3 (UI Spec Studio & Gate 4)
```

## 3. Research Impact
> Research: Không áp dụng (Tính năng phát triển nội bộ mở rộng từ PLAN-17 §BA-2 và PLAN-19)

| IMP | Chủ | Xử lý | Lý do | Áp dụng ở | Kiểm chứng |
|---|---|---|---|---|---|
| IMP-19B-01 | TL | ADOPT | Tách riêng hàm luật và luồng AI | Phase 1, Phase 2 | TC-01..TC-18 |

## 4. Điều Kiện Mang Theo
| Mục | Loại | Xử lý trong plan |
|---|---|---|
| C-1 | Pre-condition | PLAN-19a đã nghiệm thu và merge main tại commit `0ec0153` |
| C-2 | Rule Integrity | Không thêm exemption file size cho các file tạo mới |

## 5. Danh Mục Điểm Chưa Rõ Từ Plan Gốc (GAPs)
| ID | Điểm Chưa Rõ | Vị Trí Plan Gốc | Người Xác Nhận | Trạng Thái |
|---|---|---|---|:---:|
| GAP-19B-01 | Phê duyệt chính thức 7 quyết định thiết kế D1–D7 | Mục 0, D1–D7 | BA / PO | `OPEN` |
| GAP-19B-02 | Thẩm định và ký duyệt Corpus A (34 câu) và Corpus B (10 câu) | Phụ lục A, B | Lead QA / BA | `OPEN` |
| GAP-19B-03 | Phê duyệt hash contract `plan-19b.json` trước Phase 1 | Mục 8, Phase 0 | BA | `OPEN` |

## 6. Checklist Trạng Thái Tổng Thể
- [ ] Gate 1 — Phase files đạt `master plan-check` và có chữ ký chéo
- [ ] Gate 2 — Contract Lock (`.delivery/phases/plan-19b.json`)
- [ ] Gate 3 — Code Review độc lập sau khi hoàn tất Phase 1–3
- [ ] Gate 4 — Senior QA Verification PASS (38/38 TC, 16 Gate Scenarios)
- [ ] `master plan-archive` sau nghiệm thu toàn diện
