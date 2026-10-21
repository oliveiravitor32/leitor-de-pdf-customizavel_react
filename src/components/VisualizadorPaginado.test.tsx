import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VisualizadorPaginado } from "./VisualizadorPaginado";
import { preferenciasPadrao } from "../services/settings";
import type { DocumentoMotor } from "../types";

beforeAll(() => {
  // jsdom não tem PointerEvent.
  if (!("PointerEvent" in window)) {
    class PointerEventFalso extends MouseEvent {
      pointerId: number;
      constructor(tipo: string, init: PointerEventInit = {}) {
        super(tipo, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    vi.stubGlobal("PointerEvent", PointerEventFalso);
  }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

function criarDocumento(total = 10): DocumentoMotor {
  return {
    motor: "pdf.js",
    numPaginas: total,
    tamanhos: Array.from({ length: total }, () => ({ largura: 100, altura: 200 })),
    renderizar: vi.fn(async () => ({ width: 1, height: 1, close: vi.fn() }) as unknown as ImageBitmap),
    extrairTexto: vi.fn(async (p: number) => `texto da página ${p}`),
    fechar: vi.fn(async () => {}),
  };
}

function montar(props: Partial<Parameters<typeof VisualizadorPaginado>[0]> = {}) {
  const todas = {
    documento: criarDocumento(),
    estado: preferenciasPadrao,
    corTexto: "#000",
    pagina: 3,
    zoomRelativo: 1,
    onIrPara: vi.fn(),
    onAlternarBarras: vi.fn(),
    onPinca: vi.fn(() => 1),
    obterTextoPagina: vi.fn(async (p: number) => `texto da página ${p}`),
    ...props,
  };
  const r = render(<VisualizadorPaginado {...todas} />);
  const area = r.container.firstElementChild as HTMLElement;
  Object.defineProperty(area, "clientWidth", { value: 400, configurable: true });
  return { ...r, area, props: todas };
}

function rolagemHorizontal(el: HTMLElement, posicao: number, maximo: number) {
  el.scrollLeft = posicao;
  Object.defineProperty(el, "scrollWidth", { value: 400 + maximo, configurable: true });
}

function arrastar(el: HTMLElement, de: number, ate: number) {
  fireEvent.pointerDown(el, { clientX: de, clientY: 300, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: ate, clientY: 300, pointerId: 1 });
}

describe("VisualizadorPaginado", () => {
  it("mostra só a página atual", () => {
    const { container } = montar();
    const paginas = container.querySelectorAll("[data-pagina]");
    expect(paginas).toHaveLength(1);
    expect((paginas[0] as HTMLElement).dataset.pagina).toBe("3");
  });

  it("deslizar para a esquerda vai para a próxima e para a direita volta", () => {
    const { area, props } = montar();
    arrastar(area, 300, 150);
    expect(props.onIrPara).toHaveBeenLastCalledWith(4);
    arrastar(area, 150, 300);
    expect(props.onIrPara).toHaveBeenLastCalledWith(2);
  });

  it("toque na borda direita avança; no meio mostra/esconde as barras", () => {
    const { area, props } = montar();
    arrastar(area, 380, 380);
    expect(props.onIrPara).toHaveBeenCalledWith(4);
    arrastar(area, 200, 200);
    expect(props.onAlternarBarras).toHaveBeenCalled();
  });

  it("com a página ampliada, deslizar no meio da página não vira (o dedo move a página)", () => {
    const { area, props } = montar({ zoomRelativo: 2 });
    rolagemHorizontal(area, 100, 300);
    arrastar(area, 300, 100);
    expect(props.onIrPara).not.toHaveBeenCalled();
  });

  it("com a página ampliada e já na borda direita, deslizar vai para a próxima", () => {
    const { area, props } = montar({ zoomRelativo: 2 });
    rolagemHorizontal(area, 300, 300);
    arrastar(area, 300, 100);
    expect(props.onIrPara).toHaveBeenLastCalledWith(4);
  });

  it("se o navegador assume a rolagem (pointercancel), o fim do toque ainda vira a página", () => {
    const { area, props } = montar();
    fireEvent.pointerDown(area, { clientX: 300, clientY: 300, pointerId: 1 });
    fireEvent.pointerCancel(area, { pointerId: 1 });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 100, clientY: 300 }] });
    expect(props.onIrPara).toHaveBeenLastCalledWith(4);
  });

  it("ao mudar de página leva a rolagem para o canto superior esquerdo", () => {
    const { area, rerender, props } = montar({ zoomRelativo: 2 });
    area.scrollLeft = 150;
    area.scrollTop = 200;
    rerender(<VisualizadorPaginado {...props} pagina={4} />);
    expect([area.scrollLeft, area.scrollTop]).toEqual([0, 0]);
  });

  it("desenha primeiro a página atual e prepara as vizinhas", async () => {
    const { props } = montar();
    await waitFor(() => expect(props.documento.renderizar).toHaveBeenCalled());
    expect(vi.mocked(props.documento.renderizar).mock.calls[0][0]).toBe(3);
    await waitFor(() => {
      const paginas = new Set(vi.mocked(props.documento.renderizar).mock.calls.map(([p]) => p));
      expect(paginas).toEqual(new Set([2, 3, 4]));
    });
  });

  it("no modo texto mostra o texto da página atual", async () => {
    montar({ estado: { ...preferenciasPadrao, modo: "leitura" } });
    expect(await screen.findByText("texto da página 3")).toBeInTheDocument();
  });
});
