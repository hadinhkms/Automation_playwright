'use strict';

/**
 * dashboard/public/js/views/qa/qaSlice.js
 * QA Docs & Automation Root Feature Slice.
 * Tuân thủ quy chuẩn OWN-01..05 & Modular Decomposition (PLAN-07).
 */

import { eventBus } from '../../core/eventBus.js';
import { ReqAnalyzerHelper } from './reqAnalyzerHelper.js';
import { BatchController } from './batch/batchController.js';
import { ConflictStudioHelper } from './conflictStudioHelper.js';
import { bindQaEvents } from './qaSliceEvents.js';
import { reloadQaData } from './qaDataLoader.js';
import { createEl, createRow, createCell, setEmptyContent, showQaAlert, hideQaAlert, formatDegradedMessage } from './qaDomUtils.js';
import './smartLinkerHelper.js';

import { QaOverviewSlice } from './slices/qaOverviewSlice.js';
import { QaDocsSlice } from './slices/qaDocsSlice.js';
import { QaInferenceSlice } from './slices/qaInferenceSlice.js';
import { QaConflictSlice } from './slices/qaConflictSlice.js';
import { QaBatchSlice } from './slices/qaBatchSlice.js';
import { QaScaffoldSlice } from './slices/qaScaffoldSlice.js';
import { QaCandidatesSlice } from './slices/qaCandidatesSlice.js';
import { QaDecisionsSlice } from './slices/qaDecisionsSlice.js';

const TAB_PANELS = ['docs', 'candidates', 'findings', 'decisions', 'process-studio'];

export class QaSlice {
  constructor() {
    this._disposers = [];
    this._renderDisposers = [];
    this._mounted = false;
    this.trace = null;
    this.summary = null;
    this._fixChanges = [];
    this.candidates = [];
    this.decisions = null;
    this.activeTab = (typeof localStorage !== 'undefined' && localStorage.getItem('dashboard_qa_subtab')) || 'docs';
    this.priorityFilter = 'all';
    this.documents = [];
    this.activeDocPath = null;
    this.docFilter = '';
    this._activeDoc = null;
    this._activeDocAcs = [];
    this._openQuestions = [];
    this._degraded = [];
    this.pickedIds = new Set();
    this.draftText = '';
    this._lastAuthor = '';
    this._recentlyAddedTcIds = null;
    this._summarySeq = 0;

    // Sub-modules & Tab Slices
    this.reqAnalyzer = new ReqAnalyzerHelper(this);
    this.batch = new BatchController(this);
    this.conflictStudio = new ConflictStudioHelper(this);

    this.overviewSlice = new QaOverviewSlice(this);
    this.docsSlice = new QaDocsSlice(this);
    this.inferenceSlice = new QaInferenceSlice(this);
    this.conflictSlice = new QaConflictSlice(this);
    this.batchSlice = new QaBatchSlice(this);
    this.scaffoldSlice = new QaScaffoldSlice(this);
    this.candidatesSlice = new QaCandidatesSlice(this);
    this.decisionsSlice = new QaDecisionsSlice(this);
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    if (typeof this.reqAnalyzer?.init === 'function') this.reqAnalyzer.init(this._root());
    if (typeof this.batch?.init === 'function') this.batch.init(this._root());
    if (typeof this.conflictStudio?.init === 'function') this.conflictStudio.init(this._root());
    await this.reload();
  }

  unmount() {
    this._mounted = false;
    this._flushRenderDisposers();
    if (typeof this.reqAnalyzer?.destroy === 'function') this.reqAnalyzer.destroy();
    if (typeof this.batch?.destroy === 'function') this.batch.destroy();
    if (typeof this.conflictStudio?.destroy === 'function') this.conflictStudio.destroy();
    if (typeof this.processStudio?.destroy === 'function') this.processStudio.destroy();
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _flushRenderDisposers() {
    this._renderDisposers.forEach((d) => { try { d(); } catch (_) {} });
    this._renderDisposers = [];
  }

  _root() { return document.getElementById('qa-view'); }
  _bindDomEvents() { bindQaEvents(this, this._root()); }

  _syncTabVisibility(root, tabName) {
    root.querySelectorAll('[data-qa-tab]').forEach((btn) => {
      const active = btn.dataset.qaTab === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    TAB_PANELS.forEach((name) => {
      const panel = root.querySelector(`#qa-panel-${name}`);
      if (panel) panel.hidden = name !== tabName;
    });
  }

  switchTab(tabName) {
    if (!tabName) return;
    this.activeTab = tabName;
    try { localStorage.setItem('dashboard_qa_subtab', tabName); } catch (_) {}
    const root = this._root();
    if (!root) return;

    this._syncTabVisibility(root, tabName);

    if (tabName === 'docs') this.docsSlice.renderDocs(root);
    if (tabName === 'candidates') this.candidatesSlice.renderCandidates(root);
    if (tabName === 'findings') this.batchSlice.renderFindings(root);
    if (tabName === 'decisions') this.decisionsSlice.renderDecisions(root);
    if (tabName === 'process-studio' && this.processStudio) this.processStudio.loadStatus(root);
    if (tabName === 'conflicts') this.conflictSlice.renderConflicts(root);
  }

  async reload(force = false) { await reloadQaData(this, force); }
  _degradedMessage() { return formatDegradedMessage(this._degraded); }
  _showAlert(text, severity = 'warn') { showQaAlert(this._root(), text, severity); }
  _hideAlert() { hideQaAlert(this._root()); }

  renderAll() {
    const root = this._root();
    if (!root || !this._mounted) return;
    this._flushRenderDisposers();

    if (this.activeDocPath && !this.documents.some((d) => d.path === this.activeDocPath)) {
      this.activeDocPath = null;
      this._activeDoc = null;
    }

    this.overviewSlice.renderSourceBar(root, this.summary);
    this.overviewSlice.renderStats(root, this.trace);
    this.overviewSlice.renderExecutiveScorecard(root, this.summary, this.trace);
    this.overviewSlice.renderTabBadges(root, this.summary, this.trace);

    this.docsSlice.renderDocs(root);
    this.batchSlice.renderFindings(root);
    this.candidatesSlice.renderCandidates(root);
    this.decisionsSlice.renderDecisions(root);

    this._syncTabVisibility(root, this.activeTab);
    if (this.activeTab === 'process-studio' && this.processStudio) {
      this.processStudio.loadStatus(root);
    }
  }

  async loadAll() { await this.reload(true); }

  showOverview() { this.docsSlice.showOverview(); }
  openDocument(p) { return this.docsSlice.openDocument(p); }
  openAnswerForm() { this.docsSlice.openAnswerForm(); }
  openEditForm() { this.docsSlice.openEditForm(); }
  openInferModal() { return this.inferenceSlice.openInferModal(); }
  runInference() { return this.inferenceSlice.runInference(); }
  toggleAllInferred(s) { this.inferenceSlice.toggleAllInferred(s); }
  submitInferredTestCases() { return this.inferenceSlice.submitInferredTestCases(); }
  openAutoFixModal() { return this.batchSlice.openAutoFixModal(); }
  applyAutoFix() { return this.batchSlice.applyAutoFix(); }
  openScaffoldModal() { return this.scaffoldSlice.openScaffoldModal(); }
  extractRawScaffold() { return this.scaffoldSlice.extractRawScaffold(); }
  submitScaffold() { return this.scaffoldSlice.submitScaffold(); }
  generateDraft() { return this.candidatesSlice.generateDraft(); }
  clearPicks() { this.candidatesSlice.clearPicks(); }
  copyDraft() { return this.candidatesSlice.copyDraft(); }
  toggleDraftFullscreen(f) { this.candidatesSlice.toggleDraftFullscreen(f); }
  _closeDraft() { this.candidatesSlice.closeDraft(); }
  toggleAllPicks(c) { this.candidatesSlice.toggleAllPicks(c); }
  openReleaseBriefingModal() { return this.overviewSlice.openReleaseBriefingModal(); }
  openDeleteRequirementModal(d) { return this.conflictSlice.openDeleteRequirementModal(d); }
  submitDeleteRequirement() { return this.conflictSlice.submitDeleteRequirement(); }
  _checkDeleteConfirmInput() { this.conflictSlice.checkDeleteConfirmInput(); }

  notify(msg) { eventBus.emit('ui:notify', { message: msg }); }
  _el(tag, text, className) { return createEl(tag, text, className); }
  _row(cells, className) { return createRow(cells, className); }
  _cell(text, className) { return createCell(text, className); }
  _setEmpty(id, lines) { setEmptyContent(this._root(), id, lines); }
}

export const qaSlice = new QaSlice();
