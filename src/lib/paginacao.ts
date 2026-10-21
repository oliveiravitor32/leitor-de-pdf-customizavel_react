import type { TamanhoPagina } from "../types";

export type AcaoGesto = "anterior" | "proxima" | "menu" | null;

type Gesto = {
  /** Deslocamento do dedo (px) entre tocar e soltar. */
  dx: number;
  dy: number;
  /** Tempo (ms) entre tocar e soltar. */
  duracao: number;
  /** Posição horizontal do toque e largura da área (px). */
  x: number;
  largura: number;
  /** Rolagem horizontal no início do gesto (página ampliada); sem ela, a página cabe na tela. */
  rolagem?: { inicio: number; maximo: number };
};

const DESLIZE_MINIMO = 50;
const TOQUE_MAXIMO = 10;
const DURACAO_TOQUE = 350;
const BORDA = 0.3;
/** Tolerância (px) para considerar a rolagem encostada na borda. */
const FOLGA_BORDA = 2;

/** Interpreta um toque/deslize no modo página (estilo Kindle). */
export function classificarGesto({ dx, dy, duracao, x, largura, rolagem }: Gesto): AcaoGesto {
  if (Math.abs(dx) >= DESLIZE_MINIMO && Math.abs(dx) > Math.abs(dy) * 1.5) {
    const acao = dx < 0 ? "proxima" : "anterior";
    // Com zoom, o dedo primeiro arrasta a página; só vira quando ela já estava encostada na borda.
    if (rolagem && rolagem.maximo > FOLGA_BORDA) {
      const naBorda = acao === "proxima" ? rolagem.inicio >= rolagem.maximo - FOLGA_BORDA : rolagem.inicio <= FOLGA_BORDA;
      if (!naBorda) return null;
    }
    return acao;
  }
  const ehToque = Math.abs(dx) < TOQUE_MAXIMO && Math.abs(dy) < TOQUE_MAXIMO && duracao < DURACAO_TOQUE;
  if (!ehToque) return null;
  if (x < largura * BORDA) return "anterior";
  if (x > largura * (1 - BORDA)) return "proxima";
  return "menu";
}

/** Maior zoom em que a página inteira cabe na área. */
export function zoomParaCaber(pagina: TamanhoPagina, area: TamanhoPagina): number {
  return Math.min(area.largura / pagina.largura, area.altura / pagina.altura);
}
