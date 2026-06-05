const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Paths configuration
const workspaceDir = path.join(__dirname, '..');
const dataJsPath = path.join(workspaceDir, 'data.js');
const hsk3RepoDir = '/Users/nic/Github/HSK-3.0';
const hsk3DataDir = path.join(hsk3RepoDir, 'Scripts and data/hsk');

console.log('--- Starting HSK 3.0 Vocabulary Integration (Direct Core) ---');
console.log(`Workspace Path: ${workspaceDir}`);
console.log(`HSK-3.0 Data Path: ${hsk3DataDir}`);

// 1. Read existing data.js
if (!fs.existsSync(dataJsPath)) {
  console.error(`Error: data.js not found at ${dataJsPath}`);
  process.exit(1);
}

const originalDataContent = fs.readFileSync(dataJsPath, 'utf8');

// Capture the essay expansion section to append it later
const splitMarker = '// -------------------------------------------------------------';
const splitIndex = originalDataContent.indexOf('// Reading Lab Test Bank Expansion');
let essayExpansionCode = '';
let mainDataCode = originalDataContent;

if (splitIndex !== -1) {
  // Find the split marker just before it
  const markerIndex = originalDataContent.lastIndexOf(splitMarker, splitIndex);
  if (markerIndex !== -1) {
    essayExpansionCode = originalDataContent.substring(markerIndex);
    mainDataCode = originalDataContent.substring(0, markerIndex);
  } else {
    essayExpansionCode = originalDataContent.substring(splitIndex);
    mainDataCode = originalDataContent.substring(0, splitIndex);
  }
}

// Evaluate existing data.js structures using Node vm
let result = {};
try {
  result = vm.runInNewContext(mainDataCode + '\n;({HSK_DATA, EXTRA_HSK_DATA, HSK_ESSAYS});');
} catch (err) {
  console.error('Failed to parse existing data.js code:', err);
  process.exit(1);
}

const HSK_DATA = result.HSK_DATA || {};
const EXTRA_HSK_DATA = result.EXTRA_HSK_DATA || {};
const HSK_ESSAYS = result.HSK_ESSAYS || {};

console.log('Successfully loaded existing vocabulary structures.');

// Helper: Custom CSV parser that keeps commas inside quotes together
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Helper: Clean English meanings and extract POS
function parseWordDetails(parts, id) {
  const traditional = parts[0].trim();
  let character = parts[1].trim();
  if (!character) character = traditional;
  
  const pinyin = parts[2].trim();
  let rawEnglish = parts[3] ? parts[3].trim() : '';
  let english = rawEnglish;
  
  // Clean English outer quotes
  if (english.startsWith('"') && english.endsWith('"')) {
    english = english.slice(1, -1).trim();
  }
  
  let pos = 'Word';
  
  // Match prefix parts of speech
  if (english.startsWith('det.:')) {
    pos = 'Determiner';
    english = english.replace('det.:', '').trim();
  } else if (english.startsWith('m.:')) {
    pos = 'Measure Word';
    english = english.replace('m.:', '').trim();
  } else if (english.startsWith('m.[')) {
    pos = 'Measure Word';
    english = english.replace(/^m\.\[.*?\]/, '').trim();
  } else if (english.startsWith('particle:')) {
    pos = 'Particle';
    english = english.replace('particle:', '').trim();
  } else if (english.startsWith('conj.:')) {
    pos = 'Conjunction';
    english = english.replace('conj.:', '').trim();
  } else if (english.startsWith('pronoun:')) {
    pos = 'Pronoun';
    english = english.replace('pronoun:', '').trim();
  } else if (english.startsWith('adv.:')) {
    pos = 'Adverb';
    english = english.replace('adv.:', '').trim();
  } else if (english.startsWith('prep.:')) {
    pos = 'Preposition';
    english = english.replace('prep.:', '').trim();
  }
  
  // Fallback if cleaning leaves it empty (like "m.[general]" or "conj.:")
  if (!english) {
    english = rawEnglish.replace(/:$/, '').trim();
  }
  
  return {
    id: id,
    character: character,
    traditional: traditional,
    pinyin: pinyin,
    english: english,
    pos: pos,
    exampleCn: '',
    examplePy: '',
    exampleEn: ''
  };
}

// Build set of existing simplified characters across HSK levels to filter duplicates
// Also deduplicate existing lists to clean up legacy overlap
const existingCharSets = {};
for (let lvl = 1; lvl <= 9; lvl++) {
  existingCharSets[lvl] = new Set();
  
  // Deduplicate core list itself
  if (HSK_DATA[lvl]) {
    const uniqueCore = [];
    const seen = new Set();
    HSK_DATA[lvl].forEach(w => {
      if (!seen.has(w.character)) {
        seen.add(w.character);
        uniqueCore.push(w);
      }
    });
    HSK_DATA[lvl] = uniqueCore;
    HSK_DATA[lvl].forEach(w => existingCharSets[lvl].add(w.character));
  }
  
  // Deduplicate existing extra list and ensure no overlap with core
  if (EXTRA_HSK_DATA[lvl]) {
    const uniqueExtra = [];
    const seen = new Set();
    EXTRA_HSK_DATA[lvl].forEach(w => {
      if (!existingCharSets[lvl].has(w.character) && !seen.has(w.character)) {
        seen.add(w.character);
        uniqueExtra.push(w);
      }
    });
    EXTRA_HSK_DATA[lvl] = uniqueExtra;
    EXTRA_HSK_DATA[lvl].forEach(w => existingCharSets[lvl].add(w.character));
  }
  
  console.log(`Level ${lvl} (cleaned core/extra) - Core: ${HSK_DATA[lvl] ? HSK_DATA[lvl].length : 0}, Extra: ${EXTRA_HSK_DATA[lvl] ? EXTRA_HSK_DATA[lvl].length : 0}`);
}

// Process Levels 1 to 6
for (let lvl = 1; lvl <= 6; lvl++) {
  const filename = `HSK ${lvl} with clear meaning.txt`;
  const filePath = path.join(hsk3DataDir, filename);
  
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Could not find HSK file ${filePath}`);
    continue;
  }
  
  console.log(`Processing file: ${filename}`);
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  
  let extCount = (HSK_DATA[lvl] || []).length + 1;
  if (!HSK_DATA[lvl]) {
    HSK_DATA[lvl] = [];
  }
  
  let added = 0;
  lines.forEach(line => {
    if (!line.trim()) return;
    const parts = parseCsvLine(line);
    if (parts.length < 4) return;
    
    const simplified = parts[1].trim() || parts[0].trim();
    if (existingCharSets[lvl].has(simplified)) {
      return; // Skip duplicate character
    }
    
    const wordId = `hsk${lvl}_ext_${extCount++}`;
    const wordObj = parseWordDetails(parts, wordId);
    
    HSK_DATA[lvl].push(wordObj);
    existingCharSets[lvl].add(simplified);
    added++;
  });
  
  console.log(`-> Added ${added} new words directly to HSK Level ${lvl}`);
}

// Process HSK Levels 7-9 (unified list split into three levels)
const hsk79Filename = 'HSK 7-9 with clear meaning.txt';
const hsk79Path = path.join(hsk3DataDir, hsk79Filename);

if (fs.existsSync(hsk79Path)) {
  console.log(`Processing file: ${hsk79Filename}`);
  const lines = fs.readFileSync(hsk79Path, 'utf8').split(/\r?\n/);
  
  const parsedWords = [];
  lines.forEach(line => {
    if (!line.trim()) return;
    const parts = parseCsvLine(line);
    if (parts.length < 4) return;
    
    const simplified = parts[1].trim() || parts[0].trim();
    
    // Check if character already exists in HSK 7, 8, or 9
    const exists = (existingCharSets[7].has(simplified) || 
                    existingCharSets[8].has(simplified) || 
                    existingCharSets[9].has(simplified));
                    
    if (exists) return;
    
    parsedWords.push(parts);
  });
  
  console.log(`Total non-duplicate Level 7-9 words found: ${parsedWords.length}`);
  
  // Split uniformly into 3 parts
  const partSize = Math.floor(parsedWords.length / 3);
  console.log(`Splitting words: ~${partSize} words per level for 7, 8, and 9`);
  
  const levelAllocations = {
    7: parsedWords.slice(0, partSize),
    8: parsedWords.slice(partSize, partSize * 2),
    9: parsedWords.slice(partSize * 2)
  };
  
  for (let lvl = 7; lvl <= 9; lvl++) {
    let extCount = (HSK_DATA[lvl] || []).length + 1;
    if (!HSK_DATA[lvl]) {
      HSK_DATA[lvl] = [];
    }
    
    let added = 0;
    levelAllocations[lvl].forEach(parts => {
      const simplified = parts[1].trim() || parts[0].trim();
      const wordId = `hsk${lvl}_ext_${extCount++}`;
      const wordObj = parseWordDetails(parts, wordId);
      
      HSK_DATA[lvl].push(wordObj);
      existingCharSets[lvl].add(simplified);
      added++;
    });
    
    console.log(`-> Added ${added} new words directly to HSK Level ${lvl}`);
  }
} else {
  console.error(`Error: Could not find unified HSK 7-9 file: ${hsk79Path}`);
}

// Create an empty EXTRA_HSK_DATA structure for backward compatibility
const emptyExtraData = {};
for (let lvl = 1; lvl <= 9; lvl++) {
  emptyExtraData[lvl] = [];
}

// 4. Serialize back into data.js
let newContent = `const HSK_DATA = ${JSON.stringify(HSK_DATA, null, 2)};\n\n`;
newContent += `const HSK_ESSAYS = ${JSON.stringify(HSK_ESSAYS, null, 2)};\n\n`;
newContent += `const EXTRA_HSK_DATA = ${JSON.stringify(emptyExtraData, null, 2)};\n\n`;
newContent += essayExpansionCode;

fs.writeFileSync(dataJsPath, newContent, 'utf8');

console.log('--- Database reconstruction completed successfully ---');
console.log('New level totals:');
for (let lvl = 1; lvl <= 9; lvl++) {
  const coreLen = HSK_DATA[lvl] ? HSK_DATA[lvl].length : 0;
  const extraLen = emptyExtraData[lvl].length;
  console.log(`Level ${lvl} - Core words: ${coreLen}, Extra words (pool): ${extraLen}, Total Level Words: ${coreLen + extraLen}`);
}
