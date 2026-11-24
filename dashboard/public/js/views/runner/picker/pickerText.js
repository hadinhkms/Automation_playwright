/**
 * dashboard/public/js/views/runner/picker/pickerText.js
 * Pure text helpers of the Script Picker: accent-insensitive folding, HTML escaping, match highlighting.
 */

/** Lowercase, strip combining marks, "đ" -> "d": "Đăng nhập" matches "dang-nhap". */
export function fold(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Search box -> keywords (AND). A leading "@" is optional on tags, so it is dropped here. */
export function keywords(query) {
  return fold(query).split(/\s+/).map((k) => k.replace(/^@/, '')).filter(Boolean);
}

/** Escape `text`, wrapping the parts that contain any keyword in <mark> (works on the folded text, same length). */
export function highlight(text, kws) {
  const raw = String(text ?? '');
  if (!kws.length) return escapeHtml(raw);
  const folded = fold(raw);
  if (folded.length !== raw.length) return escapeHtml(raw); // decomposition changed length: skip marks, stay correct
  const mark = new Array(raw.length).fill(false);
  kws.forEach((k) => { for (let i = folded.indexOf(k); i >= 0; i = folded.indexOf(k, i + 1)) for (let j = i; j < i + k.length; j += 1) mark[j] = true; });
  let out = ''; let open = false;
  for (let i = 0; i < raw.length; i += 1) {
    if (mark[i] && !open) { out += '<mark>'; open = true; } else if (!mark[i] && open) { out += '</mark>'; open = false; }
    out += escapeHtml(raw[i]);
  }
  return open ? `${out}</mark>` : out;
}
