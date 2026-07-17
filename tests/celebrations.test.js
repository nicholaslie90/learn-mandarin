const test = require('node:test');
const assert = require('node:assert');

const Celebrations = require('../celebrations.js');
const JourneyUI = require('../journey-ui.js');

test('celebrations module exposes the API app.js wires up', () => {
  ['init', 'hanziConfetti', 'toast', 'countUp', 'floatChip', 'sealCeremony', 'badgeShine'].forEach((fn) => {
    assert.strictEqual(typeof Celebrations[fn], 'function', fn);
  });
});

test('celebrations module loads without a DOM (no window/document access at require time)', () => {
  assert.strictEqual(Celebrations.__name, 'Celebrations');
});

test('badgeLabel is exported for celebration toasts', () => {
  assert.strictEqual(JourneyUI.badgeLabel('streak-7'), '🔥 7-Day Streak');
  assert.strictEqual(JourneyUI.badgeLabel('unit-complete:CP1-u0'), '🏅 CP1-u0');
});
