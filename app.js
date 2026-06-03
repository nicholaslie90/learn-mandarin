// HSK Sensei - Client Logic & State Management

// Web Speech API Voice Selection helper
let chineseVoice = null;
function loadChineseVoice() {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  // Look for Chinese voices: zh-CN (Mainland), zh-HK (Hong Kong), zh-TW (Taiwan)
  chineseVoice = voices.find(v => v.lang.includes('zh-CN') || v.lang.includes('zh_CN')) || 
                 voices.find(v => v.lang.startsWith('zh-')) || 
                 voices.find(v => v.lang.includes('Chinese'));
}
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = loadChineseVoice;
  loadChineseVoice();
}

// Synth Sound Effects Engine (Uses Web Audio API)
class SoundEngine {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  playCorrect() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
    
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    
    osc.start(now);
    osc.stop(now + 0.5);
  }
  playWrong() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.25);
    
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
  }
  playFlip() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }
}
const sounds = new SoundEngine();

// Canvas Writing Drawing Pad Manager
class WritingCanvas {
  constructor(canvasId, guideId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.guide = document.getElementById(guideId);
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    
    this.setupListeners();
    this.resize();
  }
  
  setupListeners() {
    // Mouse Events
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e.offsetX, e.offsetY));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e.offsetX, e.offsetY));
    this.canvas.addEventListener('mouseup', () => this.stopDrawing());
    this.canvas.addEventListener('mouseleave', () => this.stopDrawing());
    
    // Touch Events for Mobile
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.startDrawing(touch.clientX - rect.left, touch.clientY - rect.top);
    });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.draw(touch.clientX - rect.left, touch.clientY - rect.top);
    });
    this.canvas.addEventListener('touchend', () => this.stopDrawing());
  }
  
  resize() {
    // Make sure we have a sharp high-DPI canvas
    const size = 320;
    const dpi = window.devicePixelRatio || 1;
    this.canvas.width = size * dpi;
    this.canvas.height = size * dpi;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.ctx.scale(dpi, dpi);
    
    // Set drawing styles
    this.ctx.strokeStyle = '#00f2fe';
    this.ctx.lineWidth = 10;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.clear();
  }
  
  startDrawing(x, y) {
    this.isDrawing = true;
    [this.lastX, this.lastY] = [x, y];
    
    // Draw initial dot
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.ctx.lineWidth / 2, 0, Math.PI * 2);
    this.ctx.fillStyle = this.ctx.strokeStyle;
    this.ctx.fill();
  }
  
  draw(x, y) {
    if (!this.isDrawing) return;
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    [this.lastX, this.lastY] = [x, y];
  }
  
  stopDrawing() {
    this.isDrawing = false;
  }
  
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  setGuideChar(char) {
    if (this.guide) {
      this.guide.textContent = char;
    }
  }
  
  toggleGuide(show) {
    if (this.guide) {
      if (show) {
        this.guide.classList.remove('hidden');
      } else {
        this.guide.classList.add('hidden');
      }
    }
  }
}

// App State Definition
const state = {
  currentLevel: 1, // Selected HSK level (1, 2, 3)
  activeTab: 'dashboard', // Current active nav view
  starredOnly: false,
  searchQuery: '',
  vocabFilter: 'all', // 'all', 'starred', 'due', 'learned'
  
  // Flashcards state
  flashcardIndex: 0,
  flashcardFlipped: false,
  
  // Quiz state
  quizQuestions: [],
  quizIndex: 0,
  quizScore: 0,
  quizAnswersHistory: [], // elements: { wordId, correct: boolean }
  quizSelectedOption: null,
  
  // Audio state
  isSpeaking: false,
  
  // Speech Recognition state
  isListening: false,
  recognition: null,
  speechFeedbackText: 'Press the microphone and say the characters aloud.',
  speechFeedbackStatus: 'neutral', // 'success', 'error', 'neutral'
  
  // Local storage state
  progress: {}, // wordId -> { srsLevel, dueTime, starred, learned }
  streak: 0,
  lastStudyDate: '', // YYYY-MM-DD
};

// Spaced Repetition Intervals (in hours)
const SRS_INTERVALS = [0, 4, 12, 24, 72, 168]; // Level 0 (new) to 5 (fully mastered)

// LocalStorage Sync Helpers
function saveToLocalStorage() {
  localStorage.setItem('hsk_sensei_progress', JSON.stringify(state.progress));
  localStorage.setItem('hsk_sensei_streak', state.streak.toString());
  localStorage.setItem('hsk_sensei_last_study', state.lastStudyDate);
}

function loadFromLocalStorage() {
  const localProg = localStorage.getItem('hsk_sensei_progress');
  if (localProg) state.progress = JSON.parse(localProg);
  
  const localStreak = localStorage.getItem('hsk_sensei_streak');
  if (localStreak) state.streak = parseInt(localStreak, 10);
  
  const localDate = localStorage.getItem('hsk_sensei_last_study');
  if (localDate) state.lastStudyDate = localDate;
  
  // Initialize progress slots for any words that don't exist yet
  Object.values(HSK_DATA).forEach(levelWords => {
    levelWords.forEach(word => {
      if (!state.progress[word.id]) {
        state.progress[word.id] = {
          srsLevel: 0,
          dueTime: 0,
          starred: false,
          learned: false
        };
      }
    });
  });
  saveToLocalStorage();
}

// Streak Maintenance Engine
function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  if (state.lastStudyDate === today) return; // Already studied today
  
  if (state.lastStudyDate) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (state.lastStudyDate === yesterdayStr) {
      state.streak += 1;
    } else {
      state.streak = 1; // Streak broken, restart
    }
  } else {
    state.streak = 1; // First study day ever
  }
  
  state.lastStudyDate = today;
  saveToLocalStorage();
  renderStreakUI();
}

// Sound playback wrapper
function playTextToSpeech(text, callback) {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel(); // Stop any current speaking
  
  const utterance = new SpeechSynthesisUtterance(text);
  if (chineseVoice) utterance.voice = chineseVoice;
  utterance.lang = 'zh-CN';
  utterance.rate = 0.8; // Clear and paced
  
  utterance.onend = () => {
    state.isSpeaking = false;
    if (callback) callback();
  };
  utterance.onerror = () => {
    state.isSpeaking = false;
    if (callback) callback();
  };
  
  state.isSpeaking = true;
  speechSynthesis.speak(utterance);
}

// Initializing Web Speech Recognition
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Web Speech Recognition API is not supported in this browser.");
    return;
  }
  
  state.recognition = new SpeechRecognition();
  state.recognition.lang = 'zh-CN';
  state.recognition.interimResults = false;
  state.recognition.maxAlternatives = 1;
  
  state.recognition.onstart = () => {
    state.isListening = true;
    state.speechFeedbackText = "Listening for pronunciation...";
    state.speechFeedbackStatus = "neutral";
    updateSpeechUI();
  };
  
  state.recognition.onresult = (event) => {
    const result = event.results[0][0].transcript;
    const targetWord = document.getElementById('speechTargetChar').textContent.trim();
    
    // Clean string matches
    const cleanResult = result.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    const isMatch = cleanResult.includes(targetWord) || targetWord.includes(cleanResult);
    
    state.speechFeedbackText = `You said: "${result}"`;
    if (isMatch) {
      state.speechFeedbackStatus = "success";
      state.speechFeedbackText += ` — Perfect Match! 🎉`;
      sounds.playCorrect();
      // Reward user in SRS for perfect speech
      const currentWordId = document.getElementById('speechTargetWordId').value;
      if (currentWordId) {
        promoteSRSWord(currentWordId);
      }
    } else {
      state.speechFeedbackStatus = "error";
      state.speechFeedbackText += ` — Didn't quite match "${targetWord}". Try again!`;
      sounds.playWrong();
    }
  };
  
  state.recognition.onerror = (event) => {
    console.error("Speech Recognition Error:", event.error);
    if (event.error === 'no-speech') {
      state.speechFeedbackText = "No speech detected. Please speak clearly into your mic.";
    } else {
      state.speechFeedbackText = `Recognition error: ${event.error}`;
    }
    state.speechFeedbackStatus = "error";
    state.isListening = false;
    updateSpeechUI();
  };
  
  state.recognition.onend = () => {
    state.isListening = false;
    updateSpeechUI();
  };
}

function updateSpeechUI() {
  const micBtn = document.getElementById('pronounceMicBtn');
  const transcriptDiv = document.getElementById('speechTranscript');
  if (!micBtn || !transcriptDiv) return;
  
  if (state.isListening) {
    micBtn.classList.add('listening');
  } else {
    micBtn.classList.remove('listening');
  }
  
  transcriptDiv.textContent = state.speechFeedbackText;
  transcriptDiv.className = 'speech-transcript';
  
  const badge = document.getElementById('speechResultBadge');
  if (!badge) return;
  
  if (state.speechFeedbackStatus === 'success') {
    badge.textContent = 'Correct';
    badge.className = 'speech-result-badge badge-success';
  } else if (state.speechFeedbackStatus === 'error') {
    badge.textContent = 'Retry';
    badge.className = 'speech-result-badge badge-error';
  } else {
    badge.textContent = 'Ready';
    badge.className = 'speech-result-badge badge-neutral';
  }
}

// Speech recognition trigger
function toggleListening() {
  if (!state.recognition) {
    alert("Speech Recognition is not supported on this browser. We recommend using Google Chrome for the Pronunciation Lab.");
    return;
  }
  
  if (state.isListening) {
    state.recognition.stop();
  } else {
    state.recognition.start();
  }
}

// SRS Helper Engines
function promoteSRSWord(wordId) {
  const wordProg = state.progress[wordId];
  if (!wordProg) return;
  
  wordProg.learned = true;
  wordProg.srsLevel = Math.min(wordProg.srsLevel + 1, 5);
  const hours = SRS_INTERVALS[wordProg.srsLevel];
  wordProg.dueTime = Date.now() + hours * 60 * 60 * 1000;
  
  saveToLocalStorage();
  renderDashboard();
  renderDictionary();
}

function demoteSRSWord(wordId) {
  const wordProg = state.progress[wordId];
  if (!wordProg) return;
  
  wordProg.learned = true;
  wordProg.srsLevel = 1; // Reset back to initial reviewed level
  const hours = SRS_INTERVALS[1];
  wordProg.dueTime = Date.now() + hours * 60 * 60 * 1000;
  
  saveToLocalStorage();
  renderDashboard();
  renderDictionary();
}

// Navigation & Screen Control
function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Update Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Toggle Visibility of Sections
  document.querySelectorAll('.screen-section').forEach(sec => {
    if (sec.id === `${tabId}Section`) {
      sec.classList.add('active');
    } else {
      sec.classList.remove('active');
    }
  });
  
  // Specific screen setups
  if (tabId === 'dashboard') {
    renderDashboard();
  } else if (tabId === 'flashcards') {
    initFlashcards();
  } else if (tabId === 'practice') {
    startNewQuiz();
  } else if (tabId === 'stroke') {
    initStrokePractice();
  } else if (tabId === 'pronounce') {
    initPronounceLab();
  } else if (tabId === 'dictionary') {
    renderDictionary();
  }
}

// Level Change Trigger
function switchLevel(level) {
  state.currentLevel = parseInt(level, 10);
  document.querySelectorAll('.level-btn').forEach(btn => {
    if (parseInt(btn.getAttribute('data-level'), 10) === state.currentLevel) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update Header Progress Pill
  updateProgressPill();
  
  // Reload current screen content
  switchTab(state.activeTab);
}

// Progress metrics helper
function updateProgressPill() {
  const words = HSK_DATA[state.currentLevel] || [];
  let learnedCount = 0;
  words.forEach(w => {
    if (state.progress[w.id] && state.progress[w.id].srsLevel >= 4) { // level 4+ is Mastered/Learned
      learnedCount++;
    }
  });
  
  const textVal = document.getElementById('headerProgressVal');
  if (textVal) {
    textVal.textContent = `${learnedCount}/${words.length}`;
  }
}

function renderStreakUI() {
  const val = document.getElementById('headerStreakVal');
  if (val) {
    val.textContent = state.streak;
  }
}

// -------------------------------------------------------------
// View Renderers: 1. Dashboard
// -------------------------------------------------------------
function renderDashboard() {
  const words = HSK_DATA[state.currentLevel] || [];
  let totalWords = words.length;
  let masteredCount = 0;
  let inProgressCount = 0;
  let starredCount = 0;
  let srsDueCount = 0;
  
  words.forEach(w => {
    const prog = state.progress[w.id];
    if (prog) {
      if (prog.srsLevel >= 4) masteredCount++;
      else if (prog.srsLevel > 0) inProgressCount++;
      
      if (prog.starred) starredCount++;
      
      // SRS Review Due calculation
      if (prog.learned && prog.dueTime <= Date.now()) {
        srsDueCount++;
      }
    }
  });
  
  // Progress Circle animation
  const pct = totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;
  const pctText = document.getElementById('dashProgressPct');
  if (pctText) pctText.textContent = `${pct}%`;
  
  const circle = document.getElementById('dashProgressCircle');
  if (circle) {
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    const offset = circumference - (pct / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }
  
  // Stats Counters
  const totalWEl = document.getElementById('dashTotalWordsVal');
  if (totalWEl) totalWEl.textContent = totalWords;
  
  const learnedWEl = document.getElementById('dashLearnedWordsVal');
  if (learnedWEl) learnedWEl.textContent = masteredCount;
  
  const progressWEl = document.getElementById('dashProgressWordsVal');
  if (progressWEl) progressWEl.textContent = inProgressCount;
  
  const starredWEl = document.getElementById('dashStarredWordsVal');
  if (starredWEl) starredWEl.textContent = starredCount;
  
  // SRS Panel
  const dueCountEl = document.getElementById('srsDueCount');
  const reviewBtn = document.getElementById('srsReviewBtn');
  if (dueCountEl) dueCountEl.textContent = srsDueCount;
  
  if (reviewBtn) {
    if (srsDueCount > 0) {
      reviewBtn.disabled = false;
      reviewBtn.style.opacity = '1';
    } else {
      reviewBtn.disabled = true;
      reviewBtn.style.opacity = '0.5';
    }
  }
  
  // Render Dynamic Greeting Card
  const greetingEl = document.getElementById('dashGreeting');
  if (greetingEl) {
    const hours = new Date().getHours();
    let greetText = "Good morning";
    if (hours >= 12 && hours < 17) greetText = "Good afternoon";
    else if (hours >= 17) greetText = "Good evening";
    greetingEl.textContent = `${greetText}, Mandarin Scholar!`;
  }
}

// -------------------------------------------------------------
// View Renderers: 2. Flashcards
// -------------------------------------------------------------
let activeFlashcardList = [];

function initFlashcards() {
  const allWords = HSK_DATA[state.currentLevel] || [];
  // Review Mode checking
  if (state.activeTab === 'flashcards_review') {
    activeFlashcardList = allWords.filter(w => {
      const prog = state.progress[w.id];
      return prog && prog.learned && prog.dueTime <= Date.now();
    });
  } else {
    // Normal Learning Path: Filter out already fully mastered words to prioritize new/learning
    activeFlashcardList = allWords.filter(w => {
      const prog = state.progress[w.id];
      return !prog || prog.srsLevel < 4;
    });
    
    // Fallback: If all are mastered, load everything
    if (activeFlashcardList.length === 0) {
      activeFlashcardList = allWords;
    }
  }
  
  state.flashcardIndex = 0;
  state.flashcardFlipped = false;
  renderFlashcard();
}

function renderFlashcard() {
  const cardScene = document.getElementById('flashcardScene');
  const emptyState = document.getElementById('flashcardEmptyState');
  
  if (activeFlashcardList.length === 0) {
    if (cardScene) cardScene.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }
  
  if (cardScene) cardScene.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';
  
  const word = activeFlashcardList[state.flashcardIndex];
  const prog = state.progress[word.id] || {};
  
  // Front Elements
  const charEl = document.getElementById('cardChar');
  const levelBadge = document.getElementById('cardLevelBadge');
  const starBtn = document.getElementById('cardStarBtn');
  
  if (charEl) charEl.textContent = word.character;
  if (levelBadge) levelBadge.textContent = `HSK ${state.currentLevel}`;
  
  if (starBtn) {
    starBtn.className = prog.starred ? 'card-star-btn starred' : 'card-star-btn';
    starBtn.onclick = (e) => {
      e.stopPropagation(); // Avoid flipping the card when starring
      toggleStarWord(word.id);
    };
  }
  
  // Back Elements
  const pinyinEl = document.getElementById('cardPinyin');
  const posEl = document.getElementById('cardPos');
  const englishEl = document.getElementById('cardEnglish');
  const exCn = document.getElementById('cardExCn');
  const exPy = document.getElementById('cardExPy');
  const exEn = document.getElementById('cardExEn');
  
  if (pinyinEl) pinyinEl.textContent = word.pinyin;
  if (posEl) posEl.textContent = word.pos;
  if (englishEl) englishEl.textContent = word.english;
  if (exCn) exCn.textContent = word.exampleCn;
  if (exPy) exPy.textContent = word.examplePy;
  if (exEn) exEn.textContent = word.exampleEn;
  
  // Setup audio speech button on front & back
  const audioBtns = document.querySelectorAll('.audio-trigger-btn');
  audioBtns.forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      playTextToSpeech(word.character);
    };
  });
  
  // Reset flipped state
  const card = document.getElementById('flashcard');
  if (card) {
    card.classList.remove('flipped');
    state.flashcardFlipped = false;
  }
  
  // Update stats counts
  const currentCountEl = document.getElementById('cardCurrentIndex');
  const totalCountEl = document.getElementById('cardTotalCount');
  if (currentCountEl) currentCountEl.textContent = state.flashcardIndex + 1;
  if (totalCountEl) totalCountEl.textContent = activeFlashcardList.length;
}

function flipFlashcard() {
  const card = document.getElementById('flashcard');
  if (!card) return;
  
  sounds.playFlip();
  card.classList.toggle('flipped');
  state.flashcardFlipped = !state.flashcardFlipped;
}

function handleFlashcardAnswer(mastered) {
  const word = activeFlashcardList[state.flashcardIndex];
  if (!word) return;
  
  updateStreak(); // Track active learning days
  
  if (mastered) {
    promoteSRSWord(word.id);
  } else {
    demoteSRSWord(word.id);
  }
  
  // Move to next card
  if (state.flashcardIndex < activeFlashcardList.length - 1) {
    state.flashcardIndex++;
    renderFlashcard();
  } else {
    // End of cards pile
    alert("Fantastic job! You've reviewed this study session pack! 🎉");
    switchTab('dashboard');
  }
}

function toggleStarWord(wordId) {
  if (!state.progress[wordId]) return;
  state.progress[wordId].starred = !state.progress[wordId].starred;
  saveToLocalStorage();
  
  // Re-sync UI stars
  const starBtns = document.querySelectorAll(`[data-star-id="${wordId}"]`);
  starBtns.forEach(btn => {
    btn.classList.toggle('starred');
  });
  
  // Re-sync active flashcard star if visible
  const activeWord = activeFlashcardList[state.flashcardIndex];
  if (activeWord && activeWord.id === wordId) {
    const starBtn = document.getElementById('cardStarBtn');
    if (starBtn) {
      starBtn.className = state.progress[wordId].starred ? 'card-star-btn starred' : 'card-star-btn';
    }
  }
  
  renderDashboard();
}

// -------------------------------------------------------------
// View Renderers: 3. Practice Quiz
// -------------------------------------------------------------
function startNewQuiz() {
  const words = HSK_DATA[state.currentLevel] || [];
  if (words.length < 4) {
    alert("Not enough HSK vocabulary loaded to run a practice quiz.");
    return;
  }
  
  // Generate a random pool of 10 questions
  const shuffled = [...words].sort(() => 0.5 - Math.random());
  state.quizQuestions = shuffled.slice(0, 10).map(word => {
    const typeIndex = Math.floor(Math.random() * 4);
    // Types: 0: Character -> Select Meaning, 1: Character -> Select Pinyin, 2: Meaning -> Select Character, 3: Listening -> Select Character
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

function renderQuizQuestion() {
  const quizActiveCard = document.getElementById('quizActiveCard');
  const quizResultsCard = document.getElementById('quizResultsCard');
  if (!quizActiveCard || !quizResultsCard) return;
  
  quizActiveCard.style.display = 'block';
  quizResultsCard.style.display = 'none';
  
  const currentQ = state.quizQuestions[state.quizIndex];
  const word = currentQ.word;
  
  // Progress Bar
  const qNum = document.getElementById('quizQNum');
  const qTotal = document.getElementById('quizQTotal');
  const progBar = document.getElementById('quizProgressBar');
  if (qNum) qNum.textContent = state.quizIndex + 1;
  if (qTotal) qTotal.textContent = state.quizQuestions.length;
  if (progBar) {
    progBar.style.width = `${((state.quizIndex) / state.quizQuestions.length) * 100}%`;
  }
  
  // Clear layout variables
  const qType = document.getElementById('quizQType');
  const qMain = document.getElementById('quizQMain');
  const qText = document.getElementById('quizQText');
  const qAudioBtn = document.getElementById('quizAudioBtn');
  
  // Audio playback for listening question
  if (currentQ.type === 'listening') {
    qType.textContent = "Listening practice";
    qMain.style.display = 'none';
    qText.style.display = 'block';
    qText.textContent = "Listen and select the matching characters:";
    qAudioBtn.style.display = 'flex';
    
    // Automatically speak the word
    setTimeout(() => { playTextToSpeech(word.character); }, 300);
    qAudioBtn.onclick = () => playTextToSpeech(word.character);
  } else if (currentQ.type === 'pinyin') {
    qType.textContent = "Identify the pinyin pronunciation";
    qMain.style.display = 'block';
    qMain.textContent = word.character;
    qText.style.display = 'none';
    qAudioBtn.style.display = 'none';
  } else if (currentQ.type === 'meaning') {
    qType.textContent = "Identify the meaning of the characters";
    qMain.style.display = 'block';
    qMain.textContent = word.character;
    qText.style.display = 'none';
    qAudioBtn.style.display = 'none';
  } else {
    // English -> Characters
    qType.textContent = "Translate the English term to Hanzi";
    qMain.style.display = 'none';
    qText.style.display = 'block';
    qText.textContent = `"${word.english}"`;
    qAudioBtn.style.display = 'none';
  }
  
  // Generate options (1 correct, 3 wrong distractors)
  const distractors = (HSK_DATA[state.currentLevel] || [])
    .filter(w => w.id !== word.id)
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);
  
  const rawOptions = [word, ...distractors].sort(() => 0.5 - Math.random());
  
  const optionsGrid = document.getElementById('quizOptionsGrid');
  if (!optionsGrid) return;
  optionsGrid.innerHTML = '';
  
  rawOptions.forEach((opt, idx) => {
    let text = '';
    if (currentQ.type === 'meaning') {
      text = opt.english;
    } else if (currentQ.type === 'pinyin') {
      text = opt.pinyin;
    } else {
      // character or listening quiz wants characters as choices
      text = opt.character;
    }
    
    const letter = String.fromCharCode(65 + idx); // A, B, C, D
    const button = document.createElement('button');
    button.className = 'option-btn';
    button.innerHTML = `
      <span class="option-badge">${letter}</span>
      <span class="option-txt">${text}</span>
    `;
    button.onclick = () => selectQuizOption(button, opt.id === word.id, word.id);
    optionsGrid.appendChild(button);
  });
  
  state.quizSelectedOption = null;
}

function selectQuizOption(btn, isCorrect, targetWordId) {
  if (state.quizSelectedOption !== null) return; // Prevent double clicks
  
  state.quizSelectedOption = btn;
  updateStreak(); // studied day logged
  
  // Disable all options
  document.querySelectorAll('.option-btn').forEach(b => {
    b.disabled = true;
    if (b !== btn) b.classList.add('dimmed');
  });
  
  if (isCorrect) {
    btn.classList.add('correct');
    sounds.playCorrect();
    state.quizScore++;
    state.quizAnswersHistory.push({ wordId: targetWordId, correct: true });
  } else {
    btn.classList.add('wrong');
    sounds.playWrong();
    state.quizAnswersHistory.push({ wordId: targetWordId, correct: false });
    
    // Highlight correct option
    document.querySelectorAll('.option-btn').forEach(b => {
      const textSpan = b.querySelector('.option-txt');
      const targetWord = (HSK_DATA[state.currentLevel] || []).find(w => w.id === targetWordId);
      const currentQ = state.quizQuestions[state.quizIndex];
      
      let correctText = '';
      if (currentQ.type === 'meaning') correctText = targetWord.english;
      else if (currentQ.type === 'pinyin') correctText = targetWord.pinyin;
      else correctText = targetWord.character;
      
      if (textSpan && textSpan.textContent === correctText) {
        b.classList.remove('dimmed');
        b.classList.add('correct');
      }
    });
  }
  
  // Proceed to next screen after short delay
  setTimeout(() => {
    if (state.quizIndex < state.quizQuestions.length - 1) {
      state.quizIndex++;
      renderQuizQuestion();
    } else {
      endQuizSession();
    }
  }, 1400);
}

function endQuizSession() {
  const quizActiveCard = document.getElementById('quizActiveCard');
  const quizResultsCard = document.getElementById('quizResultsCard');
  if (!quizActiveCard || !quizResultsCard) return;
  
  quizActiveCard.style.display = 'none';
  quizResultsCard.style.display = 'flex';
  
  // Progress bar to full
  const progBar = document.getElementById('quizProgressBar');
  if (progBar) progBar.style.width = '100%';
  
  // Render score details
  const scoreNum = document.getElementById('quizResultsScore');
  const scoreEmoji = document.getElementById('quizResultsEmoji');
  const scoreHeading = document.getElementById('quizResultsHeading');
  
  if (scoreNum) scoreNum.textContent = state.quizScore;
  
  const scorePercentage = (state.quizScore / state.quizQuestions.length) * 100;
  if (scorePercentage >= 90) {
    if (scoreEmoji) scoreEmoji.textContent = '🏆';
    if (scoreHeading) scoreHeading.textContent = 'Exceptional Job!';
  } else if (scorePercentage >= 70) {
    if (scoreEmoji) scoreEmoji.textContent = '🌟';
    if (scoreHeading) scoreHeading.textContent = 'Great Effort!';
  } else {
    if (scoreEmoji) scoreEmoji.textContent = '💪';
    if (scoreHeading) scoreHeading.textContent = 'Keep Practicing!';
  }
  
  // Commit Quiz results to SRS scheduling
  state.quizAnswersHistory.forEach(item => {
    if (item.correct) {
      promoteSRSWord(item.wordId);
    } else {
      demoteSRSWord(item.wordId);
    }
  });
}

// -------------------------------------------------------------
// View Renderers: 4. Stroke Writing Canvas
// -------------------------------------------------------------
let strokeWordList = [];
let strokeWordIndex = 0;
let canvasHelper = null;

function initStrokePractice() {
  strokeWordList = HSK_DATA[state.currentLevel] || [];
  strokeWordIndex = 0;
  
  if (!canvasHelper) {
    canvasHelper = new WritingCanvas('strokeCanvas', 'strokeCharGuideBg');
  }
  
  renderStrokeWord();
}

function renderStrokeWord() {
  if (strokeWordList.length === 0 || !canvasHelper) return;
  
  const word = strokeWordList[strokeWordIndex];
  
  // Render writing navigation header details
  const charEl = document.getElementById('strokeTargetChar');
  const pinEl = document.getElementById('strokeTargetPy');
  const engEl = document.getElementById('strokeTargetEn');
  const currEl = document.getElementById('strokeCurrentIndex');
  const totEl = document.getElementById('strokeTotalCount');
  
  if (charEl) charEl.textContent = word.character;
  if (pinEl) pinEl.textContent = word.pinyin;
  if (engEl) engEl.textContent = word.english;
  if (currEl) currEl.textContent = strokeWordIndex + 1;
  if (totEl) totEl.textContent = strokeWordList.length;
  
  // Configure canvas
  canvasHelper.clear();
  // Draw primary character helper guide
  canvasHelper.setGuideChar(word.character);
  
  // Autoplay voice
  setTimeout(() => { playTextToSpeech(word.character); }, 200);
}

function handleStrokePrev() {
  if (strokeWordIndex > 0) {
    strokeWordIndex--;
    renderStrokeWord();
  }
}

function handleStrokeNext() {
  if (strokeWordIndex < strokeWordList.length - 1) {
    strokeWordIndex++;
    renderStrokeWord();
  }
}

function clearStrokeCanvas() {
  if (canvasHelper) canvasHelper.clear();
}

function toggleStrokeGuide(btn) {
  const isVisible = btn.classList.contains('active-toggle');
  if (isVisible) {
    btn.classList.remove('active-toggle');
    if (canvasHelper) canvasHelper.toggleGuide(false);
  } else {
    btn.classList.add('active-toggle');
    if (canvasHelper) canvasHelper.toggleGuide(true);
  }
}

// -------------------------------------------------------------
// View Renderers: 5. Pronunciation Speech Lab
// -------------------------------------------------------------
let pronounceWordList = [];
let pronounceIndex = 0;

function initPronounceLab() {
  pronounceWordList = HSK_DATA[state.currentLevel] || [];
  pronounceIndex = 0;
  
  // Reset speech states
  state.isListening = false;
  state.speechFeedbackText = 'Press the microphone and say the characters aloud.';
  state.speechFeedbackStatus = 'neutral';
  
  if (!state.recognition) {
    setupSpeechRecognition();
  }
  
  renderPronounceWord();
}

function renderPronounceWord() {
  if (pronounceWordList.length === 0) return;
  const word = pronounceWordList[pronounceIndex];
  
  const charEl = document.getElementById('speechTargetChar');
  const pinEl = document.getElementById('speechTargetPy');
  const engEl = document.getElementById('speechTargetEn');
  const idEl = document.getElementById('speechTargetWordId');
  const numEl = document.getElementById('speechCurrentIndex');
  const totEl = document.getElementById('speechTotalCount');
  
  if (charEl) charEl.textContent = word.character;
  if (pinEl) pinEl.textContent = word.pinyin;
  if (engEl) engEl.textContent = word.english;
  if (idEl) idEl.value = word.id;
  if (numEl) numEl.textContent = pronounceIndex + 1;
  if (totEl) totEl.textContent = pronounceWordList.length;
  
  // Play TTS
  setTimeout(() => { playTextToSpeech(word.character); }, 300);
  
  // Reset status cards
  state.speechFeedbackText = 'Press the microphone and say the characters aloud.';
  state.speechFeedbackStatus = 'neutral';
  updateSpeechUI();
}

function playPronounceTarget() {
  const word = pronounceWordList[pronounceIndex];
  if (word) playTextToSpeech(word.character);
}

function handlePronouncePrev() {
  if (pronounceIndex > 0) {
    pronounceIndex--;
    renderPronounceWord();
  }
}

function handlePronounceNext() {
  if (pronounceIndex < pronounceWordList.length - 1) {
    pronounceIndex++;
    renderPronounceWord();
  }
}

// -------------------------------------------------------------
// View Renderers: 6. Dictionary & Popup Detail Modals
// -------------------------------------------------------------
function renderDictionary() {
  const vocabGrid = document.getElementById('vocabGrid');
  if (!vocabGrid) return;
  vocabGrid.innerHTML = '';
  
  const words = HSK_DATA[state.currentLevel] || [];
  
  // Apply Search and Star filters
  const filtered = words.filter(word => {
    const prog = state.progress[word.id] || {};
    
    // Star and SRS type filters
    if (state.vocabFilter === 'starred' && !prog.starred) return false;
    if (state.vocabFilter === 'learned' && prog.srsLevel < 4) return false;
    if (state.vocabFilter === 'due' && (!prog.learned || prog.dueTime > Date.now())) return false;
    
    // Text search query filter
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      const matchChar = word.character.includes(query);
      const matchPin = word.pinyin.toLowerCase().includes(query);
      const matchEng = word.english.toLowerCase().includes(query);
      return matchChar || matchPin || matchEng;
    }
    
    return true;
  });
  
  if (filtered.length === 0) {
    vocabGrid.innerHTML = `
      <div class="empty-state">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <p>No words found matching the active filters.</p>
      </div>
    `;
    return;
  }
  
  filtered.forEach(word => {
    const prog = state.progress[word.id] || {};
    const card = document.createElement('div');
    card.className = 'vocab-card';
    card.onclick = () => openWordDetails(word);
    
    const starClass = prog.starred ? 'star-btn starred' : 'star-btn';
    const masteredBadge = prog.srsLevel >= 4 ? '<span class="vocab-badge mastered">Mastered</span>' : '';
    const learningBadge = (prog.srsLevel > 0 && prog.srsLevel < 4) ? '<span class="vocab-badge">Learning</span>' : '';
    
    card.innerHTML = `
      <button class="${starClass}" data-star-id="${word.id}" onclick="event.stopPropagation(); toggleStarWord('${word.id}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </button>
      <div class="vocab-char">${word.character}</div>
      <div class="vocab-pinyin">${word.pinyin}</div>
      <div class="vocab-meaning">${word.english}</div>
      <div class="vocab-badges">
        <span class="vocab-badge">HSK ${state.currentLevel}</span>
        ${masteredBadge}
        ${learningBadge}
      </div>
    `;
    vocabGrid.appendChild(card);
  });
}

function handleDictFilterChange(btn, filterType) {
  state.vocabFilter = filterType;
  document.querySelectorAll('.filter-btn').forEach(b => {
    if (b === btn) b.classList.add('active');
    else b.classList.remove('active');
  });
  renderDictionary();
}

function handleDictSearch(e) {
  state.searchQuery = e.target.value;
  renderDictionary();
}

// Word Detail Modal Manager
let modalCanvasHelper = null;
function openWordDetails(word) {
  const modal = document.getElementById('wordDetailModal');
  if (!modal) return;
  
  const prog = state.progress[word.id] || {};
  
  // Fill text fields
  document.getElementById('modalChar').textContent = word.character;
  document.getElementById('modalPinyin').textContent = word.pinyin;
  document.getElementById('modalPos').textContent = word.pos;
  document.getElementById('modalEnglish').textContent = word.english;
  document.getElementById('modalExCn').textContent = word.exampleCn;
  document.getElementById('modalExPy').textContent = word.examplePy;
  document.getElementById('modalExEn').textContent = word.exampleEn;
  
  // Speaker Play
  const playBtn = document.getElementById('modalAudioBtn');
  if (playBtn) {
    playBtn.onclick = () => playTextToSpeech(word.character);
  }
  
  // Star button
  const starBtn = document.getElementById('modalStarBtn');
  if (starBtn) {
    starBtn.className = prog.starred ? 'card-star-btn starred' : 'card-star-btn';
    starBtn.onclick = () => {
      toggleStarWord(word.id);
      starBtn.className = state.progress[word.id].starred ? 'card-star-btn starred' : 'card-star-btn';
    };
  }
  
  // HTML Dialog element trigger
  modal.showModal();
  
  // Initialize canvas pad inside modal
  setTimeout(() => {
    if (!modalCanvasHelper) {
      modalCanvasHelper = new WritingCanvas('modalStrokeCanvas', 'modalStrokeCharGuideBg');
    }
    modalCanvasHelper.clear();
    modalCanvasHelper.setGuideChar(word.character);
  }, 100);
}

function closeWordDetails() {
  const modal = document.getElementById('wordDetailModal');
  if (modal) modal.close();
}

function clearModalCanvas() {
  if (modalCanvasHelper) modalCanvasHelper.clear();
}

function toggleModalStrokeGuide(btn) {
  const isVisible = btn.classList.contains('active-toggle');
  if (isVisible) {
    btn.classList.remove('active-toggle');
    if (modalCanvasHelper) modalCanvasHelper.toggleGuide(false);
  } else {
    btn.classList.add('active-toggle');
    if (modalCanvasHelper) modalCanvasHelper.toggleGuide(true);
  }
}

// -------------------------------------------------------------
// Floating Character Particles Background
// -------------------------------------------------------------
const BACKGROUND_HANZI = ["学", "文", "语", "汉", "中", "国", "师", "生", "书", "听", "说", "读", "写", "德", "福", "爱", "春", "夏", "秋", "冬"];
function setupFloatingBackground() {
  const container = document.getElementById('hanziBgContainer');
  if (!container) return;
  
  const width = window.innerWidth;
  // Spawn 15 floating particles
  for (let i = 0; i < 15; i++) {
    const char = BACKGROUND_HANZI[Math.floor(Math.random() * BACKGROUND_HANZI.length)];
    const el = document.createElement('div');
    el.className = 'floating-hanzi';
    el.textContent = char;
    
    // Random position and timing parameters
    el.style.left = `${Math.random() * 100}vw`;
    el.style.fontSize = `${Math.random() * 4 + 3}rem`;
    el.style.animationDelay = `${Math.random() * 20}s`;
    el.style.animationDuration = `${Math.random() * 15 + 15}s`;
    
    container.appendChild(el);
  }
}

// Startup trigger
window.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  setupFloatingBackground();
  updateProgressPill();
  renderStreakUI();
  
  // Dashboard default
  switchTab('dashboard');
});
