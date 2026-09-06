import type * as pdfjsLib from "pdfjs-dist";

export type DocumentoPdf = Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>;

export type ModoLeitura = "original" | "leitura";

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
  fonteLeitura: string;
  tamanhoLeitura: number;
  linhaLeitura: number;
  larguraLeitura: number;
  espacamentoLeitura: number;
  predefinicao: string;
  corTexto: string;
};
