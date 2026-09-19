# `core/local/` — Vùng mở rộng riêng của dự án

**Thư mục này thuộc về dự án vệ tinh, KHÔNG thuộc Hub.**

## Tại sao có thư mục này

`core/` là tài sản của Hub `_Automation-Project` và được đồng bộ một chiều xuống
các vệ tinh (Vieclam24h, CarThings). Mọi sửa đổi trực tiếp trong `core/` tại repo
vệ tinh **sẽ bị ghi đè** ở lần sync kế tiếp.

Việc này đã xảy ra thật: commit `7ad6984` tại `hadinhkms/Automation_Carthings`
(2026-09-16, "fix(core): restore commonUtils generators and environment URL mappings")
phải khôi phục bằng tay 179 dòng `core/utils/commonUtils.js`, 4 dòng
`core/config/dashboardConfig.js` và 11 dòng test sau khi sync xoá mất.

`core/local/` là **điểm nối duy nhất và ổn định**: nó nằm trong `excludes` của
module `core` tại [`scripts/sync-satellites.js`](../../scripts/sync-satellites.js),
nên sync không bao giờ chạm vào. Cách này thay cho việc liệt kê từng file vào
`excludes` — danh sách đó sẽ phình dần và khiến Hub vĩnh viễn không cập nhật được
`commonUtils.js` cho vệ tinh nữa.

## Hệ quả cố ý: file Hub đặt ở đây không bao giờ tới được vệ tinh

Vì cả thư mục bị exclude, bất kỳ file nào Hub commit vào `core/local/` (kể cả
chính `README.md` này) sẽ **không** được sync sang vệ tinh. Đó là chủ ý: vùng này
do dự án sở hữu, Hub chỉ giữ tài liệu tham chiếu tại chỗ.

## Cách dùng

### 1. Mở rộng `commonUtils`

Tạo `core/local/commonUtils.local.js`, export một object phẳng:

```js
// core/local/commonUtils.local.js
const generateRandomVNIDCard = () => { /* ... */ };
const generateRandomCompanyName = () => { /* ... */ };

module.exports = { generateRandomVNIDCard, generateRandomCompanyName };
```

`core/utils/commonUtils.js` (Hub sở hữu) sẽ tự nạp file này nếu tồn tại và merge
vào export của nó. Test và page object giữ nguyên import cũ:

```js
const { generateRandomVNIDCard } = require('../core/utils/commonUtils');
```

File không tồn tại thì bỏ qua, không lỗi — vệ tinh chưa migrate vẫn chạy bình thường.
Nếu key local trùng tên với export chuẩn của Hub, bản local thắng và một cảnh báo
được in ra stderr.

### 2. URL/field riêng theo môi trường

**Không** sửa `core/config/dashboardConfig.js`. Khai báo thẳng trong
`core/config/dashboardConfig.json` (file này cũng đã nằm trong `excludes`):

```json
{
  "environments": {
    "qc": {
      "label": "QC",
      "baseURL": "https://qc.example.com",
      "apiBaseURL": "https://api-qc.example.com",
      "carthingsURL": "https://qc.carthings.example.com",
      "companyURL": "https://qc.company.example.com"
    }
  }
}
```

Mọi key chuỗi ngoài `label` / `baseURL` / `apiBaseURL` được giữ nguyên qua
`normalizeDashboardConfig()` mà không cần khai báo tên trong code Hub.

## Quy tắc

- ✅ Helper, fixture, generator, hằng số **riêng của nghiệp vụ dự án** → `core/local/`.
- ✅ Sửa đổi có giá trị cho **mọi dự án** → gửi PR ngược lên Hub, đừng để ở đây.
- ❌ Không sửa file nào khác trong `core/` tại repo vệ tinh.
- 🔍 Chạy `node scripts/pre-sync-drift.js` để phát hiện file `core/` đang lệch
  trước khi sync xoá mất chúng.
