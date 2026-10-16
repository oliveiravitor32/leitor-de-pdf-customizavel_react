import type * as pdfjsLib from "pdfjs-dist";

export type DocumentoPdf = Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>;

export type ModoLeitura = "original" | "leitura";

/** "pagina": uma página por vez (estilo Kindle); "continuo": rolagem vertical. */
export type Layout = "pagina" | "continuo";

/** Ajustes de cor aplicados via filtro CSS sobre o canvas renderizado. */
export type Predefinicao = {
  fundo: string;
  inverter: number;
  matiz: number;
  contraste: number;
  brilho: number;
  sepia: number;
};

export type EstadoLeitor = Predefinicao & {
  modo: ModoLeitura;
  layout: Layout;
  fonteLeitura: string;
  tamanhoLeitura: number;
  linhaLeitura: number;
  larguraLeitura: number;
  espacamentoLeitura: number;
  predefinicao: string;
  corTexto: string;
};

/** Tamanho da página em pontos PDF (escala 1). */
export type TamanhoPagina = { largura: number; altura: number };

/**
 * Documento aberto num motor de PDF (pdf.js na web, PDFium no Tauri).
 * O resto do app só conhece esta interface.
 */
export interface DocumentoMotor {
  readonly numPaginas: number;
  readonly tamanhos: readonly TamanhoPagina[];
  /** Desenha a página (1-based) com largura = tamanho * escala pixels. */
  renderizar(pagina: number, escala: number, sinal?: AbortSignal): Promise<ImageBitmap>;
  extrairTexto(pagina: number): Promise<string>;
  fechar(): Promise<void>;
}
