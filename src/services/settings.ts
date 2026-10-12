import { predefinicoes } from "../lib/predefinicoes";
import type { EstadoLeitor } from "../types";

export const preferenciasPadrao: EstadoLeitor = {
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

/** Mantém só os campos conhecidos, para não persistir nem sincronizar lixo. */
function filtrarConhecidos(salvo: Record<string, unknown>): Partial<EstadoLeitor> {
  return Object.fromEntries(Object.entries(salvo).filter(([campo]) => campo in preferenciasPadrao));
}

export function carregarPreferencias(): EstadoLeitor {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || "null");
    return salvo ? { ...preferenciasPadrao, ...filtrarConhecidos(salvo) } : preferenciasPadrao;
  } catch {
    return preferenciasPadrao;
  }
}

export function salvarPreferencias(estado: EstadoLeitor): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    // Armazenamento indisponível (modo privado, cota): segue só em memória.
  }
}
