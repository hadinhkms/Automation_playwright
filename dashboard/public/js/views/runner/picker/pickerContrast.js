/**
 * dashboard/public/js/views/runner/picker/pickerContrast.js
 * `--on-accent` (text on the accent colour) must follow the REAL accent: Settings > branding overrides
 * `--accent` inline, so a fixed token cannot be right in every theme/brand (white on the dark-theme purple is
 * 2.72:1, dark text on the default blue is 3.2:1). Picks white or the dark ink, whichever contrasts more.
 */
const INK = '#1A0B3B';
const WHITE = '#FFFFFF';

export function parseColor(value) {
  const v = String(value || '').trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(v);
  return rgb ? rgb[1].split(',').slice(0, 3).map((n) => Number(n)) : null;
}

export function luminance([r, g, b]) {
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

export function onAccentFor(accent) {
  const rgb = parseColor(accent);
  if (!rgb) return WHITE;
  return ratio(rgb, parseColor(WHITE)) >= ratio(rgb, parseColor(INK)) ? WHITE : INK;
}

/** Keep `--on-accent` of `el` in step with the live `--accent`; returns the stop function. */
export function followAccent(win, el) {
  const apply = () => el.style.setProperty('--on-accent', onAccentFor(win.getComputedStyle(win.document.documentElement).getPropertyValue('--accent')));
  apply();
  const observer = new win.MutationObserver(apply);
  observer.observe(win.document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme', 'class'] });
  return () => observer.disconnect();
}
