const fs = require('fs');
const path = require('path');

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const results = [];

  // Check for any element with class containing btn or link that has +
  const clickRegex = /<(button|a|span|div)[^>]*class="[^"]*(btn|link|action|tab)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi;
  let match;
  while ((match = clickRegex.exec(content)) !== null) {
    if (match[0].includes('+')) {
      const index = match.index;
      const lineNum = content.substring(0, index).split('\n').length;
      results.push({
        file: filePath,
        lineNum,
        snippet: match[0].replace(/\s+/g, ' ').trim(),
        reason: 'Clickable element containing +'
      });
    }
  }

  return results;
}

function walkDir(dir) {
  let files = [];
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'scratch') continue;
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files = files.concat(walkDir(fullPath));
    } else if (/\.(html|js|css)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

const allFiles = walkDir('dashboard');
let totalHits = 0;
allFiles.forEach(f => {
  const hits = scanFile(f);
  if (hits.length > 0) {
    console.log(`\n=== Found in ${f} ===`);
    hits.forEach(h => {
      totalHits++;
      console.log(`[Line ${h.lineNum}] ${h.snippet}`);
    });
  }
});
console.log(`\nTotal hits: ${totalHits}`);
