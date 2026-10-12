import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEstadoLeitor } from "./useEstadoLeitor";
import { predefinicoes } from "../lib/predefinicoes";

const CHAVE = "leitorPdf:estado";

describe("useEstadoLeitor", () => {
  it("começa na predefinição sépia", () => {
    const { result } = renderHook(() => useEstadoLeitor());
    expect(result.current.estado.predefinicao).toBe("sepia");
    expect(result.current.estado.fundo).toBe(predefinicoes.sepia.fundo);
  });

  it("restaura o estado salvo mesclado ao padrão", () => {
    localStorage.setItem(CHAVE, JSON.stringify({ tamanhoLeitura: 24 }));
    const { result } = renderHook(() => useEstadoLeitor());
    expect(result.current.estado.tamanhoLeitura).toBe(24);
    expect(result.current.estado.fonteLeitura).toBe("Georgia, serif");
  });

  it("ignora JSON corrompido", () => {
    localStorage.setItem(CHAVE, "{quebrado");
    const { result } = renderHook(() => useEstadoLeitor());
    expect(result.current.estado.predefinicao).toBe("sepia");
  });

  it("persiste alterações", () => {
    const { result } = renderHook(() => useEstadoLeitor());
    act(() => result.current.atualizar({ tamanhoLeitura: 30 }, { manterPredefinicao: true }));
    expect(JSON.parse(localStorage.getItem(CHAVE)!).tamanhoLeitura).toBe(30);
  });

  it("mexer em cor sai da predefinição; com manterPredefinicao não", () => {
    const { result } = renderHook(() => useEstadoLeitor());
    act(() => result.current.atualizar({ fonteLeitura: "Verdana, sans-serif" }, { manterPredefinicao: true }));
    expect(result.current.estado.predefinicao).toBe("sepia");
    act(() => result.current.atualizar({ brilho: 80 }));
    expect(result.current.estado.predefinicao).toBe("personalizado");
  });

  it("aplicarPredefinicao troca cores e limpa corTexto", () => {
    const { result } = renderHook(() => useEstadoLeitor());
    act(() => result.current.atualizar({ corTexto: "#123456" }));
    act(() => result.current.aplicarPredefinicao("escuro"));
    expect(result.current.estado).toMatchObject({ ...predefinicoes.escuro, predefinicao: "escuro", corTexto: "" });
  });

  it("aplicarPredefinicao ignora nome desconhecido", () => {
    const { result } = renderHook(() => useEstadoLeitor());
    act(() => result.current.aplicarPredefinicao("inexistente"));
    expect(result.current.estado.predefinicao).toBe("sepia");
  });

  it("resetar volta ao padrão", () => {
    const { result } = renderHook(() => useEstadoLeitor());
    act(() => result.current.aplicarPredefinicao("escuro"));
    act(() => result.current.resetar());
    expect(result.current.estado.predefinicao).toBe("sepia");
  });
});
