import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRenderizador } from "./useRenderizador";
import type { DocumentoMotor } from "../types";

type BitmapFalso = { width: number; pagina: number; escala: number; close: ReturnType<typeof vi.fn> };

function criarDocumento(total = 10) {
  const bitmaps: BitmapFalso[] = [];
  const documento: DocumentoMotor = {
    motor: "pdf.js",
    numPaginas: total,
    tamanhos: Array.from({ length: total }, () => ({ largura: 100, altura: 100 })),
    renderizar: vi.fn(async (pagina: number, escala: number) => {
      const b = { width: 100 * escala, pagina, escala, close: vi.fn() };
      bitmaps.push(b);
      return b as unknown as ImageBitmap;
    }),
    extrairTexto: vi.fn(async () => ""),
    fechar: vi.fn(async () => {}),
  };
  return { documento, bitmaps };
}

const opcoes = { dpr: 1, margem: 1, fracaoRascunho: 0.25 };

function montar(documento: DocumentoMotor, zoom: number, visiveis: number[]) {
  return renderHook((p: { zoom: number; visiveis: number[] }) => useRenderizador(documento, p.zoom, p.visiveis, opcoes), {
    initialProps: { zoom, visiveis },
  });
}

const escalaDe = (r: { current: Map<number, { escala: number }> }, p: number) => r.current.get(p)?.escala;

describe("useRenderizador", () => {
  it("desenha primeiro um rascunho da página visível e depois a versão nítida", async () => {
    const { documento } = criarDocumento();
    const { result } = montar(documento, 1, [3]);

    await waitFor(() => expect(escalaDe(result, 3)).toBe(1));
    const chamadas = vi.mocked(documento.renderizar).mock.calls.map(([p, e]) => `${p}@${e}`);
    expect(chamadas.slice(0, 2)).toEqual(["3@0.25", "3@1"]);
  });

  it("também prepara as vizinhas (margem), já nítidas", async () => {
    const { documento } = criarDocumento();
    const { result } = montar(documento, 1, [3]);
    await waitFor(() => expect([escalaDe(result, 2), escalaDe(result, 4)]).toEqual([1, 1]));
    expect(result.current.has(6)).toBe(false);
  });

  it("libera da memória as páginas que saíram do plano", async () => {
    const { documento, bitmaps } = criarDocumento();
    const { result, rerender } = montar(documento, 1, [3]);
    await waitFor(() => expect(escalaDe(result, 4)).toBe(1));
    const pagina2 = bitmaps.filter((b) => b.pagina === 2);

    rerender({ zoom: 1, visiveis: [8] });

    await waitFor(() => expect(result.current.has(2)).toBe(false));
    pagina2.forEach((b) => expect(b.close).toHaveBeenCalled());
  });

  it("ao mudar o zoom mantém a imagem antiga até a nova ficar pronta", async () => {
    const { documento } = criarDocumento();
    const { result, rerender } = montar(documento, 1, [3]);
    await waitFor(() => expect(escalaDe(result, 3)).toBe(1));

    rerender({ zoom: 2, visiveis: [3] });
    expect(escalaDe(result, 3)).toBe(1);

    await waitFor(() => expect(escalaDe(result, 3)).toBe(2));
    // Com imagem antiga disponível não precisa de rascunho de novo.
    expect(vi.mocked(documento.renderizar).mock.calls.some(([p, e]) => p === 3 && e === 0.5)).toBe(false);
  });

  it("não redesenha o que já está na escala certa", async () => {
    const { documento } = criarDocumento();
    const { result, rerender } = montar(documento, 1, [3]);
    await waitFor(() => expect(escalaDe(result, 4)).toBe(1));
    const antes = vi.mocked(documento.renderizar).mock.calls.length;

    rerender({ zoom: 1, visiveis: [3] });
    await new Promise((r) => setTimeout(r, 20));

    expect(vi.mocked(documento.renderizar).mock.calls.length).toBe(antes);
  });

  it("ao desmontar libera todas as imagens", async () => {
    const { documento, bitmaps } = criarDocumento();
    const { result, unmount } = montar(documento, 1, [3]);
    await waitFor(() => expect(escalaDe(result, 4)).toBe(1));
    unmount();
    const vivas = bitmaps.filter((b) => b.escala === 1);
    vivas.forEach((b) => expect(b.close).toHaveBeenCalled());
  });

  it("começando sem nada visível (modo texto) e depois mostrando uma página, desenha a página", async () => {
    const { documento } = criarDocumento();
    const { result, rerender } = montar(documento, 1, []);
    await new Promise((r) => setTimeout(r, 10));
    rerender({ zoom: 1, visiveis: [1] });
    await waitFor(() => expect(escalaDe(result, 1)).toBe(1));
  });

  it("página nítida que saiu um pouco do plano continua na memória (folga para ir e voltar)", async () => {
    const { documento } = criarDocumento(20);
    const { result, rerender } = renderHook(
      (p: { visiveis: number[] }) => useRenderizador(documento, 1, p.visiveis, { ...opcoes, margemLiberar: 3 }),
      { initialProps: { visiveis: [5] } },
    );
    await waitFor(() => expect(escalaDe(result, 4)).toBe(1));
    rerender({ visiveis: [7] }); // a 4 está a 3 páginas: dentro da folga
    await waitFor(() => expect(escalaDe(result, 8)).toBe(1));
    expect(escalaDe(result, 4)).toBe(1);
    rerender({ visiveis: [9] }); // agora a 4 está a 5 páginas: sai
    await waitFor(() => expect(result.current.has(4)).toBe(false));
  });

  describe("com miniaturas", () => {
    const miniaturas = (visiveis: number[]) => ({ visiveis, escala: 0.1, frente: 3, tras: 1, bytesMaximos: 1_000_000 });

    function montarComMiniaturas(documento: DocumentoMotor, nitidas: number[], rapidas: number[]) {
      return renderHook(
        (p: { nitidas: number[]; rapidas: number[] }) =>
          useRenderizador(documento, 1, p.nitidas, { ...opcoes, miniaturas: miniaturas(p.rapidas) }),
        { initialProps: { nitidas, rapidas } },
      );
    }

    it("desenha miniaturas das páginas que passam na rolagem, sem esperar a nítida", async () => {
      const { documento } = criarDocumento(50);
      const { result, rerender } = montarComMiniaturas(documento, [1], [1]);
      await waitFor(() => expect(escalaDe(result, 1)).toBe(1));
      // Rolagem rápida: as nítidas ainda não mudaram, só as visíveis imediatas.
      rerender({ nitidas: [1], rapidas: [30] });
      await waitFor(() => expect(escalaDe(result, 30)).toBe(0.1));
      await waitFor(() => expect(escalaDe(result, 31)).toBe(0.1));
    });

    it("a nítida substitui a miniatura na tela, e a miniatura volta se a nítida for liberada", async () => {
      const { documento } = criarDocumento(50);
      const { result, rerender } = montarComMiniaturas(documento, [1], [20]);
      await waitFor(() => expect(escalaDe(result, 20)).toBe(0.1));
      rerender({ nitidas: [20], rapidas: [20] });
      await waitFor(() => expect(escalaDe(result, 20)).toBe(1));
      rerender({ nitidas: [40], rapidas: [21] });
      await waitFor(() => expect(escalaDe(result, 20)).toBe(0.1));
    });

    it("gera miniaturas do documento inteiro (até o limite), sem precisar rolar até lá", async () => {
      const { documento } = criarDocumento(30);
      const { result } = renderHook(() =>
        useRenderizador(documento, 1, [1], { ...opcoes, miniaturas: { ...miniaturas([1]), itensMaximos: 25 } }),
      );
      await waitFor(() => expect(escalaDe(result, 25)).toBe(0.1));
      expect(result.current.has(26)).toBe(false);
    });

    it("com miniatura pronta não precisa de rascunho", async () => {
      const { documento } = criarDocumento(50);
      const { result, rerender } = montarComMiniaturas(documento, [1], [20]);
      await waitFor(() => expect(escalaDe(result, 20)).toBe(0.1));
      rerender({ nitidas: [20], rapidas: [20] });
      await waitFor(() => expect(escalaDe(result, 20)).toBe(1));
      expect(vi.mocked(documento.renderizar).mock.calls.some(([p, e]) => p === 20 && e === 0.25)).toBe(false);
    });
  });

  it("rolando para baixo prepara mais nítidas à frente", async () => {
    const { documento } = criarDocumento(30);
    const { result, rerender } = renderHook(
      (p: { visiveis: number[] }) =>
        useRenderizador(documento, 1, p.visiveis, { ...opcoes, margem: 1, margemFrente: 3, margemLiberar: 4 }),
      { initialProps: { visiveis: [10] } },
    );
    rerender({ visiveis: [11] });
    await waitFor(() => expect(escalaDe(result, 14)).toBe(1));
    expect(result.current.has(10)).toBe(true); // 1 atrás
    expect(vi.mocked(documento.renderizar).mock.calls.some(([p]) => p === 8)).toBe(false);
  });
});
