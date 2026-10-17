//! Comandos chamados pelo `MotorPdf` do Tauri (src/platform/tauri.ts).
//! O trabalho pesado roda fora da thread do runtime (spawn_blocking).

use tauri::ipc::{InvokeBody, Request, Response};
use tauri::State;

use super::motor::Abertura;
use super::servico::ServicoPdf;

async fn em_segundo_plano<T: Send + 'static>(
    tarefa: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(tarefa).await.map_err(|e| e.to_string())?
}

/// Recebe o PDF como bytes crus no corpo da chamada (sem converter para JSON).
#[tauri::command]
pub async fn pdf_abrir(request: Request<'_>, servico: State<'_, ServicoPdf>) -> Result<Abertura, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("O PDF deve ser enviado como bytes".into());
    };
    let (bytes, servico) = (bytes.clone(), servico.inner().clone());
    em_segundo_plano(move || servico.abrir(bytes)).await
}

/// Devolve a imagem como bytes crus: 8 bytes de cabeçalho + RGBA (ver `quadro.rs`).
#[tauri::command]
pub async fn pdf_renderizar(
    id: u32,
    pagina: u16,
    escala: f32,
    servico: State<'_, ServicoPdf>,
) -> Result<Response, String> {
    let servico = servico.inner().clone();
    em_segundo_plano(move || servico.renderizar(id, pagina, escala)).await.map(Response::new)
}

#[tauri::command]
pub async fn pdf_texto(id: u32, pagina: u16, servico: State<'_, ServicoPdf>) -> Result<String, String> {
    let servico = servico.inner().clone();
    em_segundo_plano(move || servico.texto(id, pagina)).await
}

#[tauri::command]
pub fn pdf_fechar(id: u32, servico: State<'_, ServicoPdf>) {
    servico.fechar(id);
}
