import { invoke } from "@tauri-apps/api/core";
import type { DocumentoMotor, TamanhoPagina } from "../types";

type Abertura = { id: number; tamanhos: TamanhoPagina[] };

const erroCancelado = () => new DOMException("Renderização cancelada", "AbortError");

/** No desktop a resposta chega como ArrayBuffer; no Android pode vir como lista de números. */
function paraArrayBuffer(resposta: ArrayBuffer | number[]): ArrayBuffer {
  return Array.isArray(resposta) ? new Uint8Array(resposta).buffer : resposta;
}

/** Motor nativo (PDFium em Rust, ver src-tauri/src/pdf): desktop e Android. */
export async function abrirComPdfium(fonte: ArrayBuffer | { caminho: string }): Promise<DocumentoMotor> {
  // Com caminho, o Rust lê o arquivo; sem ele, bytes crus no corpo (sem converter para JSON).
  const { id, tamanhos } =
    fonte instanceof ArrayBuffer
      ? await invoke<Abertura>("pdf_abrir", new Uint8Array(fonte))
      : await invoke<Abertura>("pdf_abrir_caminho", { caminho: fonte.caminho });

  return {
    motor: "PDFium",
    numPaginas: tamanhos.length,
    tamanhos,

    async renderizar(pagina, escala, sinal) {
      if (sinal?.aborted) throw erroCancelado();
      const bytes = paraArrayBuffer(await invoke<ArrayBuffer | number[]>("pdf_renderizar", { id, pagina, escala }));
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
