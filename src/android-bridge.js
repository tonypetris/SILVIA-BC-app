/* Robust start (1-W45 build 2): every part runs in its own try/catch and the start is retried until
   window.Capacitor is ready (DOMContentLoaded, load, timers up to 10 s), so one failure cannot hide the others. */
var SILVIA_BRIDGE = { parts: {}, errors: [] };
/* S.I.L.V.I.A. + B + C – Android bridge.
   In the Android WebView a link with "download" does nothing: every file the program
   produces (project .json, PDF report, XLS) is written to the app cache and handed to
   the Android share sheet (Drive, e-mail, WhatsApp, Files/Download…). */
/* 1-W45.6: plugins are taken from Capacitor.Plugins (filled by the native bridge); registerPlugin exists only when
   the @capacitor/core JavaScript is loaded, which this app does not do (Pixel 7a: "C.registerPlugin is not a function"). */
function SILVIA_PLUGIN(name) {
  var C = window.Capacitor || {};
  var p = (C.Plugins && C.Plugins[name]) || (typeof C.registerPlugin === 'function' ? C.registerPlugin(name) : null);
  if (!p) throw new Error('plugin ' + name + ' non disponibile / not available');
  return p;
}
function SILVIA_CALL(name, method) {
  return function (a) { try { return Promise.resolve(SILVIA_PLUGIN(name)[method](a)); } catch (e) { return Promise.reject(e); } };
}
SILVIA_BRIDGE.parts.files = function () {
  var C = window.Capacitor;
  var FS = { writeFile: SILVIA_CALL('Filesystem', 'writeFile'), checkPermissions: SILVIA_CALL('Filesystem', 'checkPermissions'), requestPermissions: SILVIA_CALL('Filesystem', 'requestPermissions') },
      SH = { share: SILVIA_CALL('Share', 'share') };
  var busy = false;
  var BLOBS = {};
  try {
    var mk = URL.createObjectURL, rv = URL.revokeObjectURL;
    URL.createObjectURL = function (o) { var u = mk.apply(URL, arguments); try { if (o instanceof Blob) BLOBS[u] = o; } catch (e) {} return u; };
    URL.revokeObjectURL = function (u) { setTimeout(function () { delete BLOBS[u]; }, 60000); return rv.apply(URL, arguments); };
  } catch (e) {}
  function b64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = rej; r.readAsDataURL(blob);
    });
  }
  function clean(n) { return String(n || 'file').replace(/[\\/:*?"<>|]+/g, '_'); }
  /* 1-W45.4: the file is first saved in Documents/SILVIA-BC (always findable with the Files app),
     then the share sheet opens (Drive, e-mail, WhatsApp…); a short message says where it went. */
  function toast(msg, bad) {
    var t = document.getElementById('silviaToast');
    if (!t) { t = document.createElement('div'); t.id = 'silviaToast';
      t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(max(env(safe-area-inset-bottom),16px) + 80px);z-index:10000;' +
        'max-width:86vw;padding:10px 14px;border-radius:10px;font:600 14px/1.35 system-ui,sans-serif;color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.35);transition:opacity .3s';
      document.body.appendChild(t); }
    t.style.background = bad ? '#b3261e' : '#12803f'; t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._h); t._h = setTimeout(function () { t.style.opacity = '0'; }, 5000);
  }
  function it() { return !(window.S && S.lang === 'en'); }
  async function saveDocs(name, data) {
    var dot = name.lastIndexOf('.'), base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
    var av = +((navigator.userAgent.match(/Android (\d+)/) || [])[1] || 0);
    if (av && av < 11) try { var p = await FS.checkPermissions(); if (p && p.publicStorage && p.publicStorage !== 'granted') await FS.requestPermissions(); } catch (e) {}
    var last;
    for (var k = 0; k < 6; k++) {
      var fn = k ? base + ' (' + (k + 1) + ')' + ext : name;
      try { await FS.writeFile({ path: 'SILVIA-BC/' + fn, data: data, directory: 'DOCUMENTS', recursive: true }); return fn; }
      catch (e) { last = e; }
    }
    throw last;
  }
  /* 1-W45.5: the Blob is taken straight from URL.createObjectURL (no fetch of the blob: URL), every native step
     has a time limit and a message names the step that failed, so a silent stop cannot happen any more. */
  function step(label, p, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error((it() ? 'nessuna risposta: ' : 'no answer: ') + label)); }, ms);
      Promise.resolve(p).then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(new Error(label + ': ' + (e && (e.message || e)))); });
    });
  }
  async function deliver(href, name) {
    if (busy) { toast(it() ? 'Salvataggio già in corso…' : 'Saving already in progress…'); return; }
    busy = true;
    name = clean(name);
    toast(it() ? 'Salvataggio di ' + name + '…' : 'Saving ' + name + '…');
    var saved = null, err = null, data, w;
    try {
      var blob = BLOBS[href];
      if (!blob) blob = await step(it() ? 'lettura del file' : 'reading the file', fetch(href).then(function (r) { return r.blob(); }), 8000);
      data = await step(it() ? 'conversione' : 'conversion', b64(blob), 8000);
      try { saved = await step(it() ? 'scrittura in Documenti' : 'writing to Documents', saveDocs(name, data), 15000); }
      catch (e) { err = e; }
      try { w = await step(it() ? 'file temporaneo' : 'temporary file', FS.writeFile({ path: name, data: data, directory: 'CACHE' }), 15000); }
      catch (e) { if (!saved) throw (err || e); }
      if (saved) toast((it() ? 'Salvato in Documenti/SILVIA-BC/' : 'Saved in Documents/SILVIA-BC/') + saved);
      else if (err) toast((it() ? 'Non salvato in Documenti (' : 'Not saved in Documents (') + err.message + (it() ? '): scegli dove salvarlo nella condivisione' : '): choose where to save it in the share sheet'), true);
    } catch (e) {
      var m = String(e && (e.message || e));
      toast((it() ? 'File non salvato: ' : 'File not saved: ') + m, true);
      try { alert((it() ? 'File non salvato' : 'File not saved') + ' (' + name + ')\n' + m + (err && err.message !== m ? '\n' + err.message : '')); } catch (x) {}
      busy = false; return;
    }
    busy = false;
    if (w && w.uri) {
      try { await SH.share({ title: name, files: [w.uri], dialogTitle: name }); }
      catch (e) {
        var m2 = String(e && (e.message || e));
        if (!/cancel/i.test(m2)) {
          if (saved) toast((it() ? 'Salvato in Documenti/SILVIA-BC/' : 'Saved in Documents/SILVIA-BC/') + saved + (it() ? ' · condivisione non riuscita' : ' · sharing failed'));
          else { toast((it() ? 'Condivisione non riuscita: ' : 'Sharing failed: ') + m2, true); try { alert((it() ? 'File non salvato' : 'File not saved') + ' (' + name + ')\n' + m2 + (err ? '\n' + err.message : '')); } catch (x) {} }
        }
      }
    }
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
};

/* Screen rotation: a small button cycles Auto → Landscape → Portrait.
   "Auto" follows the device's own rotation setting; the other two lock the app
   in that orientation even when auto-rotate is off on the phone or tablet. */
SILVIA_BRIDGE.parts.rotate = function () {
  var C = window.Capacitor;
  var SO = { lock: SILVIA_CALL('ScreenOrientation', 'lock'), unlock: SILVIA_CALL('ScreenOrientation', 'unlock') };
  var modes = ['auto', 'landscape', 'portrait'], i = 0;
  var L = {
    it: { auto: 'Rotazione automatica', landscape: 'Schermo orizzontale', portrait: 'Schermo verticale', t: 'Gira lo schermo' },
    en: { auto: 'Auto-rotate', landscape: 'Landscape', portrait: 'Portrait', t: 'Rotate screen' }
  };
  function lang() { return (window.S && S.lang === 'en') ? 'en' : 'it'; }
  var css = document.createElement('style');
  css.textContent =
    '#rotBtn{position:fixed;left:calc(12px + env(safe-area-inset-left));bottom:calc(max(env(safe-area-inset-bottom), 16px) + 18px);z-index:9999;' +
    'width:46px;height:46px;border-radius:50%;border:2px solid #fff;background:#002841;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.35);' +
    'display:flex;align-items:center;justify-content:center;opacity:.88;padding:0}' +
    '#rotBtn svg{width:24px;height:24px}#rotBtn .m{position:absolute;right:-4px;top:-4px;background:#cc4400;color:#fff;border-radius:9px;' +
    'font:700 10px/16px system-ui,sans-serif;min-width:16px;padding:0 3px;border:1px solid #fff}' +
    '#rotTip{position:fixed;left:calc(66px + env(safe-area-inset-left));bottom:calc(max(env(safe-area-inset-bottom), 16px) + 26px);z-index:9999;' +
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
};

/* Camera code reading: ML Kit text recognition (on-device, offline) through the local SilviaOcr plugin.
   The program shows the camera button only when window.SILVIA_OCR exists. */
SILVIA_BRIDGE.parts.ocr = function () {
  var C = window.Capacitor;
  var OCR = { recognize: SILVIA_CALL('SilviaOcr', 'recognize') };
  window.SILVIA_OCR = function (dataUrl) { return OCR.recognize({ image: dataUrl }); };
  try { window.dispatchEvent(new Event('silvia-ocr-ready')); } catch (e) {}
};

/* build number and status in the page footer, so the user sees which app is installed */
SILVIA_BRIDGE.parts.info = function () {
  var A = window.SILVIA_APP || {};
  function put() {
    var it = !(window.S && S.lang === 'en'), f = document.getElementById('silviaAppInfo');
    if (!f) { f = document.createElement('div'); f.id = 'silviaAppInfo';
      f.style.cssText = 'text-align:center;font:600 12px system-ui,sans-serif;color:#667;padding:6px 8px 80px';
      document.body.appendChild(f); }
    var ok = typeof window.SILVIA_OCR === 'function';
    f.textContent = (it ? 'App Android' : 'Android app') + ' · v' + (A.name || '?') + ' · build ' + (A.code || '?') +
      ' · ' + (it ? 'fotocamera ' : 'camera ') + (ok ? '✓' : '✕') +
      (SILVIA_BRIDGE.errors.length ? ' · ' + SILVIA_BRIDGE.errors.join('; ') : '');
  }
  put(); window.addEventListener('silvia-ocr-ready', put); setTimeout(put, 1500);
};
(function () {
  var done = false, tries = 0;
  function native() {
    var C = window.Capacitor;
    if (!C) return false;
    try { if (C.isNativePlatform && C.isNativePlatform()) return true; } catch (e) {}
    try { return !!(C.getPlatform && C.getPlatform() === 'android'); } catch (e) { return false; }
  }
  function start() {
    if (done) return;
    if (!native() || !document.body) { if (++tries < 40) setTimeout(start, 250); return; }
    done = true;
    ['files', 'rotate', 'ocr', 'info'].forEach(function (k) {
      try { SILVIA_BRIDGE.parts[k](); } catch (e) { SILVIA_BRIDGE.errors.push(k + ': ' + (e && e.message || e)); }
    });
    if (SILVIA_BRIDGE.errors.length) try { SILVIA_BRIDGE.parts.info(); } catch (e) {}
  }
  start();
  document.addEventListener('DOMContentLoaded', start);
  window.addEventListener('load', start);
})();
