# HSK Sensei 🏮

HSK Sensei is a premium, interactive Mandarin learning application designed to help users master Chinese vocabulary across all HSK levels (HSK 1 to 9). Built with a modern, glassmorphic UI and native browser capabilities, it provides an all-in-one suite for flashcard study, handwriting practice, speaking training, and reading comprehension.

---

## 🚀 Key Features

### 1. Dashboard & Progress Tracking
- **Daily Streak Tracker**: Visual indicators of your study consistency, persisted locally.
- **Mastery Statistics**: Real-time progress bars showing your mastered HSK vocabulary.
- **Floating Hanzi Background**: Immersive floating particles of active characters.

### 2. Spaced Repetition Flashcards
- **Intelligent SRS System**: Schedule due times using a multi-stage interval method (4h, 12h, 24h, 72h, 168h).
- **Toggleable Pinyin & Translations**: Test your recognition by hiding pinyin and translation behind premium animated toggles.
- **Audio Playback**: Listen to native-like Mandarin pronunciation of any card.
- **Dynamic Decks**: Instantly generate extra flashcard sets on-demand from a pool of supplementary HSK words.

### 3. Handwriting Canvas
- **Stroke Writing Practice**: Tracing pad using HTML5 Canvas to write characters manually.
- **Multi-character Tabs**: Toggle between single characters of multi-character HSK words.
- **Visual Reference**: Toggle the background grid or target character outline to help guide your hand.

### 4. Pronunciation Lab
- **Speech Recognition**: Uses the native Web Speech API to listen to your spoken Mandarin.
- **Real-time Match Validation**: Compares your audio input to target characters and provides color-coded accuracy feedback.

### 5. Reading Lab (Comprehension Tests)
- **Passages for HSK 1–9**: Level-appropriate essays to practice contextual reading.
- **Dynamic Test Generator**: Randomly generates alternative reading tests from a curated pool of **27 high-quality essays** (3 unique passages per HSK level).
- **TTS Audio Player**: Listen to the entire passage spoken aloud in native Mandarin.
- **Vocabulary Lookup**: Click any Chinese character in the essay text to display its quick dictionary lookup card.
- **Interactive Quizzes**: Multiple-choice comprehension check questions with instant grading and highlights.

### 6. HSK Dictionary
- **Advanced Filtering**: Search HSK words by character, pinyin, or English translation.
- **Mastery Badges**: Displays completion status of all vocabulary in the HSK course.

---

## 🛠️ Technology Stack
- **Frontend**: Vanilla HTML5, ES6+ Javascript, CSS3 (Glassmorphism, custom keyframes, HSL variables).
- **Persistence**: **IndexedDB** database wrapper (via custom `ProgressDB` class) for robust offline storage of user progress, unlocked words, and streak dates.
- **Hardware Integration**: HTML5 Canvas, Web Speech Synthesis (TTS), and Web Speech Recognition API.
- **Tooling**: Built as a purely client-side static application running on a local development server (`http-server`).

---

## 💻 Getting Started

### Prerequisites
- Node.js installed on your machine.

### Installation & Run
1. Clone the repository:
   ```bash
   git clone https://github.com/nicholaslie90/learn-mandarin.git
   cd learn-mandarin
   ```
2. Start the local server:
   ```bash
   npm run dev
   ```
3. Open `http://127.0.0.1:3000` in your web browser.

---

## 📦 Deployment

### GitHub Pages
This application is fully client-side and optimized for serverless static deployment:
1. Ensure your remote git repository is configured.
2. Initialize and push your branch to GitHub.
3. In your repository settings, enable **GitHub Pages** targeting the `main` branch root.

### Vercel
Deploy instantly using Vercel CLI:
```bash
npx vercel
```
A configured `vercel.json` file is included in the project directory for custom routing.
