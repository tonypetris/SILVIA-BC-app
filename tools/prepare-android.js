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
s = s.replace(/versionCode \d+/, 'versionCode ' + code).replace(/versionName "[^"]*"/, 'versionName "' + v + '"');
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
console.log('android: versionName', v, 'versionCode', code);
