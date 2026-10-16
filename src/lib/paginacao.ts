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
};

const DESLIZE_MINIMO = 50;
const TOQUE_MAXIMO = 10;
const DURACAO_TOQUE = 350;
const BORDA = 0.3;

/** Interpreta um toque/deslize no modo página (estilo Kindle). */
export function classificarGesto({ dx, dy, duracao, x, largura }: Gesto): AcaoGesto {
  if (Math.abs(dx) >= DESLIZE_MINIMO && Math.abs(dx) > Math.abs(dy) * 1.5) {
    return dx < 0 ? "proxima" : "anterior";
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
