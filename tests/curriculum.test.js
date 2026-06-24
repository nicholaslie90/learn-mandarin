const { test } = require('node:test');
const assert = require('node:assert');
const C = require('../curriculum.js');

// Build a fake dataset: level 1 has 30 words, level 2 has 8 words.
function fakeData() {
  const mk = (lvl, n) => Array.from({ length: n }, (_, i) => ({ id: `hsk${lvl}_${i + 1}`, character: '字' }));
  return { '1': mk(1, 30), '2': mk(2, 8) };
}

test('buildCurriculum chunks words into 12-word lessons', () => {
  const cur = C.buildCurriculum(fakeData());
  const lvl1 = cur.levels.find(l => l.level === 1);
  const lessons = lvl1.units.flatMap(u => u.lessons);
  // 30 words / 12 => lessons of 12, 12, 6
  assert.strictEqual(lessons.length, 3);
  assert.deepStrictEqual(lessons.map(l => l.wordCount), [12, 12, 6]);
});

test('lessons are grouped into units of 4 with a checkpoint id', () => {
  const cur = C.buildCurriculum(fakeData());
  const lvl1 = cur.levels.find(l => l.level === 1);
  assert.strictEqual(lvl1.units.length, 1); // 3 lessons -> 1 unit
  assert.strictEqual(lvl1.units[0].checkpointId, 'CP1-u0');
  assert.strictEqual(lvl1.levelTestId, 'LT1');
});

test('lesson ids follow L{level}-u{unit}-l{idx}', () => {
  const cur = C.buildCurriculum(fakeData());
  assert.strictEqual(cur.levels[0].units[0].lessons[0].lessonId, 'L1-u0-l0');
});

test('only guided levels 1-6 are built', () => {
  const data = { '1': [{ id: 'a' }], '7': [{ id: 'b' }] };
  const cur = C.buildCurriculum(data);
  assert.deepStrictEqual(cur.levels.map(l => l.level), [1]);
});

test('getLessonWords returns the word objects for a lesson', () => {
  const data = fakeData();
  const words = C.getLessonWords(data, 'L1-u0-l0');
  assert.strictEqual(words.length, 12);
  assert.strictEqual(words[0].id, 'hsk1_1');
});

test('parseLessonId extracts numbers', () => {
  assert.deepStrictEqual(C.parseLessonId('L2-u1-l3'), { level: 2, unitIndex: 1, lessonIndex: 3 });
});

test('determinism: same input yields identical structure', () => {
  const a = JSON.stringify(C.buildCurriculum(fakeData()));
  const b = JSON.stringify(C.buildCurriculum(fakeData()));
  assert.strictEqual(a, b);
});

test('first lesson of level 1 is always unlocked', () => {
  const cur = C.buildCurriculum(fakeData());
  const j = { completedLessons: {}, passedCheckpoints: {} };
  assert.strictEqual(C.isLessonUnlocked(cur, 'L1-u0-l0', j), true);
});

test('second lesson locked until first completed', () => {
  const cur = C.buildCurriculum(fakeData());
  const locked = { completedLessons: {}, passedCheckpoints: {} };
  assert.strictEqual(C.isLessonUnlocked(cur, 'L1-u0-l1', locked), false);
  const unlocked = { completedLessons: { 'L1-u0-l0': { stars: 1 } }, passedCheckpoints: {} };
  assert.strictEqual(C.isLessonUnlocked(cur, 'L1-u0-l1', unlocked), true);
});

test('checkpoint unlocked only when all unit lessons complete', () => {
  const cur = C.buildCurriculum(fakeData()); // level 1 unit 0 has 3 lessons
  const partial = { completedLessons: { 'L1-u0-l0': {}, 'L1-u0-l1': {} }, passedCheckpoints: {} };
  assert.strictEqual(C.isCheckpointUnlocked(cur, 'CP1-u0', partial), false);
  const all = { completedLessons: { 'L1-u0-l0': {}, 'L1-u0-l1': {}, 'L1-u0-l2': {} }, passedCheckpoints: {} };
  assert.strictEqual(C.isCheckpointUnlocked(cur, 'CP1-u0', all), true);
});

test('level 2 first lesson locked until level 1 test passed', () => {
  const cur = C.buildCurriculum(fakeData());
  const noLT = { completedLessons: {}, passedCheckpoints: {} };
  assert.strictEqual(C.isLessonUnlocked(cur, 'L2-u0-l0', noLT), false);
  const withLT = { completedLessons: {}, passedCheckpoints: { 'LT1': { score: 1 } } };
  assert.strictEqual(C.isLessonUnlocked(cur, 'L2-u0-l0', withLT), true);
});
