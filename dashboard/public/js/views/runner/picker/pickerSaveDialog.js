/**
 * dashboard/public/js/views/runner/picker/pickerSaveDialog.js
 * Modal "Lưu thành suite" (HANDOFF 9). Native <dialog> (focus trap, Esc), built with createElement/textContent
 * only, so a user-chosen label or a file name can never become markup. Keeps what was typed on every error.
 */
import { NAME_MAX, DESC_MAX, KEY_RE, slugify, buildSuite, saveSuite } from './pickerSaveSuite.js';

const el = (doc, tag, props = {}, ...kids) => { const n = Object.assign(doc.createElement(tag), props); n.append(...kids); return n; };
const field = (doc, label, input, errId) => el(doc, 'div', { className: 'sp-field' }, el(doc, 'label', { htmlFor: input.id, textContent: label }), input, el(doc, 'p', { id: errId, className: 'sp-error', role: 'alert', hidden: true }));

/** `info`: { payload, summary, files[] }; `suites`: current suites (client-side key check); resolves with the saved result or null. */
export function openSaveDialog(win, { info, suites, onSaved, opener }) {
  const doc = win.document;
  const dialog = el(doc, 'dialog', { id: 'sp-save-dialog', className: 'sp-dialog' });
  dialog.setAttribute('aria-labelledby', 'sp-save-title');
  const name = el(doc, 'input', { id: 'sp-suite-name', type: 'text', maxLength: NAME_MAX, autocomplete: 'off' });
  const key = el(doc, 'input', { id: 'sp-suite-key', type: 'text', maxLength: NAME_MAX, autocomplete: 'off' });
  const desc = el(doc, 'input', { id: 'sp-suite-desc', type: 'text', maxLength: DESC_MAX, autocomplete: 'off' });
  const shown = info.files.slice(0, 6);
  const list = el(doc, 'ul', { className: 'sp-savelist' }, ...shown.map((f) => el(doc, 'li', { textContent: f })), ...(info.files.length > 6 ? [el(doc, 'li', { textContent: `… và ${info.files.length - 6} file khác` })] : []));
  const topError = el(doc, 'p', { id: 'sp-save-error', className: 'sp-error', role: 'alert', hidden: true });
  const save = el(doc, 'button', { type: 'submit', className: 'sp-run', id: 'sp-save-submit', textContent: 'Lưu suite' });
  const cancel = el(doc, 'button', { type: 'button', className: 'sp-link', id: 'sp-save-cancel', textContent: 'Hủy' });
  const form = el(doc, 'form', { method: 'dialog', noValidate: true }, el(doc, 'h3', { id: 'sp-save-title', textContent: 'Lưu thành suite' }),
    el(doc, 'p', { className: 'sp-hint', textContent: `Gồm ${info.summary}` }), list,
    field(doc, 'Tên suite', name, 'sp-name-error'), field(doc, 'Mã suite (key)', key, 'sp-key-error'), field(doc, 'Mô tả (không bắt buộc)', desc, 'sp-desc-error'),
    el(doc, 'p', { className: 'sp-hint', textContent: 'Lưu vào cấu hình của máy này; chưa đẩy lên Git.' }), topError, el(doc, 'div', { className: 'sp-runrow' }, save, cancel));
  dialog.append(form);
  (doc.getElementById('script-picker') || doc.body).append(dialog); // inside the picker: it inherits --on-accent and the focus ring

  const show = (id, text) => { const n = dialog.querySelector(`#${id}`); n.textContent = text; n.hidden = !text; };
  let keyTouched = false;
  let saved = false;
  name.addEventListener('input', () => { if (!keyTouched) key.value = slugify(name.value); });
  key.addEventListener('input', () => { keyTouched = true; });
  cancel.addEventListener('click', () => dialog.close());
  // Cancel/Esc: back to the button that opened it; after a save: to the run button (HANDOFF 9)
  dialog.addEventListener('close', () => { dialog.remove(); (saved ? doc.getElementById('sp-run') : opener)?.focus(); });

  function validate() {
    const label = name.value.trim();
    show('sp-name-error', label && label.length <= NAME_MAX ? '' : `Nhập tên suite (tối đa ${NAME_MAX} ký tự).`);
    show('sp-key-error', KEY_RE.test(key.value) ? (Object.prototype.hasOwnProperty.call(suites, key.value) ? `Mã “${key.value}” đã dùng. Đổi mã hoặc chọn tên khác.` : '') : 'Mã chỉ gồm chữ thường, số và dấu gạch ngang.');
    show('sp-desc-error', desc.value.length <= DESC_MAX ? '' : `Mô tả tối đa ${DESC_MAX} ký tự.`);
    return !['sp-name-error', 'sp-key-error', 'sp-desc-error'].some((id) => !dialog.querySelector(`#${id}`).hidden);
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    show('sp-save-error', '');
    if (!validate()) return;
    save.disabled = true; save.textContent = 'Đang lưu…';
    const result = await saveSuite({ key: key.value, suite: buildSuite(info.payload, { label: name.value.trim(), description: desc.value.trim() }) });
    save.disabled = false; save.textContent = 'Lưu suite';
    if (result.ok) { saved = true; dialog.close(); onSaved(result, name.value.trim()); return; }
    if (result.code === 'KEY_TAKEN') show('sp-key-error', result.message);
    else show('sp-save-error', result.code === 'CONFLICT' ? `${result.message} Dữ liệu bạn nhập vẫn còn — thử lại.` : `Chưa lưu được suite: ${String(result.message).replace(/[.\s]+$/, '')}. Danh sách script bạn chọn vẫn còn — thử lại.`);
  });
  dialog.showModal();
  name.focus();
  return dialog;
}
