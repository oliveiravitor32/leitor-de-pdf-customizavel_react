import { describe, expect, it } from "vitest";
import { categorias, juntarCategorias, separarPorCategoria } from "./categorias";
import { preferenciasPadrao } from "../services/settings";

describe("categorias de preferência", () => {
  it("cada campo do estado pertence a exatamente uma categoria", () => {
    const campos = Object.values(categorias).flat();
    expect(new Set(campos).size).toBe(campos.length);
    expect([...campos].sort()).toEqual(Object.keys(preferenciasPadrao).sort());
  });

  it("separa cores e fonte em categorias diferentes", () => {
    const partes = separarPorCategoria(preferenciasPadrao);
    expect(partes.cores).toHaveProperty("fundo");
    expect(partes.cores).not.toHaveProperty("fonteLeitura");
    expect(partes.fonte).toHaveProperty("fonteLeitura");
  });

  it("separar e juntar é ida e volta", () => {
    expect(juntarCategorias(separarPorCategoria(preferenciasPadrao))).toEqual(preferenciasPadrao);
  });

  it("juntar só as categorias escolhidas", () => {
    const partes = separarPorCategoria(preferenciasPadrao);
    const so = juntarCategorias({ fonte: partes.fonte });
    expect(Object.keys(so).sort()).toEqual([...categorias.fonte].sort());
  });
});
