'use strict';

/**
 * dashboard/public/js/views/qa/qaSliceEvents.js
 * DOM Event bindings for QA Docs & Automation Slice.
 */

import { ProcessStudioHelper } from './processStudioHelper.js';

export function bindQaEvents(slice, root) {
  if (!root) return;
  const on = (el, evt, fn) => {
    if (!el) return;
    el.addEventListener(evt, fn);
    slice._disposers.push(() => el.removeEventListener(evt, fn));
  };

  on(root.querySelector('#qa-btn-refresh'), 'click', () => slice.reload(true));
  on(root.querySelector('#qa-btn-release-briefing'), 'click', () => slice.overviewSlice.openReleaseBriefingModal());
  on(root.querySelector('#qa-docs-sidebar-refresh'), 'click', () => slice.reload(true));
  on(root.querySelector('#qa-reader-back'), 'click', () => slice.docsSlice.showOverview());
  on(root.querySelector('#qa-reader-answer'), 'click', () => slice.docsSlice.openAnswerForm());
  on(root.querySelector('#qa-reader-infer'), 'click', () => slice.inferenceSlice.openInferModal());
  on(root.querySelector('#qa-reader-edit'), 'click', () => slice.docsSlice.openEditForm());
  on(root.querySelector('#qa-btn-draft'), 'click', () => slice.candidatesSlice.generateDraft());
  on(root.querySelector('#qa-btn-draft-clear'), 'click', () => slice.candidatesSlice.clearPicks());
  on(root.querySelector('#qa-draft-copy'), 'click', () => slice.candidatesSlice.copyDraft());
  on(root.querySelector('#qa-draft-expand'), 'click', () => slice.candidatesSlice.toggleDraftFullscreen());
  on(root.querySelector('#qa-draft-close'), 'click', () => slice.candidatesSlice.closeDraft());
  on(root.querySelector('#qa-pick-all'), 'change', (e) => slice.candidatesSlice.toggleAllPicks(e.target.checked));

  on(root.querySelector('.qa-score-health'), 'click', () => slice.switchTab('findings'));
  on(root.querySelector('.qa-score-coverage'), 'click', () => slice.switchTab('docs'));
  on(root.querySelector('.qa-score-ratio'), 'click', () => slice.switchTab('candidates'));
  on(root.querySelector('.qa-score-boundary'), 'click', () => slice.switchTab('findings'));

  on(root.querySelector('#qa-btn-autofix'), 'click', () => slice.batchSlice.openAutoFixModal());
  on(root.querySelector('#qa-btn-scaffold'), 'click', () => slice.batchSlice.openScaffoldModal());

  const onSmartLinkApplied = () => slice.reload(true);
  window.addEventListener('qa:smart-link:applied', onSmartLinkApplied);
  slice._disposers.push(() => window.removeEventListener('qa:smart-link:applied', onSmartLinkApplied));

  const fixModal = root.querySelector('#qa-fix-modal');
  if (fixModal) {
    on(root.querySelector('#qa-fix-modal-close'), 'click', () => fixModal.close());
    on(root.querySelector('#qa-fix-cancel-btn'), 'click', () => fixModal.close());
    on(root.querySelector('#qa-btn-apply-fix'), 'click', () => slice.batchSlice.applyAutoFix());
  }

  const scaffoldModal = root.querySelector('#qa-scaffold-modal');
  if (scaffoldModal) {
    on(root.querySelector('#qa-scaffold-modal-close'), 'click', () => scaffoldModal.close());
    on(root.querySelector('#qa-scaffold-cancel-btn'), 'click', () => scaffoldModal.close());
    on(root.querySelector('#qa-btn-submit-scaffold'), 'click', () => slice.batchSlice.submitScaffold());
    on(root.querySelector('#qa-btn-extract-raw'), 'click', () => slice.batchSlice.extractRawScaffold());
  }

  const inferModal = root.querySelector('#qa-infer-modal');
  if (inferModal) {
    on(root.querySelector('#qa-infer-modal-close'), 'click', () => inferModal.close());
    on(root.querySelector('#qa-infer-cancel-btn'), 'click', () => inferModal.close());
    on(root.querySelector('#qa-btn-run-infer'), 'click', () => slice.inferenceSlice.runInference());
    on(root.querySelector('#qa-infer-pick-all'), 'change', (e) => slice.inferenceSlice.toggleAllInferred(e.target.checked));
    on(root.querySelector('#qa-btn-submit-inferred'), 'click', () => slice.inferenceSlice.submitInferredTestCases());
  }

  on(root.querySelector('#qa-docs-filter'), 'input', (event) => {
    slice.docFilter = event.target.value || '';
    slice.docsSlice.renderDocList(root);
  });

  root.querySelectorAll('[data-qa-tab]').forEach((btn) => {
    on(btn, 'click', () => slice.switchTab(btn.dataset.qaTab));
  });

  root.querySelectorAll('[data-qa-priority]').forEach((btn) => {
    on(btn, 'click', () => {
      slice.priorityFilter = btn.dataset.qaPriority;
      root.querySelectorAll('[data-qa-priority]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      slice.candidatesSlice.renderCandidates(root);
    });
  });

  slice.processStudio = new ProcessStudioHelper(slice);
  slice.processStudio.bindEvents(root, slice._disposers);
}
