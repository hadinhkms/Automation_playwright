/**
 * dashboard/public/js/views/mobile/inspectorScreen.js
 * Inspector → shared native Screen (PLAN-25 P4, BR-401, I-02): picked elements, target (new Screen or the
 * current platform's cells of an existing one), preview in the shared code editor, draft, then Tạo.
 */
import { apiClient } from '../../core/apiClient.js';

const $ = (id) => document.getElementById(id);
const NAME = /^[a-z][A-Za-z0-9]{0,39}$/;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Shared editor from app.js (one implementation for every code surface); a plain textarea if it is missing. */
function editor() {
  const create = window.createSharedCodeEditor;
  return typeof create === 'function'
    ? create({ textarea: $('insp-editor'), preview: $('insp-code'), language: 'javascript' })
    : { setValue: (v) => { $('insp-editor').value = v; }, getValue: () => $('insp-editor').value };
}

export class InspectorScreenBuilder {
  constructor(host) {
    this.host = host; // { state, notify }
    this.preview = null;
  }

  get s() { return this.host.state; }

  targetMode() { return document.querySelector('input[name="insp-target-mode"]:checked')?.value || 'new'; }

  /** Adds or replaces (same name) the selected element with the chosen locator. */
  add() {
    const name = $('insp-el-name').value.trim();
    if (!NAME.test(name)) { this.host.notify('Tên locator phải là camelCase, bắt đầu bằng chữ thường (ví dụ: searchButton).'); return; }
    if (!this.s.locator) { this.host.notify('Chọn một locator trước.'); return; }
    const entry = { name, locator: this.s.locator, action: $('insp-el-action').value };
    const at = this.s.picked.findIndex((p) => p.name === name);
    if (at >= 0) this.s.picked[at] = entry; else this.s.picked.push(entry);
    this.invalidate();
  }

  remove(name) { this.s.picked = this.s.picked.filter((p) => p.name !== name); this.invalidate(); }

  clear() { this.s.picked = []; this.invalidate(); }

  /** Any change to inputs makes the previewed source stale. */
  invalidate() { this.preview = null; $('insp-editor-stage').hidden = true; $('insp-editor-meta').textContent = ''; this.render(); }

  async loadScreens() {
    try { this.s.screens = (await apiClient.get('/api/mobile/inspector/screens')).screens || []; } catch (_) { this.s.screens = []; }
    this.render();
  }

  body(mode) {
    const existing = this.targetMode() === 'existing';
    const body = {
      mode, platform: this.s.platform, merge: existing, elements: this.s.picked,
      name: existing ? $('insp-screen-select').value : $('insp-screen-name').value.trim(),
    };
    if (this.preview && mode !== 'preview') body.source = editor().getValue();
    return body;
  }

  blocker() {
    if (!this.s.picked.length) return 'Thêm ít nhất một phần tử vào Screen.';
    if (this.targetMode() === 'existing' && !$('insp-screen-select').value) return 'Chưa có Screen nào trong pages/native/screens/.';
    if (this.targetMode() === 'new' && !$('insp-screen-name').value.trim()) return 'Đặt tên cho Screen mới (ví dụ: JobList).';
    const taken = this.targetMode() === 'new' && this.s.screens.some((x) => x.className.toLowerCase() === `${$('insp-screen-name').value.trim().replace(/screen$/i, '')}screen`.toLowerCase());
    if (taken) return 'Tên này đã có. Chọn "Screen có sẵn" để thêm locator vào đó, hoặc đặt tên khác.';
    return '';
  }

  async send(mode) {
    try {
      const result = await apiClient.post('/api/mobile/inspector/page-object', this.body(mode));
      if (mode === 'preview') {
        this.preview = result;
        $('insp-editor-stage').hidden = false;
        editor().setValue(result.source, { markClean: true });
      }
      const missingOther = result.missing?.length ? ` · Thiếu locator ${this.s.platform === 'android' ? 'iOS' : 'Android'}: ${result.missing.join(', ')}` : '';
      const done = mode === 'create' ? `Đã tạo ${result.path}` : mode === 'draft' ? `Đã lưu nháp ${result.draft}` : `${result.merge ? 'Thêm vào' : 'Tạo mới'} ${result.path}`;
      $('insp-editor-meta').textContent = `${done}${missingOther}`;
      if (mode !== 'preview') this.host.notify(`${done}.`);
      if (mode === 'create') { this.s.picked = []; this.preview = null; $('insp-editor-stage').hidden = true; await this.loadScreens(); }
    } catch (err) {
      $('insp-editor-meta').textContent = err.message;
      this.host.notify(err.message);
    }
    this.render();
  }

  render() {
    const list = $('insp-picked');
    list.replaceChildren();
    if (!this.s.picked.length) list.append(el('li', 'mobile-hint', 'Chưa có phần tử nào. Chọn phần tử, chọn locator rồi bấm "Thêm vào Screen".'));
    this.s.picked.forEach((p) => {
      const li = el('li', 'insp-picked-row');
      const text = el('span', 'insp-picked-text');
      text.append(el('strong', 'mobile-mono', p.name), el('small', 'mobile-mono', `${p.action} · ${p.locator}`));
      const del = el('button', 'btn-icon-subtle');
      del.type = 'button';
      del.dataset.remove = p.name;
      del.title = `Bỏ ${p.name}`;
      del.setAttribute('aria-label', `Bỏ ${p.name}`);
      del.append(el('i', 'ph-bold ph-x'));
      li.append(text, del);
      list.append(li);
    });
    const existing = this.targetMode() === 'existing';
    const select = $('insp-screen-select');
    const current = select.value;
    select.replaceChildren(...this.s.screens.map((x) => {
      const o = el('option', '', `${x.className}${x.editable ? '' : ' (viết tay, không ghi tự động)'}`);
      o.value = x.className;
      o.disabled = !x.editable;
      return o;
    }));
    if (current) select.value = current;
    select.hidden = !existing;
    $('insp-screen-name').hidden = existing;
    const chosen = this.s.screens.find((x) => x.className === select.value);
    const other = this.s.platform === 'android' ? 'ios' : 'android';
    const why = this.blocker();
    const info = existing && chosen
      ? `Ghi vào ô ${this.s.platform === 'android' ? 'Android' : 'iOS'} của ${chosen.path}. ${chosen.missing[other].length ? `Còn thiếu ${other === 'ios' ? 'iOS' : 'Android'}: ${chosen.missing[other].join(', ')}.` : ''}`
      : '';
    $('insp-screen-hint').textContent = why || info;
    const blocked = Boolean(why);
    $('insp-preview-btn').disabled = blocked;
    $('insp-draft-btn').disabled = blocked;
    $('insp-create-btn').disabled = blocked;
  }
}
