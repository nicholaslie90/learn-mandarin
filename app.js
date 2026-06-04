// HSK Sensei - Client Logic & State Management

// Web Speech API Voice Selection helper
let chineseVoice = null;
let allChineseVoices = [];
let selectedVoiceURI = localStorage.getItem('hsk_sensei_voice_uri') || '';

function loadChineseVoices() {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  
  // Filter for Chinese, Hong Kong, Taiwan, or Chinese-adjacent voices
  allChineseVoices = voices.filter(v => 
    v.lang.includes('zh') || 
    v.lang.includes('ZH') || 
    v.lang.includes('Chinese')
  );
  
  // Populate dropdown UI
  const select = document.getElementById('ttsVoiceSelect');
  if (select) {
    select.innerHTML = '<option value="">Default Chinese Voice</option>';
    allChineseVoices.forEach(v => {
      const option = document.createElement('option');
      option.value = v.voiceURI;
      option.textContent = `${v.name} (${v.lang})`;
      if (v.voiceURI === selectedVoiceURI) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }
  
  updateSelectedVoice();
}

function updateSelectedVoice() {
  if (allChineseVoices.length === 0) return;
  
  let voice = allChineseVoices.find(v => v.voiceURI === selectedVoiceURI);
  if (!voice) {
    // Fallback: look for zh-CN, or just use the first Chinese voice
    voice = allChineseVoices.find(v => v.lang.includes('zh-CN') || v.lang.includes('zh_CN')) || 
            allChineseVoices.find(v => v.lang.startsWith('zh-')) ||
            allChineseVoices[0];
  }
  chineseVoice = voice;
}

function handleVoiceChange(event) {
  selectedVoiceURI = event.target.value;
  localStorage.setItem('hsk_sensei_voice_uri', selectedVoiceURI);
  updateSelectedVoice();
  
  // Audio chime or quick speech test
  playTextToSpeech("中文");
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = loadChineseVoices;
  loadChineseVoices();
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
// HanziWriter Integration Manager
class HanziWriterManager {
  constructor(containerId, size) {
    this.containerId = containerId;
    this.size = size;
    this.writer = null;
    this.character = '';
    this.showOutlineState = true;
  }
  
  setCharacter(char) {
    this.character = char;
    const container = document.getElementById(this.containerId);
    if (!container) return;
    container.innerHTML = ''; // Clear previous SVG if any
    
    // Check if HanziWriter is loaded, if not show loading state
    if (typeof HanziWriter === 'undefined') {
      container.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding-top:45%;">Loading writing engine...</div>';
      return;
    }
    
    this.writer = HanziWriter.create(this.containerId, char, {
      width: this.size,
      height: this.size,
      padding: 15,
      showOutline: this.showOutlineState,
      strokeColor: '#00f2fe',
      outlineColor: 'rgba(255, 255, 255, 0.08)',
      drawingColor: '#ff0080',
      drawingWidth: 6,
      strokeAnimationSpeed: 1.2,
      delayBetweenStrokes: 350
    });
    
    // Automatically start tracing practice mode
    this.writer.quiz();
  }
  
  animate() {
    if (this.writer) {
      this.writer.animateCharacter();
    }
  }
  
  practice() {
    if (this.writer) {
      this.writer.quiz();
    }
  }
  
  toggleOutline(btn) {
    if (!this.writer) return;
    this.showOutlineState = !this.showOutlineState;
    if (this.showOutlineState) {
      this.writer.showOutline();
      btn.classList.add('active-toggle');
    } else {
      this.writer.hideOutline();
      btn.classList.remove('active-toggle');
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

  // Reading Lab state
  showEssayPinyin: false,
  showEssayTranslation: false,
  essayQuizAnswers: {}, // questionIndex -> selectedOptionIndex
  essayQuizGraded: false,
  currentEssayIndex: 0,
};

// Spaced Repetition Intervals (in hours)
const SRS_INTERVALS = [0, 4, 12, 24, 72, 168]; // Level 0 (new) to 5 (fully mastered)

// IndexedDB Database Wrapper for browser persistence
class ProgressDB {
  constructor() {
    this.dbName = 'HSKSenseiDB';
    this.dbVersion = 1;
    this.storeName = 'progressStore';
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = (e) => reject(e.target.error);
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  get(key) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      request.onerror = (e) => reject(e.target.error);
      request.onsuccess = (e) => resolve(request.result);
    });
  }

  set(key, value) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(value, key);
      request.onerror = (e) => reject(e.target.error);
      request.onsuccess = (e) => resolve(request.result);
    });
  }
}

const db = new ProgressDB();

async function saveProgressToDB() {
  try {
    if (!db.db) await db.init();
    await db.set('progress', state.progress);
    await db.set('streak', state.streak);
    await db.set('lastStudyDate', state.lastStudyDate);
    
    // Backup unlocked extra card IDs
    const stored = localStorage.getItem('hsk_sensei_unlocked_extra_ids');
    if (stored) {
      await db.set('unlockedExtraIds', JSON.parse(stored));
    }
  } catch (error) {
    console.error("Failed to save progress to IndexedDB:", error);
    
    // Resilient fallback: use LocalStorage if database fails (e.g. private mode)
    localStorage.setItem('hsk_sensei_progress', JSON.stringify(state.progress));
    localStorage.setItem('hsk_sensei_streak', state.streak.toString());
    localStorage.setItem('hsk_sensei_last_study', state.lastStudyDate);
  }
}

function saveToLocalStorage() {
  saveProgressToDB();
}

async function loadProgressFromDB() {
  try {
    await db.init();
    
    // Fetch values from IndexedDB
    const progress = await db.get('progress');
    const streak = await db.get('streak');
    const lastStudyDate = await db.get('lastStudyDate');
    const unlockedExtraIds = await db.get('unlockedExtraIds');
    
    if (progress) {
      state.progress = progress;
    } else {
      // Migrate legacy localStorage progress if present
      const localProg = localStorage.getItem('hsk_sensei_progress');
      if (localProg) state.progress = JSON.parse(localProg);
    }
    
    if (streak !== undefined) {
      state.streak = parseInt(streak, 10) || 0;
    } else {
      const localStreak = localStorage.getItem('hsk_sensei_streak');
      if (localStreak) state.streak = parseInt(localStreak, 10) || 0;
    }
    
    if (lastStudyDate) {
      state.lastStudyDate = lastStudyDate;
    } else {
      const localDate = localStorage.getItem('hsk_sensei_last_study');
      if (localDate) state.lastStudyDate = localDate;
    }
    
    let unlockedIds = [];
    if (unlockedExtraIds) {
      unlockedIds = unlockedExtraIds;
    } else {
      const stored = localStorage.getItem('hsk_sensei_unlocked_extra_ids');
      if (stored) {
        unlockedIds = JSON.parse(stored);
        await db.set('unlockedExtraIds', unlockedIds);
      }
    }
    
    const unlockedIdsSet = new Set(unlockedIds);
    for (const level in EXTRA_HSK_DATA) {
      const extraList = EXTRA_HSK_DATA[level];
      if (extraList) {
        extraList.forEach(word => {
          if (unlockedIdsSet.has(word.id)) {
            const currentWords = HSK_DATA[level] || [];
            if (!currentWords.some(w => w.id === word.id)) {
              HSK_DATA[level].push(word);
            }
          }
        });
      }
    }
    
    // Auto-initialize progress slots for missing words
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
    
    await saveProgressToDB();
  } catch (error) {
    console.error("Failed to load progress from IndexedDB, falling back to LocalStorage:", error);
    
    // Resilient fallback: read from LocalStorage
    const localProg = localStorage.getItem('hsk_sensei_progress');
    if (localProg) state.progress = JSON.parse(localProg);
    const localStreak = localStorage.getItem('hsk_sensei_streak');
    if (localStreak) state.streak = parseInt(localStreak, 10) || 0;
    const localDate = localStorage.getItem('hsk_sensei_last_study');
    if (localDate) state.lastStudyDate = localDate;
    
    const stored = localStorage.getItem('hsk_sensei_unlocked_extra_ids');
    if (stored) {
      const unlockedIdsSet = new Set(JSON.parse(stored));
      for (const level in EXTRA_HSK_DATA) {
        const extraList = EXTRA_HSK_DATA[level];
        if (extraList) {
          extraList.forEach(word => {
            if (unlockedIdsSet.has(word.id)) {
              const currentWords = HSK_DATA[level] || [];
              if (!currentWords.some(w => w.id === word.id)) {
                HSK_DATA[level].push(word);
              }
            }
          });
        }
      }
    }
    
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
  }
}

function loadFromLocalStorage() {
  loadProgressFromDB();
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
  } else if (tabId === 'reading') {
    renderEssay();
  }
}

// Level Change Trigger
function switchLevel(level) {
  state.currentLevel = parseInt(level, 10);
  state.currentEssayIndex = 0; // Reset essay index when switching level
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
  
  if (pinyinEl) {
    pinyinEl.textContent = word.pinyin;
    pinyinEl.style.display = 'none';
  }
  
  const cardPinyinToggle = document.getElementById('cardPinyinToggle');
  if (cardPinyinToggle) {
    cardPinyinToggle.style.display = '';
  }
  
  if (posEl) posEl.textContent = word.pos;
  if (englishEl) englishEl.textContent = word.english;
  if (exCn) exCn.textContent = word.exampleCn;
  if (exPy) exPy.textContent = word.examplePy;
  if (exEn) exEn.textContent = word.exampleEn;
  
  // Setup audio speech button on front & back
  const frontAudioBtn = document.querySelector('#flashcardsSection .card-front .audio-trigger-btn');
  if (frontAudioBtn) {
    frontAudioBtn.onclick = (e) => {
      e.stopPropagation();
      playTextToSpeech(word.character);
    };
  }

  const backAudioBtn = document.querySelector('#flashcardsSection .card-back .audio-trigger-btn');
  if (backAudioBtn) {
    backAudioBtn.onclick = (e) => {
      e.stopPropagation();
      playTextToSpeech(word.exampleCn);
    };
  }
  
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
    const card = document.getElementById('flashcard');
    if (card) {
      card.classList.add('no-transition');
      card.classList.remove('flipped');
      state.flashcardFlipped = false;
      void card.offsetHeight; // Force reflow
    }
    
    state.flashcardIndex++;
    renderFlashcard();
    
    // Re-enable transition after snap
    setTimeout(() => {
      if (card) card.classList.remove('no-transition');
    }, 50);
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
  
  // Calculate target canvas size based on mobile viewport width dynamically
  const targetSize = Math.min(320, window.innerWidth - 48);
  const container = document.getElementById('strokeWriterContainer');
  if (container) {
    container.style.width = `${targetSize}px`;
    container.style.height = `${targetSize}px`;
    const card = container.closest('.canvas-card');
    if (card) {
      card.style.width = `${targetSize}px`;
      card.style.height = `${targetSize}px`;
    }
  }
  
  canvasHelper = new HanziWriterManager('strokeWriterContainer', targetSize);
  
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
  
  // Extract Chinese characters only
  const chars = [...word.character].filter(c => /[\u4e00-\u9fa5]/.test(c));
  const selector = document.getElementById('strokeCharSelector');
  
  if (chars.length > 1) {
    if (selector) {
      selector.innerHTML = '';
      selector.style.display = 'flex';
      chars.forEach((char, idx) => {
        const btn = document.createElement('button');
        btn.className = 'char-selector-btn';
        if (idx === 0) btn.classList.add('active');
        btn.textContent = char;
        btn.onclick = () => {
          selector.querySelectorAll('.char-selector-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          canvasHelper.setCharacter(char);
        };
        selector.appendChild(btn);
      });
    }
    canvasHelper.setCharacter(chars[0]);
  } else {
    if (selector) {
      selector.style.display = 'none';
    }
    canvasHelper.setCharacter(word.character);
  }
  
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

function animateStroke() {
  if (canvasHelper) canvasHelper.animate();
}

function restartPractice() {
  if (canvasHelper) canvasHelper.practice();
}

function toggleStrokeGuide(btn) {
  if (canvasHelper) canvasHelper.toggleOutline(btn);
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

  const playExBtn = document.getElementById('modalExAudioBtn');
  if (playExBtn) {
    playExBtn.onclick = () => playTextToSpeech(word.exampleCn);
  }
  
  // Star button
  const starBtn = document.getElementById('modalStarBtn');
  if (starBtn) {
    if (word.id.startsWith('mock_')) {
      starBtn.style.display = 'none';
    } else {
      starBtn.style.display = '';
      starBtn.className = prog.starred ? 'card-star-btn starred' : 'card-star-btn';
      starBtn.onclick = () => {
        toggleStarWord(word.id);
        starBtn.className = state.progress[word.id].starred ? 'card-star-btn starred' : 'card-star-btn';
      };
    }
  }
  
  // HTML Dialog element trigger
  modal.showModal();
  
  // Initialize canvas pad inside modal
  setTimeout(() => {
    if (!modalCanvasHelper) {
      modalCanvasHelper = new HanziWriterManager('modalStrokeWriterContainer', 200);
    }
    
    // Extract Chinese characters only
    const chars = [...word.character].filter(c => /[\u4e00-\u9fa5]/.test(c));
    const selector = document.getElementById('modalStrokeCharSelector');
    
    if (chars.length > 1) {
      if (selector) {
        selector.innerHTML = '';
        selector.style.display = 'flex';
        chars.forEach((char, idx) => {
          const btn = document.createElement('button');
          btn.className = 'char-selector-btn';
          if (idx === 0) btn.classList.add('active');
          btn.textContent = char;
          btn.onclick = () => {
            selector.querySelectorAll('.char-selector-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            modalCanvasHelper.setCharacter(char);
          };
          selector.appendChild(btn);
        });
      }
      modalCanvasHelper.setCharacter(chars[0]);
    } else {
      if (selector) {
        selector.style.display = 'none';
      }
      modalCanvasHelper.setCharacter(word.character);
    }
  }, 100);
}

function closeWordDetails() {
  const modal = document.getElementById('wordDetailModal');
  if (modal) modal.close();
}

function animateModalStroke() {
  if (modalCanvasHelper) modalCanvasHelper.animate();
}

function restartModalPractice() {
  if (modalCanvasHelper) modalCanvasHelper.practice();
}

function toggleModalStrokeGuide(btn) {
  if (modalCanvasHelper) modalCanvasHelper.toggleOutline(btn);
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

// -------------------------------------------------------------
// View Renderers: 7. Reading Lab Controller
// -------------------------------------------------------------
function isChineseChar(c) {
  return /[\u4e00-\u9fa5]/.test(c);
}

function renderEssay() {
  const essays = HSK_ESSAYS[state.currentLevel];
  const textContentEl = document.getElementById('essayTextContent');
  if (!textContentEl) return;
  
  if (!essays || essays.length === 0) {
    textContentEl.innerHTML = `
      <div class="empty-state">
        <p>No essays available for HSK Level ${state.currentLevel}.</p>
      </div>
    `;
    return;
  }
  
  if (state.currentEssayIndex === undefined || state.currentEssayIndex >= essays.length) {
    state.currentEssayIndex = 0;
  }
  const essay = essays[state.currentEssayIndex];
  
  // Set Title and Description
  const titleCnEl = document.getElementById('essayTitleCn');
  const titleEnEl = document.getElementById('essayTitleEn');
  if (titleCnEl) titleCnEl.textContent = essay.titleCn;
  if (titleEnEl) titleEnEl.textContent = essay.titleEn;
  
  // Clear container
  textContentEl.innerHTML = '';
  
  const parasCn = essay.contentCn.split('\n');
  const parasPy = essay.contentPy.split('\n');
  const parasEn = essay.contentEn.split('\n');
  
  for (let i = 0; i < parasCn.length; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'essay-para-wrapper';
    
    // Hanzi characters section
    const cnDiv = document.createElement('div');
    cnDiv.className = 'essay-cn-text';
    
    let htmlCn = '';
    for (const char of parasCn[i]) {
      if (isChineseChar(char)) {
        htmlCn += `<span class="essay-word" onclick="handleEssayWordClick('${char}')">${char}</span>`;
      } else {
        htmlCn += char;
      }
    }
    cnDiv.innerHTML = htmlCn;
    wrapper.appendChild(cnDiv);
    
    // Pinyin section
    if (parasPy[i]) {
      const pyDiv = document.createElement('div');
      pyDiv.className = 'essay-py-text';
      pyDiv.textContent = parasPy[i];
      wrapper.appendChild(pyDiv);
    }
    
    // Translation section
    if (parasEn[i]) {
      const enDiv = document.createElement('div');
      enDiv.className = 'essay-en-text';
      enDiv.textContent = parasEn[i];
      wrapper.appendChild(enDiv);
    }
    
    textContentEl.appendChild(wrapper);
  }
  
  // Sync state visibility
  updateEssayVisibility();
  
  // Listen Button
  const audioBtn = document.getElementById('essayAudioBtn');
  if (audioBtn) {
    audioBtn.onclick = () => playTextToSpeech(essay.contentCn);
  }
  
  // Reset Quiz State
  state.essayQuizAnswers = {};
  state.essayQuizGraded = false;
  
  const feedback = document.getElementById('essayQuizFeedback');
  if (feedback) feedback.style.display = 'none';
  
  const submitBtn = document.getElementById('submitEssayQuizBtn');
  if (submitBtn) {
    submitBtn.textContent = 'Submit Answers';
    submitBtn.disabled = false;
  }
  
  // Render questions
  renderEssayQuestions(essay);
}

function handleEssayWordClick(char) {
  let foundWord = null;
  for (const level in HSK_DATA) {
    const list = HSK_DATA[level];
    const match = list.find(w => w.character === char);
    if (match) {
      foundWord = match;
      break;
    }
  }
  
  if (!foundWord) {
    foundWord = {
      id: `mock_${char}`,
      character: char,
      pinyin: "Lookup...",
      english: "Character from reading essay",
      pos: "Character",
      exampleCn: char,
      examplePy: "",
      exampleEn: ""
    };
  }
  
  openWordDetails(foundWord);
}

function toggleEssayPinyin(btn) {
  state.showEssayPinyin = !state.showEssayPinyin;
  if (state.showEssayPinyin) {
    btn.classList.add('active-toggle');
  } else {
    btn.classList.remove('active-toggle');
  }
  updateEssayVisibility();
}

function toggleEssayTranslation(btn) {
  state.showEssayTranslation = !state.showEssayTranslation;
  if (state.showEssayTranslation) {
    btn.classList.add('active-toggle');
  } else {
    btn.classList.remove('active-toggle');
  }
  updateEssayVisibility();
}

function updateEssayVisibility() {
  document.querySelectorAll('.essay-py-text').forEach(el => {
    el.style.display = state.showEssayPinyin ? 'block' : 'none';
  });
  document.querySelectorAll('.essay-en-text').forEach(el => {
    el.style.display = state.showEssayTranslation ? 'block' : 'none';
  });
}

function renderEssayQuestions(essay) {
  const qList = document.getElementById('essayQuestionsList');
  if (!qList) return;
  qList.innerHTML = '';
  
  essay.questions.forEach((qObj, qIdx) => {
    const card = document.createElement('div');
    card.className = 'essay-q-card';
    
    const qTitle = document.createElement('div');
    qTitle.className = 'essay-q-title';
    qTitle.textContent = `${qIdx + 1}. ${qObj.q}`;
    card.appendChild(qTitle);
    
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'essay-options-container';
    
    qObj.options.forEach((optText, optIdx) => {
      const label = document.createElement('label');
      label.className = 'essay-opt-label';
      
      label.innerHTML = `
        <input type="radio" class="essay-opt-input" name="essay_q_${qIdx}" value="${optIdx}" onclick="selectEssayAnswer(${qIdx}, ${optIdx})">
        <span>${optText}</span>
      `;
      optionsContainer.appendChild(label);
    });
    
    card.appendChild(optionsContainer);
    qList.appendChild(card);
  });
}

function selectEssayAnswer(qIdx, optIdx) {
  if (state.essayQuizGraded) return;
  state.essayQuizAnswers[qIdx] = optIdx;
}

function gradeEssayQuiz() {
  const essays = HSK_ESSAYS[state.currentLevel];
  if (!essays || essays.length === 0) return;
  
  if (state.currentEssayIndex === undefined || state.currentEssayIndex >= essays.length) {
    state.currentEssayIndex = 0;
  }
  const essay = essays[state.currentEssayIndex];
  
  const totalQuestions = essay.questions.length;
  const answeredCount = Object.keys(state.essayQuizAnswers).length;
  
  if (answeredCount < totalQuestions) {
    alert("Please answer all questions before submitting!");
    return;
  }
  
  state.essayQuizGraded = true;
  let correctCount = 0;
  
  essay.questions.forEach((qObj, qIdx) => {
    const selectedOptIdx = state.essayQuizAnswers[qIdx];
    const correctOptIdx = qObj.correct;
    
    const qCard = document.querySelectorAll('.essay-q-card')[qIdx];
    if (qCard) {
      const labels = qCard.querySelectorAll('.essay-opt-label');
      labels.forEach((label, optIdx) => {
        const input = label.querySelector('input');
        if (input) {
          input.disabled = true;
        }
        
        if (optIdx === correctOptIdx) {
          label.classList.add('correct-answer');
        } else if (optIdx === selectedOptIdx) {
          label.classList.add('incorrect-answer');
        }
      });
    }
    
    if (selectedOptIdx === correctOptIdx) {
      correctCount++;
    }
  });
  
  const feedback = document.getElementById('essayQuizFeedback');
  const badge = document.getElementById('essayQuizFeedbackBadge');
  const text = document.getElementById('essayQuizFeedbackText');
  const submitBtn = document.getElementById('submitEssayQuizBtn');
  
  if (feedback && badge && text) {
    feedback.style.display = 'flex';
    if (correctCount === totalQuestions) {
      badge.textContent = 'Perfect';
      badge.className = 'speech-result-badge badge-success';
      text.textContent = `All ${correctCount}/${totalQuestions} correct! Excellent reading comprehension! 🎉`;
      sounds.playCorrect();
    } else {
      badge.textContent = 'Completed';
      badge.className = 'speech-result-badge badge-error';
      text.textContent = `You got ${correctCount}/${totalQuestions} correct. Review the highlighted answers.`;
      sounds.playWrong();
    }
  }
  
  if (submitBtn) {
    submitBtn.textContent = 'Quiz Graded';
    submitBtn.disabled = true;
  }
  
  updateStreak();
}

// -------------------------------------------------------------
// Light & Dark Theme Controller
// -------------------------------------------------------------
function toggleTheme() {
  const body = document.body;
  const isLight = body.classList.toggle('light-theme');
  localStorage.setItem('hsk_sensei_theme', isLight ? 'light' : 'dark');
  
  const icon = document.getElementById('themeToggleIcon');
  if (icon) {
    if (isLight) {
      icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
    } else {
      icon.innerHTML = `<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.364 17.636l-.707.707m0-11.314l.707.707m10.608 10.608l.707.707M12 8a4 4 0 110 8 4 4 0 010-8z"/>`;
    }
  }
  sounds.playFlip();
}

function initTheme() {
  const theme = localStorage.getItem('hsk_sensei_theme') || 'dark';
  const icon = document.getElementById('themeToggleIcon');
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    if (icon) {
      icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
    }
  } else {
    document.body.classList.remove('light-theme');
    if (icon) {
      icon.innerHTML = `<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.364 17.636l-.707.707m0-11.314l.707.707m10.608 10.608l.707.707M12 8a4 4 0 110 8 4 4 0 010-8z"/>`;
    }
  }
}

// -------------------------------------------------------------
// Card Pinyin Visibility Toggle
// -------------------------------------------------------------
function toggleCardPinyin() {
  const cardPinyin = document.getElementById('cardPinyin');
  const cardPinyinToggle = document.getElementById('cardPinyinToggle');
  if (cardPinyin && cardPinyinToggle) {
    cardPinyin.style.display = 'block';
    cardPinyinToggle.style.display = 'none';
    sounds.playFlip();
  }
}

// -------------------------------------------------------------
// Dynamic Flashcard Deck Expansion
// -------------------------------------------------------------
function generateMoreFlashcards() {
  const extraPool = EXTRA_HSK_DATA[state.currentLevel] || [];
  if (extraPool.length === 0) {
    alert("No more extra words available for this HSK level in the pool!");
    return;
  }
  
  const currentWords = HSK_DATA[state.currentLevel] || [];
  const currentIds = new Set(currentWords.map(w => w.id));
  const availableExtra = extraPool.filter(w => !currentIds.has(w.id));
  
  if (availableExtra.length === 0) {
    alert("You have already generated all extra vocabulary sets for HSK Level " + state.currentLevel + "! 🎉");
    return;
  }
  
  const batchSize = Math.min(10, availableExtra.length);
  const shuffled = availableExtra.sort(() => 0.5 - Math.random());
  const selectedBatch = shuffled.slice(0, batchSize);
  
  // Add to active level vocabulary array
  HSK_DATA[state.currentLevel] = [...currentWords, ...selectedBatch];
  
  // Save custom vocabulary additions in localStorage so they persist
  let unlockedIds = [];
  const stored = localStorage.getItem('hsk_sensei_unlocked_extra_ids');
  if (stored) {
    unlockedIds = JSON.parse(stored);
  }
  selectedBatch.forEach(w => {
    unlockedIds.push(w.id);
    if (!state.progress[w.id]) {
      state.progress[w.id] = {
        srsLevel: 0,
        dueTime: 0,
        starred: false,
        learned: false
      };
    }
  });
  
  localStorage.setItem('hsk_sensei_unlocked_extra_ids', JSON.stringify(unlockedIds));
  saveToLocalStorage();
  
  sounds.playCorrect();
  alert(`Successfully generated a new set of ${batchSize} flashcards for HSK Level ${state.currentLevel}! 🚀`);
  
  // Refresh view
  switchTab(state.activeTab);
  updateProgressPill();
}

// -------------------------------------------------------------
// Dynamic Reading Lab Test Generation
// -------------------------------------------------------------
function generateNewReadingTest() {
  const essays = HSK_ESSAYS[state.currentLevel];
  if (!essays || essays.length <= 1) {
    alert(`No alternative reading tests available for HSK Level ${state.currentLevel} yet!`);
    return;
  }
  
  // Show a beautiful loading state to simulate generating a new essay
  const textContentEl = document.getElementById('essayTextContent');
  if (textContentEl) {
    textContentEl.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1.25rem; padding:5rem 2rem; text-align:center;">
        <div class="spinner" style="width:48px; height:48px; border:4px solid rgba(0, 242, 254, 0.1); border-top-color:var(--accent-cyan); border-radius:50%;"></div>
        <div>
          <h4 style="font-size:1.1rem; font-weight:600; color:var(--text-primary); margin-bottom:0.25rem; animation: pulse 1.5s ease-in-out infinite;">Generating Reading Passage...</h4>
          <p style="font-size:0.875rem; color:var(--text-muted);">Formulating appropriate vocabulary for HSK Level ${state.currentLevel}</p>
        </div>
      </div>
    `;
  }
  
  // Disable the generate button during load
  const genBtn = document.getElementById('generateEssayBtn');
  if (genBtn) {
    genBtn.disabled = true;
    genBtn.style.opacity = '0.6';
    genBtn.style.cursor = 'not-allowed';
  }
  
  setTimeout(() => {
    // Select a different essay index than current one
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * essays.length);
    } while (nextIndex === state.currentEssayIndex && essays.length > 1);
    
    state.currentEssayIndex = nextIndex;
    
    // Re-enable button
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.style.opacity = '1';
      genBtn.style.cursor = 'pointer';
    }
    
    renderEssay();
    
    if (sounds && typeof sounds.playFlip === 'function') {
      sounds.playFlip();
    }
  }, 1200);
}

// Startup trigger
window.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupFloatingBackground();
  
  // Load voices if already cached by browser
  loadChineseVoices();
  
  // Load progress asynchronously from IndexedDB
  await loadProgressFromDB();
  
  // Now render UI with loaded values
  updateProgressPill();
  renderStreakUI();
  
  // Dashboard default
  switchTab('dashboard');
});
