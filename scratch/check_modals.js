const fs = require('fs');
const content = fs.readFileSync('dashboard/public/index.html', 'utf8');

const regex = /<dialog\s+id="([^"]+)"\s+class="([^"]+)">([\s\S]*?)<\/dialog>/g;
let m;
while ((m = regex.exec(content)) !== null) {
  const id = m[1];
  const dialogClass = m[2];
  const inner = m[3];
  const boxMatch = inner.match(/<([a-z0-9]+)\s+[^>]*class="([^"]*app-modal-box[^"]*)"([^>]*)>/);
  console.log(`Dialog #${id} (class="${dialogClass}"):`);
  if (boxMatch) {
    console.log(`  box tag: <${boxMatch[1]}> class="${boxMatch[2]}" attrs="${boxMatch[3]}"`);
  } else {
    console.log('  no app-modal-box found!');
  }
}
