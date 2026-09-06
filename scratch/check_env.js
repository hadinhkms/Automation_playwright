const envKeys = Object.keys(process.env).filter(k => k.toLowerCase().includes('playwright') || k.toLowerCase().includes('headless') || k.toLowerCase().includes('display'));
console.log('Relevant env vars:', envKeys);
for (const k of envKeys) {
  console.log(k, '=', process.env[k]);
}
