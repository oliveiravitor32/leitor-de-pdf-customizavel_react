import { useCallback, useMemo } from "react";
import type { DocumentoMotor } from "../types";

/** Texto extraído por página, com cache que zera a cada documento novo. */
export function useTextoPdf(documento: DocumentoMotor | null) {
  const cache = useMemo(() => new Map<number, string>(), [documento]);

  return useCallback(
    async (numeroPagina: number): Promise<string> => {
      if (!documento) return "";
      const emCache = cache.get(numeroPagina);
      if (emCache !== undefined) return emCache;
      const texto = await documento.extrairTexto(numeroPagina);
      cache.set(numeroPagina, texto);
      return texto;
    },
    [documento, cache],
  );
}
