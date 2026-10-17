//! Formato da imagem devolvida ao JavaScript: 8 bytes de cabeçalho
//! (largura e altura, u32 little-endian) seguidos dos pixels RGBA.

pub fn empacotar(largura: u32, altura: u32, rgba: &[u8]) -> Vec<u8> {
    let mut quadro = Vec::with_capacity(8 + rgba.len());
    quadro.extend_from_slice(&largura.to_le_bytes());
    quadro.extend_from_slice(&altura.to_le_bytes());
    quadro.extend_from_slice(rgba);
    quadro
}

/// Tamanho em pixels de uma página de `pontos` com a escala dada (arredonda para cima, mínimo 1).
pub fn pixels(pontos: f32, escala: f32) -> u32 {
    ((pontos * escala).ceil() as u32).max(1)
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn cabecalho_tem_largura_e_altura_em_little_endian() {
        let quadro = empacotar(2, 1, &[1, 2, 3, 4, 5, 6, 7, 8]);
        assert_eq!(&quadro[0..4], &2u32.to_le_bytes());
        assert_eq!(&quadro[4..8], &1u32.to_le_bytes());
        assert_eq!(&quadro[8..], &[1, 2, 3, 4, 5, 6, 7, 8]);
    }

    #[test]
    fn pixels_arredonda_para_cima() {
        assert_eq!(pixels(612.0, 1.0), 612);
        assert_eq!(pixels(612.0, 0.5), 306);
        assert_eq!(pixels(100.0, 0.333), 34);
    }

    #[test]
    fn pixels_nunca_e_zero() {
        assert_eq!(pixels(1.0, 0.001), 1);
    }
}
