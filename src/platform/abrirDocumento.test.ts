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
