//! Motor de PDF nativo (PDFium) usado no desktop e no Android.

pub mod comandos;
pub mod motor;
pub mod quadro;
pub mod servico;
pub mod texto;

use std::path::PathBuf;

use pdfium_render::prelude::Pdfium;
use tauri::{AppHandle, Manager, Runtime};

/// Onde está a biblioteca do PDFium em cada plataforma.
pub fn caminho_pdfium<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    if cfg!(target_os = "android") {
        // Empacotada em jniLibs: o Android encontra pelo nome.
        PathBuf::from(Pdfium::pdfium_platform_library_name())
    } else {
        let recursos = app.path().resource_dir().unwrap_or_default().join("pdfium");
        Pdfium::pdfium_platform_library_name_at_path(&recursos)
    }
}
