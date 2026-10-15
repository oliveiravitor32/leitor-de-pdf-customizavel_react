import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { abrirComPdfium } from "./motorPdfium";

/** Imagem no formato do Rust: largura e altura (u32 LE) + RGBA. */
function quadro(largura: number, altura: number) {
  const buf = new ArrayBuffer(8 + largura * altura * 4);
  const v = new DataView(buf);
  v.setUint32(0, largura, true);
  v.setUint32(4, altura, true);
  return buf;
}

beforeEach(() => {
  vi.stubGlobal(
    "ImageData",
    class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    },
  );
  vi.stubGlobal("createImageBitmap", vi.fn(async (img: { width: number; height: number }) => ({ ...img, close: vi.fn() })));
  vi.mocked(invoke).mockImplementation(async (comando: string) => {
    if (comando === "pdf_abrir") return { id: 7, tamanhos: [{ largura: 612, altura: 792 }] };
    if (comando === "pdf_renderizar") return quadro(3, 2);
    if (comando === "pdf_texto") return "texto";
    return undefined;
  });
});

describe("motor PDFium (Tauri)", () => {
  it("envia o PDF como bytes crus e lê os tamanhos das páginas", async () => {
    const dados = new Uint8Array([1, 2, 3]).buffer;
    const doc = await abrirComPdfium(dados);
    const [comando, corpo] = vi.mocked(invoke).mock.calls[0];
    expect(comando).toBe("pdf_abrir");
    expect(corpo).toBeInstanceOf(Uint8Array);
    expect(Array.from(corpo as Uint8Array)).toEqual([1, 2, 3]);
    expect(doc.numPaginas).toBe(1);
    expect(doc.tamanhos[0]).toEqual({ largura: 612, altura: 792 });
  });

  it("renderiza pelo Rust e monta a imagem a partir do cabeçalho + RGBA", async () => {
    const doc = await abrirComPdfium(new ArrayBuffer(1));
    const imagem = await doc.renderizar(1, 0.5);
    expect(invoke).toHaveBeenCalledWith("pdf_renderizar", { id: 7, pagina: 1, escala: 0.5 });
    expect([imagem.width, imagem.height]).toEqual([3, 2]);
    const dados = (createImageBitmap as ReturnType<typeof vi.fn>).mock.calls[0][0].data as Uint8ClampedArray;
    expect(dados.length).toBe(3 * 2 * 4);
  });

  it("não pede renderização se o sinal já veio abortado", async () => {
    const doc = await abrirComPdfium(new ArrayBuffer(1));
    const controle = new AbortController();
    controle.abort();
    await expect(doc.renderizar(1, 1, controle.signal)).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalledWith("pdf_renderizar", expect.anything());
  });

  it("descarta o resultado se o sinal foi abortado durante a renderização", async () => {
    const doc = await abrirComPdfium(new ArrayBuffer(1));
    const controle = new AbortController();
    vi.mocked(invoke).mockImplementationOnce(async () => {
      controle.abort();
      return quadro(1, 1);
    });
    await expect(doc.renderizar(1, 1, controle.signal)).rejects.toThrow();
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("extrai texto e fecha pelo id do documento", async () => {
    const doc = await abrirComPdfium(new ArrayBuffer(1));
    expect(await doc.extrairTexto(1)).toBe("texto");
    await doc.fechar();
    expect(invoke).toHaveBeenCalledWith("pdf_texto", { id: 7, pagina: 1 });
    expect(invoke).toHaveBeenCalledWith("pdf_fechar", { id: 7 });
  });
});
