/**
 * dashboard/public/js/views/mobile/mobileBuilds.js
 * Upload (drag & drop or file picker, with progress and cancel) and delete of app builds in apps/.
 * The server is the authority on names and limits; the checks here only give earlier feedback.
 */
import { apiClient } from '../../core/apiClient.js';
import { formatSize } from './mobileRender.js';

const $ = (id) => document.getElementById(id);
const MAX_BYTES = 300 * 1024 * 1024;

/** BR-202: keep [A-Za-z0-9._-], no leading dot, no "..". */
export function cleanBuildName(name) {
  return String(name || '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[.-]+/, '').slice(0, 120);
}

export class MobileBuilds {
  /** @param {{ on: Function, getSelected: () => string, onUploaded: Function, onDeleted: Function, notify: Function }} host */
  constructor(host) {
    this.host = host;
    this.xhr = null;
    this.confirmAction = null;
  }

  bind() {
    const { on } = this.host;
    const drop = $('mobile-upload-drop');
    const input = $('mobile-upload-input');
    on(drop, 'click', () => { if (!this.xhr) input.click(); });
    on(drop, 'keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !this.xhr) { e.preventDefault(); input.click(); } });
    on(input, 'change', () => { const file = input.files?.[0]; input.value = ''; if (file) this.upload(file); });
    on(drop, 'dragover', (e) => { e.preventDefault(); drop.classList.add('is-dragover'); });
    on(drop, 'dragleave', () => drop.classList.remove('is-dragover'));
    on(drop, 'drop', (e) => {
      e.preventDefault();
      drop.classList.remove('is-dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file && !this.xhr) this.upload(file);
    });
    on($('mobile-upload-cancel'), 'click', () => this.xhr?.abort());
    on($('mobile-apk-delete'), 'click', () => this.askDelete());
    on($('mobile-build-confirm-yes'), 'click', () => { const act = this.confirmAction; this.hideConfirm(); act?.(); });
    on($('mobile-build-confirm-no'), 'click', () => this.hideConfirm());
  }

  dispose() {
    this.xhr?.abort();
    this.xhr = null;
  }

  upload(file, overwrite = false) {
    const name = cleanBuildName(file.name);
    this.hideConfirm();
    if (!/\.apk$/i.test(name)) return this.host.notify(`"${file.name}" không phải file .apk.`);
    if (file.size === 0) return this.host.notify('File rỗng (0 byte).');
    if (file.size > MAX_BYTES) return this.host.notify(`File ${formatSize(file.size)} vượt quá 300 MB.`);

    const xhr = new XMLHttpRequest();
    this.xhr = xhr;
    this.showProgress(0, `Đang tải ${name}...`);
    xhr.open('PUT', `/api/mobile/builds/${encodeURIComponent(name)}${overwrite ? '?overwrite=1' : ''}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) this.showProgress(e.loaded / e.total, `${name} · ${formatSize(e.loaded)} / ${formatSize(e.total)}`); };
    xhr.onload = () => this.finish(xhr, file, name, overwrite);
    xhr.onerror = () => { this.endUpload(); this.host.notify('Mất kết nối khi tải lên. File dở đã được bỏ, hãy thử lại.'); };
    xhr.onabort = () => { this.endUpload(); this.host.notify('Đã huỷ tải lên.'); };
    xhr.send(file);
  }

  finish(xhr, file, name, overwrite) {
    this.endUpload();
    let body = {};
    try { body = JSON.parse(xhr.responseText || '{}'); } catch (_) {}
    if (xhr.status === 201) {
      this.host.notify(`Đã tải lên ${body.name || name}.`);
      this.host.onUploaded(body.path || `apps/${name}`);
      return;
    }
    if (xhr.status === 409 && !overwrite && /Xác nhận ghi đè/.test(body.error || '')) {
      this.showConfirm(`Đã có build "${name}". Ghi đè bằng file mới?`, 'Ghi đè', () => this.upload(file, true));
      return;
    }
    this.host.notify(`Không tải lên được: ${body.error || `HTTP ${xhr.status}`}`);
  }

  askDelete() {
    const selected = this.host.getSelected();
    if (!selected) return;
    const name = selected.replace(/^apps\//, '');
    this.showConfirm(`Xoá build "${name}" khỏi thư mục apps/?`, 'Xoá build', () => this.remove(name));
  }

  async remove(name) {
    try {
      await apiClient.request(`/api/mobile/builds/${encodeURIComponent(name)}`, { method: 'DELETE' });
      this.host.notify(`Đã xoá ${name}.`);
      this.host.onDeleted();
    } catch (err) {
      this.host.notify(`Không xoá được: ${err.message}`);
    }
  }

  showProgress(ratio, text) {
    $('mobile-upload-progress').hidden = false;
    $('mobile-upload-drop').classList.add('is-busy');
    $('mobile-upload-bar').style.width = `${Math.round(ratio * 100)}%`;
    $('mobile-upload-text').textContent = text;
  }

  endUpload() {
    this.xhr = null;
    if (!$('mobile-upload-progress')) return;
    $('mobile-upload-progress').hidden = true;
    $('mobile-upload-drop').classList.remove('is-busy');
  }

  showConfirm(text, yesLabel, action) {
    this.confirmAction = action;
    $('mobile-build-confirm-text').textContent = text;
    $('mobile-build-confirm-yes').textContent = yesLabel;
    $('mobile-build-confirm').hidden = false;
    $('mobile-build-confirm-yes').focus();
  }

  hideConfirm() {
    this.confirmAction = null;
    if ($('mobile-build-confirm')) $('mobile-build-confirm').hidden = true;
  }
}
