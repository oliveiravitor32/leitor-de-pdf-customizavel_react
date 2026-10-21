import { beforeEach, describe, expect, it, vi } from "vitest";

const render = vi.fn();
const cancelar = vi.fn();
const destroy = vi.fn(async () => {});

vi.mock("./pdf", () => ({
  carregarDocumentoPdf: vi.fn(async () => ({
    numPages: 2,
    getPage: vi.fn(async (n: number) => ({
      getViewport: ({ scale }: { scale: number }) => ({ width: (n === 1 ? 600 : 800) * scale, height: 1000 * scale }),
      render: (opcoes: unknown) => {
        render(opcoes);
        return { promise: new Promise((resolve) => setTimeout(resolve, 300)), cancel: cancelar };
      },
    })),
    destroy,
  })),
  extrairTextoPagina: vi.fn(async (_doc: unknown, n: number) => `texto ${n}`),
}));

import { abrirComPdfjs } from "./motorPdfjs";

class OffscreenCanvasFalso {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    return {};
  }
  transferToImageBitmap() {
    return { width: this.width, height: this.height, close: vi.fn() };
  }
}

beforeEach(() => {
  vi.stubGlobal("OffscreenCanvas", OffscreenCanvasFalso);
});

describe("motor pdf.js", () => {
  it("abre o documento com número e tamanho (escala 1) de cada página", async () => {
    const doc = await abrirComPdfjs(new ArrayBuffer(1));
    expect(doc.numPaginas).toBe(2);
    expect(doc.motor).toBe("pdf.js");
    expect(doc.tamanhos).toEqual([
      { largura: 600, altura: 1000 },
      { largura: 800, altura: 1000 },
    ]);
  });

  it("renderiza a página na escala pedida e devolve uma imagem", async () => {
    const doc = await abrirComPdfjs(new ArrayBuffer(1));
    const imagem = await doc.renderizar(1, 2);
    expect(imagem.width).toBe(1200);
    expect(imagem.height).toBe(2000);
    expect(render).toHaveBeenCalled();
  });

  it("cancela a renderização quando o sinal é abortado", async () => {
    const doc = await abrirComPdfjs(new ArrayBuffer(1));
    const controle = new AbortController();
    const promessa = doc.renderizar(1, 1, controle.signal);
    await vi.waitFor(() => expect(render).toHaveBeenCalled());
    controle.abort();
    await promessa.catch(() => {});
    expect(cancelar).toHaveBeenCalled();
  });

  it("não começa a renderizar se o sinal já veio abortado", async () => {
    const doc = await abrirComPdfjs(new ArrayBuffer(1));
    const controle = new AbortController();
    controle.abort();
    await expect(doc.renderizar(1, 1, controle.signal)).rejects.toThrow();
    expect(render).not.toHaveBeenCalled();
  });

  it("extrai texto e fecha o documento", async () => {
    const doc = await abrirComPdfjs(new ArrayBuffer(1));
    expect(await doc.extrairTexto(2)).toBe("texto 2");
    await doc.fechar();
    expect(destroy).toHaveBeenCalled();
  });
});
