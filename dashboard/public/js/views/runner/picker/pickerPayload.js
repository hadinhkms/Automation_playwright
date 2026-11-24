/**
 * dashboard/public/js/views/runner/picker/pickerPayload.js
 * Picker state -> body of POST /api/run (CONTRACT 2.2 / OPEN-7). The server sets the limits; the UI never
 * second-guesses them (it only shows the server's 400 message).
 */
export const WARN_FILES = 20; // HANDOFF S6 (CEO decision): warn, never block.

export const familyOf = (project) => String(project).replace(/ (Smoke|Regression) Tests$/, '');

/** Default projects of a file: every project of its FIRST device family (keeps Smoke + Regression, not Chrome + Safari). */
export function defaultProjects(file) {
  if (!file.projects.length) return [];
  const family = familyOf(file.projects[0]);
  return file.projects.filter((p) => familyOf(p) === family);
}

export function projectsFor(files, override) {
  if (override && override.size) return [...override];
  return [...new Set(files.flatMap(defaultProjects))];
}

/** Runs = sum over files of |file.projects ∩ chosen| (a file without a mapping counts once). Not a test count. */
export function runCount(files, projects) {
  return files.reduce((n, f) => n + (f.projects.length ? f.projects.filter((p) => projects.includes(p)).length : 1), 0);
}

export function buildPayload(state, catalog, controls) {
  const files = catalog.files.filter((f) => state.selected.has(f.path));
  const payload = { environment: controls.environment, workers: controls.workers, headed: controls.headed };
  if (files.length === catalog.files.length && files.length > 0) payload.spec = 'all'; else payload.specs = files.map((f) => f.path);
  const projects = projectsFor(files, state.projects);
  if (projects.length) payload.projects = projects;
  if (state.tagOnly && state.tags.size) payload.tags = [...state.tags];
  return payload;
}

const q = (s) => (/^[\w./@-]+$/.test(s) ? s : `"${s}"`);
export function commandPreview(payload, catalog, full = true) {
  const list = payload.spec === 'all' ? [] : payload.specs;
  const shown = full || list.length <= 3 ? list : [...list.slice(0, 3), `… và ${list.length - 3} file khác`];
  const parts = ['npx playwright test', ...shown.map(q)];
  (payload.projects || []).forEach((p) => parts.push(`--project="${p}"`));
  if (payload.tags) parts.push(`--grep "${payload.tags.join('|')}"`);
  return parts.join(' ');
}

/** Honest note for a selected file that runs on more than one device family (OPEN-7.4). */
export function multiDeviceNote(files, projects) {
  const f = files.find((x) => new Set(x.projects.map(familyOf)).size > 1);
  if (!f) return '';
  const families = [...new Set(f.projects.map(familyOf))];
  return `${f.name} chạy được trên ${families.length} thiết bị; đang chọn ${familyOf(projects.find((p) => f.projects.includes(p)) || f.projects[0])}.`;
}

/** Same regex the server builds from tags[] (runnerArgs.tagGrep): tags only contain [A-Za-z0-9_@-], nothing to escape. */
export const grepFromTags = (tags) => `(?:${tags.join('|')})(?![\\w-])`;

/** Inverse of grepFromTags for suites saved by the picker; null for any other grep text. */
export function tagsFromGrep(grep) {
  const m = /^\(\?:(@[\w-]+(?:\|@[\w-]+)*)\)\(\?!\[\\w-\]\)$/.exec(String(grep || ''));
  return m ? m[1].split('|') : null;
}
