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
    // dynamic: one badge per passed checkpoint (unit completed) — guarded form for CP only
    Object.keys(journey.passedCheckpoints).filter(function (k) { return /^CP\d+-u\d+$/.test(k); }).forEach(function (cpId) {
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

  return {
    __name: 'JourneyState',
    RANK_THRESHOLDS: RANK_THRESHOLDS,
    createEmptyJourney: createEmptyJourney,
    getRank: getRank,
    starsForAccuracy: starsForAccuracy,
    xpForLesson: xpForLesson,
    applyLessonCompletion: applyLessonCompletion,
    applyCheckpointPass: applyCheckpointPass,
    applyDailyGoal: applyDailyGoal,
    BADGE_DEFS: BADGE_DEFS,
    evaluateBadges: evaluateBadges,
  };
});
