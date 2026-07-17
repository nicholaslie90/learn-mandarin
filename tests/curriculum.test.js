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

test('every lesson is unlocked from the start, at every level', () => {
  const cur = C.buildCurriculum(fakeData());
  const fresh = { completedLessons: {}, passedCheckpoints: {} };
  // Later lessons within a unit are open without completing earlier ones.
  assert.strictEqual(C.isLessonUnlocked(cur, 'L1-u0-l1', fresh), true);
  assert.strictEqual(C.isLessonUnlocked(cur, 'L1-u0-l2', fresh), true);
  // Higher levels are open too.
  assert.strictEqual(C.isLessonUnlocked(cur, 'L2-u0-l0', fresh), true);
});

test('first lessons of later units are unlocked for a fresh journey', () => {
  const data = fakeData();
  const wt = {};
  data['1'].forEach((w, i) => { wt[w.id] = i < 5 ? 'food' : 'people'; });
  const tm = [
    { key: 'people', name: 'People', emoji: '👤' },
    { key: 'food', name: 'Food', emoji: '🍜' },
  ];
  const cur = C.buildCurriculum(data, undefined, wt, tm); // units u0 (people) and u1 (food)
  const fresh = { completedLessons: {}, passedCheckpoints: {} };
  assert.strictEqual(C.isLessonUnlocked(cur, 'L1-u1-l0', fresh), true);
  assert.strictEqual(C.isLessonUnlocked(cur, 'L1-u1-l1', fresh), true);
});

test('checkpoint unlocked only when all unit lessons complete', () => {
  const cur = C.buildCurriculum(fakeData()); // level 1 unit 0 has 3 lessons
  const partial = { completedLessons: { 'L1-u0-l0': {}, 'L1-u0-l1': {} }, passedCheckpoints: {} };
  assert.strictEqual(C.isCheckpointUnlocked(cur, 'CP1-u0', partial), false);
  const all = { completedLessons: { 'L1-u0-l0': {}, 'L1-u0-l1': {}, 'L1-u0-l2': {} }, passedCheckpoints: {} };
  assert.strictEqual(C.isCheckpointUnlocked(cur, 'CP1-u0', all), true);
});

test('any level first lesson is open (learners can jump to any HSK level)', () => {
  const cur = C.buildCurriculum(fakeData());
  const fresh = { completedLessons: {}, passedCheckpoints: {} };
  // No prior-level completion required to start level 1 OR a higher level.
  assert.strictEqual(C.isLessonUnlocked(cur, 'L1-u0-l0', fresh), true);
  assert.strictEqual(C.isLessonUnlocked(cur, 'L2-u0-l0', fresh), true);
});

test('themed curriculum makes one unit per theme in meta order', () => {
  const data = fakeData(); // level 1: hsk1_1..hsk1_30
  const wt = {};
  data['1'].forEach((w, i) => { wt[w.id] = i < 5 ? 'food' : 'people'; });
  const tm = [
    { key: 'people', name: 'People', emoji: '👤' },
    { key: 'food', name: 'Food', emoji: '🍜' },
  ];
  const cur = C.buildCurriculum(data, undefined, wt, tm);
  const lvl1 = cur.levels.find(l => l.level === 1);
  assert.strictEqual(lvl1.units.length, 2); // both themes present
  assert.strictEqual(lvl1.units[0].title, 'People'); // meta order: people first
  assert.strictEqual(lvl1.units[0].themeKey, 'people');
  assert.strictEqual(lvl1.units[1].title, 'Food');
  // people has 25 words -> lessons of 12 => 12,12,1 = 3 lessons under unit 0
  assert.strictEqual(lvl1.units[0].lessons.length, 3);
  assert.strictEqual(lvl1.units[0].lessons[0].lessonId, 'L1-u0-l0');
  assert.strictEqual(lvl1.units[1].lessons[0].lessonId, 'L1-u1-l0');
  assert.strictEqual(lvl1.units[1].checkpointId, 'CP1-u1');
});

test('themed curriculum skips empty themes without gaps in unit index', () => {
  const data = fakeData();
  const wt = {};
  data['1'].forEach((w) => { wt[w.id] = 'food'; }); // all food, people empty
  const tm = [
    { key: 'people', name: 'People', emoji: '👤' },
    { key: 'food', name: 'Food', emoji: '🍜' },
  ];
  const cur = C.buildCurriculum(data, undefined, wt, tm);
  const lvl1 = cur.levels.find(l => l.level === 1);
  assert.strictEqual(lvl1.units.length, 1);
  assert.strictEqual(lvl1.units[0].unitIndex, 0);
  assert.strictEqual(lvl1.units[0].themeKey, 'food');
});
