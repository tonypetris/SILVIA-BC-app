// S.I.L.V.I.A. + B + C for Windows: the same program as the web page (www/index.html) in its own window
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running S.I.L.V.I.A. + B + C");
}
