/* S.I.L.V.I.A. + B + C – Android bridge.
   In the Android WebView a link with "download" does nothing: every file the program
   produces (project .json, PDF report, XLS) is written to the app cache and handed to
   the Android share sheet (Drive, e-mail, WhatsApp, Files/Download…). */
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var FS = C.registerPlugin('Filesystem'), SH = C.registerPlugin('Share');
  var busy = false;
  function b64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = rej; r.readAsDataURL(blob);
    });
  }
  function clean(n) { return String(n || 'file').replace(/[\\/:*?"<>|]+/g, '_'); }
  async function deliver(href, name) {
    if (busy) return; busy = true;
    try {
      var blob = await (await fetch(href)).blob();
      var w = await FS.writeFile({ path: clean(name), data: await b64(blob), directory: 'CACHE' });
      await SH.share({ title: name, files: [w.uri], dialogTitle: name });
    } catch (e) {
      if (!/cancel/i.test(String(e && (e.message || e)))) alert('File non salvato / File not saved: ' + (e && (e.message || e)));
    } finally { busy = false; }
  }
  function grab(a) {
    var h = a && a.getAttribute && a.getAttribute('href') || '';
    if (a && a.hasAttribute && a.hasAttribute('download') && (h.indexOf('blob:') === 0 || h.indexOf('data:') === 0)) {
      deliver(a.href, a.getAttribute('download') || 'file'); return true;
    }
    return false;
  }
  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (!grab(this)) return click.apply(this, arguments); };
  var disp = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === 'click' && this instanceof HTMLAnchorElement && grab(this)) return false;
    return disp.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[download]');
    if (a && grab(a)) e.preventDefault();
  }, true);
})();

/* Screen rotation: a small button cycles Auto → Landscape → Portrait.
   "Auto" follows the device's own rotation setting; the other two lock the app
   in that orientation even when auto-rotate is off on the phone or tablet. */
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var SO = C.registerPlugin('ScreenOrientation');
  var modes = ['auto', 'landscape', 'portrait'], i = 0;
  var L = {
    it: { auto: 'Rotazione automatica', landscape: 'Schermo orizzontale', portrait: 'Schermo verticale', t: 'Gira lo schermo' },
    en: { auto: 'Auto-rotate', landscape: 'Landscape', portrait: 'Portrait', t: 'Rotate screen' }
  };
  function lang() { return (window.S && S.lang === 'en') ? 'en' : 'it'; }
  var css = document.createElement('style');
  css.textContent =
    '#rotBtn{position:fixed;left:calc(12px + env(safe-area-inset-left));bottom:calc(12px + env(safe-area-inset-bottom));z-index:9999;' +
    'width:46px;height:46px;border-radius:50%;border:2px solid #fff;background:#002841;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.35);' +
    'display:flex;align-items:center;justify-content:center;opacity:.88;padding:0}' +
    '#rotBtn svg{width:24px;height:24px}#rotBtn .m{position:absolute;right:-4px;top:-4px;background:#cc4400;color:#fff;border-radius:9px;' +
    'font:700 10px/16px system-ui,sans-serif;min-width:16px;padding:0 3px;border:1px solid #fff}' +
    '#rotTip{position:fixed;left:calc(66px + env(safe-area-inset-left));bottom:calc(20px + env(safe-area-inset-bottom));z-index:9999;' +
    'background:#002841;color:#fff;font:600 13px system-ui,sans-serif;padding:7px 11px;border-radius:8px;opacity:0;transition:opacity .25s;pointer-events:none}' +
    '@media print{#rotBtn,#rotTip{display:none}}';
  document.head.appendChild(css);
  var b = document.createElement('button'), tip = document.createElement('div');
  b.id = 'rotBtn'; tip.id = 'rotTip';
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="7" y="3" width="10" height="16" rx="2"/><path d="M3 12a9 9 0 0 1 3-6.7M21 12a9 9 0 0 1-3 6.7"/><path d="M3 5v3h3M21 19v-3h-3"/></svg><span class="m">A</span>';
  var tt;
  function show() {
    var m = modes[i], l = L[lang()];
    b.title = l.t + ' · ' + l[m]; b.setAttribute('aria-label', b.title);
    b.querySelector('.m').textContent = m === 'auto' ? 'A' : m === 'landscape' ? '↔' : '↕';
  }
  function toast() {
    tip.textContent = L[lang()][modes[i]]; tip.style.opacity = '1';
    clearTimeout(tt); tt = setTimeout(function () { tip.style.opacity = '0'; }, 1600);
  }
  b.addEventListener('click', async function (e) {
    e.preventDefault(); e.stopPropagation();
    i = (i + 1) % modes.length; var m = modes[i];
    try { if (m === 'auto') await SO.unlock(); else await SO.lock({ orientation: m }); }
    catch (err) { /* plugin not available: keep the system behaviour */ }
    show(); toast();
  });
  function add() { document.body.appendChild(b); document.body.appendChild(tip); show(); }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();

/* Camera code reading: ML Kit text recognition (on-device, offline) through the local SilviaOcr plugin.
   The program shows the camera button only when window.SILVIA_OCR exists. */
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var OCR = C.registerPlugin('SilviaOcr');
  window.SILVIA_OCR = function (dataUrl) { return OCR.recognize({ image: dataUrl }); };
})();
