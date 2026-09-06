const fs = require('fs');

const content = fs.readFileSync('dashboard/public/app.js', 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
  // Look for any string or template literal containing + followed immediately by text
  // e.g. "+ Thêm", "+ Tạo", "+ Chèn", "+...", "+ new", etc.
  const m = l.match(/[`'"][^`'"]*\+\s*([a-zA-ZÀ-ỹ]{2,})[^`'"]*[`'"]/);
  if (m) {
    // Check if it's not just string concatenation like 'foo' + bar
    const str = m[0];
    if (str.includes('+ ' + m[1]) || str.includes('+' + m[1])) {
      console.log(`app.js:${idx + 1}: ${l.trim()}`);
    }
  }
});
