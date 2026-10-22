'use strict';

/**
 * dashboard/public/js/views/qa/qaDataLoader.js
 * Asynchronous data fetching and progressive loading for QA Docs & Automation.
 */

import { apiClient } from '../../core/apiClient.js';
import { toast } from '../../core/toast.js';

export async function reloadQaData(slice, force = false) {
  if (!slice._mounted) return;
  const seq = ++slice._summarySeq;
  const root = slice._root();
  if (!root) return;

  try {
    const [trace, candidates, decisions, documents] = await Promise.allSettled([
      apiClient.get('/api/qa/trace'),
      apiClient.get('/api/qa/candidates', { limit: 50 }),
      apiClient.get('/api/qa/decisions'),
      apiClient.get('/api/qa/documents'),
    ]);

    if (seq !== slice._summarySeq || !slice._mounted) return;

    if (trace.status !== 'fulfilled') {
      slice._showAlert(`Không tải được dữ liệu QA: ${trace.reason && trace.reason.message}`, 'danger');
      slice._setEmpty('qa-docs-empty', [
        'Không tải được dữ liệu tài liệu QA',
        (trace.reason && trace.reason.message) || 'Lỗi mạng hoặc server không phản hồi.',
        'Nhấn "Làm mới" hoặc kiểm tra tiến trình server dashboard.',
      ]);
      return;
    }

    slice.trace = trace.value;
    slice.candidates = candidates.status === 'fulfilled' && Array.isArray(candidates.value?.candidates)
      ? candidates.value.candidates
      : [];
    slice.decisions = decisions.status === 'fulfilled' ? decisions.value : null;
    slice.documents = documents.status === 'fulfilled' && Array.isArray(documents.value?.documents)
      ? documents.value.documents
      : [];

    slice._degraded = [
      candidates.status === 'rejected' ? { part: 'ứng viên automation', reason: candidates.reason } : null,
      decisions.status === 'rejected' ? { part: 'sổ quyết định', reason: decisions.reason } : null,
      documents.status === 'rejected' ? { part: 'danh sách tài liệu', reason: documents.reason } : null,
    ].filter(Boolean);

    slice.renderAll();

    const summaryUrl = force ? '/api/qa/summary?force=true' : '/api/qa/summary';
    if (slice.batch) slice.batch.setScanPending(true);
    apiClient.get(summaryUrl).then((summaryRes) => {
      if (!slice._mounted || seq !== slice._summarySeq) return;
      if (slice.batch) slice.batch.scanPending = false;
      slice.summary = summaryRes;
      slice.overviewSlice.renderStats(root, slice.trace);
      slice.overviewSlice.renderExecutiveScorecard(root, slice.summary, slice.trace);
      slice.overviewSlice.renderTabBadges(root, slice.summary, slice.trace);
      slice.batchSlice.renderFindings(root);
    }).catch((err) => {
      if (!slice._mounted || seq !== slice._summarySeq) return;
      if (slice.batch) slice.batch.setScanPending(false);
      slice._degraded.push({ part: 'bộ chỉ số QA Core', reason: err });
    });
  } catch (err) {
    toast.error(`Lỗi cập nhật dữ liệu QA: ${err.message}`);
  }
}
