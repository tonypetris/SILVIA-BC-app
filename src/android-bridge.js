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
