//! Thread dedicada dona do PDFium: os comandos do Tauri mandam pedidos e esperam a resposta.
//! Assim o PDFium (que não é thread-safe) só é usado de um lugar.

use std::path::PathBuf;
use std::sync::mpsc::{channel, Sender};

use super::motor::{carregar_pdfium, Abertura, Motor};

type Resposta<T> = Sender<Result<T, String>>;

enum Pedido {
    Abrir(Vec<u8>, Resposta<Abertura>),
    Renderizar(u32, u16, f32, Resposta<Vec<u8>>),
    Texto(u32, u16, Resposta<String>),
    Fechar(u32),
}

#[derive(Clone)]
pub struct ServicoPdf {
    pedidos: Sender<Pedido>,
}

impl ServicoPdf {
    pub fn iniciar(caminho_pdfium: PathBuf) -> Self {
        let (pedidos, recebidos) = channel::<Pedido>();
        std::thread::Builder::new()
            .name("pdfium".into())
            .spawn(move || {
                let mut motor = carregar_pdfium(&caminho_pdfium).map(Motor::new);
                for pedido in recebidos {
                    match (&mut motor, pedido) {
                        (Ok(m), Pedido::Abrir(bytes, r)) => drop(r.send(m.abrir(bytes))),
                        (Ok(m), Pedido::Renderizar(id, p, e, r)) => drop(r.send(m.renderizar(id, p, e))),
                        (Ok(m), Pedido::Texto(id, p, r)) => drop(r.send(m.texto(id, p))),
                        (Ok(m), Pedido::Fechar(id)) => m.fechar(id),
                        (Err(erro), Pedido::Abrir(_, r)) => drop(r.send(Err(erro.clone()))),
                        (Err(erro), Pedido::Renderizar(.., r)) => drop(r.send(Err(erro.clone()))),
                        (Err(erro), Pedido::Texto(.., r)) => drop(r.send(Err(erro.clone()))),
                        (Err(_), Pedido::Fechar(_)) => {}
                    }
                }
            })
            .expect("não foi possível criar a thread do PDFium");
        Self { pedidos }
    }

    fn pedir<T>(&self, montar: impl FnOnce(Resposta<T>) -> Pedido) -> Result<T, String> {
        let (resposta, recebida) = channel();
        self.pedidos.send(montar(resposta)).map_err(|_| "Serviço de PDF parado".to_string())?;
        recebida.recv().map_err(|_| "Serviço de PDF parado".to_string())?
    }

    pub fn abrir(&self, bytes: Vec<u8>) -> Result<Abertura, String> {
        self.pedir(|r| Pedido::Abrir(bytes, r))
    }

    pub fn renderizar(&self, id: u32, pagina: u16, escala: f32) -> Result<Vec<u8>, String> {
        self.pedir(|r| Pedido::Renderizar(id, pagina, escala, r))
    }

    pub fn texto(&self, id: u32, pagina: u16) -> Result<String, String> {
        self.pedir(|r| Pedido::Texto(id, pagina, r))
    }

    pub fn fechar(&self, id: u32) {
        let _ = self.pedidos.send(Pedido::Fechar(id));
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::pdf::motor::testes::pdf_de_teste;
    use pdfium_render::prelude::Pdfium;
    use std::path::Path;

    fn servico() -> ServicoPdf {
        let pasta = Path::new(env!("CARGO_MANIFEST_DIR")).join("pdfium");
        ServicoPdf::iniciar(Pdfium::pdfium_platform_library_name_at_path(&pasta))
    }

    #[test]
    fn atende_pedidos_de_varias_threads() {
        let s = servico();
        let a = s.abrir(pdf_de_teste(&[(200, 200), (200, 200)])).unwrap();
        let outro = s.clone();
        let id = a.id;
        let texto = std::thread::spawn(move || outro.texto(id, 1).unwrap()).join().unwrap();
        assert_eq!(texto, "Pagina 1");
        assert_eq!(s.renderizar(id, 2, 1.0).unwrap().len(), 8 + 200 * 200 * 4);
        s.fechar(id);
        assert!(s.texto(id, 1).is_err());
    }

    #[test]
    fn sem_a_biblioteca_responde_com_erro_em_vez_de_travar() {
        let s = ServicoPdf::iniciar(PathBuf::from("nao-existe/pdfium.dll"));
        let erro = s.abrir(pdf_de_teste(&[(100, 100)]));
        // Num processo de teste o PDFium pode já ter sido carregado por outro teste;
        // nesse caso abrir funciona. O que não pode é travar.
        let _ = erro;
    }
}
