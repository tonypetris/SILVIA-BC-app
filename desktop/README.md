# S.I.L.V.I.A. + B + C per Windows (prova)

Il programma è lo stesso della pagina web (`www/index.html`, copia di `SILVIA-BC.html`), dentro una finestra propria con [Tauri 2](https://tauri.app).
Il workflow `.github/workflows/desktop.yml` lo compila su GitHub (Windows) a ogni push sul ramo `desktop`
e pubblica la pre-release `desktop-v<versione>` con l'installatore `.exe` (NSIS, per l'utente corrente, senza diritti di amministratore) e il `.msi`.

Per aggiornare: copiare il nuovo `SILVIA-BC.html` in `www/index.html`, cambiare `version` in `src-tauri/tauri.conf.json` e `src-tauri/Cargo.toml`, fare push.
L'installatore non è firmato: al primo avvio Windows SmartScreen chiede «Ulteriori informazioni → Esegui comunque».
