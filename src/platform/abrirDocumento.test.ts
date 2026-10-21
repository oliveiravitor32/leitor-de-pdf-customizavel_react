import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/motorPdfjs", () => ({ abrirComPdfjs: vi.fn(async () => ({ motor: "pdf.js", numPaginas: 3 })) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readFile: vi.fn(async () => new Uint8Array([9, 9])) }));

import { abrirComPdfjs } from "../lib/motorPdfjs";
import { plataformaWeb } from "./web";

describe("abrirDocumento", () => {
  it("na web abre com o pdf.js", async () => {
    const dados = new ArrayBuffer(4);
    const doc = await plataformaWeb.abrirDocumento({ nome: "a.pdf", dados });
    expect(abrirComPdfjs).toHaveBeenCalledWith(dados);
    expect(doc.numPaginas).toBe(3);
  });
});

describe("abrirDocumento no Tauri", () => {
  it("usa o PDFium e, se ele falhar, volta para o pdf.js", async () => {
    vi.resetModules();
    vi.doMock("./motorPdfium", () => ({ abrirComPdfium: vi.fn(async () => Promise.reject(new Error("sem pdfium"))) }));
    const { plataformaTauri } = await import("./tauri");
    const { abrirComPdfjs: pdfjs } = await import("../lib/motorPdfjs");
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const doc = await plataformaTauri.abrirDocumento({ nome: "a.pdf", dados: new ArrayBuffer(1) });
    expect(pdfjs).toHaveBeenCalled();
    expect(doc.numPaginas).toBe(3);
    expect(aviso).toHaveBeenCalledWith("[pdf] PDFium indisponível, usando pdf.js:", "sem pdfium");
    expect(doc.motor).toBe("pdf.js");
    expect(doc.motivoReserva).toBe("sem pdfium");
  });

  it("no Tauri, quando o PDFium funciona, não usa o pdf.js", async () => {
    vi.resetModules();
    vi.doMock("./motorPdfium", () => ({ abrirComPdfium: vi.fn(async () => ({ numPaginas: 9 })) }));
    const { plataformaTauri } = await import("./tauri");
    const { abrirComPdfjs: pdfjs } = await import("../lib/motorPdfjs");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const doc = await plataformaTauri.abrirDocumento({ nome: "a.pdf", dados: new ArrayBuffer(1) });
    expect(doc.numPaginas).toBe(9);
    expect(info).toHaveBeenCalledWith("[pdf] motor: PDFium");
    expect(pdfjs).not.toHaveBeenCalled();
  });

  it("com caminho, o PDFium abre o arquivo direto pelo caminho", async () => {
    vi.resetModules();
    const pdfium = vi.fn(async () => ({ motor: "PDFium", numPaginas: 4 }));
    vi.doMock("./motorPdfium", () => ({ abrirComPdfium: pdfium }));
    const { plataformaTauri } = await import("./tauri");
    vi.spyOn(console, "info").mockImplementation(() => {});
    const doc = await plataformaTauri.abrirDocumento({ nome: "a.pdf", caminho: "content://x/a.pdf" });
    expect(pdfium).toHaveBeenCalledWith({ caminho: "content://x/a.pdf" });
    expect(doc.numPaginas).toBe(4);
  });

  it("com caminho e sem PDFium, lê os bytes do arquivo para o pdf.js", async () => {
    vi.resetModules();
    vi.doMock("./motorPdfium", () => ({ abrirComPdfium: vi.fn(async () => Promise.reject(new Error("x"))) }));
    const { plataformaTauri } = await import("./tauri");
    const { abrirComPdfjs: pdfjs } = await import("../lib/motorPdfjs");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await plataformaTauri.abrirDocumento({ nome: "a.pdf", caminho: "content://x/a.pdf" });
    expect(readFile).toHaveBeenCalledWith("content://x/a.pdf");
    expect(Array.from(new Uint8Array(vi.mocked(pdfjs).mock.calls[0][0] as ArrayBuffer))).toEqual([9, 9]);
  });
});
