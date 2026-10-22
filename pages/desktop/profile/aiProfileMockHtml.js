function getAiProfileMockHtml() {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Hồ sơ của tôi - Trợ lý AI</title></head>
<body>
  <h2>Quản lý Hồ sơ của tôi</h2>
  <div id="section-intro" style="margin-bottom: 20px;">
    <h3>Giới thiệu bản thân</h3>
    <div id="intro-saved-content" data-test-id="intro-saved-content" style="border: 1px solid #ccc; padding: 10px; min-height: 40px;">Chưa có giới thiệu bản thân</div>
    <button id="btn-add-intro" data-test-id="btn-add-intro">Chỉnh sửa giới thiệu</button>
  </div>
  <div id="section-exp" style="margin-bottom: 20px;">
    <h3>Kinh nghiệm làm việc</h3>
    <div id="exp-saved-content" data-test-id="exp-saved-content" style="border: 1px solid #ccc; padding: 10px; min-height: 40px;">Chưa có kinh nghiệm</div>
    <button id="btn-add-exp" data-test-id="btn-add-exp">Thêm kinh nghiệm</button>
  </div>
  <div id="modal-intro" data-test-id="modal-ai-intro" style="display: none; border: 2px solid #007bff; padding: 20px; background: #fff;">
    <h4>Chỉnh sửa Giới thiệu bản thân</h4>
    <textarea id="txt-intro-source" data-test-id="txt-ai-intro-source" style="width: 100%; height: 80px;" placeholder="Nhập giới thiệu của bạn..."></textarea>
    <div style="margin-top: 10px;"><button id="btn-ai-rewrite-trigger" data-test-id="btn-ai-rewrite-trigger">Viết lại bằng AI</button></div>
    <div id="ai-preview-box" data-test-id="ai-preview-box" style="display: none; background: #f0f7ff; border: 1px dashed #007bff; padding: 15px; margin-top: 15px;">
      <h5>Gợi ý từ trợ lý AI:</h5>
      <div style="margin-bottom: 10px;">
        <button id="tone-pro" data-test-id="btn-ai-tone-pro" class="btn-tone">Chuyên nghiệp</button>
        <button id="tone-persuasive" data-test-id="btn-ai-tone-persuasive" class="btn-tone">Thuyết phục</button>
        <button id="tone-concise" data-test-id="btn-ai-tone-concise" class="btn-tone">Ngắn gọn dễ đọc</button>
      </div>
      <div id="ai-active-tone" data-test-id="ai-active-tone" style="font-weight: bold; margin-bottom: 5px;">Giọng văn: Chuyên nghiệp</div>
      <div id="ai-preview-content" data-test-id="ai-preview-content" style="background: #fff; padding: 10px; border-radius: 4px; min-height: 50px;"></div>
      <div style="margin-top: 10px;"><button id="btn-ai-apply" data-test-id="btn-ai-apply">Áp dụng</button><button id="btn-ai-cancel" data-test-id="btn-ai-cancel">Hủy</button></div>
    </div>
  </div>
  <div id="modal-exp" data-test-id="modal-ai-exp" style="display: none; border: 2px solid #28a745; padding: 20px; background: #fff;">
    <h4>Thêm Kinh nghiệm làm việc</h4>
    <div><label>Chức danh: <input id="inp-jobtitle" data-test-id="inp-ai-jobtitle" type="text" /></label></div>
    <div style="margin-top: 10px;"><label>Công ty: <input id="inp-company" data-test-id="inp-ai-company" type="text" /></label></div>
    <div style="margin-top: 10px;"><label>Mô tả công việc:<textarea id="txt-exp-desc" data-test-id="txt-ai-exp-desc" style="width: 100%; height: 80px;" placeholder="Mô tả công việc..."></textarea></label></div>
    <div style="margin-top: 10px;"><button id="btn-ai-generate-exp" data-test-id="btn-ai-generate-exp">Tạo mô tả bằng AI</button><button id="btn-save-exp" data-test-id="btn-save-exp">Lưu kinh nghiệm</button></div>
  </div>
  <div id="ai-loading" data-test-id="ai-loading" style="display: none; position: fixed; top: 30%; left: 40%; background: rgba(0,0,0,0.7); color: #fff; padding: 20px; border-radius: 8px;">Đang kết nối trợ lý AI...</div>
  <div id="ai-error-modal" data-test-id="ai-error-modal" style="display: none; position: fixed; top: 30%; left: 35%; background: #fff; border: 2px solid #dc3545; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
    <h4 style="color: #dc3545;">Lỗi dịch vụ AI</h4>
    <p id="ai-error-message" data-test-id="ai-error-message">Dịch vụ AI đang gặp sự cố (mã lỗi 500 / Timeout). Vui lòng thử lại sau.</p>
    <button id="btn-close-error" onclick="document.getElementById('ai-error-modal').style.display='none'">Đóng</button>
  </div>
  <button id="btn-simulate-ai-error" style="display: inline-block; margin-top: 20px;">Mô phỏng lỗi AI 500</button>
  <script>
    const tonesData = {
      'Chuyên nghiệp': 'Với 5 năm kinh nghiệm chuyên sâu trong lĩnh vực kiểm thử phần mềm, tôi có năng lực hoạch định chiến lược QA toàn diện và tối ưu quy trình kiểm thử tự động.',
      'Thuyết phục': 'Tôi là một chuyên gia kiểm thử nhiệt huyết với 5 năm tạo đột phá chất lượng phần mềm, sẵn sàng đồng hành cùng doanh nghiệp kiến tạo những sản phẩm hoàn hảo.',
      'Ngắn gọn dễ đọc': '5 năm kinh nghiệm QA/Automation Test. Thành thạo lập kế hoạch và đảm bảo chất lượng phần mềm nhanh chóng, chính xác.'
    };
    const btnAddIntro = document.getElementById('btn-add-intro');
    const modalIntro = document.getElementById('modal-intro');
    const txtIntroSource = document.getElementById('txt-intro-source');
    const btnAiRewrite = document.getElementById('btn-ai-rewrite-trigger');
    const aiPreviewBox = document.getElementById('ai-preview-box');
    const aiActiveTone = document.getElementById('ai-active-tone');
    const aiPreviewContent = document.getElementById('ai-preview-content');
    const btnAiApply = document.getElementById('btn-ai-apply');
    const btnAiCancel = document.getElementById('btn-ai-cancel');
    const introSavedContent = document.getElementById('intro-saved-content');
    btnAddIntro.addEventListener('click', () => { modalIntro.style.display = 'block'; });
    function selectTone(tone) { aiActiveTone.innerText = 'Giọng văn: ' + tone; aiPreviewContent.innerText = tonesData[tone]; }
    btnAiRewrite.addEventListener('click', () => { aiPreviewBox.style.display = 'block'; selectTone('Chuyên nghiệp'); });
    document.getElementById('tone-pro').addEventListener('click', () => selectTone('Chuyên nghiệp'));
    document.getElementById('tone-persuasive').addEventListener('click', () => selectTone('Thuyết phục'));
    document.getElementById('tone-concise').addEventListener('click', () => selectTone('Ngắn gọn dễ đọc'));
    btnAiCancel.addEventListener('click', () => { aiPreviewBox.style.display = 'none'; });
    btnAiApply.addEventListener('click', () => { txtIntroSource.value = aiPreviewContent.innerText; introSavedContent.innerText = aiPreviewContent.innerText; aiPreviewBox.style.display = 'none'; });
    const btnAddExp = document.getElementById('btn-add-exp');
    const modalExp = document.getElementById('modal-exp');
    const inpJobTitle = document.getElementById('inp-jobtitle');
    const inpCompany = document.getElementById('inp-company');
    const txtExpDesc = document.getElementById('txt-exp-desc');
    const btnAiGenerateExp = document.getElementById('btn-ai-generate-exp');
    const btnSaveExp = document.getElementById('btn-save-exp');
    const expSavedContent = document.getElementById('exp-saved-content');
    btnAddExp.addEventListener('click', () => { modalExp.style.display = 'block'; });
    btnAiGenerateExp.addEventListener('click', () => {
      const job = inpJobTitle.value.trim() || 'Chuyên viên';
      const comp = inpCompany.value.trim() || 'Doanh nghiệp';
      txtExpDesc.value = 'Đảm nhận vai trò ' + job + ' tại ' + comp + ': Xây dựng kịch bản kiểm thử tự động, tối ưu hóa pipeline CI/CD và đảm bảo chất lượng hệ thống phần mềm.';
    });
    btnSaveExp.addEventListener('click', () => { expSavedContent.innerText = inpJobTitle.value + ' tại ' + inpCompany.value + ' - ' + txtExpDesc.value; modalExp.style.display = 'none'; });
    const btnSimulateError = document.getElementById('btn-simulate-ai-error');
    const aiLoading = document.getElementById('ai-loading');
    const aiErrorModal = document.getElementById('ai-error-modal');
    btnSimulateError.addEventListener('click', () => { aiLoading.style.display = 'block'; setTimeout(() => { aiLoading.style.display = 'none'; aiErrorModal.style.display = 'block'; }, 300); });
  </script>
</body>
</html>`;
}

module.exports = { getAiProfileMockHtml };
