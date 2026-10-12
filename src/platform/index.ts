import type { Plataforma } from "./types";

export type { ArquivoPdf, Plataforma } from "./types";
export { lerArquivo } from "./web";

export function estaNoTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

let plataforma: Promise<Plataforma> | undefined;

/** Carrega a implementação da plataforma atual uma única vez (import dinâmico mantém o Tauri fora do bundle web). */
export function obterPlataforma(): Promise<Plataforma> {
  plataforma ??= estaNoTauri()
    ? import("./tauri").then((m) => m.plataformaTauri)
    : import("./web").then((m) => m.plataformaWeb);
  return plataforma;
}
