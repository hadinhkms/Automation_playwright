/**
 * dashboard/public/js/views/runner/picker/pickerStatus.js
 * Non-happy-path panels (HANDOFF 2): loading skeleton, empty catalog, catalog error.
 */
import { escapeHtml } from './pickerText.js';

export const skeleton = (slow) => `<div class="sp-skeleton" aria-busy="true" aria-label="Đang tải danh sách script">${'<div class="sp-skel-row"></div>'.repeat(6)}</div>
  ${slow ? '<p class="sp-hint">Vẫn đang đọc danh sách script… Có thể dùng tab <strong>Theo Test Suite</strong> trong lúc chờ.</p>' : ''}`;

export const emptyCatalog = () => `<div class="sp-empty"><i class="ph ph-file-dashed" aria-hidden="true"></i><p><strong>Chưa có script test nào trong dự án này</strong></p>
  <p class="sp-hint">Tạo script đầu tiên trong Kịch bản BDD hoặc ghi lại thao tác trình duyệt.</p>
  <button type="button" class="sp-run" data-view-go="builder-view">Mở Kịch bản BDD</button> <button type="button" class="sp-link" data-view-go="recorder-view">Ghi kịch bản UI</button></div>`;

export const loadError = (message) => `<div class="sp-error" role="alert">Không đọc được danh sách script (${escapeHtml(message)}). Lựa chọn của bạn chưa bị mất. <button type="button" class="sp-link" data-act="retry">Thử lại</button></div>`;

export const noMatch = (state, activeLabel) => `<div class="sp-empty"><i class="ph ph-magnifying-glass" aria-hidden="true"></i><p><strong>Không có script nào khớp${state.query ? ` “${escapeHtml(state.query)}”` : ''}</strong></p>
  ${activeLabel ? `<p class="sp-hint">Đang lọc: ${escapeHtml(activeLabel)}</p>` : ''}<button type="button" class="sp-link" data-act="clear-filters">Xóa bộ lọc</button></div>`;
