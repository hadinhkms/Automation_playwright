'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaReleaseBriefingModal.js
 * Modal bản tin sẵn sàng phát hành (Release Readiness Briefing) & Tab Badges — DOM-safe, 0 innerHTML.
 */

import { apiClient } from '../../../core/apiClient.js';

const VERDICT_COLORS = { GO: '#10b981', GO_WITH_CAUTION: '#f59e0b', NO_GO: '#ef4444' };

function makeNode(tag, style, text) {
  const el = document.createElement(tag);
  if (style) el.style.cssText = style;
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}

export function renderQaTabBadges(qaSlice, root, summary, trace) {
  if (!root) return;
  const t = trace || qaSlice.trace;
  const s = summary || qaSlice.summary;

  const docsBadge = root.querySelector('#qa-tab-badge-docs');
  if (docsBadge) {
    const docCount = qaSlice.documents ? qaSlice.documents.length : 0;
    if (docCount > 0) {
      docsBadge.textContent = String(docCount);
      docsBadge.className = 'qa-tab-badge qa-tab-badge-neutral';
      docsBadge.title = `${docCount} tài liệu`;
      docsBadge.hidden = false;
    } else docsBadge.hidden = true;
  }

  const findingsBadge = root.querySelector('#qa-tab-badge-findings');
  if (findingsBadge) {
    let blockerCount = 0;
    let majorCount = 0;
    let totalCount = 0;
    if (s && Array.isArray(s.findings)) {
      totalCount += s.findings.length;
      blockerCount += s.findings.filter((f) => f.severity === 'blocker').length;
      majorCount += s.findings.filter((f) => f.severity === 'major').length;
    }
    if (t && t.findings) {
      const tf = t.findings;
      const traceMajor = (tf.major || []).length;
      majorCount += traceMajor;
      totalCount += traceMajor + (tf.minor || []).length + (tf.info || []).length;
    }
    findingsBadge.hidden = false;
    if (totalCount > 0) {
      findingsBadge.textContent = String(totalCount);
      if (blockerCount > 0 || majorCount > 0) {
        findingsBadge.className = 'qa-tab-badge qa-tab-badge-danger';
        findingsBadge.title = `Đang có ${totalCount} vấn đề (${blockerCount > 0 ? `${blockerCount} blocker, ` : ''}${majorCount} major) — Cần ưu tiên xử lý trước`;
      } else {
        findingsBadge.className = 'qa-tab-badge qa-tab-badge-warning';
        findingsBadge.title = `Đang có ${totalCount} cảnh báo`;
      }
    } else {
      findingsBadge.textContent = '0';
      findingsBadge.className = 'qa-tab-badge qa-tab-badge-success';
      findingsBadge.title = 'Hệ thống sạch, không có vấn đề';
    }
  }

  const candidatesBadge = root.querySelector('#qa-tab-badge-candidates');
  if (candidatesBadge) {
    const candCount = qaSlice.candidates ? qaSlice.candidates.length : 0;
    candidatesBadge.textContent = String(candCount);
    candidatesBadge.className = 'qa-tab-badge qa-tab-badge-neutral';
    candidatesBadge.title = `${candCount} ứng viên automation`;
    candidatesBadge.hidden = false;
  }

  const decisionsBadge = root.querySelector('#qa-tab-badge-decisions');
  if (decisionsBadge) {
    const decList = qaSlice.decisions
      ? (Array.isArray(qaSlice.decisions.decisions) ? qaSlice.decisions.decisions : (Array.isArray(qaSlice.decisions) ? qaSlice.decisions : []))
      : [];
    if (decList.length > 0) {
      decisionsBadge.textContent = String(decList.length);
      decisionsBadge.className = 'qa-tab-badge qa-tab-badge-neutral';
      decisionsBadge.hidden = false;
    } else decisionsBadge.hidden = true;
  }
}

export async function showReleaseBriefingModal(qaSlice) {
  const root = qaSlice._root();
  if (!root) return;
  const modal = root.querySelector('#qa-release-briefing-modal');
  const content = root.querySelector('#qa-release-briefing-content');
  const closeBtn = root.querySelector('#qa-release-briefing-close');
  const dismissBtn = root.querySelector('#qa-release-briefing-dismiss');
  const copyBtn = root.querySelector('#qa-release-briefing-copy');
  if (!modal || !content) return;

  try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }
  content.textContent = '';
  const loadingBox = makeNode('div', 'padding: 24px; text-align: center; color: var(--muted);');
  const spinner = makeNode('div', 'margin: 0 auto 10px; width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;');
  spinner.className = 'spinner';
  loadingBox.append(spinner, makeNode('p', 'margin: 0; font-size: 13px;', 'Đang tổng hợp số liệu kiểm thử và phân tích bản tin sẵn sàng phát hành...'));
  content.appendChild(loadingBox);

  const closeModal = () => { try { modal.close(); } catch (_) { modal.removeAttribute('open'); } };
  if (closeBtn) closeBtn.onclick = closeModal;
  if (dismissBtn) dismissBtn.onclick = closeModal;

  try {
    const stats = qaSlice.summary?.metrics || {};
    const totalReq = qaSlice.documents?.length || 10;
    const res = await apiClient.post('/api/ai/release-briefing', {
      testMetrics: {
        total: stats.totalTestCases || 20,
        passed: (stats.totalTestCases || 20) - (stats.failingTestCases || 0),
        failed: stats.failingTestCases || 0,
      },
      uncoveredReqCount: Math.max(0, totalReq - (stats.coveredRequirements || totalReq)),
      openBlockersCount: stats.blockingIssues || 0,
      releaseName: 'Release Readiness Overview',
    });

    const verdictColor = VERDICT_COLORS[res.verdict] || '#6b7280';
    content.textContent = '';
    const wrap = makeNode('div', 'display: flex; flex-direction: column; gap: 14px; padding: 6px 0;');
    const headerRow = makeNode('div', 'display: flex; justify-content: space-between; align-items: center; background: var(--surface-2); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line);');
    const leftCol = makeNode('div');
    leftCol.append(makeNode('span', 'font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 700;', 'Phán quyết phát hành'), makeNode('div', `font-size: 22px; font-weight: 800; color: ${verdictColor};`, res.verdict || 'UNKNOWN'));
    const rightCol = makeNode('div', 'text-align: right;');
    rightCol.append(makeNode('span', 'font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 700;', 'Điểm sẵn sàng'), makeNode('div', 'font-size: 22px; font-weight: 800; color: var(--text);', `${res.readinessScore ?? 0}/100`));
    headerRow.append(leftCol, rightCol);
    wrap.append(headerRow, makeNode('div', 'font-size: 13.5px; font-weight: 600; color: var(--text);', res.headline || ''), makeNode('p', 'font-size: 12.5px; color: var(--muted); line-height: 1.5; margin: 0;', res.rationale || ''));

    if (Array.isArray(res.highlights) && res.highlights.length) {
      const hlBox = makeNode('div', 'background: var(--surface-2); padding: 10px 14px; border-radius: 6px;');
      hlBox.appendChild(makeNode('strong', 'font-size: 12px; color: var(--text); display: block; margin-bottom: 6px;', 'Điểm sáng chất lượng:'));
      const ul = makeNode('ul', 'margin: 0; padding-left: 18px; font-size: 12px; color: var(--muted);');
      res.highlights.forEach((h) => ul.appendChild(makeNode('li', null, h)));
      hlBox.appendChild(ul);
      wrap.appendChild(hlBox);
    }
    content.appendChild(wrap);
    if (copyBtn) {
      copyBtn.onclick = async () => {
        const md = `# ${res.headline || ''}\n\n**Phán quyết:** ${res.verdict || ''} (${res.readinessScore ?? 0}/100)\n\n${res.rationale || ''}`;
        try { await navigator.clipboard.writeText(md); } catch (_) {}
      };
    }
  } catch (err) {
    content.textContent = '';
    content.appendChild(makeNode('div', 'padding: 16px; color: var(--danger);', `Lỗi tải bản tin: ${err.message}`));
  }
}
