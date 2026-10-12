import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useSincronizacao } from "./useSincronizacao";
import type { Conta, DocRemoto, ServicoNuvem } from "../lib/sincronizacao";
import { separarPorCategoria } from "../lib/categorias";
import { carregarAtivas, carregarCarimbos, preferenciasPadrao } from "../services/settings";
import type { EstadoLeitor } from "../types";

function criarNuvem(docInicial: DocRemoto | null = null) {
  let aoMudarConta: (c: Conta) => void = () => {};
  const nuvem = {
    observarConta: vi.fn((cb: (c: Conta) => void) => {
      aoMudarConta = cb;
      cb(null);
      return () => {};
    }),
    ler: vi.fn(async () => docInicial),
    gravar: vi.fn(async () => {}),
    apagar: vi.fn(async () => {}),
  } satisfies ServicoNuvem;
  return { nuvem, entrar: (uid = "u1") => act(() => aoMudarConta({ uid })) };
}

function montar(nuvem: ServicoNuvem, inicial: EstadoLeitor = preferenciasPadrao) {
  return renderHook(() => {
    const [estado, setEstado] = useState(inicial);
    const sinc = useSincronizacao({ estado, aplicar: setEstado, nuvem, atraso: 500 });
    return { estado, setEstado, sinc };
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(1000);
});
afterEach(() => vi.useRealTimers());

describe("useSincronizacao", () => {
  it("deslogado: marca o carimbo local e não envia nada", () => {
    const { nuvem } = criarNuvem();
    const { result } = montar(nuvem);
    act(() => result.current.setEstado((e) => ({ ...e, brilho: 50 })));
    expect(carregarCarimbos().cores).toBe(1000);
    expect(nuvem.gravar).not.toHaveBeenCalled();
  });

  it("ao entrar aplica o que é mais novo na nuvem e envia o que é mais novo aqui", async () => {
    const remoto = { ...preferenciasPadrao, fundo: "#000000" };
    const { nuvem, entrar } = criarNuvem({
      preferencias: { cores: separarPorCategoria(remoto).cores },
      atualizadoEm: { cores: 5000 },
    });
    const { result } = montar(nuvem);
    entrar();
    await waitFor(() => expect(result.current.estado.fundo).toBe("#000000"));
    expect(result.current.sinc.conta).toEqual({ uid: "u1" });
    expect(nuvem.gravar).toHaveBeenCalledWith("u1", expect.objectContaining({ preferencias: expect.not.objectContaining({ cores: expect.anything() }) }));
    expect(carregarCarimbos().cores).toBe(5000);
  });

  it("logado: envia alterações com atraso e só das categorias ativas", async () => {
    const { nuvem, entrar } = criarNuvem();
    const { result } = montar(nuvem);
    entrar();
    await waitFor(() => expect(nuvem.gravar).toHaveBeenCalledTimes(1));

    act(() => result.current.sinc.alternarCategoria("fonte"));
    expect(carregarAtivas().fonte).toBe(false);

    act(() => result.current.setEstado((e) => ({ ...e, brilho: 40, tamanhoLeitura: 30 })));
    expect(nuvem.gravar).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(600));

    expect(nuvem.gravar).toHaveBeenCalledTimes(2);
    const [, doc] = nuvem.gravar.mock.calls[1] as unknown as [string, DocRemoto];
    expect(Object.keys(doc.preferencias)).toEqual(["cores"]);
  });

  it("apagarDadosNuvem remove o documento do usuário", async () => {
    const { nuvem, entrar } = criarNuvem();
    const { result } = montar(nuvem);
    entrar();
    await waitFor(() => expect(result.current.sinc.conta).not.toBeNull());
    await act(() => result.current.sinc.apagarDadosNuvem());
    expect(nuvem.apagar).toHaveBeenCalledWith("u1");
  });
});
