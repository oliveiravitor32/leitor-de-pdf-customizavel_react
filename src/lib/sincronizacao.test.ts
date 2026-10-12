import { describe, expect, it } from "vitest";
import { categoriasAlteradas, mesclar, todasAtivas } from "./sincronizacao";
import { separarPorCategoria } from "./categorias";
import { preferenciasPadrao } from "../services/settings";

const local = preferenciasPadrao;
const remotoEstado = { ...preferenciasPadrao, fundo: "#000000", fonteLeitura: "Verdana, sans-serif" };
const remotoPartes = separarPorCategoria(remotoEstado);

describe("categoriasAlteradas", () => {
  it("lista só as categorias com campo diferente", () => {
    expect(categoriasAlteradas(local, { ...local, brilho: 50 })).toEqual(["cores"]);
    expect(categoriasAlteradas(local, { ...local, tamanhoLeitura: 30, modo: "leitura" })).toEqual(["fonte", "modo"]);
    expect(categoriasAlteradas(local, local)).toEqual([]);
  });
});

describe("mesclar", () => {
  it("sem documento remoto, envia todas as categorias ativas", () => {
    const r = mesclar(local, { cores: 5 }, null, todasAtivas);
    expect(r.estado).toEqual(local);
    expect(Object.keys(r.paraEnviar!.preferencias).sort()).toEqual(["cores", "espacamento", "fonte", "modo"]);
    expect(r.paraEnviar!.atualizadoEm.cores).toBe(5);
  });

  it("remoto mais novo vence; local mais novo é enviado", () => {
    const r = mesclar(
      local,
      { cores: 10, fonte: 30 },
      { preferencias: { cores: remotoPartes.cores, fonte: remotoPartes.fonte }, atualizadoEm: { cores: 20, fonte: 25 } },
      todasAtivas,
    );
    expect(r.estado.fundo).toBe("#000000");
    expect(r.estado.fonteLeitura).toBe(local.fonteLeitura);
    expect(r.carimbos.cores).toBe(20);
    expect(Object.keys(r.paraEnviar!.preferencias)).toContain("fonte");
    expect(r.paraEnviar!.preferencias).not.toHaveProperty("cores");
  });

  it("categoria desligada não recebe nem envia", () => {
    const r = mesclar(
      local,
      { fonte: 1 },
      { preferencias: { cores: remotoPartes.cores }, atualizadoEm: { cores: 99 } },
      { ...todasAtivas, cores: false, fonte: false, espacamento: false, modo: false },
    );
    expect(r.estado).toEqual(local);
    expect(r.paraEnviar).toBeNull();
  });

  it("carimbos iguais não fazem nada", () => {
    const partes = separarPorCategoria(local);
    const remoto = { preferencias: partes, atualizadoEm: { cores: 1, fonte: 1, espacamento: 1, modo: 1 } };
    const r = mesclar(local, { cores: 1, fonte: 1, espacamento: 1, modo: 1 }, remoto, todasAtivas);
    expect(r.paraEnviar).toBeNull();
  });

  it("ignora campos desconhecidos vindos da nuvem", () => {
    const r = mesclar(
      local,
      {},
      { preferencias: { cores: { ...remotoPartes.cores, intruso: 1 } as never }, atualizadoEm: { cores: 5 } },
      todasAtivas,
    );
    expect(r.estado).not.toHaveProperty("intruso");
  });
});
