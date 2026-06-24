const { test } = require('node:test');
const assert = require('node:assert');
const B = require('../backup.js');

const sample = {
  progress: { hsk1_1: { srsLevel: 4, dueTime: 0, starred: false, learned: true } },
  streak: 3,
  lastStudyDate: '2026-06-24',
  points: 120,
  readEssayIds: ['essay_1_1'],
  unlockedExtraIds: [],
  journey: { schemaVersion: 1, completedLessons: {}, passedCheckpoints: {}, badges: [] },
};

test('export bundle carries all keys and schemaVersion', () => {
  const b = B.buildExportBundle(sample, '2026-06-24T00:00:00Z');
  assert.strictEqual(b.schemaVersion, 1);
  assert.strictEqual(b.exportedAt, '2026-06-24T00:00:00Z');
  assert.strictEqual(b.points, 120);
  assert.deepStrictEqual(b.progress, sample.progress);
});

test('round-trip: export then validate yields equal data', () => {
  const b = B.buildExportBundle(sample, null);
  const json = JSON.parse(JSON.stringify(b));
  const res = B.validateImportBundle(json);
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.data.journey, sample.journey);
});

test('validate rejects wrong schema version', () => {
  const res = B.validateImportBundle({ schemaVersion: 99, progress: {}, journey: {} });
  assert.strictEqual(res.ok, false);
});

test('validate rejects non-object / missing fields', () => {
  assert.strictEqual(B.validateImportBundle(null).ok, false);
  assert.strictEqual(B.validateImportBundle({ schemaVersion: 1 }).ok, false);
});
