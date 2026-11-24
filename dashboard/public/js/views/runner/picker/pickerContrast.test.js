/**
 * Unit tests of the on-accent colour choice (ESM module loaded through dynamic import).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

test('onAccentFor picks the text colour with the higher contrast (>= 4.5:1 for the real accents)', async () => {
  const { onAccentFor, ratio, parseColor } = await import('./pickerContrast.js');
  assert.equal(onAccentFor('#0A65CC'), '#FFFFFF'); // default brand blue
  assert.equal(onAccentFor(' #A78BFA'), '#1A0B3B'); // dark-theme purple token: white would be 2.72:1
  assert.equal(onAccentFor('rgb(91, 33, 182)'), '#FFFFFF'); // light-theme purple
  assert.equal(onAccentFor('not a colour'), '#FFFFFF');
  for (const accent of ['#0A65CC', '#A78BFA', '#5B21B6', '#22c55e']) assert.ok(ratio(parseColor(accent), parseColor(onAccentFor(accent))) >= 4.5, accent);
});
