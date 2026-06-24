# Guided Learning Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gamified, sequential, self-paced "Learn" journey (HSK 1–6) with lessons, unit checkpoint exams, XP/rank/badges/daily-goal, and JSON export/import — layered over the existing vanilla-JS engine without removing any current feature.

**Architecture:** Three new isolated modules — `curriculum.js` (pure curriculum + gating), `journey-state.js` (pure state transitions + gamification), `backup.js` (export/import) — plus a DOM module `journey-ui.js` and minimal edits to `app.js` / `index.html`. Pure logic is unit-tested with Node's built-in `node --test`; DOM/integration is verified manually in the browser.

**Tech Stack:** Vanilla ES6+ JavaScript, HTML5, CSS3. IndexedDB via the existing `ProgressDB`. No build step, no runtime dependencies. Tests use the Node built-in test runner (`node:test` + `node:assert`), no new packages.

## Global Constraints

- **Static & dependency-free:** runs as plain `<script>` includes on GitHub Pages. No bundler, no npm runtime deps. New modules MUST work both as browser globals AND as Node `require()` targets (UMD-style wrapper below).
- **No new npm dependencies.** Tests use only `node:test` and `node:assert` (built into Node 18+).
- **Persistence:** reuse the existing `ProgressDB` instance `db` (`db.init()`, `db.get(key)`, `db.set(key, value)`) and the IndexedDB→localStorage fallback already in `saveProgressToDB()`.
- **Guided journey covers HSK levels 1–6 only.** Levels 7–9 stay in Free Practice and are never passed to `buildCurriculum`.
- **Tunable parameters (exact values):** `wordsPerLesson = 12`, `lessonsPerUnit = 4`, `passThreshold = 0.8`, lesson mini-quiz length `= min(8, lessonWordCount)`, stars `3 = 100% / 2 = ≥80% / 1 = passed`.
- **XP is the existing `state.points` value** — do NOT introduce a separate XP counter. Rank is derived from `state.points`.
- **ID formats (exact):** lesson `L{level}-u{unit}-l{idx}`, checkpoint `CP{level}-u{unit}`, level test `LT{level}` (all indexes 0-based except `level` which is 1-based).
- **Export schema:** `schemaVersion = 1`.

### UMD wrapper (use verbatim for every new pure module)

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // ... module body: define functions ...
  return { __name: 'Curriculum', /* exported functions */ };
});
```

In the browser this attaches `window.Curriculum` (etc.); in Node `require('../curriculum.js')` returns the same object.

---

### Task 1: Curriculum generation (`curriculum.js`)

**Files:**
- Create: `curriculum.js`
- Create: `tests/curriculum.test.js`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Consumes: nothing (pure). Takes `hskData` (the shape of global `HSK_DATA`: `{ "1": [{id, character, ...}], ... }`) as an argument.
- Produces:
  - `CURRICULUM_CONFIG = { wordsPerLesson: 12, lessonsPerUnit: 4, passThreshold: 0.8, guidedLevels: [1,2,3,4,5,6] }`
  - `buildCurriculum(hskData, config = CURRICULUM_CONFIG)` → `{ levels: [ { level: 1, units: [ { unitId: "CP1-u0"→no; unitIndex: 0, checkpointId: "CP1-u0", lessons: [ { lessonId: "L1-u0-l0", lessonIndex, unitIndex, level, wordIds: ["hsk1_1", ...], wordCount } ] } ], levelTestId: "LT1" } ] }`
  - `getLessonWords(hskData, lessonId)` → array of word objects.
  - `getUnitWords(hskData, curriculum, unitId)` → array of word objects (unitId === checkpointId).
  - `parseLessonId(id)` → `{ level, unitIndex, lessonIndex }`.

- [ ] **Step 1: Add the test script to `package.json`**

In `package.json`, change the `scripts` block to:

```json
  "scripts": {
    "dev": "node scripts/dev-server.js",
    "validate": "node validate.js",
    "test": "node --test"
  },
```

- [ ] **Step 2: Write the failing test** — `tests/curriculum.test.js`

```js
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../curriculum.js'`.

- [ ] **Step 4: Implement `curriculum.js`**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const CURRICULUM_CONFIG = {
    wordsPerLesson: 12,
    lessonsPerUnit: 4,
    passThreshold: 0.8,
    guidedLevels: [1, 2, 3, 4, 5, 6],
  };

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function buildCurriculum(hskData, config) {
    const cfg = config || CURRICULUM_CONFIG;
    const levels = [];
    cfg.guidedLevels.forEach(function (level) {
      const words = (hskData[String(level)] || []);
      if (words.length === 0) return;
      const lessonChunks = chunk(words, cfg.wordsPerLesson);
      const lessons = lessonChunks.map(function (wordsInLesson, idx) {
        const unitIndex = Math.floor(idx / cfg.lessonsPerUnit);
        const lessonIndex = idx % cfg.lessonsPerUnit;
        return {
          lessonId: 'L' + level + '-u' + unitIndex + '-l' + lessonIndex,
          level: level,
          unitIndex: unitIndex,
          lessonIndex: lessonIndex,
          wordIds: wordsInLesson.map(function (w) { return w.id; }),
          wordCount: wordsInLesson.length,
        };
      });
      const unitsCount = Math.ceil(lessons.length / cfg.lessonsPerUnit);
      const units = [];
      for (let u = 0; u < unitsCount; u++) {
        units.push({
          unitIndex: u,
          checkpointId: 'CP' + level + '-u' + u,
          lessons: lessons.filter(function (l) { return l.unitIndex === u; }),
        });
      }
      levels.push({ level: level, units: units, levelTestId: 'LT' + level });
    });
    return { levels: levels };
  }

  function parseLessonId(id) {
    const m = /^L(\d+)-u(\d+)-l(\d+)$/.exec(id);
    if (!m) throw new Error('Bad lesson id: ' + id);
    return { level: +m[1], unitIndex: +m[2], lessonIndex: +m[3] };
  }

  function findLesson(hskData, lessonId) {
    const cur = buildCurriculum(hskData);
    for (const lvl of cur.levels) {
      for (const u of lvl.units) {
        for (const l of u.lessons) if (l.lessonId === lessonId) return l;
      }
    }
    return null;
  }

  function wordsById(hskData, ids) {
    const byId = {};
    Object.keys(hskData).forEach(function (lvl) {
      (hskData[lvl] || []).forEach(function (w) { byId[w.id] = w; });
    });
    return ids.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function getLessonWords(hskData, lessonId) {
    const lesson = findLesson(hskData, lessonId);
    return lesson ? wordsById(hskData, lesson.wordIds) : [];
  }

  function getUnitWords(hskData, curriculum, unitId) {
    for (const lvl of curriculum.levels) {
      for (const u of lvl.units) {
        if (u.checkpointId === unitId) {
          const ids = u.lessons.flatMap(function (l) { return l.wordIds; });
          return wordsById(hskData, ids);
        }
      }
    }
    return [];
  }

  return {
    __name: 'Curriculum',
    CURRICULUM_CONFIG: CURRICULUM_CONFIG,
    buildCurriculum: buildCurriculum,
    parseLessonId: parseLessonId,
    getLessonWords: getLessonWords,
    getUnitWords: getUnitWords,
  };
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 7 tests green.

- [ ] **Step 6: Commit**

```bash
git add curriculum.js tests/curriculum.test.js package.json
git commit -m "feat: deterministic HSK 1-6 curriculum generator with node:test harness"
```

---

### Task 2: Gating predicates (`curriculum.js`)

**Files:**
- Modify: `curriculum.js` (add gating functions to the returned api)
- Modify: `tests/curriculum.test.js` (append gating tests)

**Interfaces:**
- Consumes: `buildCurriculum` output; a `journey` object of shape `{ completedLessons: { [lessonId]: {...} }, passedCheckpoints: { [checkpointId]: {...} } }`.
- Produces:
  - `isLessonUnlocked(curriculum, lessonId, journey)` → boolean
  - `isCheckpointUnlocked(curriculum, checkpointId, journey)` → boolean
  - `isLevelTestUnlocked(curriculum, levelTestId, journey)` → boolean
  - `isUnitComplete(curriculum, checkpointId, journey)` → boolean (all lessons in unit completed)

**Gating rules:**
- Lesson `l0` of unit `u0` of level `L`: unlocked iff `L === 1` OR level `L-1`'s level test is passed.
- Lesson `l0` of unit `u>0`: unlocked iff checkpoint `CP{L}-u{u-1}` is passed.
- Lesson `lN` (N>0) within a unit: unlocked iff the previous lesson in the same unit is completed.
- Checkpoint: unlocked iff every lesson in its unit is completed.
- Level test `LT{L}`: unlocked iff every checkpoint in level `L` is passed.

- [ ] **Step 1: Append failing tests** to `tests/curriculum.test.js`

```js
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `C.isLessonUnlocked is not a function`.

- [ ] **Step 3: Implement** — add these functions inside the factory in `curriculum.js`, before `return`, and add them to the returned object.

```js
  function getLevel(curriculum, level) {
    return curriculum.levels.find(function (l) { return l.level === level; });
  }
  function getUnit(curriculum, level, unitIndex) {
    const lvl = getLevel(curriculum, level);
    return lvl ? lvl.units[unitIndex] : null;
  }

  function isCheckpointUnlocked(curriculum, checkpointId, journey) {
    const m = /^CP(\d+)-u(\d+)$/.exec(checkpointId);
    if (!m) return false;
    const unit = getUnit(curriculum, +m[1], +m[2]);
    if (!unit) return false;
    return unit.lessons.every(function (l) { return !!journey.completedLessons[l.lessonId]; });
  }

  function isLevelTestUnlocked(curriculum, levelTestId, journey) {
    const m = /^LT(\d+)$/.exec(levelTestId);
    if (!m) return false;
    const lvl = getLevel(curriculum, +m[1]);
    if (!lvl) return false;
    return lvl.units.every(function (u) { return !!journey.passedCheckpoints[u.checkpointId]; });
  }

  function isUnitComplete(curriculum, checkpointId, journey) {
    return isCheckpointUnlocked(curriculum, checkpointId, journey);
  }

  function isLessonUnlocked(curriculum, lessonId, journey) {
    const p = parseLessonId(lessonId);
    if (p.lessonIndex > 0) {
      const prev = 'L' + p.level + '-u' + p.unitIndex + '-l' + (p.lessonIndex - 1);
      return !!journey.completedLessons[prev];
    }
    // first lesson of a unit
    if (p.unitIndex > 0) {
      return !!journey.passedCheckpoints['CP' + p.level + '-u' + (p.unitIndex - 1)];
    }
    // first lesson of first unit of a level
    if (p.level === 1) return true;
    return !!journey.passedCheckpoints['LT' + (p.level - 1)];
  }
```

Add to the returned object: `isLessonUnlocked, isCheckpointUnlocked, isLevelTestUnlocked, isUnitComplete`.

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: PASS — all curriculum tests green.

- [ ] **Step 5: Commit**

```bash
git add curriculum.js tests/curriculum.test.js
git commit -m "feat: sequential gating predicates for lessons/checkpoints/level tests"
```

---

### Task 3: Journey state — completion, stars, XP, rank (`journey-state.js`)

**Files:**
- Create: `journey-state.js`
- Create: `tests/journey-state.test.js`

**Interfaces:**
- Consumes: nothing (pure transitions over plain objects).
- Produces:
  - `createEmptyJourney()` → `{ schemaVersion: 1, completedLessons: {}, passedCheckpoints: {}, badges: [], rank: '学徒', dailyGoalDate: null, dailyGoalDone: false }`
  - `RANK_THRESHOLDS = [{xp:0,name:'学徒'},{xp:200,name:'学生'},{xp:800,name:'高手'},{xp:2000,name:'大师'}]`
  - `getRank(xp)` → string
  - `starsForAccuracy(accuracy)` → 1|2|3 (accuracy is 0..1)
  - `xpForLesson(stars)` → number (3★→30, else 20)
  - `applyLessonCompletion(journey, lessonId, accuracy, nowTs)` → `{ journey, xpGained }` (keeps best stars; xp 0 if re-completing with equal/lower stars but still returns updated journey)

- [ ] **Step 1: Write the failing test** — `tests/journey-state.test.js`

```js
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '../journey-state.js'`.

- [ ] **Step 3: Implement `journey-state.js`** (UMD wrapper; this task adds the listed exports — Task 4 will extend the same `return` block)

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const RANK_THRESHOLDS = [
    { xp: 0, name: '学徒' },
    { xp: 200, name: '学生' },
    { xp: 800, name: '高手' },
    { xp: 2000, name: '大师' },
  ];

  function createEmptyJourney() {
    return {
      schemaVersion: 1,
      completedLessons: {},
      passedCheckpoints: {},
      badges: [],
      rank: RANK_THRESHOLDS[0].name,
      dailyGoalDate: null,
      dailyGoalDone: false,
    };
  }

  function getRank(xp) {
    let name = RANK_THRESHOLDS[0].name;
    for (const t of RANK_THRESHOLDS) if (xp >= t.xp) name = t.name;
    return name;
  }

  function starsForAccuracy(accuracy) {
    if (accuracy >= 1) return 3;
    if (accuracy >= 0.8) return 2;
    return 1;
  }

  function xpForLesson(stars) {
    return stars >= 3 ? 30 : 20;
  }

  function applyLessonCompletion(journey, lessonId, accuracy, nowTs) {
    const stars = starsForAccuracy(accuracy);
    const existing = journey.completedLessons[lessonId];
    const bestStars = existing ? Math.max(existing.stars, stars) : stars;
    const isNew = !existing;
    journey.completedLessons[lessonId] = { stars: bestStars, ts: nowTs };
    journey.rank = getRank.__currentXp != null ? journey.rank : journey.rank; // rank set by caller after xp
    const xpGained = isNew ? xpForLesson(stars) : 0;
    return { journey: journey, xpGained: xpGained };
  }

  return {
    __name: 'JourneyState',
    RANK_THRESHOLDS: RANK_THRESHOLDS,
    createEmptyJourney: createEmptyJourney,
    getRank: getRank,
    starsForAccuracy: starsForAccuracy,
    xpForLesson: xpForLesson,
    applyLessonCompletion: applyLessonCompletion,
  };
});
```

> Note: the `journey.rank` line above is a no-op placeholder kept intentionally minimal — rank display is recomputed from `state.points` by the caller via `getRank()`. Remove the no-op line if it reads awkwardly; it has no behavioral effect. (Simplest: replace its body with nothing.)

Replace that confusing line — the clean body of `applyLessonCompletion` is:

```js
  function applyLessonCompletion(journey, lessonId, accuracy, nowTs) {
    const stars = starsForAccuracy(accuracy);
    const existing = journey.completedLessons[lessonId];
    const bestStars = existing ? Math.max(existing.stars, stars) : stars;
    const isNew = !existing;
    journey.completedLessons[lessonId] = { stars: bestStars, ts: nowTs };
    return { journey: journey, xpGained: isNew ? xpForLesson(stars) : 0 };
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add journey-state.js tests/journey-state.test.js
git commit -m "feat: journey state — lesson completion, stars, xp, rank"
```

---

### Task 4: Journey state — checkpoints, daily goal, badges (`journey-state.js`)

**Files:**
- Modify: `journey-state.js`
- Modify: `tests/journey-state.test.js`

**Interfaces:**
- Produces (added to the same api object):
  - `applyCheckpointPass(journey, checkpointId, score, nowTs)` → `{ journey, xpGained }` (xp 50 on first pass; keeps best score; xp 0 if already passed)
  - `applyDailyGoal(journey, todayStr)` → `{ journey, bonusXp }` (bonusXp 15 the first lesson of a new day, else 0)
  - `BADGE_DEFS` — array of `{ id, test(ctx) }` where ctx = `{ journey, streak, masteredCount }`
  - `evaluateBadges(journey, ctx)` → array of newly-earned badge ids (also pushes them into `journey.badges`)

- [ ] **Step 1: Append failing tests** to `tests/journey-state.test.js`

```js
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `J.applyCheckpointPass is not a function`.

- [ ] **Step 3: Implement** — add inside the factory in `journey-state.js`, and extend the returned object.

```js
  function applyCheckpointPass(journey, checkpointId, score, nowTs) {
    const existing = journey.passedCheckpoints[checkpointId];
    const bestScore = existing ? Math.max(existing.score, score) : score;
    const isNew = !existing;
    journey.passedCheckpoints[checkpointId] = { score: bestScore, ts: nowTs };
    return { journey: journey, xpGained: isNew ? 50 : 0 };
  }

  function applyDailyGoal(journey, todayStr) {
    if (journey.dailyGoalDate === todayStr) {
      return { journey: journey, bonusXp: 0 };
    }
    journey.dailyGoalDate = todayStr;
    journey.dailyGoalDone = true;
    return { journey: journey, bonusXp: 15 };
  }

  const BADGE_DEFS = [
    { id: 'streak-7', test: function (ctx) { return ctx.streak >= 7; } },
    { id: 'words-100', test: function (ctx) { return ctx.masteredCount >= 100; } },
    {
      id: 'perfect-checkpoint',
      test: function (ctx) {
        return Object.values(ctx.journey.passedCheckpoints).some(function (c) { return c.score >= 1; });
      },
    },
  ];

  function evaluateBadges(journey, ctx) {
    const earned = [];
    // static badge defs
    BADGE_DEFS.forEach(function (def) {
      if (def.test(ctx) && journey.badges.indexOf(def.id) === -1) earned.push(def.id);
    });
    // dynamic: one badge per passed checkpoint (unit completed)
    Object.keys(journey.passedCheckpoints).forEach(function (cpId) {
      const id = 'unit-complete:' + cpId;
      if (journey.badges.indexOf(id) === -1) earned.push(id);
    });
    // dynamic: one badge per passed level test
    Object.keys(journey.passedCheckpoints).filter(function (k) { return /^LT\d+$/.test(k); }).forEach(function (ltId) {
      const id = 'level-complete:' + ltId;
      if (journey.badges.indexOf(id) === -1 && earned.indexOf(id) === -1) earned.push(id);
    });
    earned.forEach(function (id) { journey.badges.push(id); });
    return earned;
  }
```

Add to the returned object: `applyCheckpointPass, applyDailyGoal, BADGE_DEFS, evaluateBadges`.

> Note: level tests are stored in the same `passedCheckpoints` map (keys matching `LT{level}`); `unit-complete:` is emitted for `CP*` keys and `LT*` keys alike since the loop runs over all keys — `unit-complete:LT1` is harmless but if undesired, guard the first loop with `if (/^CP/.test(cpId))`. Use the guarded form:

```js
    Object.keys(journey.passedCheckpoints).filter(function (k) { return /^CP\d+-u\d+$/.test(k); }).forEach(function (cpId) {
      const id = 'unit-complete:' + cpId;
      if (journey.badges.indexOf(id) === -1) earned.push(id);
    });
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add journey-state.js tests/journey-state.test.js
git commit -m "feat: checkpoints, daily goal, and badge evaluation in journey state"
```

---

### Task 5: Export/import serialization (`backup.js` pure functions)

**Files:**
- Create: `backup.js`
- Create: `tests/backup.test.js`

**Interfaces:**
- Produces:
  - `buildExportBundle(allState)` → `{ schemaVersion: 1, exportedAt, progress, streak, lastStudyDate, points, readEssayIds, unlockedExtraIds, journey }` (copies through provided fields; `exportedAt` passed in or defaulted to `null`)
  - `validateImportBundle(obj)` → `{ ok: true, data }` | `{ ok: false, error }` (rejects non-objects, missing/!=1 `schemaVersion`, missing `journey`/`progress`)

- [ ] **Step 1: Write the failing test** — `tests/backup.test.js`

```js
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '../backup.js'`.

- [ ] **Step 3: Implement `backup.js`** (pure functions now; DOM glue added in Task 9)

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA_VERSION = 1;

  function buildExportBundle(s, exportedAt) {
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: exportedAt || null,
      progress: s.progress || {},
      streak: s.streak || 0,
      lastStudyDate: s.lastStudyDate || null,
      points: s.points || 0,
      readEssayIds: s.readEssayIds || [],
      unlockedExtraIds: s.unlockedExtraIds || [],
      journey: s.journey || null,
    };
  }

  function validateImportBundle(obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'Not a valid file.' };
    if (obj.schemaVersion !== SCHEMA_VERSION) {
      return { ok: false, error: 'Unsupported file version (' + obj.schemaVersion + ').' };
    }
    if (!obj.progress || typeof obj.progress !== 'object') return { ok: false, error: 'Missing progress data.' };
    if (!obj.journey || typeof obj.journey !== 'object') return { ok: false, error: 'Missing journey data.' };
    return { ok: true, data: obj };
  }

  return {
    __name: 'Backup',
    SCHEMA_VERSION: SCHEMA_VERSION,
    buildExportBundle: buildExportBundle,
    validateImportBundle: validateImportBundle,
  };
});
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backup.js tests/backup.test.js
git commit -m "feat: versioned export/import serialization with validation"
```

---

### Task 6: Parameterize flashcards and quiz engines (`app.js`)

**Goal:** Let lessons/checkpoints reuse the existing flashcard and quiz UIs by passing an explicit word list + a completion callback, WITHOUT breaking the existing Free-Practice tabs (which call them with no args).

**Files:**
- Modify: `app.js` — `initFlashcards()` (around line 1320), `startNewQuiz()` (around line 1524), `endQuizSession()` (around line 1770).

**Interfaces:**
- Produces:
  - `initFlashcards(explicitList)` — if `explicitList` is an array, use it verbatim (no skip-mastered filter, no shuffle); else existing behavior.
  - `startNewQuiz(quizWords, options)` — `quizWords` optional array to draw questions from (default `HSK_DATA[level]`); `options = { count, onComplete }`. `count` defaults to 10. `onComplete(scoreRatio)` is stored on `state.quizOnComplete`.
  - `endQuizSession()` — after existing SRS commit, if `state.quizOnComplete` is set, call it with `state.quizScore / state.quizQuestions.length`, then clear it.

**Verification:** This task has no Node test (DOM-bound). Verify manually that Free Practice still works (regression) and that programmatic calls work from the console.

- [ ] **Step 1: Edit `initFlashcards`** — change the signature and add the explicit-list branch at the top.

Replace the opening of `initFlashcards()`:

```js
function initFlashcards(explicitList) {
  if (Array.isArray(explicitList)) {
    activeFlashcardList = [...explicitList];
    state.flashcardIndex = 0;
    state.flashcardFlipped = false;
    renderFlashcard();
    return;
  }
  const allWords = HSK_DATA[state.currentLevel] || [];
  // ... (existing body unchanged from here) ...
```

- [ ] **Step 2: Edit `startNewQuiz`** — accept an explicit word pool, count, and completion callback.

Replace the opening of `startNewQuiz()`:

```js
function startNewQuiz(quizWords, options) {
  const opts = options || {};
  const words = Array.isArray(quizWords) ? quizWords : (HSK_DATA[state.currentLevel] || []);
  const count = opts.count || 10;
  state.quizOnComplete = typeof opts.onComplete === 'function' ? opts.onComplete : null;
  if (words.length < 4) {
    alert("Not enough HSK vocabulary loaded to run a practice quiz.");
    if (state.quizOnComplete) { state.quizOnComplete(0); state.quizOnComplete = null; }
    return;
  }

  const shuffled = [...words].sort(() => 0.5 - Math.random());
  state.quizQuestions = shuffled.slice(0, count).map(word => {
    const typeIndex = Math.floor(Math.random() * 4);
    let type = 'meaning';
    if (typeIndex === 1) type = 'pinyin';
    else if (typeIndex === 2) type = 'character';
    else if (typeIndex === 3) type = 'listening';
    return { word, type };
  });

  state.quizIndex = 0;
  state.quizScore = 0;
  state.quizAnswersHistory = [];
  state.quizSelectedOption = null;
  renderQuizQuestion();
}
```

> Note: `selectQuizOption` (line ~1690) looks up the target word via `HSK_DATA[state.currentLevel]`. Lesson/checkpoint words always belong to `state.currentLevel`, so this still resolves correctly. No change needed there.

- [ ] **Step 3: Edit `endQuizSession`** — invoke the completion callback after the SRS commit loop. Append, just before the closing brace of `endQuizSession()`:

```js
  // Notify guided-journey controller, if this quiz was launched by a lesson/checkpoint
  if (state.quizOnComplete) {
    const ratio = state.quizQuestions.length ? (state.quizScore / state.quizQuestions.length) : 0;
    const cb = state.quizOnComplete;
    state.quizOnComplete = null;
    cb(ratio);
  }
```

- [ ] **Step 4: Manual regression check**

Run: `npm run dev` and open `http://127.0.0.1:3000`.
- Click the **Flashcards** tab → cards still render and flip. (Confirms `initFlashcards()` no-arg path intact.)
- Click the **Practice** tab → a 10-question quiz runs and shows results. (Confirms `startNewQuiz()` no-arg path intact.)
- In DevTools console: `startNewQuiz(HSK_DATA['1'].slice(0,12), { count: 5, onComplete: r => console.log('done', r) })` → a 5-question quiz runs; on finish, console logs `done <ratio>`.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "refactor: parameterize flashcards/quiz with explicit word list + onComplete"
```

---

### Task 7: "Learn" tab scaffold, script includes, journey load/save (`index.html`, `app.js`)

**Goal:** Add the Learn section + nav, regroup existing tabs as "Free Practice", include the new scripts, add a header rank/XP element and Export/Import buttons, and load/save the `journey` object alongside existing progress. The path renders empty for now (filled in Task 8).

**Files:**
- Modify: `index.html` — nav (around line 103–151), header (around 73–98), `<script>` includes (near `app.js` include / line ~804+).
- Modify: `app.js` — `state` object (add `journey`), `saveProgressToDB()` (line ~390), `loadProgressFromDB()` (line ~422), `switchTab()` (line ~1158), the `DOMContentLoaded` init (line ~3106), and add `saveJourney()`.

**Interfaces:**
- Consumes: `Curriculum`, `JourneyState` globals.
- Produces: `state.journey` (a `JourneyState` object), `state.curriculum` (built once), `saveJourney()`, `switchTab('learn')` path, default tab `'learn'`, `renderLearnSection()` stub (real render in Task 8).

- [ ] **Step 1: Add the Learn nav button + section to `index.html`**

In the tab-button row, add as the FIRST tab button (so it's leftmost/default):

```html
<button class="tab-btn active" data-tab="learn" onclick="switchTab('learn')">
  <span>📚 Learn</span>
</button>
```

Remove the `active` class from the previously-default Dashboard tab button. Add a small text divider/label before the remaining tabs to group them visually:

```html
<span class="tab-group-label">Free Practice</span>
```

Add the Learn section as the FIRST `.screen-section`, marked active (and remove `active` from the Dashboard section):

```html
<section id="learnSection" class="screen-section active">
  <div class="learn-header">
    <h2 id="learnLevelTitle">HSK 1 Journey</h2>
    <div id="learnRankBadge" class="rank-badge"></div>
  </div>
  <div id="learnPath" class="learn-path"><!-- nodes rendered by JS --></div>
</section>
```

- [ ] **Step 2: Add header rank/XP element and Export/Import buttons to `index.html`**

Inside the header stats area (near `headerPointsVal`, ~line 73–98), add:

```html
<div class="stat-pill"><span class="stat-label">Rank</span><span id="headerRankVal">学徒</span></div>
```

Add a small settings cluster (place near the theme toggle, ~line 66):

```html
<button id="exportBtn" class="icon-btn" title="Export progress">⬇️</button>
<button id="importBtn" class="icon-btn" title="Import progress">⬆️</button>
<input id="importFileInput" type="file" accept="application/json" style="display:none" />
```

- [ ] **Step 3: Include the new scripts in `index.html`** — BEFORE the `app.js` include and AFTER `data.js`:

```html
<script src="curriculum.js"></script>
<script src="journey-state.js"></script>
<script src="backup.js"></script>
<script src="journey-ui.js"></script>
<!-- existing: <script src="app.js"></script> -->
```

> `journey-ui.js` is created in Task 8; add a placeholder empty file now so the include 404s don't occur: `echo "" > journey-ui.js` (committed in Task 8). For this task, you may add the include and create an empty `journey-ui.js`.

- [ ] **Step 4: Add `journey`/`curriculum` to `state` and a `saveJourney()` in `app.js`**

In the `state` object literal (around line 277), add:

```js
  journey: null,        // JourneyState object, hydrated on load
  curriculum: null,     // built once from HSK_DATA
  quizOnComplete: null, // set by guided-journey quiz launches
```

Add near `saveProgressToDB` (after it, ~line 411):

```js
async function saveJourney() {
  try {
    if (!db.db) await db.init();
    await db.set('journey', state.journey);
  } catch (e) {
    localStorage.setItem('hsk_sensei_journey', JSON.stringify(state.journey));
  }
}
```

- [ ] **Step 5: Persist `journey` in `saveProgressToDB`** — add inside the `try` of `saveProgressToDB` (after the `points` line, ~line 393):

```js
    await db.set('journey', state.journey);
```

And in its `catch` fallback block (after the points line, ~line 408):

```js
    localStorage.setItem('hsk_sensei_journey', JSON.stringify(state.journey));
```

- [ ] **Step 6: Hydrate `journey` + build curriculum in `loadProgressFromDB`** — inside the `try`, after the existing `await db.get(...)` calls (~line 427), add:

```js
    const journey = await db.get('journey');
```

After the block that assigns the other state (before the function's catch, after `readEssayIds` handling), add:

```js
    if (journey && journey.schemaVersion) {
      state.journey = journey;
    } else {
      const localJourney = localStorage.getItem('hsk_sensei_journey');
      state.journey = localJourney ? JSON.parse(localJourney) : JourneyState.createEmptyJourney();
    }
    state.curriculum = Curriculum.buildCurriculum(HSK_DATA);
```

In the `catch` of `loadProgressFromDB`, ensure a journey exists too:

```js
    if (!state.journey) state.journey = JourneyState.createEmptyJourney();
    if (!state.curriculum) state.curriculum = Curriculum.buildCurriculum(HSK_DATA);
```

- [ ] **Step 7: Wire the Learn tab in `switchTab` and default to it** — in `switchTab`'s setup chain (~line 1158), add as the FIRST branch:

```js
  if (tabId === 'learn') {
    renderLearnSection();
  } else if (tabId === 'dashboard') {
```

(Convert the existing `if (tabId === 'dashboard')` to `} else if`.)

Add a stub renderer (real implementation in Task 8) near the dashboard renderers (~line 1230):

```js
function renderLearnSection() {
  const title = document.getElementById('learnLevelTitle');
  if (title) title.textContent = `HSK ${state.currentLevel} Journey`;
  const rank = document.getElementById('headerRankVal');
  if (rank) rank.textContent = JourneyState.getRank(state.points);
  if (typeof JourneyUI !== 'undefined' && JourneyUI.renderLearnPath) {
    JourneyUI.renderLearnPath(document.getElementById('learnPath'), state);
  }
}
```

- [ ] **Step 8: Change the default view** — in the `DOMContentLoaded` init (~line 3128), change `switchTab('dashboard')` to `switchTab('learn')`.

- [ ] **Step 9: Manual verification**

Run: `npm run dev`, open the app.
- App loads on the **Learn** tab; header shows a Rank pill (`学徒`); title reads "HSK 1 Journey"; the path area is empty (expected).
- Switch to **Dashboard / Flashcards / Practice** — all still work.
- In console: `state.curriculum.levels.length` → `6`; `state.journey.schemaVersion` → `1`.
- Reload: no console errors; journey persists (`await db.get('journey')` resolves to an object).

- [ ] **Step 10: Commit**

```bash
git add index.html app.js journey-ui.js
git commit -m "feat: Learn tab scaffold, script includes, journey load/save wiring"
```

---

### Task 8: Visual path + lesson/checkpoint controllers (`journey-ui.js`, `app.js`, `styles.css`)

**Goal:** Render the sequential node path (lessons + checkpoint per unit, for the current level) with locked/unlocked/completed+stars states, and wire clicking a node to run the lesson (flashcards → mini-quiz) or checkpoint (combined quiz + 1 reading question) flow, recording results via `JourneyState`.

**Files:**
- Create/replace: `journey-ui.js`
- Modify: `app.js` — add `startLesson(lessonId)`, `startCheckpoint(checkpointId)`, `finishLesson(lessonId, ratio)`, `finishCheckpoint(checkpointId, ratio)`.
- Modify: `styles.css` — add `.learn-path`, `.path-node`, node state classes.

**Interfaces:**
- Consumes: `Curriculum`, `JourneyState`, parameterized `initFlashcards`/`startNewQuiz` (Task 6), `state`, `switchTab`, `saveProgressToDB`, `saveJourney`, `renderLearnSection`.
- Produces: `JourneyUI.renderLearnPath(container, state)`; global `startLesson`, `startCheckpoint`.

- [ ] **Step 1: Implement `journey-ui.js`**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof self !== 'undefined' ? self : this, function () {
  function nodeState(curriculum, journey, id, kind) {
    const C = root.Curriculum || require('./curriculum.js');
    if (kind === 'lesson') {
      if (journey.completedLessons[id]) return 'done';
      return C.isLessonUnlocked(curriculum, id, journey) ? 'open' : 'locked';
    }
    // checkpoint
    if (journey.passedCheckpoints[id]) return 'done';
    return C.isCheckpointUnlocked(curriculum, id, journey) ? 'open' : 'locked';
  }

  function starHtml(stars) {
    return '★★★'.slice(0, stars).padEnd(3, '☆');
  }

  function renderLearnPath(container, state) {
    if (!container) return;
    const C = root.Curriculum;
    const cur = state.curriculum;
    const level = state.currentLevel;
    const lvl = cur.levels.find(function (l) { return l.level === level; });
    if (!lvl) {
      container.innerHTML = '<p class="path-empty">HSK ' + level +
        ' is available in Free Practice (no guided journey).</p>';
      return;
    }
    let html = '';
    lvl.units.forEach(function (unit) {
      html += '<div class="path-unit"><div class="path-unit-title">Unit ' + (unit.unitIndex + 1) + '</div>';
      unit.lessons.forEach(function (lesson) {
        const st = nodeState(cur, state.journey, lesson.lessonId, 'lesson');
        const rec = state.journey.completedLessons[lesson.lessonId];
        const stars = rec ? '<span class="node-stars">' + starHtml(rec.stars) + '</span>' : '';
        html += '<button class="path-node node-' + st + '" ' +
          (st === 'locked' ? 'disabled' : 'onclick="startLesson(\'' + lesson.lessonId + '\')"') + '>' +
          '<span class="node-icon">' + (st === 'done' ? '✓' : st === 'locked' ? '🔒' : '●') + '</span>' +
          '<span class="node-label">Lesson ' + (lesson.lessonIndex + 1) + '</span>' + stars + '</button>';
      });
      const cpSt = nodeState(cur, state.journey, unit.checkpointId, 'checkpoint');
      html += '<button class="path-node path-checkpoint node-' + cpSt + '" ' +
        (cpSt === 'locked' ? 'disabled' : 'onclick="startCheckpoint(\'' + unit.checkpointId + '\')"') + '>' +
        '<span class="node-icon">' + (cpSt === 'done' ? '🏅' : cpSt === 'locked' ? '🔒' : '🏁') + '</span>' +
        '<span class="node-label">Checkpoint</span></button>';
      html += '</div>';
    });
    container.innerHTML = html;
  }

  return { __name: 'JourneyUI', renderLearnPath: renderLearnPath };
});
```

- [ ] **Step 2: Implement controllers in `app.js`** (place near `renderLearnSection`)

```js
function startLesson(lessonId) {
  const words = Curriculum.getLessonWords(HSK_DATA, lessonId);
  if (!words.length) return;
  // Phase 1: flashcard intro of this lesson's words
  switchTab('flashcards');
  initFlashcards(words);
  // Phase 2: when the user opens Practice (or via a "Start quiz" affordance), run the mini-quiz.
  // For a guided flow we launch the quiz immediately after flashcards via the existing Practice UI:
  state.pendingLesson = { lessonId: lessonId, words: words };
  showLessonQuizPrompt(lessonId, words);
}

function showLessonQuizPrompt(lessonId, words) {
  // Minimal affordance: a confirm-style banner button. Reuse Practice tab for the quiz.
  const count = Math.min(8, words.length);
  switchTab('practice');
  startNewQuiz(words, { count: count, onComplete: function (ratio) { finishLesson(lessonId, ratio); } });
}

function finishLesson(lessonId, ratio) {
  const res = JourneyState.applyLessonCompletion(state.journey, lessonId, ratio, Date.now());
  state.points += res.xpGained;
  // First lesson of the day -> daily goal bonus + streak
  const today = new Date().toISOString().slice(0, 10);
  const goal = JourneyState.applyDailyGoal(state.journey, today);
  state.points += goal.bonusXp;
  if (goal.bonusXp > 0) updateStreak();
  // Mark this lesson's words as learned in SRS
  Curriculum.getLessonWords(HSK_DATA, lessonId).forEach(function (w) { promoteSRSWord(w.id); });
  evaluateJourneyBadges();
  state.journey.rank = JourneyState.getRank(state.points);
  saveProgressToDB();
  saveJourney();
  renderPointsUI();
  switchTab('learn');
}

function startCheckpoint(checkpointId) {
  const words = Curriculum.getUnitWords(HSK_DATA, state.curriculum, checkpointId);
  if (words.length < 4) return;
  switchTab('practice');
  // Combined quiz over all unit words; reading question handled by Reading Lab separately if desired.
  startNewQuiz(words, {
    count: Math.min(12, words.length),
    onComplete: function (ratio) { finishCheckpoint(checkpointId, ratio); },
  });
}

function finishCheckpoint(checkpointId, ratio) {
  const passed = ratio >= Curriculum.CURRICULUM_CONFIG.passThreshold;
  if (passed) {
    const res = JourneyState.applyCheckpointPass(state.journey, checkpointId, ratio, Date.now());
    state.points += res.xpGained;
    evaluateJourneyBadges();
    state.journey.rank = JourneyState.getRank(state.points);
    saveProgressToDB();
    saveJourney();
    renderPointsUI();
    alert('Checkpoint passed! (' + Math.round(ratio * 100) + '%)');
  } else {
    alert('Score ' + Math.round(ratio * 100) + '% — need ' +
      Math.round(Curriculum.CURRICULUM_CONFIG.passThreshold * 100) + '% to pass. Try again!');
  }
  switchTab('learn');
}

function evaluateJourneyBadges() {
  const words = HSK_DATA[state.currentLevel] || [];
  let mastered = 0;
  Object.keys(state.progress).forEach(function (id) {
    if (state.progress[id] && state.progress[id].srsLevel >= 4) mastered++;
  });
  JourneyState.evaluateBadges(state.journey, {
    journey: state.journey,
    streak: state.streak,
    masteredCount: mastered,
  });
}
```

> Note on reading question: the spec calls for one reading-comprehension question in checkpoints when essays exist. To keep this task focused and testable, the checkpoint here uses the combined vocab quiz; integrating one `HSK_ESSAYS[level]` question into the checkpoint quiz is a follow-up enhancement tracked in Task 10. The 80% threshold and unit-words pool are implemented now.

- [ ] **Step 3: Add path styles to `styles.css`** (append; match existing glassmorphic variables)

```css
.learn-path { display:flex; flex-direction:column; gap:1.5rem; padding:1rem 0; }
.path-unit { display:flex; flex-direction:column; align-items:center; gap:0.75rem; }
.path-unit-title { font-weight:600; color:var(--text-secondary); }
.path-node { display:flex; flex-direction:column; align-items:center; gap:0.25rem;
  width:120px; padding:0.75rem; border-radius:1rem; border:1px solid var(--glass-border, rgba(255,255,255,.15));
  background:var(--glass-bg, rgba(255,255,255,.06)); cursor:pointer; color:var(--text-primary); }
.path-node.node-locked { opacity:.45; cursor:not-allowed; }
.path-node.node-done { border-color:var(--accent-cyan, #22d3ee); }
.path-node.node-open { box-shadow:0 0 0 2px var(--accent-blue, #3b82f6) inset; }
.path-checkpoint { width:140px; font-weight:600; }
.node-stars { letter-spacing:2px; color:#fbbf24; }
.path-empty { text-align:center; color:var(--text-secondary); padding:2rem; }
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`.
- Learn tab shows Unit 1 with Lesson 1 unlocked (●), Lessons 2+ locked (🔒), Checkpoint locked.
- Click Lesson 1 → flashcards of 12 words, then a mini-quiz (≤8 Q). Finish it.
- Returns to Learn; Lesson 1 now shows ✓ + stars; Lesson 2 unlocked.
- Complete all lessons in a unit → Checkpoint unlocks; pass it (≥80%) → next unit's first lesson unlocks; header points increase; Rank updates if threshold crossed.
- Reload → all progress and node states persist.

- [ ] **Step 5: Commit**

```bash
git add journey-ui.js app.js styles.css
git commit -m "feat: visual journey path + lesson/checkpoint controllers"
```

---

### Task 9: Export/Import UI wiring (`backup.js`, `app.js`)

**Goal:** Wire the Export/Import buttons (added in Task 7) to download a JSON backup and restore from one, using the validated bundle functions from Task 5.

**Files:**
- Modify: `backup.js` — add DOM helpers `downloadExport`, `readImportFile`.
- Modify: `app.js` — gather state for export, apply imported state, attach button listeners in init.

**Interfaces:**
- Consumes: `Backup.buildExportBundle`, `Backup.validateImportBundle`, `db`, `state`.
- Produces: `Backup.downloadExport(bundle, dateStr)`, `Backup.readImportFile(file)` → Promise<obj>; `exportProgressFile()`, `importProgressFile(file)` in app.js.

- [ ] **Step 1: Add DOM helpers to `backup.js`** (inside the factory, before `return`; guarded so Node tests ignore them)

```js
  function downloadExport(bundle, dateStr) {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hsk-sensei-progress-' + (dateStr || 'backup') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function readImportFile(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        try { resolve(JSON.parse(reader.result)); }
        catch (e) { reject(new Error('File is not valid JSON.')); }
      };
      reader.onerror = function () { reject(new Error('Could not read file.')); };
      reader.readAsText(file);
    });
  }
```

Add `downloadExport, readImportFile` to the returned object.

- [ ] **Step 2: Add export/import controllers to `app.js`**

```js
async function exportProgressFile() {
  const unlocked = JSON.parse(localStorage.getItem('hsk_sensei_unlocked_extra_ids') || '[]');
  const bundle = Backup.buildExportBundle({
    progress: state.progress,
    streak: state.streak,
    lastStudyDate: state.lastStudyDate,
    points: state.points,
    readEssayIds: state.readEssayIds,
    unlockedExtraIds: unlocked,
    journey: state.journey,
  }, new Date().toISOString());
  Backup.downloadExport(bundle, new Date().toISOString().slice(0, 10));
}

async function importProgressFile(file) {
  let obj;
  try { obj = await Backup.readImportFile(file); }
  catch (e) { alert(e.message); return; }
  const res = Backup.validateImportBundle(obj);
  if (!res.ok) { alert('Import failed: ' + res.error); return; }
  if (!confirm('This will OVERWRITE your current progress. Continue?')) return;
  const d = res.data;
  state.progress = d.progress;
  state.streak = d.streak;
  state.lastStudyDate = d.lastStudyDate;
  state.points = d.points;
  state.readEssayIds = d.readEssayIds || [];
  state.journey = d.journey;
  localStorage.setItem('hsk_sensei_unlocked_extra_ids', JSON.stringify(d.unlockedExtraIds || []));
  await saveProgressToDB();
  await saveJourney();
  alert('Progress imported. Reloading.');
  location.reload();
}
```

- [ ] **Step 3: Attach listeners in `DOMContentLoaded` init** (~line 3128, after `switchTab('learn')`)

```js
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importInput = document.getElementById('importFileInput');
  if (exportBtn) exportBtn.addEventListener('click', exportProgressFile);
  if (importBtn && importInput) {
    importBtn.addEventListener('click', function () { importInput.click(); });
    importInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importProgressFile(e.target.files[0]);
    });
  }
```

- [ ] **Step 4: Manual verification (cross-browser round trip)**

Run: `npm run dev`.
- Complete a lesson, click **⬇️ Export** → a `hsk-sensei-progress-YYYY-MM-DD.json` file downloads; open it and confirm it contains `journey`, `progress`, `points`.
- Open the app in a different browser (or a private window), click **⬆️ Import**, choose the file, confirm overwrite → page reloads with the same completed lesson + points + rank.
- Import a deliberately corrupted file (delete a brace) → friendly "not valid JSON" alert, existing data untouched.

- [ ] **Step 5: Commit**

```bash
git add backup.js app.js
git commit -m "feat: JSON export/import UI with overwrite confirmation"
```

---

### Task 10: Gamification polish — badge gallery, daily goal, reading checkpoint question

**Goal:** Surface badges and the daily goal in the UI, and add the reading-comprehension question to checkpoints when the level has essays. (Header rank/XP already wired in Tasks 7–8.)

**Files:**
- Modify: `journey-ui.js` — `renderBadgeGallery`, daily-goal indicator.
- Modify: `index.html` — a badges strip + daily-goal pill in `#learnSection`.
- Modify: `app.js` — `startCheckpoint` to append one reading question; `renderLearnSection` to call the gallery/goal renderers.
- Modify: `styles.css` — badge + daily-goal styles.

**Interfaces:**
- Consumes: `state.journey.badges`, `state.journey.dailyGoalDone`, `HSK_ESSAYS`.
- Produces: `JourneyUI.renderBadgeGallery(container, journey)`, `JourneyUI.renderDailyGoal(container, journey, today)`.

- [ ] **Step 1: Add badge + daily-goal markup to `#learnSection`** in `index.html` (after `learn-header`):

```html
<div id="dailyGoalPill" class="daily-goal-pill"></div>
<div id="badgeGallery" class="badge-gallery"></div>
```

- [ ] **Step 2: Implement the renderers in `journey-ui.js`** (add functions + export them)

```js
  var BADGE_LABELS = {
    'streak-7': '🔥 7-Day Streak',
    'words-100': '💯 100 Words',
    'perfect-checkpoint': '🌟 Perfect Checkpoint',
  };
  function badgeLabel(id) {
    if (BADGE_LABELS[id]) return BADGE_LABELS[id];
    if (id.indexOf('unit-complete:') === 0) return '🏅 ' + id.split(':')[1];
    if (id.indexOf('level-complete:') === 0) return '👑 ' + id.split(':')[1];
    return id;
  }
  function renderBadgeGallery(container, journey) {
    if (!container) return;
    if (!journey.badges.length) { container.innerHTML = '<span class="badge-empty">No badges yet — keep going!</span>'; return; }
    container.innerHTML = journey.badges.map(function (b) {
      return '<span class="badge-chip">' + badgeLabel(b) + '</span>';
    }).join('');
  }
  function renderDailyGoal(container, journey, today) {
    if (!container) return;
    var done = journey.dailyGoalDate === today && journey.dailyGoalDone;
    container.innerHTML = done
      ? '<span class="goal-done">✅ Daily goal complete!</span>'
      : '<span class="goal-todo">🎯 Daily goal: finish 1 lesson today</span>';
  }
```

Add `renderBadgeGallery, renderDailyGoal` to the returned object.

- [ ] **Step 3: Call them from `renderLearnSection`** in `app.js` (extend the existing function):

```js
  const today = new Date().toISOString().slice(0, 10);
  if (typeof JourneyUI !== 'undefined') {
    JourneyUI.renderDailyGoal(document.getElementById('dailyGoalPill'), state.journey, today);
    JourneyUI.renderBadgeGallery(document.getElementById('badgeGallery'), state.journey);
  }
```

- [ ] **Step 4: Add the reading question to checkpoints** — modify `startCheckpoint` in `app.js` so that, when `HSK_ESSAYS[state.currentLevel]` exists, the pass ratio also factors one reading question. Simplest integration that respects the spec: after the vocab quiz completes, if essays exist, show one reading question and average it in.

Replace `startCheckpoint`'s `onComplete` with a two-phase flow:

```js
function startCheckpoint(checkpointId) {
  const words = Curriculum.getUnitWords(HSK_DATA, state.curriculum, checkpointId);
  if (words.length < 4) return;
  switchTab('practice');
  startNewQuiz(words, {
    count: Math.min(12, words.length),
    onComplete: function (vocabRatio) {
      const essays = (typeof HSK_ESSAYS !== 'undefined') ? (HSK_ESSAYS[state.currentLevel] || []) : [];
      if (!essays.length) { finishCheckpoint(checkpointId, vocabRatio); return; }
      askCheckpointReadingQuestion(essays, function (readingCorrect) {
        // Weight: vocab 80%, reading 20%
        const ratio = vocabRatio * 0.8 + (readingCorrect ? 0.2 : 0);
        finishCheckpoint(checkpointId, ratio);
      });
    },
  });
}

function askCheckpointReadingQuestion(essays, cb) {
  const essay = essays[Math.floor(Math.random() * essays.length)];
  if (!essay || !essay.questions || !essay.questions.length) { cb(true); return; }
  const q = essay.questions[0];
  const optionsText = q.options.map(function (o, i) { return (i + 1) + '. ' + o; }).join('\n');
  const ans = prompt(essay.titleCn + '\n\n' + essay.contentCn + '\n\n' + q.q + '\n' + optionsText + '\n\nEnter option number:');
  const picked = parseInt(ans, 10) - 1;
  cb(picked === q.correct);
}
```

> Note: a `prompt()`-based reading question keeps this task small and dependency-free. A richer inline reading-question card can replace `askCheckpointReadingQuestion` later without changing `startCheckpoint`'s contract.

- [ ] **Step 5: Add styles to `styles.css`** (append)

```css
.badge-gallery { display:flex; flex-wrap:wrap; gap:0.5rem; justify-content:center; margin:1rem 0; }
.badge-chip { padding:0.35rem 0.7rem; border-radius:999px; background:var(--glass-bg, rgba(255,255,255,.08));
  border:1px solid var(--glass-border, rgba(255,255,255,.15)); font-size:0.85rem; }
.badge-empty, .goal-todo, .goal-done { color:var(--text-secondary); font-size:0.9rem; }
.daily-goal-pill { text-align:center; margin:0.5rem 0; }
.goal-done { color:var(--accent-cyan, #22d3ee); }
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`.
- Learn tab shows the daily-goal pill (todo state); complete a lesson → it flips to "complete", points include the +15 bonus once.
- Earn a checkpoint → an `unit-complete:*` badge chip appears in the gallery.
- On a level WITH essays, a checkpoint shows the reading question after the vocab quiz; the final pass ratio blends both.
- `npm test` still passes (no pure-logic regressions).

- [ ] **Step 7: Commit**

```bash
git add journey-ui.js index.html app.js styles.css
git commit -m "feat: badge gallery, daily goal indicator, checkpoint reading question"
```

---

## Self-Review

**Spec coverage:**
- §2 small lessons + unit checkpoints → Tasks 1, 8. ✓
- §2 sequential gating → Task 2, enforced in Task 8 render. ✓
- §2 lesson = flashcards → mini-quiz → Task 6 + Task 8 `startLesson`. ✓
- §2 checkpoint = combined quiz + reading + 80% → Task 8 (vocab + threshold) and Task 10 (reading question). ✓
- §2 gamification: XP/rank (Tasks 3, 7, 8), badges (Task 4, 10), visual path (Task 8), daily goal (Tasks 4, 8, 10). ✓
- §2 nav: Learn home + Free Practice grouping → Task 7. ✓
- §2 export/import JSON → Tasks 5, 9. ✓
- §2 HSK 1–6 only → Task 1 `guidedLevels`, Task 8 empty-level message. ✓
- §5 `journey` persisted via ProgressDB → Task 7. ✓
- §6 error handling: import validation (Tasks 5, 9), missing essays (Task 10), short final lesson/unit (Task 1 chunk remainder), storage fallback (Task 7 reuses existing). ✓
- §7 testing: pure modules unit-tested (Tasks 1–5), DOM manual (Tasks 6–10). ✓

**Placeholder scan:** No "TBD"/"implement later". Task 3 contains an intentionally-removed no-op line with the corrected clean version shown immediately after — implementer uses the clean version. Reading-question and richer-UI deferrals are explicit, scoped follow-ups within Task 10, not placeholders.

**Type consistency:** `journey` shape (`completedLessons`, `passedCheckpoints`, `badges`, `dailyGoalDate`, `dailyGoalDone`, `schemaVersion`, `rank`) is consistent across Tasks 3, 4, 5, 7, 8, 9. ID formats match `curriculum.js` generation and gating regexes. `startNewQuiz(words, {count, onComplete})` and `initFlashcards(explicitList)` signatures consistent between Tasks 6 and 8. `Backup.buildExportBundle`/`validateImportBundle` consistent between Tasks 5 and 9.
