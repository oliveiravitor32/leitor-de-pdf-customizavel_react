import { useCallback, useEffect, useState } from "react";
import { predefinicoes } from "../lib/predefinicoes";
import type { EstadoLeitor } from "../types";

const padrao: EstadoLeitor = {
  ...predefinicoes.sepia,
  modo: "original",
  fonteLeitura: "Georgia, serif",
  tamanhoLeitura: 18,
  linhaLeitura: 1.6,
  larguraLeitura: 720,
  espacamentoLeitura: 0,
  predefinicao: "sepia",
  corTexto: "",
};

const CHAVE = "leitorPdf:estado";

function carregarInicial(): EstadoLeitor {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || "null");
    return salvo ? { ...padrao, ...salvo } : padrao;
  } catch {
    return padrao;
  }
}

export function useEstadoLeitor() {
  const [estado, setEstado] = useState<EstadoLeitor>(carregarInicial);

  useEffect(() => {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
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

  const resetar = useCallback(() => setEstado(padrao), []);

  return { estado, atualizar, aplicarPredefinicao, resetar };
}
