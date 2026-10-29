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
  on(root.querySelector('#qa-reader-delete'), 'click', () => slice.openDeleteRequirementModal(slice._activeDoc));
  on(root.querySelector('#qa-btn-draft'), 'click', () => slice.candidatesSlice.generateDraft());
  on(root.querySelector('#qa-btn-draft-clear'), 'click', () => slice.candidatesSlice.clearPicks());
  on(root.querySelector('#qa-draft-copy'), 'click', () => slice.candidatesSlice.copyDraft());
  on(root.querySelector('#qa-draft-expand'), 'click', () => slice.candidatesSlice.toggleDraftFullscreen());
  on(root.querySelector('#qa-draft-close'), 'click', () => slice.candidatesSlice.closeDraft());
  on(root.querySelector('#qa-pick-all'), 'change', (e) => slice.candidatesSlice.toggleAllPicks(e.target.checked));

  on(root.querySelector('.qa-score-health'), 'click', () => slice.switchTab('findings'));
  on(root.querySelector('.qa-score-coverage'), 'click', () => slice.switchTab('docs'));
  on(root.querySelector('.qa-score-ratio'), 'click', () => slice.switchTab('candidates'));
  on(root.querySelector('.qa-score-shield'), 'click', () => slice.switchTab('findings'));

  on(root.querySelector('#qa-btn-autofix'), 'click', () => slice.batchSlice.openAutoFixModal());
  on(root.querySelector('#qa-btn-scaffold'), 'click', () => slice.openScaffoldModal());

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
    on(root.querySelector('#qa-btn-submit-scaffold'), 'click', () => slice.submitScaffold());
    on(root.querySelector('#qa-btn-extract-raw'), 'click', () => slice.extractRawScaffold());

    root.querySelectorAll('input[name="qa-scaffold-mode"]').forEach((radio) => {
      on(radio, 'change', () => {
        const mode = radio.value;
        ['raw', 'new', 'infer'].forEach((m) => {
          const fields = root.querySelector(`#qa-scaffold-${m}-fields`);
          const card = root.querySelector(`#qa-mode-card-${m}`);
          if (fields) fields.style.display = mode === m ? 'flex' : 'none';
          if (card) {
            card.classList.toggle('is-selected', mode === m);
            card.style.borderColor = mode === m ? 'var(--accent)' : 'var(--line)';
            card.style.background = mode === m ? 'rgba(59, 130, 246, 0.05)' : 'transparent';
          }
        });
      });
    });
  }

  const inferModal = root.querySelector('#qa-infer-modal');
  if (inferModal) {
    on(root.querySelector('#qa-infer-modal-close'), 'click', () => inferModal.close());
    on(root.querySelector('#qa-infer-cancel-btn'), 'click', () => inferModal.close());
    on(root.querySelector('#qa-infer-btn-rerun'), 'click', () => slice.inferenceSlice.runInference());
    on(root.querySelector('#qa-infer-select-all'), 'click', () => slice.inferenceSlice.toggleAllInferred(true));
    on(root.querySelector('#qa-infer-deselect-all'), 'click', () => slice.inferenceSlice.toggleAllInferred(false));
    on(root.querySelector('#qa-infer-submit-btn'), 'click', () => slice.inferenceSlice.submitInferredTestCases());

    root.querySelectorAll('input[name="qa-infer-mode"]').forEach((radio) => {
      on(radio, 'change', () => {
        if (radio.checked) slice.inferenceSlice.runInference();
      });
    });
  }

  const deleteModal = root.querySelector('#qa-delete-req-modal');
  if (deleteModal) {
    on(root.querySelector('#qa-delete-modal-close'), 'click', () => deleteModal.close());
    on(root.querySelector('#qa-delete-cancel-btn'), 'click', () => deleteModal.close());
    on(root.querySelector('#qa-delete-submit-btn'), 'click', () => slice.conflictSlice.submitDeleteRequirement());
    on(root.querySelector('#qa-delete-confirm-input'), 'input', () => slice.conflictSlice.checkDeleteConfirmInput());
  }

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      const box = root.querySelector('#qa-draft');
      if (box && !box.hidden) {
        if (box.classList.contains('is-fullscreen')) {
          slice.candidatesSlice.toggleDraftFullscreen(false);
        } else {
          slice.candidatesSlice.closeDraft();
        }
      }
    }
  };
  window.addEventListener('keydown', handleKeydown);
  slice._disposers.push(() => window.removeEventListener('keydown', handleKeydown));

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
