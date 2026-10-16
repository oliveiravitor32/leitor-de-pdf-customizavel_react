import type { CSSProperties } from "react";
import type { EstadoLeitor } from "../types";

/** Tipografia do modo texto, igual nos dois layouts (contínuo e página). */
export function estiloTextoLeitura(estado: EstadoLeitor, corTexto: string): CSSProperties {
  return {
    color: corTexto,
    fontFamily: estado.fonteLeitura,
    fontSize: `${estado.tamanhoLeitura}px`,
    lineHeight: estado.linhaLeitura,
    letterSpacing: `${estado.espacamentoLeitura}em`,
    maxWidth: estado.larguraLeitura,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
}
