// After "npx cap add android": app version from package.json, release signing from environment variables.
const fs = require('fs'), path = require('path');
const R = p => path.join(__dirname, '..', p);
const pkg = JSON.parse(fs.readFileSync(R('package.json'), 'utf8'));
const v = pkg.version;                                   // e.g. 1.1.0-rc.3
const m = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/);
if (!m) throw new Error('unexpected version ' + v);
// 1.1.0-rc.3 -> 1010003 ; 1.1.0 (stable) -> 1010099
// explicit androidVersionCode wins (must always increase: 1.0.0 stable comes after the 1.1.0 release candidates)
const code = pkg.androidVersionCode || ((+m[1]) * 1000000 + (+m[2]) * 10000 + (+m[3]) * 100 + (m[4] ? +m[4] : 99));
const g = R('android/app/build.gradle');
let s = fs.readFileSync(g, 'utf8');
const vn = pkg.versionName || pkg.release || v;     // e.g. 1-W45.2 (the release tag stays pkg.release)                             // release name shown on the phone, e.g. 1-W45
s = s.replace(/versionCode \d+/, 'versionCode ' + code).replace(/versionName "[^"]*"/, 'versionName "' + vn + '"');
if (!s.includes('signingConfigs')) {
  s = s.replace(/buildTypes \{/, `signingConfigs {
        release {
            if (System.getenv("ANDROID_KEYSTORE_FILE")) {
                storeFile file(System.getenv("ANDROID_KEYSTORE_FILE"))
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {`);
  s = s.replace(/release \{\n(\s*)minifyEnabled false/, 'release {\n$1if (System.getenv("ANDROID_KEYSTORE_FILE")) signingConfig signingConfigs.release\n$1minifyEnabled false');
}
fs.writeFileSync(g, s);
console.log('android: versionName', vn, 'versionCode', code);

// rotation: the activity must survive orientation changes (no WebView reload) and follow the device/user choice
const mf = R('android/app/src/main/AndroidManifest.xml');
let x = fs.readFileSync(mf, 'utf8');
x = x.replace(/android:configChanges="([^"]*)"/, (a, v) => {
  const need = ['orientation', 'screenSize', 'smallestScreenSize', 'screenLayout'];
  const have = v.split('|'); need.forEach(n => { if (!have.includes(n)) have.push(n); });
  return 'android:configChanges="' + have.join('|') + '"';
});
x = x.replace(/\s*android:screenOrientation="[^"]*"/g, '');
x = x.replace(/<activity\b/, '<activity android:screenOrientation="fullUser" android:resizeableActivity="true"');
fs.writeFileSync(mf, x);
console.log('android: rotation enabled (fullUser, configChanges kept)');

// 1-W46: open a project from Android "Share" (Invia/Condividi) and "Open with" (Apri con)
x = fs.readFileSync(mf, 'utf8');
if (!x.includes('SILVIA_SHARE_IN')) {
  if (!/android:launchMode=/.test(x)) x = x.replace(/<activity\b/, '<activity android:launchMode="singleTask"');
  const types = ['application/json', 'text/plain', 'application/octet-stream', 'text/x-json', 'application/x-json'];
  const send = '\n            <!-- SILVIA_SHARE_IN -->\n            <intent-filter android:label="SILVIA-BC">\n                <action android:name="android.intent.action.SEND" />\n                <category android:name="android.intent.category.DEFAULT" />\n' +
    types.map(t => '                <data android:mimeType="' + t + '" />\n').join('') + '            </intent-filter>\n';
  const view = '            <intent-filter android:label="SILVIA-BC">\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="content" />\n                <data android:scheme="file" />\n' +
    types.map(t => '                <data android:mimeType="' + t + '" />\n').join('') + '            </intent-filter>\n        ';
  x = x.replace(/<\/activity>/, send + view + '</activity>');
  fs.writeFileSync(mf, x);
  console.log('android: Share / Open with filters added');
}

// camera code reading: local Capacitor plugin with ML Kit text recognition (bundled Latin model, offline)
{
  const cfg = JSON.parse(fs.readFileSync(R('capacitor.config.json'), 'utf8'));
  const dir = R('android/app/src/main/java/' + cfg.appId.split('.').join('/'));
  fs.copyFileSync(R('tools/native/SilviaOcrPlugin.java'), path.join(dir, 'SilviaOcrPlugin.java'));
  fs.copyFileSync(R('tools/native/SilviaFilesPlugin.java'), path.join(dir, 'SilviaFilesPlugin.java'));
  const ma = path.join(dir, 'MainActivity.java');
  fs.writeFileSync(ma, `package ${cfg.appId};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SilviaOcrPlugin.class);
        registerPlugin(SilviaFilesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);
  let gg = fs.readFileSync(g, 'utf8');
  if (!gg.includes('com.google.mlkit:text-recognition')) {
    gg = gg.replace(/dependencies \{/, "dependencies {\n    implementation 'com.google.mlkit:text-recognition:16.0.0'");
    fs.writeFileSync(g, gg);
  }
  let mx = fs.readFileSync(mf, 'utf8');
  if (!mx.includes('android.permission.CAMERA')) {
    mx = mx.replace(/<application\b/, '<uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n\n    <application');
    fs.writeFileSync(mf, mx);
  }
  // 1-W45.4: files saved in Documents/SILVIA-BC. Android 11+ needs no permission; Android 10 and older need these.
  mx = fs.readFileSync(mf, 'utf8');
  if (!mx.includes('android.permission.WRITE_EXTERNAL_STORAGE')) {
    mx = mx.replace(/<application\b/, '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n\n    <application');
  }
  if (!mx.includes('requestLegacyExternalStorage')) mx = mx.replace(/<application\b/, '<application android:requestLegacyExternalStorage="true"');
  fs.writeFileSync(mf, mx);
  console.log('android: SilviaOcr plugin (ML Kit text recognition) and camera permission added');
}
