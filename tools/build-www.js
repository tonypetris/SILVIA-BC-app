// Builds www/ for the Android app from src/SILVIA-BC.html (the desktop program):
// PDF/XLS libraries served locally (offline), Google font link removed (system font offline), Android bridge added.
const fs = require('fs'), path = require('path');
const R = p => path.join(__dirname, '..', p);
fs.rmSync(R('www'), { recursive: true, force: true });
fs.mkdirSync(R('www/libs'), { recursive: true });
const libs = {
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js': 'node_modules/jspdf/dist/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js': 'node_modules/xlsx/dist/xlsx.full.min.js'
};
let h = fs.readFileSync(R('src/SILVIA-BC.html'), 'utf8');
for (const [url, file] of Object.entries(libs)) {
  if (!h.includes(url)) throw new Error('library URL not found in the program: ' + url);
  const name = path.basename(file);
  fs.copyFileSync(R(file), R('www/libs/' + name));
  h = h.split(url).join('libs/' + name);
}
h = h.replace(/<link[^>]+fonts\.googleapis\.com[^>]*>/g, '').replace(/<link[^>]+fonts\.gstatic\.com[^>]*>/g, '');
if (/https:\/\/cdnjs\.cloudflare\.com/.test(h)) throw new Error('a CDN reference is still in the page');
h = h.replace('</head>', '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>');
const bridge = fs.readFileSync(R('src/android-bridge.js'), 'utf8');
const k = h.lastIndexOf('</body>');
if (k < 0) throw new Error('</body> not found');
h = h.slice(0, k) + '<script>\n' + bridge + '\n</script>\n' + h.slice(k);
fs.writeFileSync(R('www/index.html'), h);
console.log('www/index.html', (h.length / 1024).toFixed(0), 'KB');
