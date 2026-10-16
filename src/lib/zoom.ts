export const ZOOM_PADRAO = 1.2;
export const ZOOM_MINIMO = 0.2;

/** Folga lateral (px) somada das duas margens do visualizador. */
const MARGEM = 32;

/**
 * Zoom ao abrir um PDF: o padrão em telas largas; em telas estreitas (celular)
 * a página é ajustada à largura disponível.
 */
export function zoomInicial(larguraPagina: number, larguraJanela: number, margem = MARGEM): number {
  const ajuste = (larguraJanela - margem) / larguraPagina;
  const zoom = Math.min(ZOOM_PADRAO, Math.max(ZOOM_MINIMO, ajuste));
  // Três casas: com duas, sobrava até ~6 px de vão numa página A4.
  return Math.floor(zoom * 1000) / 1000;
}

export const ZOOM_MAXIMO = 3;
export const TAMANHO_TEXTO_MINIMO = 12;
export const TAMANHO_TEXTO_MAXIMO = 40;

const limitar = (valor: number, min: number, max: number) => Math.min(max, Math.max(min, valor));

/** Zoom do PDF depois de uma pinça com a escala dada. */
export function escalarZoom(zoom: number, escala: number): number {
  return Math.round(limitar(zoom * escala, ZOOM_MINIMO, ZOOM_MAXIMO) * 100) / 100;
}

/** Tamanho da fonte do modo texto depois de uma pinça com a escala dada. */
export function escalarTamanhoTexto(tamanho: number, escala: number): number {
  return Math.round(limitar(tamanho * escala, TAMANHO_TEXTO_MINIMO, TAMANHO_TEXTO_MAXIMO));
}
