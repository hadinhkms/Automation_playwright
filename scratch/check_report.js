const fs = require('fs');
const buf = fs.readFileSync('scratch/report_data.zip');
// Find file headers in zip
let offset = 0;
while (offset < buf.length - 30) {
  if (buf.readUInt32LE(offset) === 0x04034b50) {
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const fileName = buf.toString('utf8', offset + 30, offset + 30 + nameLen);
    const compSize = buf.readUInt32LE(offset + 18);
    const compMethod = buf.readUInt16LE(offset + 8);
    const dataOffset = offset + 30 + nameLen + extraLen;
    console.log('Zip entry:', fileName, 'compMethod:', compMethod, 'compSize:', compSize);
    if (compMethod === 8) {
      const zlib = require('zlib');
      const data = zlib.inflateRawSync(buf.slice(dataOffset, dataOffset + compSize));
      const content = data.toString('utf8');
      console.log('--- Content of', fileName, '---');
      try {
        const json = JSON.parse(content);
        console.log('File is JSON. Keys:', Object.keys(json));
        if (json.tests) {
          json.tests.forEach(t => {
            console.log('Test title:', t.title);
            t.results?.forEach(r => {
              r.steps?.forEach(s => console.log('  Step:', s.title));
            });
          });
        }
      } catch {
        console.log('Snippet:', content.slice(0, 300));
      }
    }
    offset = dataOffset + compSize;
  } else {
    offset++;
  }
}

