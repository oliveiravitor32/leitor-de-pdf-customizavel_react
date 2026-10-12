import { useCallback, useEffect, useState } from "react";
import { predefinicoes } from "../lib/predefinicoes";
import { carregarPreferencias, preferenciasPadrao, salvarPreferencias } from "../services/settings";
import type { EstadoLeitor } from "../types";

export function useEstadoLeitor() {
  const [estado, setEstado] = useState<EstadoLeitor>(carregarPreferencias);

  useEffect(() => {
    salvarPreferencias(estado);
  }, [estado]);

  /** Mexer num controle de cor sai da predefinição; trocar de modo/fonte não. */
  const atualizar = useCallback(
    (patch: Partial<EstadoLeitor>, opcoes: { manterPredefinicao?: boolean } = {}) => {
      setEstado((anterior) => ({
        ...anterior,
        ...patch,
        predefinicao: opcoes.manterPredefinicao ? anterior.predefinicao : "personalizado",
      }));
    },
    [],
  );

  const aplicarPredefinicao = useCallback((nome: string) => {
    const predefinicao = predefinicoes[nome];
    if (!predefinicao) return;
    setEstado((anterior) => ({ ...anterior, ...predefinicao, predefinicao: nome, corTexto: "" }));
  }, []);

  const resetar = useCallback(() => setEstado(preferenciasPadrao), []);

  /** Troca o estado inteiro (ex.: preferências vindas da nuvem). */
  const substituir = useCallback((novo: EstadoLeitor) => setEstado(novo), []);

  return { estado, atualizar, aplicarPredefinicao, resetar, substituir };
}
