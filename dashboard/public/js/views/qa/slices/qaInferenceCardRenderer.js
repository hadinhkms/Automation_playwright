'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaInferenceCardRenderer.js
 * Dựng thẻ Test Case đề xuất có thể chỉnh sửa, kiểm tra trạng thái AI badge và cuộn highlight (DOM-safe).
 */

export function refreshInferAiBadge(root, apiClient) {
  const aiBadge = root.querySelector('#qa-infer-ai-badge');
  if (!aiBadge) return;
  aiBadge.textContent = 'Đang kiểm tra AI...';
  aiBadge.style.background = 'rgba(156, 163, 175, 0.15)';
  aiBadge.style.color = 'var(--muted)';
  apiClient.get('/api/ai/config').then((aiConfig) => {
    if (aiConfig && aiConfig.hasKey) {
      aiBadge.textContent = `🟢 Sẵn sàng (${aiConfig.provider})`;
      aiBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      aiBadge.style.color = '#10b981';
    } else {
      aiBadge.textContent = '⚪ Chưa có Key';
      aiBadge.style.background = 'rgba(239, 68, 68, 0.15)';
      aiBadge.style.color = '#ef4444';
    }
  }).catch(() => {
    aiBadge.textContent = '⚪ Không khả dụng';
  });
}

export function highlightAddedTcInReader(root, firstAddedId) {
  if (!firstAddedId) return;
  setTimeout(() => {
    const readerBody = root.querySelector('#qa-reader-body');
    if (!readerBody) return;
    const targetEl = Array.from(readerBody.querySelectorAll('h3, tr, p'))
      .find((el) => el.textContent.includes(firstAddedId));
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetEl.classList.add('qa-row-highlight');
    }
  }, 200);
}

export function renderInferredCardList(qaSlice, list, items, onSelectionChange) {
  list.textContent = '';

  items.forEach((item, index) => {
    const card = qaSlice._el('div', null, 'qa-inferred-card is-selected');
    card.dataset.idx = String(index);
    const topRow = qaSlice._el('div', null, 'qa-inferred-top');

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = true;
    chk.className = 'qa-inferred-chk';
    chk.dataset.idx = String(index);
    chk.addEventListener('change', () => {
      card.classList.toggle('is-selected', chk.checked);
      if (typeof onSelectionChange === 'function') onSelectionChange();
    });

    const badge = qaSlice._el('span', item.suggestedId || `TC-${index + 1}`, 'qa-inferred-id-badge');

    const acSelect = document.createElement('select');
    acSelect.className = 'qa-inferred-ac-select';
    acSelect.title = 'Liên kết Acceptance Criterion';
    const acOptions = (qaSlice._activeDocAcs && qaSlice._activeDocAcs.length)
      ? qaSlice._activeDocAcs
      : [{ id: item.acId || 'AC-001', title: '' }];
    acOptions.forEach((ac) => {
      const opt = document.createElement('option');
      opt.value = ac.id;
      opt.textContent = ac.title ? `${ac.id} — ${ac.title}` : ac.id;
      if (ac.id === item.acId) opt.selected = true;
      acSelect.appendChild(opt);
    });

    const prioSelect = document.createElement('select');
    prioSelect.className = 'qa-inferred-priority-select';
    prioSelect.title = 'Mức độ ưu tiên kiểm thử';
    ['P0', 'P1', 'P2', 'P3'].forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      if (p === (item.priority || 'P1')) opt.selected = true;
      prioSelect.appendChild(opt);
    });

    topRow.append(chk, badge, acSelect, prioSelect);
    card.appendChild(topRow);

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'qa-inferred-title-input';
    titleInput.value = item.title || '';
    card.appendChild(titleInput);

    if (item.rationale) card.appendChild(qaSlice._el('p', `💡 ${item.rationale}`, 'qa-inferred-rationale'));

    if (Array.isArray(item.steps) && item.steps.length) {
      const table = document.createElement('table');
      table.className = 'qa-inferred-steps-table';
      const thead = document.createElement('thead');
      const trHead = document.createElement('tr');
      const th1 = qaSlice._el('th', 'Bước');
      th1.style.width = '45px';
      trHead.append(th1, qaSlice._el('th', 'Thao tác'), qaSlice._el('th', 'Kết quả mong đợi'));
      thead.appendChild(trHead);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      item.steps.forEach((s, sIdx) => {
        const tr = document.createElement('tr');
        tr.append(qaSlice._el('td', String(s.step || sIdx + 1)), qaSlice._el('td', s.action || ''), qaSlice._el('td', s.expected || ''));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      card.appendChild(table);
    }

    list.appendChild(card);
  });
}

export function collectSelectedInferredTestCases(root, inferredItems) {
  const toSubmit = [];
  root.querySelectorAll('.qa-inferred-card').forEach((card) => {
    const chk = card.querySelector('.qa-inferred-chk');
    if (chk && chk.checked) {
      const original = inferredItems[parseInt(chk.dataset.idx, 10)];
      if (original) {
        const title = card.querySelector('.qa-inferred-title-input')?.value.trim() || original.title;
        const acId = card.querySelector('.qa-inferred-ac-select')?.value || original.acId;
        const priority = card.querySelector('.qa-inferred-priority-select')?.value || original.priority;
        toSubmit.push({ ...original, title, acId, priority });
      }
    }
  });
  return toSubmit;
}
