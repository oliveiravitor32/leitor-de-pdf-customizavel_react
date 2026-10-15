import { carregarDocumentoPdf, extrairTextoPagina } from "./pdf";
import type { DocumentoMotor } from "../types";

const erroCancelado = () => new DOMException("Renderização cancelada", "AbortError");

/** Motor baseado no pdf.js (JavaScript): usado na web e como alternativa. */
export async function abrirComPdfjs(dados: ArrayBuffer): Promise<DocumentoMotor> {
  const doc = await carregarDocumentoPdf(dados);
  const tamanhos = await Promise.all(
    Array.from({ length: doc.numPages }, async (_, i) => {
      const { width, height } = (await doc.getPage(i + 1)).getViewport({ scale: 1 });
      return { largura: width, altura: height };
    }),
  );

  return {
    numPaginas: doc.numPages,
    tamanhos,

    async renderizar(pagina, escala, sinal) {
      if (sinal?.aborted) throw erroCancelado();
      const pdfPagina = await doc.getPage(pagina);
      if (sinal?.aborted) throw erroCancelado();
      const viewport = pdfPagina.getViewport({ scale: escala });
      const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const tarefa = pdfPagina.render({
        canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
        viewport,
      });
      const aoAbortar = () => tarefa.cancel();
      sinal?.addEventListener("abort", aoAbortar);
      try {
        await tarefa.promise;
      } finally {
        sinal?.removeEventListener("abort", aoAbortar);
      }
      return canvas.transferToImageBitmap();
    },

    extrairTexto: (pagina) => extrairTextoPagina(doc, pagina),
    fechar: () => doc.destroy(),
  };
}
