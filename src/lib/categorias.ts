import type { EstadoLeitor } from "../types";

/**
 * Agrupa as preferências em categorias que o usuário pode sincronizar
 * (ou não) de forma independente entre dispositivos.
 */
export const categorias = {
  cores: ["predefinicao", "fundo", "inverter", "matiz", "contraste", "brilho", "sepia", "corTexto"],
  fonte: ["fonteLeitura", "tamanhoLeitura"],
  espacamento: ["linhaLeitura", "larguraLeitura", "espacamentoLeitura"],
  modo: ["modo"],
} as const satisfies Record<string, readonly (keyof EstadoLeitor)[]>;

export type Categoria = keyof typeof categorias;

export const rotulosCategorias: Record<Categoria, string> = {
  cores: "Esquema de cores",
  fonte: "Fonte e tamanho",
  espacamento: "Espaçamento e largura",
  modo: "Modo de leitura",
};

export type PartesPorCategoria = { [C in Categoria]: Pick<EstadoLeitor, (typeof categorias)[C][number]> };

export function separarPorCategoria(estado: EstadoLeitor): PartesPorCategoria {
  const partes = {} as Record<Categoria, Partial<EstadoLeitor>>;
  for (const [categoria, campos] of Object.entries(categorias) as [Categoria, readonly (keyof EstadoLeitor)[]][]) {
    partes[categoria] = Object.fromEntries(campos.map((campo) => [campo, estado[campo]]));
  }
  return partes as PartesPorCategoria;
}

export function juntarCategorias(partes: Partial<PartesPorCategoria>): Partial<EstadoLeitor> {
  return Object.assign({}, ...Object.values(partes));
}
