import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { DocumentoPdf } from "../types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function carregarDocumentoPdf(dados: ArrayBuffer): Promise<DocumentoPdf> {
  return pdfjsLib.getDocument({ data: dados }).promise;
}

/**
 * Reconstrói parágrafos a partir dos itens de texto posicionados do PDF.js:
 * a diferença vertical entre dois itens vira quebra de parágrafo, de linha ou espaço.
 */
export async function extrairTextoPagina(
  documento: DocumentoPdf,
  numeroPagina: number,
): Promise<string> {
  const pagina = await documento.getPage(numeroPagina);
  const conteudo = await pagina.getTextContent();
  let saida = "";
  let ultimoY: number | null = null;
  let ultimaAltura = 0;

  for (const item of conteudo.items) {
    if (!("str" in item) || !item.str) continue;
    const y = item.transform[5];
    const altura = Math.abs(item.transform[3] || item.transform[0]) || 12;
    if (ultimoY !== null) {
      const dy = ultimoY - y;
      if (dy > ultimaAltura * 1.6) saida += "\n\n";
      else if (dy > ultimaAltura * 0.4) saida += "\n";
      else if (!saida.endsWith(" ") && !item.str.startsWith(" ")) saida += " ";
    }
    saida += item.str;
    if (item.hasEOL) saida += "\n";
    ultimoY = y;
    ultimaAltura = altura;
  }

  return saida
    .replace(/([^\n])\n([^\n])/g, "$1 $2")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}
