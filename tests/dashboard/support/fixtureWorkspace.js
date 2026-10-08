/**
 * tests/dashboard/support/fixtureWorkspace.js
 * Creates an isolated temporary workspace for Dashboard testing to protect the real project.
 */
const fs = require('fs');
const path = require('path');

function cleanupStaleWorkspaces() {
  try {
    const parentDir = path.resolve(__dirname, '..');
    const entries = fs.readdirSync(parentDir, { withFileTypes: true });
    const now = Date.now();
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('.tmp-workspace-')) {
        const timeStr = entry.name.replace('.tmp-workspace-', '');
        const time = parseInt(timeStr, 10);
        if (isNaN(time) || now - time > 30000) {
          try {
            fs.rmSync(path.join(parentDir, entry.name), { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
          } catch (_) {}
        }
      }
    }
  } catch (_) {}
}

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

  cleanupStaleWorkspaces();

  const clean = () => {
    try {
      if (fs.existsSync(tmpRoot)) {
        fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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
