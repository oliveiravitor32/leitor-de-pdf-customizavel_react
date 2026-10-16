import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePinca } from "./usePinca";

type Ponto = { x: number; y: number };

function tocar(el: HTMLElement, tipo: string, pontos: Ponto[]) {
  const evento = new Event(tipo, { bubbles: true, cancelable: true });
  const toques = pontos.map((p) => ({ clientX: p.x, clientY: p.y }));
  Object.defineProperty(evento, "touches", { value: toques });
  el.dispatchEvent(evento);
  return evento;
}

function montar() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const aoMover = vi.fn();
  const aoTerminar = vi.fn();
  renderHook(() => usePinca({ current: el }, { aoMover, aoTerminar }));
  return { el, aoMover, aoTerminar };
}

describe("usePinca", () => {
  it("afastar os dedos informa escala maior que 1 e o centro do gesto", () => {
    const { el, aoMover } = montar();
    tocar(el, "touchstart", [{ x: 100, y: 200 }, { x: 200, y: 200 }]);
    tocar(el, "touchmove", [{ x: 50, y: 200 }, { x: 250, y: 200 }]);
    expect(aoMover).toHaveBeenLastCalledWith(2, { x: 150, y: 200 });
  });

  it("ao soltar entrega a escala final uma única vez", () => {
    const { el, aoTerminar } = montar();
    tocar(el, "touchstart", [{ x: 100, y: 100 }, { x: 300, y: 100 }]);
    tocar(el, "touchmove", [{ x: 150, y: 100 }, { x: 250, y: 100 }]);
    tocar(el, "touchend", [{ x: 150, y: 100 }]);
    tocar(el, "touchend", []);
    expect(aoTerminar).toHaveBeenCalledTimes(1);
    expect(aoTerminar).toHaveBeenCalledWith(0.5, { x: 200, y: 100 });
  });

  it("um dedo só (rolagem) não é pinça", () => {
    const { el, aoMover, aoTerminar } = montar();
    tocar(el, "touchstart", [{ x: 100, y: 100 }]);
    tocar(el, "touchmove", [{ x: 100, y: 50 }]);
    tocar(el, "touchend", []);
    expect(aoMover).not.toHaveBeenCalled();
    expect(aoTerminar).not.toHaveBeenCalled();
  });

  it("pinça sem movimento não dispara zoom", () => {
    const { el, aoTerminar } = montar();
    tocar(el, "touchstart", [{ x: 100, y: 100 }, { x: 200, y: 100 }]);
    tocar(el, "touchend", []);
    expect(aoTerminar).not.toHaveBeenCalled();
  });

  it("não segura a rolagem: todos os listeners de toque são passivos", () => {
    const el = document.createElement("div");
    const registrar = vi.spyOn(el, "addEventListener");
    renderHook(() => usePinca({ current: el }, { aoMover: vi.fn(), aoTerminar: vi.fn() }));
    const toques = registrar.mock.calls.filter(([tipo]) => String(tipo).startsWith("touch"));
    expect(toques.length).toBeGreaterThan(0);
    for (const [, , opcoes] of toques) expect(opcoes).toMatchObject({ passive: true });
  });
});
