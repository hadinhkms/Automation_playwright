/**
 * Locator của PersonalizePage (Personalized Page + Onboarding mini + xác thực OTP).
 * Tách khỏi PersonalizePage để giữ module dưới giới hạn kích thước; gán trực tiếp lên page object
 * nên spec vẫn dùng `personalizePage.<locator>` như cũ.
 * @param {import('../PersonalizePage').PersonalizePage} t
 */
function definePersonalizeLocators(t) {
  const { page } = t;
  // Banner quảng cáo & nút đóng
  t.closeBannerBtn = page.locator('.absolute.top-1.right-1, [data-test-id="common__close-button"], button.close, [class*="close-banner"]').first();
  t.absolutetop1right1 = t.closeBannerBtn;
  t.body = page.locator('body');

  // Điểm chạm gợi ý việc làm ban đầu
  t.xemViecLamDanhBtn = page.getByRole('button', { name: /Xem việc làm dành riêng/i }).or(page.getByText(/Xem việc làm dành riêng/i)).first();
  t.item10ViecLamCoLink = page.getByRole('link', { name: /\+?10 việc làm có lương hấp dẫn/i }).or(page.locator('a:has-text("10 việc làm có lương hấp dẫn")')).first();
  t['10ViecLamCoLink'] = t.item10ViecLamCoLink;

  // Xác thực tài khoản (Đăng ký / Đăng nhập OTP)
  t.nhapSoDienThoaiInput = page.getByPlaceholder(/Nhập số điện thoại/i).or(page.getByRole('textbox', { name: /Nhập số điện thoại/i })).first();
  t.tiepTucBtn = page.getByRole('button', { name: 'Tiếp tục' }).first();
  t.pleaseEnterVerificationInput = page.getByRole('textbox', { name: /Please enter verification|Digit 1/i }).or(page.locator('input[autocomplete="one-time-code"]')).or(page.locator('input[type="tel"]').first());
  t.digit2Input = page.getByRole('textbox', { name: 'Digit 2' }).or(page.locator('input[type="tel"]').nth(1));
  t.digit3Input = page.getByRole('textbox', { name: 'Digit 3' }).or(page.locator('input[type="tel"]').nth(2));
  t.digit4Input = page.getByRole('textbox', { name: 'Digit 4' }).or(page.locator('input[type="tel"]').nth(3));
  t.otpInputIndicator = t.pleaseEnterVerificationInput.or(page.locator('input[type="tel"]').first()).or(page.locator('input[autocomplete="one-time-code"]').first());
  t.nhapHoVaTenInput = page.getByPlaceholder(/Nhập họ và tên/i).or(page.getByRole('textbox', { name: /Nhập họ và tên/i })).first();
  t.emailInput = page.getByPlaceholder(/nhập email/i).or(page.locator('input[type="email"], input[placeholder*="email" i]')).first();
  t.newUserInfoModal = t.nhapHoVaTenInput.or(t.emailInput);
  t.hoanTatBtn = page.getByRole('button', { name: /Hoàn tất|Đăng ký/i }).first();
  t.dongYBtn = page.getByRole('button', { name: 'Đồng ý' }).first();

  // Màn hình mật khẩu khi số điện thoại đã tồn tại (TC-096)
  t.loginPasswordInput = page.getByPlaceholder(/nhập mật khẩu của bạn|nhập mật khẩu/i).or(page.locator('input[type="password"]')).first();
  t.passwordInput = t.loginPasswordInput;
  t.dangNhapBtn = page.getByRole('button', { name: /Đăng nhập/i }).first();
  t.authModalTitle = page.getByText(/Đăng nhập|Xác thực|Đăng ký/i).first();
  t.phoneError = page.locator('[class*="error"], [class*="helper"], [class*="feedback"], [role="alert"]').filter({ hasText: /số điện thoại/i }).or(page.getByText(/số điện thoại.*(?:không hợp lệ|đã tồn tại|chưa đúng|không đúng)/i)).first();

  // Cảnh báo giới hạn biên (TC-097) - loại trừ __next-route-announcer__ của Next.js
  t.fieldError = page.locator('[class*="error"]:not(#__next-route-announcer__), [class*="helper"], [class*="feedback"], [class*="text-danger"], [role="alert"]:not(#__next-route-announcer__)').filter({ hasText: /\S+/ }).first();
  t.limitExceededWarning = page.locator('[class*="error"], [class*="warning"], [class*="alert"], [class*="toast"]').filter({ hasText: /5 khu vực|tối đa 5|vượt quá/i }).or(page.getByText(/tối đa 5/i)).first();
  t.extraCityBtn = page.getByRole('button', { name: /Đà Nẵng|Hải Phòng|Cần Thơ/i }).first();

  // Thiết lập tiêu chí: Bước 1 - Vị trí công việc mong muốn
  t.jobTitleInput = page.locator('input[name="job_title"], input[placeholder*="vị trí công việc" i], [data-test-id="common__input"]').first();
  t.dataTestId = t.jobTitleInput;
  t.banDangTimCongHeading = page.getByRole('heading', { name: /Bạn đang tìm công việc gì/i }).first();
  t.nhanVienBanHangText = page.locator('div, span, p, li').filter({ hasText: /^nhân viên bán hàng$/i }).last();
  t.tiepTheoBtn = page.getByRole('button', { name: /Tiếp theo|Tiếp tục/i }).first();

  // Thiết lập tiêu chí: Bước 2 - Khu vực làm việc
  t.chonToiDa5Text = page.getByText('Chọn tối đa 5 khu vực').first();
  t.step2Modal = page.locator('div').filter({ hasText: 'Chọn tối đa 5 khu vực' }).filter({ hasText: /Tiếp theo|Trở về/i }).first();
  t.tphcmBtn = t.getLocationBtn('TP.HCM');
  t.haNoiBtn = t.getLocationBtn('Hà Nội');
  t.binhDuongBtn = t.getLocationBtn('Bình Dương');
  t.dongNaiBtn = t.getLocationBtn('Đồng Nai');
  t.canThoBtn = t.getLocationBtn('Cần Thơ');
  t.khacBtn = t.getLocationBtn('Khác');
  t.anGiangBtn = page.getByRole('button', { name: /An Giang/i }).or(page.locator('button, div, span, [role="button"]').filter({ hasText: /^An Giang/ })).first();

  // Thiết lập tiêu chí: Bước 3 - Mức lương mong muốn
  t.vdInput = page.getByRole('textbox', { name: 'VD:' }).first();
  t.minSalaryInput = page.getByRole('textbox', { name: 'VD:' }).first();
  t.maxSalaryInput = page.getByRole('textbox', { name: 'VD:' }).nth(1);
  t.salaryHeading = page.getByRole('heading', { name: /Mức lương|Lương/i }).or(page.getByText(/Mức lương mong muốn/i)).first();
  t.step3Indicator = t.minSalaryInput.or(t.vdInput).or(t.salaryHeading).or(page.getByText(/câu hỏi|mức lương/i)).or(t.hoanTatBtn);

  // Quản lý & điều chỉnh tiêu chí tìm việc
  t.tieuChiTimViecText = page.getByText(/Tiêu chí tìm việc của tôi/i).first();
  t.tieuChiTimViecHeading = page.getByRole('heading', { name: /Tiêu chí tìm việc/i }).first();
  t.luongCaoNhatTab = page.getByRole('tab', { name: /Lương cao nhất/i }).or(page.getByText(/Lương cao nhất/i)).first();
  t.moiNhatTab = page.getByRole('tab', { name: /Mới nhất/i }).or(page.getByText(/Mới nhất/i)).first();
  t.chinhSuaVaThemBtn = page.getByRole('button', { name: /Chỉnh sửa và thêm mới/i }).first();

  // Cập nhật kinh nghiệm & ngành nghề
  t.daCoKinhNghiemBtn = page.getByRole('button', { name: /Đã có kinh nghiệm/i }).first();
  t.chonSoNamKinhText = page.getByText(/Chọn số năm kinh nghiệm/i).first();
  t.exp3NamOption = page.locator('div').filter({ hasText: /^3 năm$/ }).or(page.getByText('3 năm')).last();
  t.div = t.exp3NamOption;
  t.chonNganhNgheText = page.getByText(/Chọn ngành nghề/i).first();
  t.hanhChinhThuKyHeading = page.getByRole('heading', { name: /Hành chính - Thư ký/i }).or(page.getByText(/Hành chính - Thư ký/i)).first();
  t.luuThongTinBtn = page.getByRole('button', { name: 'Lưu thông tin' }).first();

  // Khám phá việc làm phù hợp
  t.viecLamBtn = page.getByRole('button', { name: /Việc làm/i }).first();
  t.timViecLamBtn = page.getByRole('button', { name: /Tìm việc làm/i }).or(page.getByRole('link', { name: /Tìm việc làm/i })).first();
  t.viecLamDanhChoHeading = page.getByRole('heading', { name: /Việc làm dành cho bạn với mức/i }).first();
  t.xemTatCaLink = page.getByRole('link', { name: /Xem tất cả/i }).first();
  t.keToanTongHopLink = page.getByRole('link', { name: /Kế Toán Tổng Hợp/i }).first();

  // Thuộc tính trên Personalized Page trực tiếp
  t.personalizedPath = '/viec-lam-danh-rieng-cho-ban.html';
  t.loginOrRegisterHeading = page.getByRole('heading', { name: /Đăng nhập hoặc Đăng ký/i }).first();
  t.personalizedHeading = page.locator('h1, h2').filter({ hasText: /Việc làm.*dành riêng cho/i }).first();
  t.choChopBietNhuCauText = page.getByText(/Cho Chớp biết nhu cầu/i).first();

  // Locators cho SEO, Social và Direct Flow trên Personalized Page
  t.jobCards = page.locator('[data-test-id*="job-card"], [class*="job-card"], [class*="job_item"]');
  t.metaDescription = page.locator('meta[name="description"]');
  t.metaKeywords = page.locator('meta[name="keywords"]');
  t.canonicalLink = page.locator('link[rel="canonical"]');
  t.ogTitleMeta = page.locator('meta[property="og:title"]');
  t.ogUrlMeta = page.locator('meta[property="og:url"]');
  t.ogDescriptionMeta = page.locator('meta[property="og:description"]');
  t.fullNameInput = page.locator('input[placeholder*="họ và tên" i], input[placeholder*="Họ và tên" i]').first();
  t.consentAgreeBtn = page.getByRole('button', { name: 'Đồng ý', exact: true }).first();
  t.salaryInputs = page.locator('input[placeholder*="VD" i], input[role="textbox"]');
  t.finalPersonalizeHeading = page.locator('h1, h2, h3').filter({ hasText: /Việc làm.*dành riêng|Tiêu chí tìm việc|Gợi ý việc làm/i }).first();

  // Locators cho widget Tiêu chí tìm việc của tôi trên Personalized Page
  t.criteriaCard = page.locator('aside, div, section').filter({ hasText: /Tiêu chí tìm việc của tôi/i }).first();
  t.criteriaJobTitleText = page.locator('div, span, p').filter({ hasText: /Vị trí mong muốn ứng tuyển/i }).first();
  t.criteriaLocationText = page.locator('div, span, p').filter({ hasText: /Khu vực/i }).first();
  t.criteriaSalaryText = page.locator('div, span, p').filter({ hasText: /Mức lương mong muốn/i }).first();
}

module.exports = { definePersonalizeLocators };
