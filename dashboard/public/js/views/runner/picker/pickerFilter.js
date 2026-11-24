/**
 * dashboard/public/js/views/runner/picker/pickerFilter.js
 * Search + chip filters. Semantics (HANDOFF 4.1): keywords AND; chips of one group OR; groups AND each other.
 */
import { fold, keywords } from './pickerText.js';

function matchesKeyword(file, kw) {
  if (fold(file.path).includes(kw)) return true;
  return file.tags.some((t) => fold(t).replace(/^@/, '').includes(kw));
}

export function filterFiles(files, { query = '', platforms = new Set(), tags = new Set() } = {}) {
  const kws = keywords(query);
  return files.filter((f) => (
    kws.every((k) => matchesKeyword(f, k))
    && (platforms.size === 0 || platforms.has(f.platform))
    && (tags.size === 0 || f.tags.some((t) => tags.has(t)))
  ));
}

export const hasFilter = (s) => Boolean(keywords(s.query).length || s.platforms.size || s.tags.size);
