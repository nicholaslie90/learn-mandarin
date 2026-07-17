(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const CONFETTI_CHARS = '福龙爱好棒学喜吉乐才';
  // Reward vocabulary only (seal reds + golds) — task-UI cyan/pink stay out of celebrations.
  // Two ramps: bright for the dark theme, deepened for the light theme.
  const CONFETTI_COLORS_DARK = ['#e9403a', '#f5b428', '#ff6f61', '#ffd76a', '#f7ead9'];
  const CONFETTI_COLORS_LIGHT = ['#c62828', '#a8720a', '#e05747', '#8a5a00', '#9a3324'];

  function confettiColors() {
    const light = typeof document !== 'undefined' &&
      document.body && document.body.classList.contains('light-theme');
    return light ? CONFETTI_COLORS_LIGHT : CONFETTI_COLORS_DARK;
  }
  const MAX_CONFETTI_PIECES = 140;

  let initialized = false;
  let reducedMotion = false;
  let tooltipEl = null;
  const activePieces = [];
  const tweens = new WeakMap();
  const toastQueue = [];
  let toastShowing = false;
  let toastTimer = null;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function init() {
    if (initialized) return;
    initialized = true;
    if (typeof document !== 'undefined' && !document.getElementById('hanziTooltip')) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'hanziTooltip';
      tooltipEl.className = 'hanzi-tooltip';
      tooltipEl.style.position = 'fixed';
      tooltipEl.style.display = 'none';
      document.body.appendChild(tooltipEl);
    } else if (typeof document !== 'undefined') {
      tooltipEl = document.getElementById('hanziTooltip');
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotion = !!query.matches;
      const onChange = function (e) { reducedMotion = !!e.matches; };
      if (query.addEventListener) query.addEventListener('change', onChange);
      else if (query.addListener) query.addListener(onChange);
    }
  }

  function removePiece(span) {
    const i = activePieces.indexOf(span);
    if (i !== -1) activePieces.splice(i, 1);
    if (span.parentNode) span.parentNode.removeChild(span);
  }

  function hanziConfetti(options) {
    init();
    if (reducedMotion) return;
    const layer = document.getElementById('celebrationLayer');
    if (!layer) return;
    options = options || {};
    const count = options.count != null ? options.count : 80;
    let x;
    let y;
    if (options.originEl && options.originEl.getBoundingClientRect) {
      const r = options.originEl.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    } else if (options.origin && typeof options.origin.x === 'number' && typeof options.origin.y === 'number') {
      x = options.origin.x;
      y = options.origin.y;
    } else {
      x = window.innerWidth / 2;
      y = window.innerHeight / 2;
    }
    const colors = confettiColors();
    for (let i = 0; i < count; i++) {
      const dur = rand(1.6, 2.8);
      const delay = rand(0, 0.25);
      const span = document.createElement('span');
      span.className = 'hz-confetti-piece';
      span.textContent = CONFETTI_CHARS[Math.floor(Math.random() * CONFETTI_CHARS.length)];
      span.style.left = x + 'px';
      span.style.top = y + 'px';
      span.style.color = pick(colors);
      span.style.fontSize = Math.round(rand(14, 30)) + 'px';
      span.style.setProperty('--dx', rand(-38, 38).toFixed(1) + 'vw');
      span.style.setProperty('--rot', Math.round(rand(-540, 540)) + 'deg');
      span.style.setProperty('--dur', dur.toFixed(2) + 's');
      span.style.setProperty('--delay', delay.toFixed(2) + 's');
      layer.appendChild(span);
      activePieces.push(span);
      span.addEventListener('animationend', function () { removePiece(span); }, { once: true });
      setTimeout(function () { removePiece(span); }, (dur + delay + 0.4) * 1000);
    }
    while (activePieces.length > MAX_CONFETTI_PIECES) removePiece(activePieces[0]);
  }

  function nextToast() {
    const el = document.getElementById('milestoneToast');
    if (!el) {
      toastQueue.length = 0;
      toastShowing = false;
      return;
    }
    const item = toastQueue.shift();
    if (!item) {
      toastShowing = false;
      return;
    }
    toastShowing = true;
    const icon = item.options.icon || '';
    const reward = item.options.reward !== false;
    const duration = item.options.duration != null ? item.options.duration : 3200;
    el.textContent = icon ? icon + ' ' + item.message : item.message;
    el.classList.toggle('toast-reward', reward);
    el.classList.add('toast-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('toast-visible');
      toastTimer = setTimeout(nextToast, 250);
    }, duration);
  }

  function toast(message, options) {
    init();
    toastQueue.push({ message: String(message), options: options || {} });
    if (!toastShowing) nextToast();
  }

  function countUp(el, toValue, options) {
    if (!el) return;
    init();
    options = options || {};
    const duration = options.duration != null ? options.duration : 600;
    const format = options.format || null;
    const fmt = function (v) { return format ? format(v) : String(Math.round(v)); };
    const prev = tweens.get(el);
    if (prev) {
      cancelAnimationFrame(prev);
      tweens.delete(el);
    }
    let from = options.from != null ? Number(options.from) : parseFloat(el.textContent);
    if (isNaN(from)) from = 0;
    toValue = Number(toValue);
    if (isNaN(toValue)) toValue = 0;
    if (reducedMotion || duration <= 0) {
      el.textContent = fmt(toValue);
      return;
    }
    const start = performance.now();
    const frame = function (now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (toValue - from) * eased);
      if (t < 1) tweens.set(el, requestAnimationFrame(frame));
      else tweens.delete(el);
    };
    tweens.set(el, requestAnimationFrame(frame));
  }

  function floatChip(anchorEl, text) {
    init();
    if (reducedMotion || !anchorEl || !anchorEl.getBoundingClientRect) return;
    const layer = document.getElementById('celebrationLayer');
    if (!layer) return;
    const r = anchorEl.getBoundingClientRect();
    const span = document.createElement('span');
    span.className = 'points-float-chip';
    span.textContent = text;
    span.style.left = (r.left + r.width / 2) + 'px';
    span.style.top = r.top + 'px';
    layer.appendChild(span);
    span.addEventListener('animationend', function () { span.remove(); }, { once: true });
    setTimeout(function () { span.remove(); }, 1000);
  }

  function sealCeremony(options) {
    init();
    options = options || {};
    const modal = document.getElementById('rankUpModal');
    if (!modal) {
      toast((options.name || '') + ' — rank up!', { icon: '🏅' });
      if (options.onClose) options.onClose();
      return;
    }
    const nameEl = document.getElementById('rankUpName');
    const pinyinEl = document.getElementById('rankUpPinyin');
    const meaningEl = document.getElementById('rankUpMeaning');
    if (nameEl) nameEl.textContent = options.name || '';
    if (pinyinEl) pinyinEl.textContent = options.pinyin || '';
    if (meaningEl) meaningEl.textContent = options.meaning || '';
    const sealChar = modal.querySelector('.seal-char');
    // Last character distinguishes ranks (学徒/学生 share 学 but end in 徒/生).
    const name = options.name || '';
    if (sealChar) sealChar.textContent = name.charAt(Math.max(0, name.length - 1));
    const stamp = modal.querySelector('.seal-stamp');
    if (stamp && !reducedMotion) {
      stamp.classList.remove('seal-stamping');
      void stamp.offsetWidth;
      stamp.classList.add('seal-stamping');
    }
    const closeBtn = document.getElementById('rankUpCloseBtn');
    let closeFired = false;
    const fireClose = function () {
      if (closeFired) return;
      closeFired = true;
      modal.removeEventListener('close', fireClose);
      modal.removeEventListener('click', onBackdropClick);
      if (closeBtn) closeBtn.removeEventListener('click', onCloseBtnClick);
      if (options.onClose) options.onClose();
    };
    const onCloseBtnClick = function () { if (modal.open) modal.close(); };
    const onBackdropClick = function (e) { if (e.target === modal && modal.open) modal.close(); };
    modal.addEventListener('close', fireClose);
    modal.addEventListener('click', onBackdropClick);
    if (closeBtn) closeBtn.addEventListener('click', onCloseBtnClick);
    if (!modal.open) modal.showModal();
    if (closeBtn) closeBtn.focus();
  }

  function badgeShine(containerEl, options) {
    if (!containerEl) return;
    const count = (options && options.count) || 1;
    const chips = containerEl.querySelectorAll('.badge-chip');
    const targets = [];
    for (let i = Math.max(0, chips.length - count); i < chips.length; i++) {
      chips[i].classList.add('badge-new');
      targets.push(chips[i]);
    }
    setTimeout(function () {
      targets.forEach(function (chip) { chip.classList.remove('badge-new'); });
    }, 2500);
  }

  function showTooltip(anchorEl, html) {
    init();
    if (!tooltipEl || !anchorEl || !anchorEl.getBoundingClientRect) return;
    const r = anchorEl.getBoundingClientRect();
    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';
    tooltipEl.style.visibility = 'hidden';
    const tw = tooltipEl.offsetWidth;
    const th = tooltipEl.offsetHeight;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    let top = r.top - th - 8;
    if (top < 8) top = r.bottom + 8;
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
    tooltipEl.style.visibility = '';
    tooltipEl.classList.add('tooltip-visible');
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.remove('tooltip-visible');
    tooltipEl.style.display = 'none';
  }

  const api = {
    __name: 'Celebrations',
    init: init,
    hanziConfetti: hanziConfetti,
    toast: toast,
    countUp: countUp,
    floatChip: floatChip,
    sealCeremony: sealCeremony,
    badgeShine: badgeShine,
    showTooltip: showTooltip,
    hideTooltip: hideTooltip,
  };
  Object.defineProperty(api, 'reducedMotion', {
    enumerable: true,
    get: function () { return reducedMotion; },
  });
  return api;
});
