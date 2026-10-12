import { describe, expect, it } from "vitest";
import { filtroCss, luminancia, predefinicoes } from "./predefinicoes";

describe("luminancia", () => {
  it("é 0 para preto e 1 para branco", () => {
    expect(luminancia("#000000")).toBe(0);
    expect(luminancia("#ffffff")).toBeCloseTo(1);
  });

  it("aceita hex sem # e em maiúsculas", () => {
    expect(luminancia("FFFFFF")).toBeCloseTo(1);
  });

  it("retorna 1 para valor inválido", () => {
    expect(luminancia("vermelho")).toBe(1);
    expect(luminancia("#fff")).toBe(1);
  });
});

describe("filtroCss", () => {
  it("monta o filtro na ordem esperada", () => {
    expect(filtroCss(predefinicoes.escuro)).toBe(
      "invert(1) hue-rotate(180deg) contrast(100%) brightness(95%) sepia(0%)",
    );
  });
});
