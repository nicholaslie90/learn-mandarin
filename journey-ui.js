(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
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
    const journey = state.journey;

    function lessonNode(lesson) {
      const st = nodeState(cur, journey, lesson.lessonId, 'lesson');
      const rec = journey.completedLessons[lesson.lessonId];
      const inner = st === 'done' ? '✓' : st === 'locked' ? '🔒' : (lesson.lessonIndex + 1);
      const stars = '<span class="jnode-stars">' + (rec ? starHtml(rec.stars) : '') + '</span>';
      const attrs = st === 'locked' ? 'disabled' : 'onclick="startLesson(\'' + lesson.lessonId + '\')"';
      return '<div class="jnode-wrap"><button class="jnode node-' + st + '" title="Lesson ' +
        (lesson.lessonIndex + 1) + '" ' + attrs + '>' + inner + '</button>' + stars + '</div>';
    }
    function cpNode(unit) {
      const st = nodeState(cur, journey, unit.checkpointId, 'checkpoint');
      const icon = st === 'done' ? '🏅' : st === 'locked' ? '🔒' : '🏁';
      const attrs = st === 'locked' ? 'disabled' : 'onclick="startCheckpoint(\'' + unit.checkpointId + '\')"';
      return '<div class="jnode-wrap"><button class="jnode jnode-cp node-' + st + '" title="Checkpoint" ' +
        attrs + '>' + icon + '</button><span class="jnode-cap">Test</span></div>';
    }

    let html = '';
    lvl.units.forEach(function (unit) {
      const title = unit.title ? ((unit.emoji ? unit.emoji + ' ' : '') + unit.title) : ('Unit ' + (unit.unitIndex + 1));
      const done = unit.lessons.filter(function (l) { return journey.completedLessons[l.lessonId]; }).length;
      const cpDone = !!journey.passedCheckpoints[unit.checkpointId];
      html += '<div class="unit-card">' +
        '<div class="unit-card-head"><span class="unit-name">' + title + '</span>' +
        '<span class="unit-progress">' + (cpDone ? '✅ done' : done + '/' + unit.lessons.length) + '</span></div>' +
        '<div class="unit-nodes">' +
        unit.lessons.map(lessonNode).join('') + cpNode(unit) +
        '</div></div>';
    });

    var ltId = lvl.levelTestId;
    var ltState = journey.passedCheckpoints[ltId] ? 'done'
      : C.isLevelTestUnlocked(cur, ltId, journey) ? 'open' : 'locked';
    var ltIcon = ltState === 'done' ? '👑' : ltState === 'locked' ? '🔒' : '🎓';
    var ltAttrs = ltState === 'locked' ? 'disabled' : 'onclick="startLevelTest(\'' + ltId + '\')"';
    html += '<div class="unit-card unit-card-test">' +
      '<div class="unit-card-head"><span class="unit-name">🎓 Level Test</span></div>' +
      '<div class="unit-nodes"><div class="jnode-wrap"><button class="jnode jnode-cp node-' + ltState + '" title="Level Test" ' +
      ltAttrs + '>' + ltIcon + '</button><span class="jnode-cap">Final</span></div></div></div>';
    container.innerHTML = html;
  }

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
    if (!journey.badges || !journey.badges.length) { container.innerHTML = '<span class="badge-empty">No badges yet — keep going!</span>'; return; }
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

  return { __name: 'JourneyUI', renderLearnPath: renderLearnPath, renderBadgeGallery: renderBadgeGallery, renderDailyGoal: renderDailyGoal, badgeLabel: badgeLabel };
});
