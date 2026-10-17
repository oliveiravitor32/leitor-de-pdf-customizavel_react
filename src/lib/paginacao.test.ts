import { describe, expect, it } from "vitest";
import { classificarGesto, zoomParaCaber } from "./paginacao";

const largura = 400;
const gesto = (g: Partial<Parameters<typeof classificarGesto>[0]>) =>
  classificarGesto({ dx: 0, dy: 0, duracao: 100, x: 200, largura, ...g });

describe("classificarGesto", () => {
  it("deslizar para a esquerda avança e para a direita volta", () => {
    expect(gesto({ dx: -80 })).toBe("proxima");
    expect(gesto({ dx: 80 })).toBe("anterior");
  });

  it("movimento mais vertical que horizontal não vira página", () => {
    expect(gesto({ dx: -60, dy: 100 })).toBeNull();
  });

  it("deslize curto demais não conta", () => {
    expect(gesto({ dx: -30 })).toBeNull();
  });

  it("toque nas bordas vira página e no meio abre o menu", () => {
    expect(gesto({ x: 40 })).toBe("anterior");
    expect(gesto({ x: 360 })).toBe("proxima");
    expect(gesto({ x: 200 })).toBe("menu");
  });

  it("toque longo não é toque (pode ser seleção ou engano)", () => {
    expect(gesto({ x: 360, duracao: 800 })).toBeNull();
  });
});

describe("zoomParaCaber", () => {
  it("cabe pela largura quando a página é proporcionalmente mais larga", () => {
    expect(zoomParaCaber({ largura: 600, altura: 600 }, { largura: 300, altura: 600 })).toBe(0.5);
  });

  it("cabe pela altura quando a página é proporcionalmente mais alta", () => {
    expect(zoomParaCaber({ largura: 612, altura: 792 }, { largura: 1000, altura: 396 })).toBe(0.5);
  });
});
