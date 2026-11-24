/**
 * dashboard/public/js/views/runner/picker/pickerContrast.js
 * `--on-accent` (text on the accent colour) must follow the REAL accent: Settings > branding overrides
 * `--accent` inline, so a fixed token cannot be right in every theme/brand (white on the dark-theme purple is
 * 2.72:1, dark text on the default blue is 3.2:1). Picks white or the dark ink, whichever contrasts more.
 * Colours are not parsed by hand beyond hex/rgb: anything else (names, hsl(), space syntax) is resolved by
 * the browser through a probe element and read back as rgb().
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
  if (!rgb) return null;
  const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map((n) => (n.endsWith('%') ? (parseFloat(n) / 100) * 255 : Number(n)));
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? parts : null;
}

export function luminance([r, g, b]) {
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

/** `resolve(value)` (optional) turns any CSS colour into an `rgb(...)` string, e.g. via the browser. */
export function onAccentFor(accent, resolve) {
  const rgb = parseColor(accent) || (resolve ? parseColor(resolve(accent)) : null);
  if (!rgb) return WHITE;
  return ratio(rgb, parseColor(WHITE)) >= ratio(rgb, parseColor(INK)) ? WHITE : INK;
}

/** Browser-backed resolver: assigns the value to a hidden probe's `color` and reads the computed rgb(). */
function probeResolver(win) {
  const probe = win.document.createElement('span');
  probe.hidden = true;
  win.document.body.appendChild(probe);
  const resolve = (value) => { probe.style.color = ''; probe.style.color = value; return probe.style.color ? win.getComputedStyle(probe).color : ''; };
  return { resolve, dispose: () => probe.remove() };
}

/** Keep `--on-accent` of `el` in step with the live `--accent`; returns the stop function. */
export function followAccent(win, el) {
  const { resolve, dispose } = probeResolver(win);
  const apply = () => el.style.setProperty('--on-accent', onAccentFor(win.getComputedStyle(win.document.documentElement).getPropertyValue('--accent'), resolve));
  apply();
  const observer = new win.MutationObserver(apply);
  observer.observe(win.document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme', 'class'] });
  return () => { observer.disconnect(); dispose(); };
}
