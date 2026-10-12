import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readFile: vi.fn() }));

import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { plataformaTauri } from "./tauri";

describe("plataformaTauri.escolherPdf", () => {
  it("abre o diálogo nativo filtrando PDF e lê o arquivo escolhido", async () => {
    vi.mocked(open).mockResolvedValue("C:\\docs\\livro.pdf");
    vi.mocked(readFile).mockResolvedValue(new Uint8Array([1, 2]));

    const arquivo = await plataformaTauri.escolherPdf();

    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: false, filters: [{ name: "PDF", extensions: ["pdf"] }] }),
    );
    expect(readFile).toHaveBeenCalledWith("C:\\docs\\livro.pdf");
    expect(arquivo?.nome).toBe("livro.pdf");
    expect(new Uint8Array(arquivo!.dados)).toEqual(new Uint8Array([1, 2]));
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
