import { describe, expect, it } from "vitest";
import { ZOOM_MAXIMO, ZOOM_MINIMO, ZOOM_PADRAO, escalarTamanhoTexto, escalarZoom, zoomInicial } from "./zoom";

describe("zoomInicial", () => {
  it("em telas largas usa o zoom padrão", () => {
    expect(zoomInicial(612, 1280)).toBe(ZOOM_PADRAO);
  });

  it("em telas estreitas ajusta a página à largura (com margem)", () => {
    const z = zoomInicial(612, 390);
    expect(612 * z).toBeLessThanOrEqual(390 - 24);
    expect(612 * z).toBeGreaterThan(390 - 40);
  });

  it("nunca passa do zoom padrão nem fica minúsculo", () => {
    expect(zoomInicial(200, 390)).toBe(ZOOM_PADRAO);
    expect(zoomInicial(5000, 320)).toBeGreaterThanOrEqual(0.2);
  });

  it("sem margem (celular) a página ocupa a largura toda, sem passar dela", () => {
    const z = zoomInicial(612, 390, 0);
    expect(612 * z).toBeLessThanOrEqual(390);
    expect(612 * z).toBeGreaterThan(389);
  });
});

describe("escalarZoom", () => {
  it("multiplica o zoom pela escala da pinça", () => {
    expect(escalarZoom(1, 1.5)).toBe(1.5);
  });

  it("respeita os limites mínimo e máximo", () => {
    expect(escalarZoom(1, 10)).toBe(ZOOM_MAXIMO);
    expect(escalarZoom(0.5, 0.01)).toBe(ZOOM_MINIMO);
  });
});

describe("escalarTamanhoTexto", () => {
  it("multiplica o tamanho da fonte e arredonda", () => {
    expect(escalarTamanhoTexto(18, 1.5)).toBe(27);
  });

  it("fica entre 12 e 40 px", () => {
    expect(escalarTamanhoTexto(18, 5)).toBe(40);
    expect(escalarTamanhoTexto(18, 0.1)).toBe(12);
  });
});
