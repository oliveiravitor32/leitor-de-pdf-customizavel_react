import { describe, expect, it } from "vitest";
import { montarExportacao, nomeArquivoExportacao } from "./exportacao";
import type { DocRemoto } from "./sincronizacao";

const remoto = { preferencias: { cores: { fundo: "#000" } }, atualizadoEm: { cores: 123 } } as DocRemoto;

describe("montarExportacao", () => {
  it("leva tudo o que a nuvem guarda sobre o usuário: o uid e o documento", () => {
    const exportacao = JSON.parse(montarExportacao({ uid: "u1", remoto, agora: new Date("2026-10-21T12:00:00Z") }));
    expect(exportacao).toEqual({
      formato: "leitor-pdf-customizavel/exportacao",
      versao: 1,
      exportadoEm: "2026-10-21T12:00:00.000Z",
      conta: { uid: "u1" },
      nuvem: remoto,
    });
  });

  it("sem nada na nuvem, diz isso explicitamente", () => {
    const exportacao = JSON.parse(montarExportacao({ uid: "u1", remoto: null, agora: new Date(0) }));
    expect(exportacao.nuvem).toBeNull();
  });

  it("é JSON legível (indentado)", () => {
    expect(montarExportacao({ uid: "u1", remoto, agora: new Date(0) })).toContain('\n  "conta"');
  });
});

describe("nomeArquivoExportacao", () => {
  it("usa a data do dia no nome", () => {
    expect(nomeArquivoExportacao(new Date("2026-10-21T12:00:00Z"))).toBe("leitor-pdf-meus-dados-2026-10-21.json");
  });
});
