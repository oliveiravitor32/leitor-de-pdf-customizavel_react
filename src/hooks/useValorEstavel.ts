import { useEffect, useState } from "react";

/**
 * Devolve `valor` só depois que ele ficar `atraso` ms sem mudar. Usado para não
 * pedir renderização de cada página que passa voando numa rolagem rápida.
 */
export function useValorEstavel<T>(valor: T, atraso: number): T {
  const [estavel, setEstavel] = useState(valor);
  useEffect(() => {
    const timer = setTimeout(() => setEstavel(valor), atraso);
    return () => clearTimeout(timer);
  }, [valor, atraso]);
  return estavel;
}
