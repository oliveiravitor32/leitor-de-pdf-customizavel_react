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

/// No desktop o corpo chega como bytes crus; no Android o IPC passa por
/// postMessage e o mesmo Uint8Array chega como JSON (lista ou objeto de índices).
fn bytes_do_corpo(corpo: &InvokeBody) -> Result<Vec<u8>, String> {
    let erro = || "O PDF deve ser enviado como bytes".to_string();
    let byte = |v: &serde_json::Value| v.as_u64().and_then(|n| u8::try_from(n).ok()).ok_or_else(erro);
    match corpo {
        InvokeBody::Raw(bytes) => Ok(bytes.clone()),
        InvokeBody::Json(serde_json::Value::Array(lista)) => lista.iter().map(byte).collect(),
        InvokeBody::Json(serde_json::Value::Object(mapa)) => {
            let mut bytes = vec![0u8; mapa.len()];
            for (indice, valor) in mapa {
                let i: usize = indice.parse().map_err(|_| erro())?;
                *bytes.get_mut(i).ok_or_else(erro)? = byte(valor)?;
            }
            Ok(bytes)
        }
        _ => Err(erro()),
    }
}

/// Recebe o PDF como bytes no corpo da chamada (sem campos JSON em volta).
#[tauri::command]
pub async fn pdf_abrir(request: Request<'_>, servico: State<'_, ServicoPdf>) -> Result<Abertura, String> {
    let bytes = bytes_do_corpo(request.body())?;
    let servico = servico.inner().clone();
    em_segundo_plano(move || servico.abrir(bytes)).await
}

/// Abre o PDF lendo o arquivo aqui no Rust: só o caminho atravessa a ponte.
/// Aceita caminhos do desktop e `content://` do Android (via plugin-fs).
#[tauri::command]
pub async fn pdf_abrir_caminho(
    app: tauri::AppHandle,
    caminho: String,
    servico: State<'_, ServicoPdf>,
) -> Result<Abertura, String> {
    use tauri_plugin_fs::{FilePath, FsExt};
    let servico = servico.inner().clone();
    em_segundo_plano(move || {
        let arquivo: FilePath = caminho.parse().map_err(|e: std::convert::Infallible| e.to_string())?;
        let bytes = app.fs().read(arquivo).map_err(|e| format!("Não foi possível ler o PDF: {e}"))?;
        servico.abrir(bytes)
    })
    .await
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn aceita_bytes_crus() {
        assert_eq!(bytes_do_corpo(&InvokeBody::Raw(vec![1, 2, 3])).unwrap(), vec![1, 2, 3]);
    }

    #[test]
    fn aceita_json_em_lista_como_no_android() {
        assert_eq!(bytes_do_corpo(&InvokeBody::Json(json!([37, 80, 68]))).unwrap(), vec![37, 80, 68]);
    }

    #[test]
    fn aceita_json_com_indices_como_objeto() {
        let corpo = InvokeBody::Json(json!({"1": 80, "0": 37, "2": 68}));
        assert_eq!(bytes_do_corpo(&corpo).unwrap(), vec![37, 80, 68]);
    }

    #[test]
    fn recusa_o_que_nao_e_bytes() {
        assert!(bytes_do_corpo(&InvokeBody::Json(json!({"id": "x"}))).is_err());
        assert!(bytes_do_corpo(&InvokeBody::Json(json!([300]))).is_err());
    }
}
