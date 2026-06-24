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
    return { journey: journey, xpGained: isNew ? xpForLesson(stars) : 0 };
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
