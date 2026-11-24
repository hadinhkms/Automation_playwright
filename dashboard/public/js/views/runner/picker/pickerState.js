/**
 * dashboard/public/js/views/runner/picker/pickerState.js
 * Selection + filter state and the tri-state rule of the group checkboxes (HANDOFF 5.2).
 * A group only acts on its VISIBLE children; hidden selected files keep their state.
 */
export function createState() {
  return { selected: new Set(), query: '', platforms: new Set(), tags: new Set(), collapsed: new Set(), tagOnly: false, projects: new Set() };
}

export function toggleFile(state, path) {
  if (state.selected.has(path)) state.selected.delete(path); else state.selected.add(path);
}

/** 'true' = every visible child selected, 'false' = none, 'mixed' = some. */
export function groupCheck(state, visibleFiles) {
  const n = visibleFiles.filter((f) => state.selected.has(f.path)).length;
  if (n === 0) return 'false';
  return n === visibleFiles.length ? 'true' : 'mixed';
}

/** From 'mixed' or 'false' select all visible; from 'true' clear them (Gmail/Finder style). */
export function toggleGroup(state, visibleFiles) {
  const clear = groupCheck(state, visibleFiles) === 'true';
  visibleFiles.forEach((f) => (clear ? state.selected.delete(f.path) : state.selected.add(f.path)));
}

export function selectVisible(state, visibleFiles, on = true) {
  visibleFiles.forEach((f) => (on ? state.selected.add(f.path) : state.selected.delete(f.path)));
}

/** S12: drop selected paths that no longer exist in the catalog; returns the dropped count. */
export function pruneMissing(state, catalog) {
  const gone = [...state.selected].filter((p) => !catalog.byPath.has(p));
  gone.forEach((p) => state.selected.delete(p));
  return gone.length;
}

/** L2: drop remembered filters/overrides that no longer exist in the catalog/config; returns the dropped counts. */
export function pruneStale(state, catalog) {
  const tags = new Set(catalog.tags.map((t) => t.tag));
  const platforms = new Set(catalog.platforms.map((p) => p.label));
  const projects = new Set(catalog.projects);
  const drop = (set, keep) => { const gone = [...set].filter((v) => !keep.has(v)); gone.forEach((v) => set.delete(v)); return gone.length; };
  const counts = { file: pruneMissing(state, catalog), tag: drop(state.tags, tags), nền_tảng: drop(state.platforms, platforms), project: catalog.projects.length ? drop(state.projects, projects) : 0 };
  if (!state.tags.size) state.tagOnly = false;
  return counts;
}

/** "Đã bỏ 2 file, 1 tag không còn tồn tại." or '' when nothing was dropped. */
export function staleMessage(counts) {
  const parts = Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k.replace('_', ' ')}`);
  return parts.length ? `Đã bỏ ${parts.join(', ')} không còn tồn tại.` : '';
}

export function clearFilters(state) {
  state.query = ''; state.platforms.clear(); state.tags.clear();
}

export function toggleIn(set, value) {
  if (set.has(value)) set.delete(value); else set.add(value);
}
