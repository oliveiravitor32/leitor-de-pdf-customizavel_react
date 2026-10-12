import { afterEach, describe, expect, it } from "vitest";
import { estaNoTauri, obterPlataforma } from "./index";

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("plataforma", () => {
  it("no navegador usa a implementação web", async () => {
    expect(estaNoTauri()).toBe(false);
    expect((await obterPlataforma()).nome).toBe("web");
  });

  it("detecta o Tauri pela variável global", () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(estaNoTauri()).toBe(true);
  });
});
