import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/motorPdfjs", () => ({ abrirComPdfjs: vi.fn(async () => ({ numPaginas: 3 })) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readFile: vi.fn() }));

import { abrirComPdfjs } from "../lib/motorPdfjs";
import { plataformaWeb } from "./web";

describe("abrirDocumento", () => {
  it("na web abre com o pdf.js", async () => {
    const dados = new ArrayBuffer(4);
    const doc = await plataformaWeb.abrirDocumento(dados);
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
    const doc = await plataformaTauri.abrirDocumento(new ArrayBuffer(1));
    expect(pdfjs).toHaveBeenCalled();
    expect(doc.numPaginas).toBe(3);
    expect(aviso).toHaveBeenCalledWith("[pdf] PDFium indisponível, usando pdf.js:", "sem pdfium");
  });

  it("no Tauri, quando o PDFium funciona, não usa o pdf.js", async () => {
    vi.resetModules();
    vi.doMock("./motorPdfium", () => ({ abrirComPdfium: vi.fn(async () => ({ numPaginas: 9 })) }));
    const { plataformaTauri } = await import("./tauri");
    const { abrirComPdfjs: pdfjs } = await import("../lib/motorPdfjs");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const doc = await plataformaTauri.abrirDocumento(new ArrayBuffer(1));
    expect(doc.numPaginas).toBe(9);
    expect(info).toHaveBeenCalledWith("[pdf] motor: PDFium");
    expect(pdfjs).not.toHaveBeenCalled();
  });
});
