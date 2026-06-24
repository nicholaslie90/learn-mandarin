const { test } = require('node:test');
const assert = require('node:assert');
const J = require('../journey-state.js');

test('empty journey has expected shape', () => {
  const j = J.createEmptyJourney();
  assert.strictEqual(j.schemaVersion, 1);
  assert.deepStrictEqual(j.completedLessons, {});
  assert.strictEqual(j.rank, '学徒');
});

test('stars map by accuracy', () => {
  assert.strictEqual(J.starsForAccuracy(1), 3);
  assert.strictEqual(J.starsForAccuracy(0.8), 2);
  assert.strictEqual(J.starsForAccuracy(0.5), 1);
});

test('rank derived from xp thresholds', () => {
  assert.strictEqual(J.getRank(0), '学徒');
  assert.strictEqual(J.getRank(250), '学生');
  assert.strictEqual(J.getRank(2500), '大师');
});

test('completing a lesson records best stars and awards xp', () => {
  const j = J.createEmptyJourney();
  const r1 = J.applyLessonCompletion(j, 'L1-u0-l0', 1, 1000);
  assert.strictEqual(r1.journey.completedLessons['L1-u0-l0'].stars, 3);
  assert.strictEqual(r1.xpGained, 30);
  // Re-complete with lower accuracy: keep best stars, no new xp
  const r2 = J.applyLessonCompletion(r1.journey, 'L1-u0-l0', 0.5, 2000);
  assert.strictEqual(r2.journey.completedLessons['L1-u0-l0'].stars, 3);
  assert.strictEqual(r2.xpGained, 0);
});
