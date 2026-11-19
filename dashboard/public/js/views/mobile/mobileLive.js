/**
 * dashboard/public/js/views/mobile/mobileLive.js
 * Live part of the Mobile App view: SSE events from /api/events, the log panel, and the run snapshot on mount.
 */
import { apiClient } from '../../core/apiClient.js';
import { readFormOptions, runBlocker } from './mobileForm.js';

const $ = (id) => document.getElementById(id);

export function appendLog(text) {
  const log = $('mobile-log');
  if (!log) return;
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  log.append(document.createTextNode(text));
  if (log.textContent.length > 200000) log.textContent = log.textContent.slice(-150000);
  if (nearBottom) log.scrollTop = log.scrollHeight;
}

/** Opens the event stream; returns the EventSource so the slice can close it on unmount. */
export function connectEvents(slice) {
  if (typeof EventSource === 'undefined') return null;
  const source = new EventSource('/api/events');
  source.onmessage = ({ data }) => {
    let event;
    try { event = JSON.parse(data); } catch (_) { return; }
    if (event.type === 'mobile_log') appendLog(event.payload.text);
    if (event.type === 'mobile_status') { slice.state.run = event.payload; slice._renderRunPanel(); }
    if (event.type === 'status') { slice.state.webBusy = event.payload?.status === 'running'; slice._renderRunPanel(); }
  };
  return source;
}

/** Current or last mobile run plus whether Playwright is busy (shared run lock, X-02). */
export async function loadRunState(slice, gen) {
  try {
    const [mobile, web] = await Promise.all([apiClient.get('/api/mobile/state'), apiClient.get('/api/state')]);
    if (gen !== slice._gen) return;
    slice.state.run = mobile.activeRun || mobile.lastRun;
    slice.state.webBusy = Boolean(web.activeRun);
    $('mobile-log').textContent = mobile.logs.map((l) => l.text).join('');
    slice._renderRunPanel();
  } catch (_) {}
}

/** Starts a run with the current form; the server re-validates everything (X-03). */
export async function startRun(slice) {
  const opts = readFormOptions(slice.state);
  if (runBlocker(slice.state, opts)) return;
  $('mobile-run-btn').disabled = true;
  $('mobile-log').textContent = '';
  try {
    const run = await apiClient.post('/api/mobile/run', opts);
    if (slice.state.run?.id !== run.id) slice.state.run = run;
    slice._renderRunPanel();
  } catch (err) {
    slice._renderRunPanel();
    $('mobile-run-hint').textContent = `Không chạy được: ${err.message}`;
    slice._notify(`Không chạy được: ${err.message}`);
  }
}
