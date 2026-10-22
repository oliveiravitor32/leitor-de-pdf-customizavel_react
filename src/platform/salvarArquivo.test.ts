import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readFile: vi.fn(), writeTextFile: vi.fn(async () => {}) }));

import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { plataformaTauri } from "./tauri";
import { plataformaWeb } from "./web";

describe("plataformaWeb.salvarArquivo", () => {
  it("baixa o texto como arquivo com o nome dado", async () => {
    const criarUrl = vi.fn((_blob: Blob) => "blob:teste");
    const liberarUrl = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: criarUrl, revokeObjectURL: liberarUrl });
    const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("dados.json");
      expect(this.href).toBe("blob:teste");
    });

    expect(await plataformaWeb.salvarArquivo("dados.json", '{"a":1}', "application/json")).toBe(true);

    expect(clique).toHaveBeenCalled();
    const blob = criarUrl.mock.calls[0][0];
    expect(blob.type).toBe("application/json");
    expect(await blob.text()).toBe('{"a":1}');
    expect(liberarUrl).toHaveBeenCalledWith("blob:teste");
    vi.unstubAllGlobals();
  });
});

describe("plataformaTauri.salvarArquivo", () => {
  it("pergunta onde salvar no diálogo nativo e grava o texto lá", async () => {
    vi.mocked(save).mockResolvedValue("C:\\docs\\dados.json");
    expect(await plataformaTauri.salvarArquivo("dados.json", '{"a":1}', "application/json")).toBe(true);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: "dados.json", filters: [{ name: "JSON", extensions: ["json"] }] }),
    );
    expect(writeTextFile).toHaveBeenCalledWith("C:\\docs\\dados.json", '{"a":1}');
  });

  it("se o usuário cancelar, não grava nada", async () => {
    vi.mocked(save).mockResolvedValue(null);
    expect(await plataformaTauri.salvarArquivo("dados.json", "{}", "application/json")).toBe(false);
    expect(writeTextFile).not.toHaveBeenCalled();
  });
});
