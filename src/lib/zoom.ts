export const ZOOM_PADRAO = 1.2;
export const ZOOM_MINIMO = 0.2;

/** Folga lateral (px) somada das duas margens do visualizador. */
const MARGEM = 32;

/**
 * Zoom ao abrir um PDF: o padrão em telas largas; em telas estreitas (celular)
 * a página é ajustada à largura disponível.
 */
export function zoomInicial(larguraPagina: number, larguraJanela: number): number {
  const ajuste = (larguraJanela - MARGEM) / larguraPagina;
  const zoom = Math.min(ZOOM_PADRAO, Math.max(ZOOM_MINIMO, ajuste));
  return Math.floor(zoom * 100) / 100;
}
