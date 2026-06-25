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

  function makeLesson(level, unitIndex, lessonIndex, wordsInLesson) {
    return {
      lessonId: 'L' + level + '-u' + unitIndex + '-l' + lessonIndex,
      level: level,
      unitIndex: unitIndex,
      lessonIndex: lessonIndex,
      wordIds: wordsInLesson.map(function (w) { return w.id; }),
      wordCount: wordsInLesson.length,
    };
  }

  // Fixed-size sequential units (fallback when no theme map is available).
  function buildSequentialUnits(level, words, cfg) {
    const lessons = chunk(words, cfg.wordsPerLesson).map(function (w, idx) {
      return makeLesson(level, Math.floor(idx / cfg.lessonsPerUnit), idx % cfg.lessonsPerUnit, w);
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
    return units;
  }

  // One unit per theme (in themeMeta order); each theme split into lessons.
  // Themes with fewer than MIN_UNIT_WORDS are merged into a neighbor so we
  // never create a trivial unit / an unpassable checkpoint.
  var MIN_UNIT_WORDS = 4;
  function buildThemedUnits(level, words, cfg, wt, tm) {
    const byTheme = {};
    words.forEach(function (w) {
      const key = wt[w.id] || 'general';
      (byTheme[key] = byTheme[key] || []).push(w);
    });
    // Ordered, non-empty theme groups
    let groups = [];
    tm.forEach(function (theme) {
      const ws = byTheme[theme.key];
      if (ws && ws.length) {
        groups.push({ title: theme.name, emoji: theme.emoji, themeKey: theme.key, words: ws.slice() });
      }
    });
    // Fold an undersized group into the previous group
    const merged = [];
    groups.forEach(function (g) {
      if (g.words.length < MIN_UNIT_WORDS && merged.length > 0) {
        merged[merged.length - 1].words = merged[merged.length - 1].words.concat(g.words);
      } else {
        merged.push(g);
      }
    });
    // If the first group is still undersized, fold it into the next one
    if (merged.length > 1 && merged[0].words.length < MIN_UNIT_WORDS) {
      merged[1].words = merged[0].words.concat(merged[1].words);
      merged.shift();
    }
    return merged.map(function (g, ui) {
      return {
        unitIndex: ui,
        checkpointId: 'CP' + level + '-u' + ui,
        title: g.title,
        emoji: g.emoji,
        themeKey: g.themeKey,
        lessons: chunk(g.words, cfg.wordsPerLesson).map(function (w, idx) {
          return makeLesson(level, ui, idx, w);
        }),
      };
    });
  }

  function buildCurriculum(hskData, config, wordTheme, themeMeta) {
    const cfg = config || CURRICULUM_CONFIG;
    const wt = wordTheme || (typeof WORD_THEME !== 'undefined' ? WORD_THEME : null);
    const tm = themeMeta || (typeof THEME_META !== 'undefined' ? THEME_META : null);
    const themed = !!(wt && tm);
    const levels = [];
    cfg.guidedLevels.forEach(function (level) {
      const words = (hskData[String(level)] || []);
      if (words.length === 0) return;
      const units = themed
        ? buildThemedUnits(level, words, cfg, wt, tm)
        : buildSequentialUnits(level, words, cfg);
      if (units.length === 0) return;
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

  return {
    __name: 'Curriculum',
    CURRICULUM_CONFIG: CURRICULUM_CONFIG,
    buildCurriculum: buildCurriculum,
    parseLessonId: parseLessonId,
    getLessonWords: getLessonWords,
    getUnitWords: getUnitWords,
    isLessonUnlocked: isLessonUnlocked,
    isCheckpointUnlocked: isCheckpointUnlocked,
    isLevelTestUnlocked: isLevelTestUnlocked,
    isUnitComplete: isUnitComplete,
  };
});
