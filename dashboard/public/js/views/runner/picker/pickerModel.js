/**
 * dashboard/public/js/views/runner/picker/pickerModel.js
 * Builds the picker catalog from GET /api/config (specs, specTags, specProjects, availableTags).
 * Tests of the tool itself (tests/dashboard/) are dropped: this runner cannot run them (CONTRACT D4).
 */
export const INTERNAL_PREFIX = 'tests/dashboard/';
const CODE_TAG = /^@(REQ|AC)-/i;

export function platformOf(path) {
  const p = `/${path}`.toLowerCase();
  if (p.includes('/native/')) return 'Native';
  if (p.includes('/mobile')) return 'Mobile web';
  if (p.includes('/api/')) return 'API';
  if (p.includes('/desktop/')) return 'Desktop';
  return 'Khác';
}

const dirOf = (path) => path.slice(0, path.lastIndexOf('/'));
const labelOf = (dir) => dir.replace(/^tests\//, '').split('/').join(' / ');

export function buildCatalog(config = {}) {
  const specTags = config.specTags || {};
  const specProjects = config.specProjects || {};
  const files = (config.specs || []).filter((p) => !p.startsWith(INTERNAL_PREFIX)).map((path) => ({
    path, name: path.split('/').pop(), dir: dirOf(path), tags: specTags[path] || [], projects: specProjects[path] || [], platform: platformOf(path),
  }));
  const byDir = new Map();
  files.forEach((f) => { if (!byDir.has(f.dir)) byDir.set(f.dir, []); byDir.get(f.dir).push(f); });
  const groups = [...byDir.keys()].sort().map((dir) => ({ key: dir, label: labelOf(dir), files: byDir.get(dir).sort((a, b) => a.name.localeCompare(b.name)) }));

  const tagCount = new Map();
  files.forEach((f) => f.tags.forEach((t) => { if (!CODE_TAG.test(t)) tagCount.set(t, (tagCount.get(t) || 0) + 1); }));
  const tags = [...tagCount].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  const platformCount = new Map();
  files.forEach((f) => platformCount.set(f.platform, (platformCount.get(f.platform) || 0) + 1));
  const platforms = [...platformCount].map(([label, count]) => ({ label, count }));
  return { files, groups, tags, platforms, byPath: new Map(files.map((f) => [f.path, f])), projects: config.projects || [], source: config.specProjectsSource || 'none' };
}
