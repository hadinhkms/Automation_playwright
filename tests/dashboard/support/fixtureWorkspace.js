/**
 * tests/dashboard/support/fixtureWorkspace.js
 * Creates an isolated temporary workspace for Dashboard testing to protect the real project.
 */
const fs = require('fs');
const path = require('path');

function createFixtureWorkspace() {
  const tmpRoot = path.resolve(__dirname, '../.tmp-workspace-' + Date.now());

  // Create standard subdirectories expected by Dashboard
  const dirs = [
    'data',
    'tests',
    'pages',
    'core/fixtures/custom',
    '.tmp'
  ];

  dirs.forEach(d => {
    fs.mkdirSync(path.join(tmpRoot, d), { recursive: true });
  });

  // Create sample dataset
  const sampleData = [
    { id: 1, name: 'Sample User', email: 'user@example.com', role: 'Tester' }
  ];
  fs.writeFileSync(
    path.join(tmpRoot, 'data/sample-users.json'),
    JSON.stringify(sampleData, null, 2),
    'utf8'
  );

  const clean = () => {
    try {
      if (fs.existsSync(tmpRoot)) {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    } catch (_) {}
  };

  process.on('exit', clean);
  process.on('SIGINT', clean);

  return {
    rootPath: tmpRoot,
    cleanup: () => {
      clean();
      process.removeListener('exit', clean);
      process.removeListener('SIGINT', clean);
    }
  };
}

module.exports = { createFixtureWorkspace };
