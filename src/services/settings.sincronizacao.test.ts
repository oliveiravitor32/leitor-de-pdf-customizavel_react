import { describe, expect, it } from "vitest";
import { carregarAtivas, carregarCarimbos, salvarAtivas, salvarCarimbos } from "./settings";
import { todasAtivas } from "../lib/sincronizacao";

describe("opções de sincronização no dispositivo", () => {
  it("por padrão todas as categorias sincronizam", () => {
    expect(carregarAtivas()).toEqual(todasAtivas);
  });

  it("guarda a escolha por categoria", () => {
    salvarAtivas({ ...todasAtivas, fonte: false });
    expect(carregarAtivas()).toEqual({ ...todasAtivas, fonte: false });
  });

  it("guarda carimbos de atualização", () => {
    expect(carregarCarimbos()).toEqual({});
    salvarCarimbos({ cores: 123 });
    expect(carregarCarimbos()).toEqual({ cores: 123 });
  });
});
