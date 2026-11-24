/**
 * dashboard/public/js/views/runner/picker/pickerHistory.js
 * Adapter for the web run history (CONTRACT-run-history §4) + the wording of the history UI. The UI only talks
 * to this file, so an API rename never spreads. Pure helpers (timeAgo, statusInfo, recentSets) are unit-tested.
 */
import { apiClient } from '../../../core/apiClient.js';

export const emptyHistory = () => ({ loaded: false, error: '', latest: { run: null, specs: [], missing: [] }, status: {}, runs: [] });

/** Loads everything the picker shows from history; a failure is reported, never thrown (S5b). */
export async function fetchHistory(api = apiClient) {
  try {
    const [latest, fileStatus, list] = await Promise.all([api.get('/api/run-history/latest-failed'), api.get('/api/run-history/file-status'), api.get('/api/run-history?limit=10')]);
    return { loaded: true, error: '', latest: { run: latest.run || null, specs: latest.specs || [], missing: latest.missing || [] }, status: fileStatus.files || {}, runs: list.runs || [] };
  } catch (err) {
    return { ...emptyHistory(), loaded: true, error: err.message || 'lỗi không rõ' };
  }
}

const pad = (n) => String(n).padStart(2, '0');

/** "vừa xong", "5 phút trước", "2 giờ trước", "hôm qua 16:20", "03/11 09:05". */
export function timeAgo(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  if (min < 24 * 60 && new Date(now).getDate() === new Date(t).getDate()) return `${Math.floor(min / 60)} giờ trước`;
  const d = new Date(t);
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === yesterday.toDateString() ? `hôm qua ${hm}` : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hm}`;
}

const KINDS = {
  failed: { kind: 'fail', icon: 'ph-x', label: 'Fail' },
  passed: { kind: 'pass', icon: 'ph-check', label: 'Pass' },
  flaky: { kind: 'flaky', icon: 'ph-warning', label: 'Flaky' },
  skipped: { kind: 'skipped', icon: 'ph-minus', label: 'Bỏ qua' },
};

/** Badge of one file: always an icon AND words (never colour alone). */
export function statusInfo(entry, now = Date.now()) {
  const k = entry && KINDS[entry.status];
  if (!k) return { kind: 'none', icon: 'ph-circle-dashed', text: 'Chưa chạy' };
  const when = timeAgo(entry.at, now);
  return { kind: k.kind, icon: k.icon, text: when ? `${k.label} ${when}` : k.label };
}

/** Up to `max` recent runs with different file/tag sets, newest first (stopped runs are skipped). */
export function recentSets(runs, max = 5) {
  const seen = new Set();
  const out = [];
  for (const r of runs) {
    if (r.status === 'stopped') continue;
    const key = JSON.stringify([[...(r.specs || [])].sort(), [...(r.tags || [])].sort()]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

export function runLabel(run, now = Date.now()) {
  const n = (run.specs || []).length;
  const failed = run.summary && Number.isFinite(run.summary.failed) ? run.summary.failed : null;
  return [timeAgo(run.startedAt, now), n ? `${n} script` : 'tất cả script', failed === null ? '' : `${failed} fail`].filter(Boolean).join(' · ');
}
