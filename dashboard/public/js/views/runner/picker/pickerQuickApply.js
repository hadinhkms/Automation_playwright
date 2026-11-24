/**
 * dashboard/public/js/views/runner/picker/pickerQuickApply.js
 * Quick chips (suite, Fail lần trước, Chạy gần đây) REPLACE the selection, clear search/filters, and leave an
 * undo record (HANDOFF 6: "Hoàn tác" instead of a confirm dialog).
 */
import { clearFilters } from './pickerState.js';

const snapshot = (state) => ({ selected: new Set(state.selected), projects: new Set(state.projects), tags: new Set(state.tags), tagOnly: state.tagOnly, query: state.query, platforms: new Set(state.platforms) });

export function restore(state, prev) {
  state.selected = prev.selected; state.projects = prev.projects; state.tags = prev.tags; state.tagOnly = prev.tagOnly; state.query = prev.query; state.platforms = prev.platforms;
}

/** paths: wanted files (unknown ones are ignored); opts: { source, projects, tags, missing }. Returns the number selected. */
export function replaceSelection(ctx, paths, { source, projects = [], tags = [], missing = 0 }) {
  const { state, catalog } = ctx;
  const prev = snapshot(state);
  clearFilters(state);
  state.selected = new Set(paths.filter((p) => catalog.byPath.has(p)));
  const known = new Set(catalog.projects);
  state.projects = new Set(projects.filter((p) => known.has(p)));
  const knownTags = new Set(catalog.tags.map((t) => t.tag));
  const useTags = tags.filter((t) => knownTags.has(t));
  state.tags = new Set(useTags);
  state.tagOnly = useTags.length > 0;
  ctx.undo = { prev, text: `Đã chọn ${state.selected.size} script từ “${source}”.${missing ? ` ${missing} file đã bị xoá khỏi dự án.` : ''}` };
  return state.selected.size;
}
