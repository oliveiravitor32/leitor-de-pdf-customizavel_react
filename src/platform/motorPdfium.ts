import { invoke } from "@tauri-apps/api/core";
import type { DocumentoMotor, TamanhoPagina } from "../types";

const erroCancelado = () => new DOMException("Renderização cancelada", "AbortError");

/** Motor nativo (PDFium em Rust, ver src-tauri/src/pdf): desktop e Android. */
export async function abrirComPdfium(dados: ArrayBuffer): Promise<DocumentoMotor> {
  // Bytes crus no corpo da chamada: sem converter o PDF inteiro para JSON.
  const { id, tamanhos } = await invoke<{ id: number; tamanhos: TamanhoPagina[] }>(
    "pdf_abrir",
    new Uint8Array(dados),
  );

  return {
    numPaginas: tamanhos.length,
    tamanhos,

    async renderizar(pagina, escala, sinal) {
      if (sinal?.aborted) throw erroCancelado();
      const bytes = await invoke<ArrayBuffer>("pdf_renderizar", { id, pagina, escala });
      // O PDFium não para no meio; se a página saiu da tela, só descarta.
      if (sinal?.aborted) throw erroCancelado();
      const cabecalho = new DataView(bytes, 0, 8);
      const largura = cabecalho.getUint32(0, true);
      const altura = cabecalho.getUint32(4, true);
      const pixels = new Uint8ClampedArray(bytes, 8, largura * altura * 4);
      return createImageBitmap(new ImageData(pixels, largura, altura));
    },

    extrairTexto: (pagina) => invoke<string>("pdf_texto", { id, pagina }),
    fechar: () => invoke<void>("pdf_fechar", { id }),
  };
}
