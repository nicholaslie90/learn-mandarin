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

  return { __name: 'JourneyUI', renderLearnPath: renderLearnPath, renderBadgeGallery: renderBadgeGallery, renderDailyGoal: renderDailyGoal };
});
