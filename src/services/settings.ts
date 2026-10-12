import { predefinicoes } from "../lib/predefinicoes";
import { todasAtivas, type Ativas, type Carimbos } from "../lib/sincronizacao";
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
const CHAVE_ATIVAS = "leitorPdf:sincronizar";
const CHAVE_CARIMBOS = "leitorPdf:atualizadoEm";

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

function ler<T>(chave: string, padrao: T): T {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave) || "null");
    return salvo ?? padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown): void {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Armazenamento indisponível (modo privado, cota): segue só em memória.
  }
}

export function salvarPreferencias(estado: EstadoLeitor): void {
  gravar(CHAVE, estado);
}

export function carregarAtivas(): Ativas {
  return { ...todasAtivas, ...ler<Partial<Ativas>>(CHAVE_ATIVAS, {}) };
}

export function salvarAtivas(ativas: Ativas): void {
  gravar(CHAVE_ATIVAS, ativas);
}

export function carregarCarimbos(): Carimbos {
  return ler<Carimbos>(CHAVE_CARIMBOS, {});
}

export function salvarCarimbos(carimbos: Carimbos): void {
  gravar(CHAVE_CARIMBOS, carimbos);
}
