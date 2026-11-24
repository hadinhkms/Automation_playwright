/**
 * dashboard/public/js/views/runner/picker/pickerView.js
 * Derives what to draw from the controller context: filtered files per group and the run-bar info.
 */
import { filterFiles, hasFilter } from './pickerFilter.js';
import { buildPayload, projectsFor, runCount, multiDeviceNote, WARN_FILES, commandPreview } from './pickerPayload.js';

export function deriveView(ctx, controls) {
  const { catalog, state } = ctx;
  const found = filterFiles(catalog.files, state);
  const foundSet = new Set(found.map((f) => f.path));
  const visibleByGroup = new Map(catalog.groups.map((g) => [g.key, g.files.filter((f) => foundSet.has(f.path))]));
  const selected = catalog.files.filter((f) => state.selected.has(f.path));
  const payload = buildPayload(state, catalog, controls);
  const projects = projectsFor(selected, state.projects);
  const activeFilters = state.platforms.size + state.tags.size;
  const info = {
    count: selected.length, all: payload.spec === 'all', hidden: selected.filter((f) => !foundSet.has(f.path)).length, projects, runs: runCount(selected, projects),
    env: controls.environment, workers: controls.workers, warnAt: WARN_FILES, error: ctx.runError, notice: ctx.notice, running: ctx.running, frozen: controls.frozen,
    estimate: catalog.source === 'estimate', canRun: selected.length > 0 && !ctx.running && !controls.frozen, multiDevice: multiDeviceNote(selected, projects),
    tagLine: payload.tags ? `Chỉ test mang ${payload.tags.join(' | ')}` : '',
    command: commandPreview(payload, catalog, true),
  };
  const options = [...new Set(selected.flatMap((f) => f.projects))].sort();
  const activeLabel = [...state.platforms, ...state.tags].join(' · ');
  return { found, visibleByGroup, selected, payload, info, options, activeFilters, activeLabel, filtered: hasFilter(state) };
}
