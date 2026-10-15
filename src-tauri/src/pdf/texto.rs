//! Reconstrói parágrafos a partir dos trechos de texto posicionados da página
//! (mesma regra do `src/lib/pdf.ts` usado com o pdf.js).

/// Um trecho de texto numa linha: `y` é a base (em pontos, crescendo para cima).
#[derive(Debug, Clone, PartialEq)]
pub struct Trecho {
    pub texto: String,
    pub y: f32,
    pub altura: f32,
}

pub fn montar_texto(trechos: &[Trecho]) -> String {
    let mut saida = String::new();
    let mut anterior: Option<(f32, f32)> = None; // (y, altura) do último trecho com texto

    for trecho in trechos.iter().filter(|t| !t.texto.is_empty()) {
        if let Some((y, altura)) = anterior {
            let dy = y - trecho.y;
            if dy > altura * 1.6 {
                saida.push_str("\n\n");
            } else if dy > altura * 0.4 {
                saida.push('\n');
            } else if !saida.ends_with(' ') && !trecho.texto.starts_with(' ') {
                saida.push(' ');
            }
        }
        saida.push_str(&trecho.texto);
        let altura = if trecho.altura > 0.0 { trecho.altura } else { 12.0 };
        anterior = Some((trecho.y, altura));
    }

    normalizar_quebras(&saida)
}

/// Quebra simples vira espaço (a linha continua o parágrafo); 2+ quebras viram uma separação de parágrafo.
fn normalizar_quebras(texto: &str) -> String {
    let mut saida = String::with_capacity(texto.len());
    let mut quebras = 0;
    for c in texto.chars() {
        if c == '\n' {
            quebras += 1;
            continue;
        }
        match quebras {
            0 => {}
            1 if !saida.is_empty() => saida.push(' '),
            1 => {}
            _ => saida.push_str("\n\n"),
        }
        quebras = 0;
        saida.push(c);
    }
    saida.trim().to_string()
}

#[cfg(test)]
mod testes {
    use super::*;

    fn t(texto: &str, y: f32) -> Trecho {
        Trecho { texto: texto.into(), y, altura: 10.0 }
    }

    #[test]
    fn trechos_na_mesma_linha_viram_uma_frase() {
        assert_eq!(montar_texto(&[t("Olá", 100.0), t("mundo", 100.0)]), "Olá mundo");
    }

    #[test]
    fn quebra_de_linha_simples_vira_espaco() {
        assert_eq!(montar_texto(&[t("primeira", 100.0), t("segunda", 88.0)]), "primeira segunda");
    }

    #[test]
    fn distancia_grande_entre_linhas_vira_paragrafo() {
        assert_eq!(montar_texto(&[t("fim do parágrafo.", 100.0), t("Novo", 70.0)]), "fim do parágrafo.\n\nNovo");
    }

    #[test]
    fn trechos_vazios_sao_ignorados() {
        assert_eq!(montar_texto(&[t("", 200.0), t("texto", 100.0), t("", 50.0)]), "texto");
    }

    #[test]
    fn nao_duplica_espacos_que_ja_existem() {
        assert_eq!(montar_texto(&[t("a ", 100.0), t("b", 100.0)]), "a b");
    }

    #[test]
    fn varios_paragrafos_seguidos_viram_um_so_separador() {
        assert_eq!(
            montar_texto(&[t("um", 300.0), t("dois", 200.0), t("três", 100.0)]),
            "um\n\ndois\n\ntrês"
        );
    }

    #[test]
    fn pagina_sem_texto_devolve_vazio() {
        assert_eq!(montar_texto(&[]), "");
    }
}
