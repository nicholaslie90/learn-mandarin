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

test('checkpoint pass awards xp once and keeps best score', () => {
  const j = J.createEmptyJourney();
  const r1 = J.applyCheckpointPass(j, 'CP1-u0', 0.9, 100);
  assert.strictEqual(r1.xpGained, 50);
  assert.strictEqual(r1.journey.passedCheckpoints['CP1-u0'].score, 0.9);
  const r2 = J.applyCheckpointPass(r1.journey, 'CP1-u0', 0.7, 200);
  assert.strictEqual(r2.xpGained, 0);
  assert.strictEqual(r2.journey.passedCheckpoints['CP1-u0'].score, 0.9); // best kept
});

test('daily goal grants bonus once per day', () => {
  const j = J.createEmptyJourney();
  const a = J.applyDailyGoal(j, '2026-06-24');
  assert.strictEqual(a.bonusXp, 15);
  const b = J.applyDailyGoal(a.journey, '2026-06-24');
  assert.strictEqual(b.bonusXp, 0);
  const c = J.applyDailyGoal(b.journey, '2026-06-25');
  assert.strictEqual(c.bonusXp, 15);
});

test('badges: streak-7 and perfect-checkpoint awarded, idempotent', () => {
  let j = J.createEmptyJourney();
  j = J.applyCheckpointPass(j, 'CP1-u0', 1, 1).journey; // perfect
  const first = J.evaluateBadges(j, { journey: j, streak: 7, masteredCount: 0 });
  assert.ok(first.includes('streak-7'));
  assert.ok(first.includes('perfect-checkpoint'));
  assert.ok(first.includes('unit-complete:CP1-u0'));
  const second = J.evaluateBadges(j, { journey: j, streak: 7, masteredCount: 0 });
  assert.deepStrictEqual(second, []); // nothing new
});
