import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { PaginaCanvas } from "./PaginaCanvas";

const desenhos: { filtro: string; imagem: unknown }[] = [];

beforeEach(() => {
  desenhos.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function () {
    const ctx = {
      filter: "none",
      clearRect: vi.fn(),
      drawImage: vi.fn((imagem: unknown) => desenhos.push({ filtro: ctx.filter, imagem })),
    };
    return ctx as unknown as CanvasRenderingContext2D;
  } as never);
});

const bitmap = (largura: number) => ({ width: largura, height: largura * 1.5, close: vi.fn() }) as unknown as ImageBitmap;
const tamanho = { largura: 100, altura: 150 };

describe("PaginaCanvas", () => {
  it("ocupa na tela o tamanho da página vezes o zoom", () => {
    const { container } = render(<PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="none" />);
    const pagina = container.querySelector("[data-pagina='1']") as HTMLElement;
    expect(pagina.style.width).toBe("200px");
    expect(pagina.style.height).toBe("300px");
  });

  it("desenha a imagem uma vez com o filtro de cor aplicado no desenho", () => {
    const imagem = { bitmap: bitmap(300), escala: 3 };
    const { container } = render(<PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="invert(1)" imagem={imagem} />);
    expect(desenhos).toEqual([{ filtro: "invert(1)", imagem: imagem.bitmap }]);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.width).toBe(300);
    expect(canvas.style.filter).toBe("");
  });

  it("ao trocar o filtro redesenha a mesma imagem, sem precisar renderizar o PDF de novo", () => {
    const imagem = { bitmap: bitmap(300), escala: 3 };
    const { rerender } = render(<PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="none" imagem={imagem} />);
    rerender(<PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="sepia(50%)" imagem={imagem} />);
    expect(desenhos.map((d) => d.filtro)).toEqual(["none", "sepia(50%)"]);
  });

  it("sem imagem (página fora do plano) o canvas não guarda pixels na memória", () => {
    const imagem = { bitmap: bitmap(300), escala: 3 };
    const { container, rerender } = render(
      <PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="none" imagem={imagem} />,
    );
    rerender(<PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="none" />);
    const canvas = container.querySelector("canvas")!;
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });

  it("imagem já liberada (detached) não é desenhada nem derruba o app", () => {
    const viva = { bitmap: bitmap(300), escala: 3 };
    const { container, rerender } = render(<PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="none" imagem={viva} />);
    const liberada = { bitmap: bitmap(0), escala: 3 };
    expect(() =>
      rerender(<PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="none" imagem={liberada} />),
    ).not.toThrow();
    expect(desenhos).toHaveLength(1);
    // Mantém o que já estava desenhado até chegar uma imagem válida.
    expect(container.querySelector("canvas")!.width).toBe(300);
  });

  it("sem sombra quando pedido (modo contínuo)", () => {
    const { container } = render(<PaginaCanvas numero={1} tamanho={tamanho} zoom={1} filtro="none" sombra={false} />);
    expect((container.querySelector("[data-pagina='1']") as HTMLElement).className).not.toMatch(/shadow/);
  });

  it("imagem nova do mesmo tamanho não redimensiona o canvas (redimensionar apaga e realoca)", () => {
    const descritor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width")!;
    const larguras: number[] = [];
    Object.defineProperty(HTMLCanvasElement.prototype, "width", {
      configurable: true,
      get: descritor.get,
      set(valor: number) {
        larguras.push(valor);
        descritor.set!.call(this, valor);
      },
    });
    try {
      const { rerender } = render(
        <PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="none" imagem={{ bitmap: bitmap(300), escala: 3 }} />,
      );
      larguras.length = 0;
      rerender(<PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="none" imagem={{ bitmap: bitmap(300), escala: 3 }} />);
      expect(larguras).toEqual([]);
      expect(desenhos).toHaveLength(2);
    } finally {
      Object.defineProperty(HTMLCanvasElement.prototype, "width", descritor);
    }
  });

  it("página que nunca foi desenhada também não ocupa memória", () => {
    const { container } = render(<PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="none" />);
    expect(container.querySelector("canvas")!.width).toBe(0);
  });

  it("não redesenha quando nada da página mudou", () => {
    const imagem = { bitmap: bitmap(300), escala: 3 };
    const { rerender } = render(<PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="none" imagem={imagem} />);
    rerender(<PaginaCanvas numero={1} tamanho={tamanho} zoom={2} filtro="none" imagem={imagem} />);
    expect(desenhos).toHaveLength(1);
  });
});
