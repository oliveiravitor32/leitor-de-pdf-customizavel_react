import type { TamanhoPagina } from "../types";

type LimitesEscala = {
  /** Densidade de pixels máxima usada (telas 3x não ganham nitidez visível acima disso num PDF). */
  dprMaximo?: number;
  /** Teto de pixels por página: canvases gigantes estouram a memória da GPU no celular. */
  pixelsMaximos?: number;
};

/** Escala (pixels por ponto PDF) para renderizar uma página com o zoom dado. */
export function escalaRender(
  zoom: number,
  dpr: number,
  tamanho: TamanhoPagina,
  { dprMaximo = 2, pixelsMaximos = 16_000_000 }: LimitesEscala = {},
): number {
  const escala = zoom * Math.min(dpr, dprMaximo);
  const pixels = tamanho.largura * tamanho.altura * escala * escala;
  return pixels > pixelsMaximos ? Math.sqrt(pixelsMaximos / (tamanho.largura * tamanho.altura)) : escala;
}

/**
 * Quais páginas manter desenhadas (as visíveis ± margem) e em que ordem
 * desenhá-las: visíveis primeiro, depois alternando próxima e anterior.
 */
export function planejarPaginas(
  visiveis: readonly number[],
  total: number,
  margem: number,
): { manter: Set<number>; ordem: number[] } {
  if (visiveis.length === 0) return { manter: new Set(), ordem: [] };
  const primeira = Math.min(...visiveis);
  const ultima = Math.max(...visiveis);
  const ordem = [...visiveis];
  for (let d = 1; d <= margem; d++) {
    if (ultima + d <= total) ordem.push(ultima + d);
    if (primeira - d >= 1) ordem.push(primeira - d);
  }
  return { manter: new Set(ordem), ordem };
}

export type TarefaRenderizacao = {
  /** Identifica a tarefa entre chamadas de `definir` (ex.: "pagina:escala"). */
  chave: string;
  executar: (sinal: AbortSignal) => Promise<void>;
};

/**
 * Executa uma renderização por vez. A cada `definir`, a lista de pendentes é
 * trocada; a tarefa em andamento continua se ainda estiver na lista nova e é
 * cancelada se não estiver.
 */
export class FilaRenderizacao {
  private pendentes: TarefaRenderizacao[] = [];
  private atual: { chave: string; controle: AbortController } | null = null;

  definir(tarefas: TarefaRenderizacao[]) {
    if (this.atual && !tarefas.some((t) => t.chave === this.atual!.chave)) {
      this.atual.controle.abort();
      this.atual = null;
    }
    this.pendentes = tarefas.filter((t) => t.chave !== this.atual?.chave);
    this.proxima();
  }

  parar() {
    this.pendentes = [];
    this.atual?.controle.abort();
    this.atual = null;
  }

  private proxima() {
    if (this.atual) return;
    const tarefa = this.pendentes.shift();
    if (!tarefa) return;
    const controle = new AbortController();
    const atual = { chave: tarefa.chave, controle };
    this.atual = atual;
    tarefa
      .executar(controle.signal)
      .catch(() => {
        // Cancelamento ou falha de uma página não pode travar as outras.
      })
      .finally(() => {
        if (this.atual === atual) this.atual = null;
        this.proxima();
      });
  }
}
