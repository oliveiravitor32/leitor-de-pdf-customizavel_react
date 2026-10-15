import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRenderizador } from "./useRenderizador";
import type { DocumentoMotor } from "../types";

type BitmapFalso = { width: number; pagina: number; escala: number; close: ReturnType<typeof vi.fn> };

function criarDocumento(total = 10) {
  const bitmaps: BitmapFalso[] = [];
  const documento: DocumentoMotor = {
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
});
