import { describe, expect, it, vi } from "vitest";
import { carregarPreferencias, preferenciasPadrao, salvarPreferencias } from "./settings";

const CHAVE = "leitorPdf:estado";

describe("settings", () => {
  it("sem nada salvo devolve o padrão", () => {
    expect(carregarPreferencias()).toEqual(preferenciasPadrao);
  });

  it("mescla o salvo sobre o padrão", () => {
    localStorage.setItem(CHAVE, JSON.stringify({ tamanhoLeitura: 22 }));
    expect(carregarPreferencias()).toEqual({ ...preferenciasPadrao, tamanhoLeitura: 22 });
  });

  it("ignora campos desconhecidos (não guarda lixo)", () => {
    localStorage.setItem(CHAVE, JSON.stringify({ intruso: 1 }));
    expect(carregarPreferencias()).not.toHaveProperty("intruso");
  });

  it("JSON corrompido devolve o padrão", () => {
    localStorage.setItem(CHAVE, "{x");
    expect(carregarPreferencias()).toEqual(preferenciasPadrao);
  });

  it("salvar grava no armazenamento local", () => {
    salvarPreferencias({ ...preferenciasPadrao, brilho: 70 });
    expect(JSON.parse(localStorage.getItem(CHAVE)!).brilho).toBe(70);
  });

  it("storage indisponível não derruba o app", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(carregarPreferencias()).toEqual(preferenciasPadrao);
    expect(() => salvarPreferencias(preferenciasPadrao)).not.toThrow();
  });
});
