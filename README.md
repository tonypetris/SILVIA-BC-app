# S.I.L.V.I.A. + B + C – app Android

App Android nativa (Capacitor) di **S.I.L.V.I.A. + B + C**: selettività, filiazione (back-up) e coordinamento di cavi e differenziali Hager.
Funziona **offline**: librerie PDF/XLS incluse nell'app, nessun dato salvato automaticamente (ogni avvio parte da impianto vuoto).

## Installare l'app
1. Apri la pagina **Releases** del repository dal telefono (oppure **Actions → ultima esecuzione → Artifacts** per le build di prova).
2. Scarica il file `SILVIA-BC_<versione>.apk` e aprilo.
3. Android chiede di consentire l'installazione da quella origine (browser o File): consenti e installa.

Salva progetto, report PDF e XLS aprono il menu **Condividi** di Android (Drive, e-mail, WhatsApp, File → Download…).
Apri progetto usa il selettore file di Android.

## Come si aggiorna
- `src/SILVIA-BC.html` è il programma desktop (cartella `1_Programma_Program` del pacchetto): sostituiscilo con la nuova versione.
- Aggiorna `"version"` in `package.json` (es. `1.1.0-rc.4`, poi `1.1.0`).
- Ogni push su `main` compila l'APK (Actions → Artifacts). Un tag `v1.1.0-rc.4` lo pubblica anche su **Releases**.

## Firma dell'app
Senza firma di release GitHub produce un APK *debug*: si installa, ma ogni nuova versione richiede di disinstallare la precedente.
Per aggiornamenti senza disinstallare, aggiungi in **Settings → Secrets and variables → Actions** i secrets:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
Conserva il keystore in un posto sicuro: senza lo stesso keystore non si possono pubblicare aggiornamenti dell'app installata.

## Struttura
| Percorso | Contenuto |
|---|---|
| `src/SILVIA-BC.html` | programma (file unico) |
| `src/android-bridge.js` | salvataggio dei file tramite Condividi di Android |
| `tools/build-www.js` | crea `www/` con librerie locali e bridge |
| `tools/prepare-android.js` | versione dell'app e firma di release |
| `assets/` | icona e schermata di avvio |
| `.github/workflows/android.yml` | compilazione APK su GitHub Actions |

© 2026 Antonio Petris · Tutti i diritti riservati. Valori indicativi: verificare sempre sulla documentazione Hager ufficiale.
