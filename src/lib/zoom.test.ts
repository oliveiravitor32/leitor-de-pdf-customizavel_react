import { describe, expect, it } from "vitest";
import { ZOOM_PADRAO, zoomInicial } from "./zoom";

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

  it("arredonda para duas casas", () => {
    const z = zoomInicial(612, 390);
    expect(Math.round(z * 100) / 100).toBe(z);
  });
});
