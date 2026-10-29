'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaScaffoldPreviewRenderer.js
 * DOM helpers cho Scaffold Wizard (reset form, đổ danh sách domains/meta, render preview DOM-safe).
 */

export function setBtnContent(btn, iconClass, labelText) {
  if (!btn) return;
  btn.textContent = '';
  const icon = document.createElement('i');
  icon.className = iconClass;
  btn.append(icon, document.createTextNode(` ${labelText}`));
}

export function resetScaffoldForm(root) {
  const q = (sel) => root.querySelector(sel);
  const radioRaw = q('input[name="qa-scaffold-mode"][value="raw"]');
  if (radioRaw) { radioRaw.checked = true; radioRaw.dispatchEvent(new Event('change')); }
  ['#qa-scaffold-raw-content', '#qa-scaffold-raw-req-id', '#qa-scaffold-raw-domain', '#qa-scaffold-title', '#qa-scaffold-spec-path'].forEach((s) => {
    const el = q(s); if (el) el.value = '';
  });
  const previewBox = q('#qa-scaffold-raw-preview');
  if (previewBox) previewBox.style.display = 'none';
  const acCountInput = q('#qa-scaffold-ac-count');
  if (acCountInput) acCountInput.value = '2';
}

export function applyScaffoldMetaToDom(root, meta) {
  if (!root || !meta) return;
  const reqInput = root.querySelector('#qa-scaffold-req-id');
  const rawReqInput = root.querySelector('#qa-scaffold-raw-req-id');
  const domainInput = root.querySelector('#qa-scaffold-domain');
  const rawDomainInput = root.querySelector('#qa-scaffold-raw-domain');
  const domainsList = root.querySelector('#qa-scaffold-domains-list');

  if (meta.nextReqId) {
    if (reqInput) reqInput.value = meta.nextReqId;
    if (rawReqInput) rawReqInput.placeholder = meta.nextReqId;
  }
  if (domainsList && Array.isArray(meta.existingDomains)) {
    domainsList.textContent = '';
    for (const d of meta.existingDomains) {
      const opt = document.createElement('option');
      opt.value = d;
      domainsList.appendChild(opt);
    }
  }
  if (Array.isArray(meta.existingDomains) && meta.existingDomains.length > 0) {
    if (domainInput) domainInput.value = meta.existingDomains[0];
    if (rawDomainInput) rawDomainInput.placeholder = meta.existingDomains[0];
  }
}

export function renderExtractedScaffoldPreview(root, res) {
  const engineBadge = root.querySelector('#qa-scaffold-preview-engine-badge');
  const typeBadge = root.querySelector('#qa-scaffold-preview-type-badge');
  const filesList = root.querySelector('#qa-scaffold-preview-files-list');
  const previewBox = root.querySelector('#qa-scaffold-raw-preview');

  if (engineBadge) {
    engineBadge.textContent = res.engine === 'ai' ? 'AI Semantic' : 'Heuristic Cục Bộ';
    engineBadge.style.background = res.engine === 'ai' ? 'var(--primary-subtle, rgba(168, 85, 247, 0.15))' : 'var(--accent-subtle, rgba(59, 130, 246, 0.15))';
    engineBadge.style.color = res.engine === 'ai' ? 'var(--primary)' : 'var(--accent)';
  }
  if (typeBadge) {
    typeBadge.textContent = res.inputType === 'test_script' ? 'Playwright Script' : 'Spec Text';
    typeBadge.style.background = res.inputType === 'test_script' ? 'var(--warning-subtle, rgba(234, 179, 8, 0.15))' : 'var(--success-subtle, rgba(16, 185, 129, 0.15))';
    typeBadge.style.color = res.inputType === 'test_script' ? 'var(--warning)' : 'var(--success)';
  }

  const setTxt = (id, v) => { const el = root.querySelector(`#${id}`); if (el) el.textContent = v; };
  setTxt('qa-scaffold-preview-req-id', res.preview?.reqId || '');
  setTxt('qa-scaffold-preview-title', res.preview?.title || '');
  setTxt('qa-scaffold-preview-domain', res.preview?.domain || '');
  setTxt('qa-scaffold-preview-ac-count', String(res.preview?.acCount ?? 0));
  setTxt('qa-scaffold-preview-tc-count', String(res.preview?.tcCount ?? 0));

  if (filesList && Array.isArray(res.preview?.files)) {
    filesList.textContent = '';
    res.preview.files.forEach((f) => {
      const li = document.createElement('li');
      li.textContent = f;
      filesList.appendChild(li);
    });
  }
  if (previewBox) previewBox.style.display = 'block';
}
