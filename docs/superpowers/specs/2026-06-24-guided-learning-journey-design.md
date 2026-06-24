# Design: Guided Learning Journey for HSK Sensei

**Date:** 2026-06-24
**Status:** Approved (pending spec review)

## 1. Goal

Transform HSK Sensei from a free-form, tab-based study tool into a **guided,
step-by-step, gamified, self-paced learning journey** built on the HSK
curriculum, with **checkpoint exams** that test comprehension before unlocking
the next unit. All progress is tracked client-side (IndexedDB + localStorage
fallback) and can be **exported/imported as a JSON file** so a learner can move
between browsers — the app is hosted on GitHub Pages with no backend.

This is an **additive layer** over the existing engine. No existing feature is
removed.

## 2. Scope Decisions (confirmed)

- **Curriculum chunking:** small lessons grouped into units, with a checkpoint
  exam per unit and a level test per level.
- **Gating:** strictly sequential (Duolingo-style). Next lesson/unit locks until
  the prior checkpoint is passed. Completed items remain replayable.
- **Lesson content:** Flashcards (introduce the lesson's words) → mini-quiz.
  Stroke writing and pronunciation remain optional free practice.
- **Checkpoint exam:** combined quiz drawing from all words in the unit, plus one
  reading-comprehension question (when essays exist for that level). Pass at
  ≥ 80%; failure means retake.
- **Gamification:** XP + user rank, badges/achievements, a visual node path as
  the home screen, and a daily goal with streak bonus.
- **Navigation:** the path ("Learn") becomes the default home; the existing
  tabs (Flashcards, Practice, Stroke, Pronunciation, Dictionary, Reading) stay,
  regrouped visually as "Free Practice." Dashboard is retained.
- **Export/Import:** JSON file download/upload.
- **Coverage:** the guided journey covers **HSK 1–6**. HSK 7–9 (thousands of
  words each) remain available only in Free Practice (Dictionary / Reading /
  Flashcards), not as guided lessons.

### Tunable parameters (defaults)

| Parameter | Default |
|---|---|
| Words per lesson | 12 |
| Lessons per unit | 4 (≈48 words → 1 checkpoint) |
| Checkpoint / level-test pass threshold | 80% |
| Lesson mini-quiz length | min(8, lesson word count) |
| Lesson stars | 3 = 100%, 2 = ≥80%, 1 = passed |

## 3. Architecture Overview

The app is a monolithic vanilla-JS static site (`app.js` ≈ 106 KB, `data.js`
≈ 3.7 MB). To avoid bloating `app.js`, the journey is built as **three new
isolated modules** plus minimal, targeted edits to `app.js` and `index.html`.

### New modules

1. **`curriculum.js`** — Pure, stateless curriculum generator + gating logic.
   - `buildCurriculum(HSK_DATA)` → deterministic structure of levels → units →
     lessons → checkpoints, derived from the existing word order.
   - Lesson IDs: `L{level}-u{unit}-l{idx}`; checkpoint IDs: `CP{level}-u{unit}`;
     level test: `LT{level}`.
   - `getLessonWords(lessonId)`, `getUnitWords(unitId)` → word-object slices.
   - `isLessonUnlocked(lessonId, journey)`, `isCheckpointUnlocked(...)`,
     `isUnitUnlocked(...)` → gating predicates (no state mutation).
   - Covers HSK levels 1–6 only.
   - **Determinism contract:** lesson membership is a function of `HSK_DATA`
     order alone. Reordering/removing words mid-curriculum would shift
     membership; word order is treated as stable input.

2. **`journey.js`** — Journey state, progression, gamification, and path
   rendering.
   - Owns the `journey` state object (see §5) and reads/writes it via the
     existing `ProgressDB`.
   - `completeLesson(lessonId, quizAccuracy)`, `passCheckpoint(checkpointId, score)`.
   - XP/rank: reuses existing `points` as XP; `getRank(xp)` maps XP → rank.
   - Badges: data-driven definitions evaluated on each state change.
   - Daily goal: target ≥ 1 lesson/day; ties into existing `streak` /
     `lastStudyDate`.
   - `renderLearnPath()` → renders the visual node path for the current level.

3. **`backup.js`** — Export/import.
   - `exportProgress()` → serializes all ProgressDB keys + `journey` into a
     versioned JSON blob; triggers download `hsk-sensei-progress-YYYY-MM-DD.json`.
   - `importProgress(file)` → parse → validate `schemaVersion` and shape →
     confirm overwrite → write all keys → reload UI.

### Edits to existing code

- **`index.html`** — add the `#learnSection` ("Learn") tab and nav entry; mark
  it the default; visually group the existing activity tabs under "Free
  Practice"; add Export/Import buttons (profile/settings area); add XP-bar/rank
  element to the header.
- **`app.js`** — register the "Learn" tab in `switchTab()`; make the default
  view "Learn"; **parameterize `initFlashcards()` and `startNewQuiz()`** to
  accept an explicit word list (and a completion callback) so lessons and
  checkpoints reuse the existing flashcard/quiz engines instead of duplicating
  them. Wire lesson/checkpoint completion back into `journey.js`.

## 4. Data Flow

1. On load: `loadProgressFromDB()` also hydrates `journey`; `buildCurriculum()`
   runs once from `HSK_DATA`; `renderLearnPath()` draws the path for
   `state.currentLevel`.
2. User taps an unlocked lesson node → flashcard pass over the lesson's 12 words
   → mini-quiz over those words → on pass, `completeLesson()` records stars +
   XP, marks the lesson's words `learned` / promotes SRS, re-evaluates badges
   and daily goal, persists, and re-renders the path.
3. When all lessons in a unit are complete, its checkpoint node unlocks. Passing
   the checkpoint (`passCheckpoint()`) unlocks the next unit and awards a badge +
   XP. The final unit's checkpoint plus a level test gate the next level.
4. Export/import round-trips the entire persisted state through a JSON file.

## 5. State / Persistence

New `journey` object, persisted via the existing `ProgressDB` (key `journey`):

```js
journey = {
  schemaVersion: 1,
  completedLessons: { "L1-u0-l0": { stars: 3, ts: 0 }, /* ... */ },
  passedCheckpoints: { "CP1-u0": { score: 0.9, ts: 0 }, /* ... */ },
  badges: [ "unit-1-1-done", "streak-7", "perfect-checkpoint" ],
  rank: "学生",
  dailyGoalDate: "2026-06-24",
  dailyGoalDone: true
}
```

- **XP** is the existing `points` value (no duplication); `rank` is derived and
  cached for display.
- Per-word state stays in the existing `progress` map
  (`{ srsLevel, dueTime, starred, learned }`); lesson completion updates it.
- Export bundle = `{ schemaVersion, exportedAt, progress, streak,
  lastStudyDate, points, readEssayIds, unlockedExtraIds, journey }`.

## 6. Error Handling

- **Import validation:** reject files missing/mismatched `schemaVersion` or with
  the wrong top-level shape; show a clear error and leave existing data
  untouched. Confirm before overwriting.
- **Missing essays:** if a level has no `HSK_ESSAYS` entries, the checkpoint
  omits the reading question and scores from vocab only.
- **Short final lesson/unit:** the last lesson/unit of a level may have < 12
  words / < 4 lessons; generation handles the remainder gracefully.
- **Storage failure:** reuse the existing IndexedDB→localStorage fallback path.

## 7. Testing Strategy

- **`curriculum.js` (pure):** unit-test chunking math (counts, remainders, ID
  format, determinism for fixed input) and every gating predicate across
  locked/unlocked/completed states — no DOM needed.
- **`journey.js`:** test `completeLesson`/`passCheckpoint` transitions, XP/rank
  thresholds, badge evaluation, and daily-goal rollover with an in-memory
  ProgressDB stub.
- **`backup.js`:** round-trip export→import equality; rejection of malformed /
  wrong-version payloads.
- **Manual/integration:** lesson → mini-quiz → checkpoint → unlock flow in the
  browser; export in one browser, import in another.

## 8. Out of Scope (YAGNI)

- Guided lessons for HSK 7–9.
- Theme/topic-based grouping (data has only part-of-speech, not theme).
- Cloud sync / accounts / multiplayer / leaderboards.
- Hearts/lives system on checkpoints.
- Copy-paste backup codes (file-only).
