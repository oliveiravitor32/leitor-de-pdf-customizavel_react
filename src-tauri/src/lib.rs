mod pdf;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Servidor localhost que recebe o retorno do login do Google (só desktop).
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_oauth::init());

    builder
        .plugin(tauri_plugin_google_login::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            pdf::comandos::pdf_abrir,
            pdf::comandos::pdf_abrir_caminho,
            pdf::comandos::pdf_renderizar,
            pdf::comandos::pdf_texto,
            pdf::comandos::pdf_fechar,
        ])
        .setup(|app| {
            app.manage(pdf::servico::ServicoPdf::iniciar(pdf::caminho_pdfium(app.handle())));
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
