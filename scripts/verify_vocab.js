const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataJsPath = path.join(__dirname, '../data.js');
const fileContent = fs.readFileSync(dataJsPath, 'utf8');

// Strip off the dynamic essay expansion logic
const splitIndex = fileContent.indexOf('// Reading Lab Test Bank Expansion');
const mainDataCode = splitIndex !== -1 ? fileContent.substring(0, splitIndex) : fileContent;

// Run in VM
const result = vm.runInNewContext(mainDataCode + '\n;({HSK_DATA, EXTRA_HSK_DATA});');
const HSK_DATA = result.HSK_DATA;
const EXTRA_HSK_DATA = result.EXTRA_HSK_DATA;

console.log('--- Verifying expanded HSK Sensei Database ---');

let totalWords = 0;
let errors = 0;

for (let lvl = 1; lvl <= 9; lvl++) {
  const core = HSK_DATA[lvl] || [];
  const extra = EXTRA_HSK_DATA[lvl] || [];
  const levelTotal = core.length + extra.length;
  totalWords += levelTotal;
  
  console.log(`Level ${lvl}: Core = ${core.length}, Extra = ${extra.length}, Total = ${levelTotal}`);
  
  // Check duplicates in this level
  const seenChars = new Set();
  const duplicateChars = [];
  
  core.forEach(w => {
    if (seenChars.has(w.character)) duplicateChars.push(w.character);
    seenChars.add(w.character);
  });
  
  extra.forEach(w => {
    if (seenChars.has(w.character)) duplicateChars.push(w.character);
    seenChars.add(w.character);
  });
  
  if (duplicateChars.length > 0) {
    console.error(`  [ERROR] Level ${lvl} has duplicate characters: ${duplicateChars.join(', ')}`);
    errors++;
  }
  
  // Validate fields
  const allWords = [...core, ...extra];
  allWords.forEach(w => {
    if (!w.id || typeof w.id !== 'string') {
      console.error(`  [ERROR] Word has invalid ID:`, w);
      errors++;
    }
    if (!w.character || typeof w.character !== 'string') {
      console.error(`  [ERROR] Word ${w.id} has invalid character:`, w);
      errors++;
    }
    if (!w.pinyin || typeof w.pinyin !== 'string') {
      console.error(`  [ERROR] Word ${w.id} (${w.character}) has invalid pinyin:`, w);
      errors++;
    }
    if (!w.english || typeof w.english !== 'string') {
      console.error(`  [ERROR] Word ${w.id} (${w.character}) has invalid english:`, w);
      errors++;
    }
    if (!w.pos || typeof w.pos !== 'string') {
      console.error(`  [ERROR] Word ${w.id} (${w.character}) has invalid pos:`, w);
      errors++;
    }
    if (w.exampleCn === undefined || w.examplePy === undefined || w.exampleEn === undefined) {
      console.error(`  [ERROR] Word ${w.id} (${w.character}) is missing example sentence fields:`, w);
      errors++;
    }
  });
}

console.log(`\nVerification finished. Total words checked: ${totalWords}`);
if (errors === 0) {
  console.log('🎉 Verification SUCCESS! Database is 100% healthy and integral.');
} else {
  console.error(`❌ Verification FAILED with ${errors} errors.`);
  process.exit(1);
}
