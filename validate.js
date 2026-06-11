const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = __dirname;
let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`[FAIL] ${message}`);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function runNodeCheck(relativePath) {
  const result = spawnSync(process.execPath, ['--check', relativePath], {
    cwd: root,
    encoding: 'utf8'
  });

  if (result.status === 0) {
    pass(`${relativePath} syntax`);
    return;
  }

  fail(`${relativePath} syntax\n${(result.stderr || result.stdout).trim()}`);
}

function runScript(relativePath) {
  const result = spawnSync(process.execPath, [relativePath], {
    cwd: root,
    encoding: 'utf8'
  });

  if (result.status === 0) {
    pass(relativePath);
    return;
  }

  fail(`${relativePath}\n${(result.stderr || result.stdout).trim()}`);
}

function checkDomHooks() {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const referencedIds = [
    ...app.matchAll(/getElementById\(['"`]([^'"`]+)['"`]\)/g)
  ].map(match => match[1]);
  const declaredIds = [
    ...html.matchAll(/\bid=['"`]([^'"`]+)['"`]/g)
  ].map(match => match[1]);
  const declaredIdSet = new Set(declaredIds);
  const missingIds = [...new Set(referencedIds)].filter(id => !declaredIdSet.has(id));
  const duplicateIds = [...new Set(declaredIds.filter((id, index) => declaredIds.indexOf(id) !== index))];

  if (missingIds.length > 0) {
    fail(`DOM hooks missing from index.html: ${missingIds.join(', ')}`);
  } else {
    pass('All app.js DOM hooks exist in index.html');
  }

  if (duplicateIds.length > 0) {
    fail(`Duplicate IDs in index.html: ${duplicateIds.join(', ')}`);
  } else {
    pass('index.html IDs are unique');
  }
}

['app.js', 'data.js', 'scripts/dev-server.js', 'scripts/verify_vocab.js'].forEach(runNodeCheck);
runScript('scripts/verify_vocab.js');
checkDomHooks();

if (failures > 0) {
  console.error(`\nValidation failed with ${failures} error${failures === 1 ? '' : 's'}.`);
  process.exit(1);
}

console.log('\nValidation passed.');
