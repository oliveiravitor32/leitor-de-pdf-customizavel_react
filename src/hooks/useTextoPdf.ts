import { useCallback, useMemo } from "react";
import { extrairTextoPagina } from "../lib/pdf";
import type { DocumentoPdf } from "../types";

/** Texto extraído por página, com cache que zera a cada documento novo. */
export function useTextoPdf(documento: DocumentoPdf | null) {
  const cache = useMemo(() => new Map<number, string>(), [documento]);

  return useCallback(
    async (numeroPagina: number): Promise<string> => {
      if (!documento) return "";
      const emCache = cache.get(numeroPagina);
      if (emCache !== undefined) return emCache;
      const texto = await extrairTextoPagina(documento, numeroPagina);
      cache.set(numeroPagina, texto);
      return texto;
    },
    [documento, cache],
  );
}
