'use strict';

/**
 * dashboard/public/js/views/qa/reqAnalyzerHelper.js
 * Quản lý vòng đời và tương tác của Modal Phân Tích Yêu Cầu & Đánh Giá Tác Động QA (Requirement Analyzer).
 * Tuân thủ quy chuẩn OWN-01..05 & Modular Decomposition (PLAN-07).
 * Modularity ceiling <= 250 lines (Target < 200).
 */

import { toast } from '../../core/toast.js';
import { escapeHtml, extractJiraKey, parseJiraMarkup, buildMarkdownReport } from './analyzer/markdownSpecParser.js';
import { switchTab, renderResults, renderClarityResult, renderSpecResult } from './analyzer/reqAnalyzerRenderer.js';
import { renderTestCases, renderSystemImpact, renderLogicClarifications, renderQaInquiries } from './analyzer/cardPanelsRenderer.js';
import {
  runClarityCheck, runGenerateTestCases, runGenerateSpec,
  runAnalysis, scaffoldFiles, copyMarkdownReport,
} from './analyzer/analyzerActions.js';
import { mountSpecPanels } from './specStudio/specStudioPanels.js';
import {
  SAMPLE_REQUIREMENT_TEXT, setAnalyzerText,
  setLoadingState, checkAiStatus, showInputView, fetchJiraTicket,
} from './analyzer/reqAnalyzerModalState.js';

export class ReqAnalyzerHelper {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
    this.disposers = [];
    this.currentResult = null;
    this.currentTestCases = [];
    this.currentRawText = '';
    this.specPanels = null;
  }

  init(root) {
    this.destroy();
    if (!root) return;

    const modal = root.querySelector('#qa-req-analyzer-modal');
    if (!modal) return;

    const addEvt = (target, evt, handler) => {
      if (!target) return;
      target.addEventListener(evt, handler);
      this.disposers.push(() => target.removeEventListener(evt, handler));
    };

    const formatJiraBtn = root.querySelector('#qa-req-btn-format-jira');
    const jiraKeyInput = root.querySelector('#qa-req-jira-key');
    addEvt(formatJiraBtn, 'click', () => {
      const textarea = root.querySelector('#qa-req-analyzer-text');
      if (!textarea || !textarea.value.trim()) {
        toast.info('Vui lòng dán nội dung requirement trước khi chuyển đổi.');
        return;
      }
      const original = textarea.value;
      const formatted = this.parseJiraMarkup(original);
      setAnalyzerText(textarea, formatted);
      if (jiraKeyInput && !jiraKeyInput.value.trim()) {
        const detectedKey = this.extractJiraKey(original) || this.extractJiraKey(formatted);
        if (detectedKey) jiraKeyInput.value = detectedKey;
      }
      toast.success('Đã chuyển đổi Jira markup sang Markdown.');
    });

    const fetchJiraBtn = root.querySelector('#qa-req-btn-fetch-jira');
    addEvt(fetchJiraBtn, 'click', () => fetchJiraTicket(root, jiraKeyInput, fetchJiraBtn));

    this.specPanels = mountSpecPanels(root, {
      switchTab: (tab) => this.switchTab(root, tab),
      showResults: () => {
        const inSec = root.querySelector('#qa-req-analyzer-input-section');
        const resSec = root.querySelector('#qa-req-analyzer-results-section');
        if (inSec) inSec.style.display = 'none';
        if (resSec) resSec.style.display = 'flex';
      },
      showInput: () => this.showInputView(root),
    });

    addEvt(root.querySelector('#qa-btn-analyze-req'), 'click', () => this.openModal(root));

    const closeModal = async (event) => {
      if (this.specPanels) {
        if (this.specPanels.isDirty() && event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        const canClose = await this.specPanels.confirmClose();
        if (!canClose) {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          return;
        }
      }
      try { modal.close(); } catch (_) {}
    };
    addEvt(root.querySelector('#qa-req-analyzer-close'), 'click', closeModal);
    addEvt(root.querySelector('#qa-req-analyzer-btn-cancel'), 'click', closeModal);
    addEvt(modal, 'cancel', closeModal);

    addEvt(root.querySelector('#qa-req-analyzer-sample-btn'), 'click', () => {
      const textarea = root.querySelector('#qa-req-analyzer-text');
      if (textarea) {
        setAnalyzerText(textarea, SAMPLE_REQUIREMENT_TEXT);
        textarea.focus();
        toast.info('Đã nạp văn bản requirement mẫu.');
      }
    });

    addEvt(root.querySelector('#qa-req-analyzer-btn-reinput'), 'click', () => this.showInputView(root));
    addEvt(root.querySelector('#qa-req-analyzer-btn-submit'), 'click', () => this.runAnalysis(root));
    addEvt(root.querySelector('#qa-req-btn-clarity'), 'click', () => this.runClarityCheck(root));
    addEvt(root.querySelector('#qa-req-btn-generate-tc'), 'click', () => this.runGenerateTestCases(root));

    const generateSpecBtn = root.querySelector('#qa-req-btn-generate-spec');
    if (generateSpecBtn) {
      addEvt(generateSpecBtn, 'click', () => this.runGenerateSpec(root));
    }

    const tabBtns = root.querySelectorAll('.qa-req-tab');
    tabBtns.forEach((tabBtn) => {
      addEvt(tabBtn, 'click', () => {
        this.switchTab(root, tabBtn.getAttribute('data-tab'));
      });
    });

    addEvt(root.querySelector('#qa-req-analyzer-btn-copy'), 'click', () => this.copyMarkdownReport());
    addEvt(root.querySelector('#qa-req-analyzer-btn-scaffold'), 'click', () => this.scaffoldFiles(root));
  }

  async runClarityCheck(root) { await runClarityCheck(this, root); }
  async runGenerateTestCases(root) { await runGenerateTestCases(this, root); }
  async runGenerateSpec(root) { await runGenerateSpec(this, root); }
  async runAnalysis(root) { await runAnalysis(this, root); }
  async scaffoldFiles(root) { await scaffoldFiles(this, root); }
  async copyMarkdownReport() { await copyMarkdownReport(this); }

  _setLoadingState(root, isLoading, isError = false) { setLoadingState(root, isLoading, isError); }

  async openModal(root) {
    const modal = root.querySelector('#qa-req-analyzer-modal');
    if (!modal) return;
    this.showInputView(root);
    this.checkAiStatus(root);
    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }
  }

  async checkAiStatus(root) { await checkAiStatus(root); }
  showInputView(root) { showInputView(root); }
  renderResults(root, data) { renderResults(this, root, data); }

  renderTestCases(root, testCases) {
    this.currentTestCases = testCases;
    renderTestCases(root, testCases);
  }

  renderClarityResult(root, res) { renderClarityResult(root, res); }
  renderSpecResult(root, res) { renderSpecResult(root, res); }
  renderSystemImpact(root, systemImpact, existingImpacts) { renderSystemImpact(root, systemImpact, existingImpacts); }
  renderLogicClarifications(root, clarifications) { renderLogicClarifications(root, clarifications); }
  renderQaInquiries(root, inquiries) { renderQaInquiries(root, inquiries); }
  switchTab(root, tabKey) { switchTab(root, tabKey); }
  parseJiraMarkup(raw) { return parseJiraMarkup(raw); }
  extractJiraKey(text) { return extractJiraKey(text); }
  buildMarkdownReport(data) { return buildMarkdownReport(data); }
  _escape(str) { return escapeHtml(str); }

  destroy() {
    if (this._activeRequest) { try { this._activeRequest.cancel(); } catch (_) {} this._activeRequest = null; }
    if (this._statusBar) { try { this._statusBar.dispose(); } catch (_) {} this._statusBar = null; }
    if (this.specPanels) { try { this.specPanels.destroy(); } catch (_) {} this.specPanels = null; }
    this.disposers.forEach((d) => { try { d(); } catch (_) {} });
    this.disposers = [];
  }
}
