'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaOverviewSlice.js
 * Quản lý vẽ Scorecards điều hành, chỉ số thống kê, source bar và modal Briefing.
 * Line budget <= 180 lines.
 */

import { showReleaseBriefingModal, renderQaTabBadges } from './qaReleaseBriefingModal.js';

export class QaOverviewSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  renderSourceBar(root) {
    const bar = root && root.querySelector('#qa-source-bar');
    if (!bar || !this.qaSlice.trace) return;
    const dirs = this.qaSlice.trace.dirs || {};
    const set = (id, value) => { const el = root.querySelector(`#${id}`); if (el) el.textContent = value; };
    set('qa-src-requirements', `${dirs.requirements || '?'}/`);
    set('qa-src-testcases', `${dirs.testCases || '?'}/`);
    set('qa-src-specs', `${dirs.specs || '?'}/`);
    set('qa-src-config', this.qaSlice.trace.configPath
      ? `theo ${this.qaSlice.trace.configPath}`
      : 'theo mặc định — khai mục qa trong core/config/dashboardConfig.json để đổi');
    bar.hidden = false;

    this.qaSlice._hideAlert();
    const degraded = this.qaSlice._degradedMessage();
    if (degraded) { this.qaSlice._showAlert(degraded, 'danger'); return; }
    if (this.qaSlice.trace.available === false) {
      this.qaSlice._showAlert((this.qaSlice.trace.analyzer && this.qaSlice.trace.analyzer.error) || 'Analyzer chưa sẵn sàng.', 'danger');
    } else if (this.qaSlice.trace.staleCore) {
      this.qaSlice._showAlert(
        'core/config/dashboardConfig.json có khai mục "qa" nhưng bản core/ của repo này chưa hiểu khóa đó, '
        + 'nên cấu hình đang bị bỏ qua và mục QA đọc theo thư mục mặc định. '
        + 'Hoàn tất migration core/ (ai/shared/SATELLITE_CORE_MIGRATION.md) để sync giao nốt core/.',
        'danger',
      );
    } else if (this.qaSlice.trace.specsDirEmpty) {
      this.qaSlice._showAlert(
        `Không đọc được spec nào trong "${dirs.specs}/". Nếu repo này để spec ở chỗ khác, `
        + 'hãy sửa mục qa.specs trong core/config/dashboardConfig.json — nếu không, mọi thứ sẽ trông như đã sạch.',
      );
    }
  }

  renderStats(root, trace) {
    const box = root && root.querySelector('#qa-stats');
    if (!box || !trace) return;
    if (trace.available === false) { box.hidden = true; return; }
    const c = trace.counts || {};
    const set = (id, v) => { const el = root.querySelector(`#${id}`); if (el) el.textContent = String(v ?? 0); };
    set('qa-stat-req', c.requirements);
    set('qa-stat-ac', c.acceptanceCriteria);
    set('qa-stat-tc', c.testCases);
    set('qa-stat-auto', trace.automatedCount);
    const summaryMajor = (this.qaSlice.summary && Array.isArray(this.qaSlice.summary.findings))
      ? this.qaSlice.summary.findings.filter((f) => f.severity === 'major' || f.severity === 'blocker').length
      : 0;
    set('qa-stat-major', (trace.majorCount || 0) + summaryMajor);
    box.hidden = false;
  }

  renderExecutiveScorecard(root, summaryArg, traceArg) {
    if (!root) return;
    const t = traceArg || this.qaSlice.trace;
    let s = summaryArg || this.qaSlice.summary;
    if (!s && t) {
      const c = t.counts || {};
      const autoCount = t.automatedCount || 0;
      const acCount = c.acceptanceCriteria || 0;
      const covPercent = acCount > 0 ? Number(((autoCount / acCount) * 100).toFixed(1)) : 0;
      s = {
        systemHealth: t.majorCount > 0 ? 'WARNING' : 'HEALTHY',
        health: { totalFindings: t.majorCount || 0 },
        metrics: {
          coveragePercent: covPercent, coveredAcCount: autoCount, acceptanceCriteria: acCount,
          automatedTests: autoCount, candidateTests: this.qaSlice.candidates ? this.qaSlice.candidates.length : 0,
          testCases: c.testCases || 0,
        },
        boundary: { status: 'ALIGNED', shipCount: '—', seedCount: '—', ownCount: '—' },
      };
    }
    if (!s) return;

    let healthStatus = s.systemHealth || s.health?.status || 'HEALTHY';
    const traceMajors = (t?.findings?.major || []).length || (t?.majorCount || 0);
    if (healthStatus === 'HEALTHY' && traceMajors > 0) healthStatus = 'WARNING';

    const healthBadge = root.querySelector('#qa-health-badge');
    const healthStatusEl = root.querySelector('#qa-health-status');
    const healthIcon = root.querySelector('#qa-health-icon');
    const healthFindings = root.querySelector('#qa-health-findings-text');
    if (healthBadge) {
      healthBadge.className = `qa-health-pill ${healthStatus === 'HEALTHY' ? 'is-healthy' : (healthStatus === 'WARNING' ? 'is-warning' : 'is-critical')}`;
    }
    if (healthIcon) {
      healthIcon.className = healthStatus === 'HEALTHY' ? 'ph-bold ph-shield-check' : (healthStatus === 'WARNING' ? 'ph-bold ph-warning' : 'ph-bold ph-warning-octagon');
    }
    if (healthStatusEl) healthStatusEl.textContent = healthStatus;
    if (healthFindings) {
      const summaryCount = s.health?.totalFindings ?? (Array.isArray(s.findings) ? s.findings.length : 0);
      const traceCount = t && t.findings
        ? ((t.findings.major || []).length + (t.findings.minor || []).length + (t.findings.info || []).length)
        : (t?.majorCount || 0);
      healthFindings.textContent = `${summaryCount + traceCount} phát hiện`;
    }

    const m = s.metrics || {};
    const covPercent = m.coveragePercent ?? 0;
    const covPercentEl = root.querySelector('#qa-cov-percent');
    const covRatioEl = root.querySelector('#qa-cov-ratio');
    const covProgressEl = root.querySelector('#qa-cov-progress');
    if (covPercentEl) covPercentEl.textContent = `${covPercent}%`;
    if (covRatioEl) covRatioEl.textContent = `${m.coveredAcCount || 0}/${m.acceptanceCriteria || 0} ACs được phủ`;
    if (covProgressEl) covProgressEl.style.width = `${Math.min(100, Math.max(0, covPercent))}%`;

    const autoCountEl = root.querySelector('#qa-auto-count');
    const candCountEl = root.querySelector('#qa-candidate-count');
    const tcTotalEl = root.querySelector('#qa-tc-total-sub');
    if (autoCountEl) autoCountEl.textContent = String(m.automatedTests || 0);
    if (candCountEl) candCountEl.textContent = String(m.candidateTests || 0);
    if (tcTotalEl) tcTotalEl.textContent = `${m.testCases || 0} tổng số test cases`;

    const b = s.boundary || {};
    const bStatus = b.status || 'ALIGNED';
    const shieldBadge = root.querySelector('#qa-shield-badge');
    const shieldIcon = root.querySelector('#qa-shield-icon');
    const shieldStatus = root.querySelector('#qa-shield-status');
    const shieldDetails = root.querySelector('#qa-shield-details');
    if (shieldBadge) {
      shieldBadge.className = `qa-shield-pill ${bStatus === 'ALIGNED' ? 'is-aligned' : (bStatus === 'DRIFTED' ? 'is-drifted' : 'is-missing')}`;
    }
    if (shieldIcon) {
      shieldIcon.className = bStatus === 'ALIGNED' ? 'ph-bold ph-check-circle' : (bStatus === 'DRIFTED' ? 'ph-bold ph-warning' : 'ph-bold ph-shield-slash');
    }
    if (shieldStatus) shieldStatus.textContent = bStatus;
    if (shieldDetails) shieldDetails.textContent = `Ship: ${b.shipCount ?? 0} · Seed: ${b.seedCount ?? 0} · Own: ${b.ownCount ?? 0}`;
  }

  renderTabBadges(root, summary, trace) {
    renderQaTabBadges(this.qaSlice, root, summary, trace);
  }

  async openReleaseBriefingModal() {
    await showReleaseBriefingModal(this.qaSlice);
  }
}
