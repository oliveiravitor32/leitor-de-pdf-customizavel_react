import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readFile: vi.fn() }));

import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { plataformaTauri } from "./tauri";

describe("plataformaTauri.escolherPdf", () => {
  it("abre o diálogo nativo filtrando PDF e devolve só o caminho (o Rust lê o arquivo)", async () => {
    vi.mocked(open).mockResolvedValue("C:\\docs\\livro.pdf");

    const arquivo = await plataformaTauri.escolherPdf();

    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: false, filters: [{ name: "PDF", extensions: ["pdf"] }] }),
    );
    expect(readFile).not.toHaveBeenCalled();
    expect(arquivo).toEqual({ nome: "livro.pdf", caminho: "C:\\docs\\livro.pdf" });
  });

  it("extrai o nome de caminhos com barra normal", async () => {
    vi.mocked(open).mockResolvedValue("/home/u/a b.pdf");
    vi.mocked(readFile).mockResolvedValue(new Uint8Array());
    expect((await plataformaTauri.escolherPdf())?.nome).toBe("a b.pdf");
  });

  it("devolve null quando o usuário cancela", async () => {
    vi.mocked(open).mockResolvedValue(null);
    expect(await plataformaTauri.escolherPdf()).toBeNull();
    expect(readFile).not.toHaveBeenCalled();
  });
});
