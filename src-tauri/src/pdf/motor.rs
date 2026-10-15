//! Documentos abertos no PDFium. Não é thread-safe: fica dentro da thread do serviço.

use std::collections::HashMap;
use std::path::Path;
use std::sync::OnceLock;

use pdfium_render::prelude::*;
use serde::Serialize;

use super::quadro;
use super::texto::{montar_texto, Trecho};

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct TamanhoPagina {
    pub largura: f32,
    pub altura: f32,
}

#[derive(Debug, Serialize)]
pub struct Abertura {
    pub id: u32,
    pub tamanhos: Vec<TamanhoPagina>,
}

static PDFIUM: OnceLock<Pdfium> = OnceLock::new();

/// Carrega a biblioteca do PDFium uma única vez por processo.
pub fn carregar_pdfium(caminho: &Path) -> Result<&'static Pdfium, String> {
    if let Some(pdfium) = PDFIUM.get() {
        return Ok(pdfium);
    }
    let bindings = Pdfium::bind_to_library(caminho).map_err(|e| format!("PDFium não carregou ({}): {e}", caminho.display()))?;
    Ok(PDFIUM.get_or_init(|| Pdfium::new(bindings)))
}

pub struct Motor {
    pdfium: &'static Pdfium,
    documentos: HashMap<u32, PdfDocument<'static>>,
    proximo_id: u32,
}

impl Motor {
    pub fn new(pdfium: &'static Pdfium) -> Self {
        Self { pdfium, documentos: HashMap::new(), proximo_id: 1 }
    }

    pub fn abrir(&mut self, bytes: Vec<u8>) -> Result<Abertura, String> {
        let documento = self.pdfium.load_pdf_from_byte_vec(bytes, None).map_err(|e| format!("PDF inválido: {e}"))?;
        let tamanhos = documento
            .pages()
            .iter()
            .map(|p| TamanhoPagina { largura: p.width().value, altura: p.height().value })
            .collect();
        let id = self.proximo_id;
        self.proximo_id += 1;
        self.documentos.insert(id, documento);
        Ok(Abertura { id, tamanhos })
    }

    fn pagina(&self, id: u32, pagina: u16) -> Result<PdfPage<'static>, String> {
        let documento = self.documentos.get(&id).ok_or("Documento não está aberto")?;
        documento
            .pages()
            .get(pagina as PdfPageIndex - 1)
            .map_err(|_| format!("Página {pagina} não existe"))
    }

    /// Página 1-based renderizada em `escala` pixels por ponto, no formato de `quadro::empacotar`.
    pub fn renderizar(&self, id: u32, pagina: u16, escala: f32) -> Result<Vec<u8>, String> {
        let pagina = self.pagina(id, pagina)?;
        let largura = quadro::pixels(pagina.width().value, escala);
        let altura = quadro::pixels(pagina.height().value, escala);
        let config = PdfRenderConfig::new()
            .set_target_size(largura as Pixels, altura as Pixels)
            .render_form_data(true);
        let bitmap = pagina.render_with_config(&config).map_err(|e| format!("Falha ao desenhar: {e}"))?;
        Ok(quadro::empacotar(bitmap.width() as u32, bitmap.height() as u32, &bitmap.as_rgba_bytes()))
    }

    pub fn texto(&self, id: u32, pagina: u16) -> Result<String, String> {
        let pagina = self.pagina(id, pagina)?;
        let texto = pagina.text().map_err(|e| format!("Falha ao ler o texto: {e}"))?;
        let trechos: Vec<Trecho> = texto
            .segments()
            .iter()
            .map(|s| {
                let caixa = s.bounds();
                Trecho { texto: s.text(), y: caixa.bottom().value, altura: caixa.height().value }
            })
            .collect();
        Ok(montar_texto(&trechos))
    }

    pub fn fechar(&mut self, id: u32) {
        self.documentos.remove(&id);
    }
}

#[cfg(test)]
pub(crate) mod testes {
    use super::*;

    /// PDF mínimo: cada página com o texto "Pagina N" e um retângulo azul.
    pub fn pdf_de_teste(tamanhos: &[(u32, u32)]) -> Vec<u8> {
        let mut objetos = vec![
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            String::new(),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
        ];
        let mut filhos = Vec::new();
        for (i, (l, a)) in tamanhos.iter().enumerate() {
            let conteudo = format!("BT /F1 24 Tf 20 {} Td (Pagina {}) Tj ET 0 0 1 rg 20 20 100 100 re f", a - 40, i + 1);
            objetos.push(format!("<< /Length {} >>\nstream\n{}\nendstream", conteudo.len(), conteudo));
            let c = objetos.len();
            objetos.push(format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {l} {a}] /Contents {c} 0 R /Resources << /Font << /F1 3 0 R >> >> >>"
            ));
            filhos.push(format!("{} 0 R", objetos.len()));
        }
        objetos[1] = format!("<< /Type /Pages /Kids [{}] /Count {} >>", filhos.join(" "), tamanhos.len());

        let mut pdf = String::from("%PDF-1.4\n");
        let mut posicoes = Vec::new();
        for (i, o) in objetos.iter().enumerate() {
            posicoes.push(pdf.len());
            pdf.push_str(&format!("{} 0 obj\n{}\nendobj\n", i + 1, o));
        }
        let xref = pdf.len();
        pdf.push_str(&format!("xref\n0 {}\n0000000000 65535 f \n", objetos.len() + 1));
        for p in posicoes {
            pdf.push_str(&format!("{p:010} 00000 n \n"));
        }
        pdf.push_str(&format!("trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF", objetos.len() + 1, xref));
        pdf.into_bytes()
    }

    pub fn motor() -> Motor {
        let dll = Path::new(env!("CARGO_MANIFEST_DIR")).join("pdfium");
        let caminho = Pdfium::pdfium_platform_library_name_at_path(&dll);
        Motor::new(carregar_pdfium(&caminho).expect("rode `npm run pdfium:baixar` antes dos testes"))
    }

    #[test]
    fn abre_e_informa_o_tamanho_de_cada_pagina() {
        let mut m = motor();
        let a = m.abrir(pdf_de_teste(&[(612, 792), (300, 400)])).unwrap();
        assert_eq!(
            a.tamanhos,
            vec![TamanhoPagina { largura: 612.0, altura: 792.0 }, TamanhoPagina { largura: 300.0, altura: 400.0 }]
        );
    }

    #[test]
    fn cada_documento_ganha_um_id_diferente() {
        let mut m = motor();
        let a = m.abrir(pdf_de_teste(&[(100, 100)])).unwrap();
        let b = m.abrir(pdf_de_teste(&[(100, 100)])).unwrap();
        assert_ne!(a.id, b.id);
    }

    #[test]
    fn pdf_invalido_da_erro() {
        assert!(motor().abrir(b"isso nao e um pdf".to_vec()).is_err());
    }

    #[test]
    fn renderiza_na_escala_pedida_em_rgba() {
        let mut m = motor();
        let a = m.abrir(pdf_de_teste(&[(300, 400)])).unwrap();
        let quadro = m.renderizar(a.id, 1, 0.5).unwrap();
        let largura = u32::from_le_bytes(quadro[0..4].try_into().unwrap());
        let altura = u32::from_le_bytes(quadro[4..8].try_into().unwrap());
        assert_eq!((largura, altura), (150, 200));
        assert_eq!(quadro.len(), 8 + 150 * 200 * 4);

        // Pixel dentro do retângulo azul (20..120 pt a partir de baixo).
        let (x, y) = (35usize, 200 - 35usize);
        let i = 8 + (y * 150 + x) * 4;
        assert_eq!(&quadro[i..i + 4], &[0, 0, 255, 255]);
    }

    #[test]
    fn extrai_o_texto_da_pagina() {
        let mut m = motor();
        let a = m.abrir(pdf_de_teste(&[(300, 400), (300, 400)])).unwrap();
        assert_eq!(m.texto(a.id, 2).unwrap(), "Pagina 2");
    }

    #[test]
    fn pagina_ou_documento_inexistente_da_erro() {
        let mut m = motor();
        let a = m.abrir(pdf_de_teste(&[(100, 100)])).unwrap();
        assert!(m.renderizar(a.id, 5, 1.0).is_err());
        assert!(m.renderizar(999, 1, 1.0).is_err());
    }

    #[test]
    fn fechar_libera_o_documento() {
        let mut m = motor();
        let a = m.abrir(pdf_de_teste(&[(100, 100)])).unwrap();
        m.fechar(a.id);
        assert!(m.texto(a.id, 1).is_err());
    }
}
